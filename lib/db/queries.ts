/**
 * Postgres-backed read layer - the real counterpart to lib/mock/store.ts,
 * exposing the exact same function signatures so callers don't need to
 * know which data source is behind them (see ../data-source.ts).
 *
 * Deliberate scope boundary, stated plainly: consensus/edge/EV/score are
 * computed HERE, at read time, directly from CurrentOdds - exactly like
 * lib/mock/store.ts does from its in-memory quotes, rather than reading
 * back the persisted ConsensusSnapshot/OpportunitySnapshot rows that
 * lib/ingest/recompute.ts writes after each ingestion run. Those rows exist
 * for lineage/audit/historical-analysis (Section 8.1), not to serve reads -
 * recomputing at read time is always at least as fresh as the latest
 * snapshot, so this is still fully correct, just not the "compute once,
 * read cheaply forever" architecture a higher-traffic production system
 * should eventually move to by reading getAllMarketViewsWithScores's output
 * from storage instead of recomputing it below.
 *
 * Smoke-tested against a real, locally containerized Postgres (see
 * DEPLOYMENT.md) with the schema migrated and the catalog seeded but no
 * odds data ingested - confirms every function here runs cleanly against
 * a genuinely empty-but-real database instead of throwing. Not yet
 * exercised with actual odds data flowing through it (that needs a real
 * ODDS_PROVIDER_API_KEY, which doesn't exist in this environment) - that
 * gap is closed by structural parity with lib/mock/store.ts instead (same
 * calc functions, same gating rules, same shapes).
 */
import { cache as reactCache } from "react";
import { prisma } from "./prisma";

/**
 * React's `cache()` only exists under the RSC runtime (Next.js maps "react"
 * to a server-specific build there). Under plain Node - e.g. Vitest, which
 * loads this module transitively through lib/data-source.ts even when
 * USE_MOCK_DATA means it's never called - that import resolves to
 * undefined, and calling it at module-load time throws before any test
 * even runs. Fall back to an identity wrapper outside the RSC runtime.
 */
const cache: typeof reactCache =
  typeof reactCache === "function" ? reactCache : (<T extends (...args: any[]) => any>(fn: T): T => fn) as typeof reactCache;
import { decimalToImpliedProbability } from "../calc/odds";
import { deVigProportional } from "../calc/devig";
import { edgePercentagePoints, evPerDollar, evPercent as toEvPercent } from "../calc/ev";
import { computeFreshness, type FreshnessState } from "../calc/freshness";
import { SLA_SECONDS, HARD_EXPIRY_SECONDS } from "../calc/freshness-config";
import { opportunityScore, OPPORTUNITY_SCORE_VERSION } from "../calc/score";
import type {
  BookQuote,
  EventSummary,
  LeagueKey,
  MarketType,
  MarketView,
  OpportunityRow,
  OutcomeView,
  ProviderHealthRow,
  SportsbookKey,
  TeamRef
} from "../types";

/** MVP scope (Decision Log): exactly these 4 books, matching lib/mock/catalog.ts. */
const MVP_SPORTSBOOKS: SportsbookKey[] = ["fanduel", "draftkings", "betmgm", "caesars"];

function isEligible(state: FreshnessState): boolean {
  return state === "current" || state === "aging";
}

// ---------------------------------------------------------------------------
// Prisma fetch + shape into MarketView (consensus/edge/EV per outcome, no score yet)
// ---------------------------------------------------------------------------

const marketInclude = {
  event: {
    include: {
      league: true,
      participants: { include: { team: true } }
    }
  },
  outcomes: {
    include: {
      currentOdds: { include: { sportsbook: true, snapshot: true } }
    }
  }
} as const;

type MarketRow = NonNullable<Awaited<ReturnType<typeof fetchOneMarketRow>>>;

async function fetchOneMarketRow(marketId: string) {
  return prisma.market.findUnique({ where: { id: marketId }, include: marketInclude });
}

function buildEventSummary(marketRow: { event: any }): EventSummary {
  const event = marketRow.event;
  const homeParticipant = event.participants.find((p: any) => p.side === "home");
  const awayParticipant = event.participants.find((p: any) => p.side === "away");
  const leagueKey = event.league.key as LeagueKey;

  const toTeamRef = (participant: any): TeamRef => ({
    key: participant.team.key,
    name: participant.team.name,
    city: participant.team.city ?? "",
    leagueKey
  });

  const home = toTeamRef(homeParticipant);
  const away = toTeamRef(awayParticipant);

  return {
    id: event.id,
    leagueKey,
    home,
    away,
    startAt: event.canonicalStartAt.toISOString(),
    status: event.status === "final" ? "final" : event.status === "live" ? "live" : "scheduled",
    // Real venue data isn't wired up yet (Venue rows aren't seeded) - same
    // placeholder heuristic the mock layer uses, not a claim of real data.
    venue: `${home.city} Arena`,
    isOutdoor: leagueKey === "nfl" || leagueKey === "mlb"
  };
}

function buildMarketView(marketRow: any): MarketView {
  const event = buildEventSummary(marketRow);
  const marketType = marketRow.marketType as MarketType;
  const now = new Date();

  // Step 1: per book, de-vig this market's own outcomes (Section 6.2) - only
  // using eligible (fresh) quotes, exactly mirroring lib/mock/store.ts.
  const bookFairByOutcome = new Map<string, number[]>();

  for (const bookKey of MVP_SPORTSBOOKS) {
    const perOutcomeQuote = marketRow.outcomes.map((o: any) => {
      const row = o.currentOdds.find((c: any) => c.sportsbook.key === bookKey);
      if (!row) return null;
      const freshness = computeFreshness({
        observedAt: row.snapshot.observedAt,
        now,
        targetSlaSeconds: SLA_SECONDS[marketType],
        hardExpirySeconds: HARD_EXPIRY_SECONDS
      }).state;
      return { outcomeId: o.id, decimalOdds: Number(row.snapshot.decimalOdds), freshness };
    });

    if (perOutcomeQuote.some((q: any) => !q || !isEligible(q.freshness))) continue;

    const rawProbs = perOutcomeQuote.map((q: any) => decimalToImpliedProbability(q.decimalOdds));
    const deVig = deVigProportional(rawProbs);
    perOutcomeQuote.forEach((q: any, i: number) => {
      const arr = bookFairByOutcome.get(q.outcomeId) ?? [];
      arr.push(deVig.probabilities[i]!);
      bookFairByOutcome.set(q.outcomeId, arr);
    });
  }

  const outcomes: OutcomeView[] = marketRow.outcomes.map((o: any) => {
    const quotes: BookQuote[] = o.currentOdds
      .map((row: any) => {
        const freshness = computeFreshness({
          observedAt: row.snapshot.observedAt,
          now,
          targetSlaSeconds: SLA_SECONDS[marketType],
          hardExpirySeconds: HARD_EXPIRY_SECONDS
        }).state;
        return {
          sportsbookKey: row.sportsbook.key as SportsbookKey,
          sportsbookName: row.sportsbook.name,
          americanOdds: row.snapshot.americanOdds,
          decimalOdds: Number(row.snapshot.decimalOdds),
          point: row.snapshot.point !== null ? Number(row.snapshot.point) : null,
          observedAt: row.snapshot.observedAt.toISOString(),
          freshness
        };
      })
      .sort((a: BookQuote, b: BookQuote) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());

    const eligibleQuotes = quotes.filter((q) => isEligible(q.freshness));
    const bestQuote = eligibleQuotes.length > 0 ? eligibleQuotes.reduce((best, q) => (q.decimalOdds > best.decimalOdds ? q : best)) : null;

    const fairSamples = bookFairByOutcome.get(o.id) ?? [];
    const eligibleBooks = fairSamples.length;
    const hasConsensus = eligibleBooks >= 2;
    const consensusProbability = hasConsensus ? fairSamples.reduce((s, p) => s + p, 0) / fairSamples.length : null;

    const anyMappingReview = false; // mapping-review is gated before an Outcome even exists (see lib/ingest/identity.ts) - nothing to flag at read time
    const anyUnavailable = quotes.length > 0 && quotes.every((q) => q.freshness === "unavailable");
    const anyStale = eligibleQuotes.length === 0 && !anyUnavailable && quotes.length > 0;

    let dataQuality: OutcomeView["dataQuality"];
    if (quotes.length === 0) dataQuality = "unavailable";
    else if (anyMappingReview) dataQuality = "mapping_review";
    else if (anyUnavailable) dataQuality = "unavailable";
    else if (anyStale) dataQuality = "stale";
    else if (!hasConsensus) dataQuality = "partial";
    else dataQuality = "complete";

    let edgePp: number | null = null;
    let ev: number | null = null;
    let evPct: number | null = null;
    if (bestQuote && consensusProbability !== null) {
      const pImplied = decimalToImpliedProbability(bestQuote.decimalOdds);
      edgePp = edgePercentagePoints(consensusProbability, pImplied);
      ev = evPerDollar(consensusProbability, bestQuote.decimalOdds);
      evPct = toEvPercent(ev);
    }

    return {
      outcomeId: o.id,
      label: o.label,
      side: o.side,
      point: null, // current point lives on each snapshot, not the Outcome row - see lib/ingest/identity.ts's CURRENT_LINE_KEY note
      quotes,
      bestQuote,
      consensus: hasConsensus && consensusProbability !== null ? { methodVersion: "proportional-v1", probability: consensusProbability, eligibleBooks, overround: 0 } : null,
      estimate: consensusProbability !== null ? { source: "consensus", pEstimate: consensusProbability } : null,
      edgePp,
      ev,
      evPercent: evPct,
      score: null,
      scoreVersion: null,
      dataQuality
    } satisfies OutcomeView;
  });

  return { marketId: marketRow.id, event, marketType, period: "full_game", rulesVersion: marketRow.rulesVersion, outcomes };
}

/**
 * Fetches and scores EVERY market, exactly mirroring lib/mock/store.ts's
 * module-level `marketViews` + `attachOpportunityScores`. Score percentile
 * is a ranking aid computed across the FULL cohort for its market type
 * (not just whatever a caller later filters to) - so this always loads
 * everything, then listMarkets/listOpportunities filter the result, same
 * as the mock version's architecture.
 *
 * Wrapped in React's `cache()` so multiple calls within one request (e.g. a
 * page calling listOpportunities and getFreshnessHealth) share one fetch
 * instead of hitting Postgres twice.
 */
export const getAllMarketViewsWithScores = cache(async (): Promise<MarketView[]> => {
  const marketRows = await prisma.market.findMany({ include: marketInclude });
  const views = marketRows.map(buildMarketView);

  const cohortEdges = new Map<MarketType, number[]>();
  for (const view of views) {
    for (const outcome of view.outcomes) {
      if (outcome.edgePp === null || outcome.dataQuality !== "complete") continue;
      const arr = cohortEdges.get(view.marketType) ?? [];
      arr.push(outcome.edgePp);
      cohortEdges.set(view.marketType, arr);
    }
  }
  for (const arr of cohortEdges.values()) arr.sort((a, b) => a - b);

  function percentile(marketType: MarketType, value: number): number {
    const arr = cohortEdges.get(marketType) ?? [];
    if (arr.length === 0) return 50;
    let count = 0;
    for (const v of arr) if (v <= value) count += 1;
    return (count / arr.length) * 100;
  }

  const now = Date.now();
  for (const view of views) {
    for (const outcome of view.outcomes) {
      if (outcome.edgePp === null || outcome.dataQuality !== "complete" || !outcome.consensus) continue;

      const quotesFresh = outcome.quotes.filter((q) => isEligible(q.freshness));
      const sortedByPrice = [...quotesFresh].sort((a, b) => b.decimalOdds - a.decimalOdds);
      const best = sortedByPrice[0];
      const second = sortedByPrice[1];
      const priceAdvantage = best && second ? Math.min(100, ((best.decimalOdds - second.decimalOdds) / best.decimalOdds) * 800) : 0;

      const consensusDepth = Math.min(100, (outcome.consensus.eligibleBooks / MVP_SPORTSBOOKS.length) * 100);

      const decimals = outcome.quotes.map((q) => q.decimalOdds);
      const mean = decimals.reduce((s, d) => s + d, 0) / decimals.length;
      const variance = decimals.reduce((s, d) => s + (d - mean) ** 2, 0) / decimals.length;
      const stability = Math.max(0, 100 - variance * 4000);

      const freshestAgeSeconds = quotesFresh.length ? Math.min(...quotesFresh.map((q) => (now - new Date(q.observedAt).getTime()) / 1000)) : HARD_EXPIRY_SECONDS;
      const freshnessScore = Math.max(0, 100 - (freshestAgeSeconds / HARD_EXPIRY_SECONDS) * 100);

      const result = opportunityScore({
        edgePercentile: percentile(view.marketType, outcome.edgePp),
        priceAdvantage,
        consensusDepth,
        liquidityProxy: consensusDepth,
        stability,
        freshness: freshnessScore
      });

      outcome.score = result.score;
      outcome.scoreVersion = OPPORTUNITY_SCORE_VERSION;
    }
  }

  return views;
});

// ---------------------------------------------------------------------------
// Public query API - same signatures as lib/mock/store.ts, async throughout.
// ---------------------------------------------------------------------------

export async function listMarkets(filters?: { leagueKey?: LeagueKey; marketType?: MarketType }): Promise<MarketView[]> {
  const views = await getAllMarketViewsWithScores();
  return views.filter((m) => (!filters?.leagueKey || m.event.leagueKey === filters.leagueKey) && (!filters?.marketType || m.marketType === filters.marketType));
}

export async function getMarketById(marketId: string): Promise<MarketView | null> {
  const views = await getAllMarketViewsWithScores();
  return views.find((m) => m.marketId === marketId) ?? null;
}

/**
 * Line history for one outcome, merged across all books rather than one
 * specific book's line - a documented simplification. Gaps are flagged
 * when the time between consecutive observations exceeds an hour, which is
 * generously wider than any market's SLA/hard-expiry window, so normal
 * polling cadence never gets flagged as a gap.
 */
const HISTORY_GAP_THRESHOLD_SECONDS = 3600;

export async function getPriceHistory(outcomeId: string): Promise<{ at: string; decimalOdds: number; gapBefore: boolean }[]> {
  const snapshots = await prisma.oddsSnapshot.findMany({
    where: { outcomeId },
    orderBy: { observedAt: "asc" }
  });

  return snapshots.map((snap, i) => {
    const gapBefore = i > 0 && (snap.observedAt.getTime() - snapshots[i - 1]!.observedAt.getTime()) / 1000 > HISTORY_GAP_THRESHOLD_SECONDS;
    return { at: snap.observedAt.toISOString(), decimalOdds: Number(snap.decimalOdds), gapBefore };
  });
}

export interface OpportunityFilters {
  leagueKey?: LeagueKey;
  marketType?: MarketType;
  minEdgePp?: number;
  sportsbookKey?: SportsbookKey;
}

export async function listOpportunities(filters: OpportunityFilters = {}): Promise<OpportunityRow[]> {
  const views = await getAllMarketViewsWithScores();
  const rows: OpportunityRow[] = [];

  for (const view of views) {
    if (filters.leagueKey && view.event.leagueKey !== filters.leagueKey) continue;
    if (filters.marketType && view.marketType !== filters.marketType) continue;

    for (const outcome of view.outcomes) {
      if (outcome.dataQuality !== "complete") continue;
      if (!outcome.bestQuote || outcome.edgePp === null || outcome.score === null) continue;
      if (filters.minEdgePp !== undefined && outcome.edgePp < filters.minEdgePp) continue;
      if (filters.sportsbookKey && outcome.bestQuote.sportsbookKey !== filters.sportsbookKey) continue;

      rows.push({
        outcomeId: outcome.outcomeId,
        marketId: view.marketId,
        marketType: view.marketType,
        event: view.event,
        outcomeLabel: outcome.label,
        point: outcome.point,
        bestQuote: outcome.bestQuote,
        edgePp: outcome.edgePp,
        evPercent: outcome.evPercent ?? 0,
        score: outcome.score,
        scoreVersion: outcome.scoreVersion ?? OPPORTUNITY_SCORE_VERSION,
        consensusEligibleBooks: outcome.consensus?.eligibleBooks ?? 0,
        dataQuality: "complete",
        edgeSource: "market"
      });
    }
  }

  return rows.sort((a, b) => b.score - a.score);
}

export async function findOutcome(outcomeId: string): Promise<{ market: MarketView; outcome: OutcomeView } | null> {
  const views = await getAllMarketViewsWithScores();
  for (const view of views) {
    const outcome = view.outcomes.find((o) => o.outcomeId === outcomeId);
    if (outcome) return { market: view, outcome };
  }
  return null;
}

export async function listMappingReviewItems(): Promise<{ key: string; label: string; detail: string }[]> {
  // Real mapping exceptions fire BEFORE an outcome/event can be created
  // (see lib/ingest/identity.ts) - there is no resolved event/outcome to
  // show, unlike the mock's flagged-outcome demo concept. That's a real
  // architectural difference, not a shape bug.
  const open = await prisma.mappingException.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
  return open.map((e) => ({ key: e.id, label: `${e.entityType}: "${e.sourceKey}"`, detail: e.reason }));
}

export async function getFreshnessHealth() {
  const views = await getAllMarketViewsWithScores();
  let total = 0;
  let healthy = 0;
  for (const view of views) {
    for (const outcome of view.outcomes) {
      for (const quote of outcome.quotes) {
        total += 1;
        if (isEligible(quote.freshness)) healthy += 1;
      }
    }
  }
  return { total, healthy, pctHealthy: total === 0 ? 1 : healthy / total };
}

export async function listSportsbooks() {
  const books = await prisma.sportsbook.findMany({ where: { key: { in: MVP_SPORTSBOOKS } } });
  return books.map((b) => ({ key: b.key as SportsbookKey, name: b.name }));
}

export async function listLeagues() {
  const leagues = await prisma.league.findMany();
  return leagues.map((l) => ({ key: l.key as LeagueKey, name: l.name }));
}

export async function getProviderHealth(): Promise<ProviderHealthRow[]> {
  const [rows, books] = await Promise.all([
    prisma.providerHealth.findMany({ include: { provider: true } }),
    listSportsbooks()
  ]);
  const booksCovered = books.map((b) => b.name);

  return rows.map((row) => ({
    providerKey: row.provider.key,
    providerName: row.provider.name,
    booksCovered,
    status: row.circuitBreakerOpen ? "down" : row.errorRate > 0.1 ? "degraded" : "healthy",
    quotaRemaining: row.quotaRemaining,
    latencyMs: row.latencyMs,
    lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
    circuitBreakerOpen: row.circuitBreakerOpen,
    consecutiveFailures: row.consecutiveFailures
  }));
}
