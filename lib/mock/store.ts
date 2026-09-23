/**
 * In-memory mock data store.
 *
 * Stands in for the real ingestion pipeline (Section 7.3) + Postgres
 * (Section 8) while USE_MOCK_DATA=true. Everything downstream (API routes,
 * screens) consumes the same shapes the real database would produce, and
 * runs the SAME calculation engine in lib/calc - only the source of the raw
 * odds is fake, not the math applied to it.
 *
 * Rebuilt once per server process from a fixed seed, so demo data and
 * screenshots are stable within a run.
 */

import { LEAGUES, SPORTSBOOKS, type SportsbookDef } from "./catalog";
import { mulberry32, pick, randInt } from "./prng";
import { americanToDecimal, decimalToImpliedProbability } from "../calc/odds";
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

const SEED = 20260916; // PRD version date - stable across restarts.
const rng = mulberry32(SEED);

interface InternalOutcome {
  outcomeId: string;
  marketId: string;
  side: "home" | "away" | "over" | "under";
  label: string;
  point: number | null;
  fairAmerican: number;
  quotesByBook: Map<SportsbookKey, BookQuote>;
  priceHistory: { at: string; decimalOdds: number; gapBefore: boolean }[];
}

interface InternalMarket {
  marketId: string;
  eventId: string;
  marketType: MarketType;
  outcomes: InternalOutcome[];
}

interface InternalEvent {
  event: EventSummary;
  markets: InternalMarket[];
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36)}`;
}

function bookName(key: SportsbookKey): string {
  const book = SPORTSBOOKS.find((b) => b.key === key);
  return book?.name ?? key;
}

/** Generates one book's quote for a single outcome, with realistic per-book variance and freshness spread. */
function generateBookQuote(
  book: SportsbookDef,
  fairAmerican: number,
  marketType: MarketType,
  now: Date
): BookQuote {
  // Each book shades the fair line by a small vig-driven offset plus book-specific noise,
  // so different books legitimately disagree - that disagreement is where edges come from.
  const noise = randInt(rng, -12, 12);
  const american = fairAmerican + noise;

  // Freshness spread: most quotes are current, a minority are aging/stale, a rare few
  // are unavailable/mapping-review so the UI's non-happy-path states are exercised.
  const freshnessRoll = rng();
  let ageSeconds: number;
  let providerAvailable = true;
  let mappingConfidence: number | undefined;

  if (freshnessRoll < 0.82) {
    ageSeconds = randInt(rng, 1, 30);
  } else if (freshnessRoll < 0.93) {
    ageSeconds = randInt(rng, 60, 240);
  } else if (freshnessRoll < 0.97) {
    ageSeconds = randInt(rng, 700, 1200);
  } else if (freshnessRoll < 0.985) {
    providerAvailable = false;
    ageSeconds = randInt(rng, 1, 30);
  } else {
    mappingConfidence = rng() * 0.6; // below threshold
    ageSeconds = randInt(rng, 1, 30);
  }

  const observedAt = new Date(now.getTime() - ageSeconds * 1000);
  const freshness = computeFreshness({
    observedAt,
    now,
    targetSlaSeconds: SLA_SECONDS[marketType],
    hardExpirySeconds: HARD_EXPIRY_SECONDS,
    providerAvailable,
    mappingConfidence,
    mappingConfidenceThreshold: 0.8
  }).state;

  return {
    sportsbookKey: book.key,
    sportsbookName: book.name,
    americanOdds: american,
    decimalOdds: americanToDecimal(american),
    point: null,
    observedAt: observedAt.toISOString(),
    freshness
  };
}

function isEligible(state: FreshnessState): boolean {
  return state === "current" || state === "aging";
}

function buildPriceHistory(rngLocal: () => number, fairDecimal: number, now: Date) {
  const points: { at: string; decimalOdds: number; gapBefore: boolean }[] = [];
  let current = fairDecimal * (0.94 + rngLocal() * 0.12);
  const hours = 18;
  let sawGap = false;
  for (let h = hours; h >= 0; h -= 1) {
    const drift = (rngLocal() - 0.5) * 0.06;
    current = Math.max(1.05, current + drift);
    // Introduce exactly one deliberate data gap for realism (ANL-02).
    const gapBefore = !sawGap && h > 2 && h < hours - 2 && rngLocal() < 0.08;
    if (gapBefore) sawGap = true;
    points.push({
      at: new Date(now.getTime() - h * 3600_000).toISOString(),
      decimalOdds: Math.round(current * 10000) / 10000,
      gapBefore
    });
  }
  return points;
}

function buildEvents(now: Date): InternalEvent[] {
  const events: InternalEvent[] = [];

  for (const league of LEAGUES) {
    const teams: TeamRef[] = league.teams.map((t) => ({ ...t, leagueKey: league.key }));
    const shuffled = [...teams].sort(() => rng() - 0.5);

    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const home = shuffled[i]!;
      const away = shuffled[i + 1]!;
      const startAt = new Date(now.getTime() + randInt(rng, -3, 168) * 3600_000);
      const status: EventSummary["status"] = startAt.getTime() < now.getTime() ? "live" : "scheduled";

      const eventId = nextId("evt");
      const event: EventSummary = {
        id: eventId,
        leagueKey: league.key as LeagueKey,
        home,
        away,
        startAt: startAt.toISOString(),
        status,
        venue: `${home.city} Arena`,
        isOutdoor: league.key === "nfl" || league.key === "mlb"
      };

      const markets: InternalMarket[] = [];

      // Moneyline
      markets.push(
        buildMarket(eventId, "moneyline", [
          { side: "home", label: home.name, point: null, fairAmerican: randInt(rng, -260, 180) },
          { side: "away", label: away.name, point: null, fairAmerican: null }
        ], now)
      );

      // Spread
      const spreadPoint = [3.5, 6.5, 7, 4.5, 2.5][randInt(rng, 0, 4)]!;
      markets.push(
        buildMarket(eventId, "spread", [
          { side: "home", label: `${home.name} -${spreadPoint}`, point: -spreadPoint, fairAmerican: -110 },
          { side: "away", label: `${away.name} +${spreadPoint}`, point: spreadPoint, fairAmerican: -110 }
        ], now)
      );

      // Total
      const totalPoint = league.key === "mlb" ? 8.5 : league.key === "nhl" ? 6 : league.key === "nba" ? 224.5 : 47.5;
      markets.push(
        buildMarket(eventId, "total", [
          { side: "over", label: `Over ${totalPoint}`, point: totalPoint, fairAmerican: -108 },
          { side: "under", label: `Under ${totalPoint}`, point: totalPoint, fairAmerican: -112 }
        ], now)
      );

      events.push({ event, markets });
    }
  }

  return events;
}

function buildMarket(
  eventId: string,
  marketType: MarketType,
  sides: { side: InternalOutcome["side"]; label: string; point: number | null; fairAmerican: number | null }[],
  now: Date
): InternalMarket {
  const marketId = nextId("mkt");

  // For moneyline, derive the away fair price from the home fair price so the
  // pair is internally consistent (mirrors how a book actually prices a match-up).
  const homeFair = sides[0]!.fairAmerican;
  if (marketType === "moneyline" && homeFair !== null) {
    const homeP = decimalToImpliedProbability(americanToDecimal(homeFair));
    const awayP = 1.06 - homeP; // ~6% book margin baked into the "fair" pre-shop line
    const awayDecimal = 1 / Math.max(0.03, awayP);
    sides[1]!.fairAmerican = Math.round(awayDecimal >= 2 ? 100 * (awayDecimal - 1) : -100 / (awayDecimal - 1));
  }

  const outcomes: InternalOutcome[] = sides.map((s) => {
    const outcomeId = nextId("out");
    const fairAmerican = s.fairAmerican ?? -110;
    const quotesByBook = new Map<SportsbookKey, BookQuote>();
    for (const book of SPORTSBOOKS) {
      quotesByBook.set(book.key, generateBookQuote(book, fairAmerican, marketType, now));
    }
    const fairDecimal = americanToDecimal(fairAmerican);
    return {
      outcomeId,
      marketId,
      side: s.side,
      label: s.label,
      point: s.point,
      fairAmerican,
      quotesByBook,
      priceHistory: buildPriceHistory(rng, fairDecimal, now)
    };
  });

  return { marketId, eventId, marketType, outcomes };
}

// ---------------------------------------------------------------------------
// Derived analytics layer - consensus, edge, EV, score. Runs the SAME
// functions the real ingestion pipeline would call (lib/calc/*).
// ---------------------------------------------------------------------------

function computeMarketView(event: EventSummary, market: InternalMarket): MarketView {
  // Step 1: per book, de-vig this market's own outcomes to get that book's fair
  // probability for each side (Section 6.2) - only using eligible (fresh) quotes.
  const bookFairByOutcome = new Map<string, number[]>(); // outcomeId -> [book fair p, ...]

  for (const book of SPORTSBOOKS) {
    const quotes = market.outcomes.map((o) => o.quotesByBook.get(book.key)!);
    const allEligible = quotes.every((q) => isEligible(q.freshness));
    if (!allEligible) continue;

    const rawProbs = quotes.map((q) => decimalToImpliedProbability(q.decimalOdds));
    const deVig = deVigProportional(rawProbs);
    market.outcomes.forEach((o, i) => {
      const arr = bookFairByOutcome.get(o.outcomeId) ?? [];
      arr.push(deVig.probabilities[i]!);
      bookFairByOutcome.set(o.outcomeId, arr);
    });
  }

  const outcomeViews: OutcomeView[] = market.outcomes.map((o) => {
    const quotes = [...o.quotesByBook.values()].sort(
      (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
    );
    const eligibleQuotes = quotes.filter((q) => isEligible(q.freshness));
    const bestQuote =
      eligibleQuotes.length > 0
        ? eligibleQuotes.reduce((best, q) => (q.decimalOdds > best.decimalOdds ? q : best))
        : null;

    const fairSamples = bookFairByOutcome.get(o.outcomeId) ?? [];
    const eligibleBooks = fairSamples.length;
    const hasConsensus = eligibleBooks >= 2;
    const consensusProbability = hasConsensus
      ? fairSamples.reduce((s, p) => s + p, 0) / fairSamples.length
      : null;

    const anyMappingReview = quotes.some((q) => q.freshness === "mapping_review");
    const anyUnavailable = quotes.every((q) => q.freshness === "unavailable");
    const anyStale = eligibleQuotes.length === 0 && !anyUnavailable;

    let dataQuality: OutcomeView["dataQuality"];
    if (anyMappingReview) dataQuality = "mapping_review";
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
      outcomeId: o.outcomeId,
      label: o.label,
      side: o.side,
      point: o.point,
      quotes,
      bestQuote,
      consensus:
        hasConsensus && consensusProbability !== null
          ? { methodVersion: "proportional-v1", probability: consensusProbability, eligibleBooks, overround: 0 }
          : null,
      estimate: consensusProbability !== null ? { source: "consensus", pEstimate: consensusProbability } : null,
      edgePp,
      ev,
      evPercent: evPct,
      score: null,
      scoreVersion: null,
      dataQuality
    };
  });

  return {
    marketId: market.marketId,
    event,
    marketType: market.marketType,
    period: "full_game",
    rulesVersion: "v1",
    outcomes: outcomeViews
  };
}

// ---------------------------------------------------------------------------
// Build once per process.
// ---------------------------------------------------------------------------

const NOW = new Date();
const internalEvents = buildEvents(NOW);
let marketViews: MarketView[] = internalEvents.flatMap((e) => e.markets.map((m) => computeMarketView(e.event, m)));

const internalMarketByMarketId = new Map<string, { event: EventSummary; market: InternalMarket }>();
for (const e of internalEvents) {
  for (const m of e.markets) internalMarketByMarketId.set(m.marketId, { event: e.event, market: m });
}

// Opportunity scoring needs a cohort-relative percentile, so it runs as a
// second pass once every outcome's raw edge/EV is known.
function attachOpportunityScores(views: MarketView[]) {
  const withEdge = views.flatMap((v) =>
    v.outcomes
      .filter((o) => o.edgePp !== null && o.dataQuality === "complete")
      .map((o) => ({ marketType: v.marketType, outcome: o }))
  );

  const cohortEdges = new Map<MarketType, number[]>();
  for (const { marketType, outcome } of withEdge) {
    const arr = cohortEdges.get(marketType) ?? [];
    arr.push(outcome.edgePp!);
    cohortEdges.set(marketType, arr);
  }
  for (const arr of cohortEdges.values()) arr.sort((a, b) => a - b);

  function percentile(marketType: MarketType, value: number): number {
    const arr = cohortEdges.get(marketType) ?? [];
    if (arr.length === 0) return 50;
    let count = 0;
    for (const v of arr) if (v <= value) count += 1;
    return (count / arr.length) * 100;
  }

  for (const view of views) {
    for (const outcome of view.outcomes) {
      if (outcome.edgePp === null || outcome.dataQuality !== "complete" || !outcome.consensus) continue;

      const quotesFresh = outcome.quotes.filter((q) => isEligible(q.freshness));
      const sortedByPrice = [...quotesFresh].sort((a, b) => b.decimalOdds - a.decimalOdds);
      const best = sortedByPrice[0];
      const second = sortedByPrice[1];
      const priceAdvantage =
        best && second ? Math.min(100, ((best.decimalOdds - second.decimalOdds) / best.decimalOdds) * 800) : 0;

      const consensusDepth = Math.min(100, (outcome.consensus.eligibleBooks / SPORTSBOOKS.length) * 100);

      const decimals = outcome.quotes.map((q) => q.decimalOdds);
      const mean = decimals.reduce((s, d) => s + d, 0) / decimals.length;
      const variance = decimals.reduce((s, d) => s + (d - mean) ** 2, 0) / decimals.length;
      const stability = Math.max(0, 100 - variance * 4000);

      const freshestAgeSeconds = quotesFresh.length
        ? Math.min(...quotesFresh.map((q) => (NOW.getTime() - new Date(q.observedAt).getTime()) / 1000))
        : HARD_EXPIRY_SECONDS;
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
}
attachOpportunityScores(marketViews);

// ---------------------------------------------------------------------------
// Public query API - this is the seam a real Postgres-backed repository
// layer would sit behind.
// ---------------------------------------------------------------------------

export function listMarkets(filters?: { leagueKey?: LeagueKey; marketType?: MarketType }): MarketView[] {
  return marketViews.filter(
    (m) =>
      (!filters?.leagueKey || m.event.leagueKey === filters.leagueKey) &&
      (!filters?.marketType || m.marketType === filters.marketType)
  );
}

export function getMarketById(marketId: string): MarketView | null {
  return marketViews.find((m) => m.marketId === marketId) ?? null;
}

export function getPriceHistory(outcomeId: string) {
  for (const e of internalEvents) {
    for (const m of e.markets) {
      const outcome = m.outcomes.find((o) => o.outcomeId === outcomeId);
      if (outcome) return outcome.priceHistory;
    }
  }
  return [];
}

export interface OpportunityFilters {
  leagueKey?: LeagueKey;
  marketType?: MarketType;
  minEdgePp?: number;
  sportsbookKey?: SportsbookKey;
}

export function listOpportunities(filters: OpportunityFilters = {}): OpportunityRow[] {
  const rows: OpportunityRow[] = [];

  for (const view of marketViews) {
    if (filters.leagueKey && view.event.leagueKey !== filters.leagueKey) continue;
    if (filters.marketType && view.marketType !== filters.marketType) continue;

    for (const outcome of view.outcomes) {
      if (outcome.dataQuality !== "complete") continue; // gate: only ranked when complete + fresh
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

export function findOutcome(outcomeId: string): { market: MarketView; outcome: OutcomeView } | null {
  for (const view of marketViews) {
    const outcome = view.outcomes.find((o) => o.outcomeId === outcomeId);
    if (outcome) return { market: view, outcome };
  }
  return null;
}

export interface MappingReviewItem {
  key: string;
  label: string;
  detail: string;
}

/** Admin mapping-review queue (Section 11.1): outcomes with an identity-confidence quote below threshold. */
export function listMappingReviewItems(): MappingReviewItem[] {
  const items: MappingReviewItem[] = [];
  for (const view of marketViews) {
    for (const outcome of view.outcomes) {
      const flagged = outcome.quotes.find((q) => q.freshness === "mapping_review");
      if (flagged) {
        items.push({
          key: outcome.outcomeId,
          label: outcome.label,
          detail: `${view.event.away.name} @ ${view.event.home.name} - ${flagged.sportsbookName}`
        });
      }
    }
  }
  return items;
}

/** Data-health rollup for the Dashboard banner (DASH-04) and Admin system overview. */
export function getFreshnessHealth() {
  let total = 0;
  let healthy = 0;
  for (const view of marketViews) {
    for (const outcome of view.outcomes) {
      for (const quote of outcome.quotes) {
        total += 1;
        if (quote.freshness === "current" || quote.freshness === "aging") healthy += 1;
      }
    }
  }
  return { total, healthy, pctHealthy: total === 0 ? 1 : healthy / total };
}

export function listSportsbooks() {
  return SPORTSBOOKS;
}

export function listLeagues() {
  return LEAGUES.map((l) => ({ key: l.key, name: l.name }));
}

/** Mock mode has no real ProviderHealth row - this is a static, always-healthy stand-in. */
export function getProviderHealth(): ProviderHealthRow[] {
  return [
    {
      providerKey: "the-odds-api",
      providerName: "The Odds API",
      booksCovered: SPORTSBOOKS.map((b) => b.name),
      status: "healthy",
      quotaRemaining: null,
      latencyMs: null,
      lastSuccessAt: null,
      circuitBreakerOpen: false,
      consecutiveFailures: 0
    }
  ];
}

/**
 * Demo affordance standing in for a live provider push (Section 7.3
 * ingestion pipeline): re-quotes a random sample of outcomes as brand-new
 * "current" observations and recomputes consensus/edge/EV/score for just
 * the affected markets, then refreshes the whole opportunity cohort's
 * percentile ranking. Nothing here should be mistaken for a real feed - it
 * exists so the freshness-pulse and price-tick UI has something honest to
 * react to without standing up a websocket for a prototype.
 */
export function simulateMarketTick(sampleSize = 24): { affectedMarkets: number; affectedOutcomes: number } {
  const allOutcomes = internalEvents.flatMap((e) => e.markets.flatMap((m) => m.outcomes.map((o) => ({ e, m, o }))));
  const sample = [...allOutcomes].sort(() => rng() - 0.5).slice(0, Math.min(sampleSize, allOutcomes.length));

  const affectedMarketIds = new Set<string>();
  const now = new Date();

  for (const { m, o } of sample) {
    for (const book of SPORTSBOOKS) {
      o.quotesByBook.set(book.key, generateBookQuote(book, o.fairAmerican, m.marketType, now));
    }
    affectedMarketIds.add(m.marketId);
  }

  marketViews = marketViews.map((view) => {
    if (!affectedMarketIds.has(view.marketId)) return view;
    const entry = internalMarketByMarketId.get(view.marketId)!;
    return computeMarketView(entry.event, entry.market);
  });

  attachOpportunityScores(marketViews);

  return { affectedMarkets: affectedMarketIds.size, affectedOutcomes: sample.length };
}
