/**
 * Ingestion pipeline - Section 7.3, steps 1-4 (fetch, map to canonical IDs,
 * validate, upsert current + append snapshot) and the ProviderHealth/
 * IngestionRun bookkeeping from Section 8.1 "Operations".
 *
 * Section 7.3 step 5 (recompute consensus/opportunities) is implemented,
 * but as a separate step - see lib/ingest/recompute.ts's
 * persistDerivedSnapshots(), called once after all leagues in a run finish
 * (scripts/ingest.ts), not per-league inside this file, since score
 * percentile is a cohort-wide ranking aid across every market of a type.
 * Steps 6-7 (invalidate cache, evaluate alerts) are still not implemented -
 * there's no cache to invalidate (the read path in lib/db/queries.ts
 * recomputes fresh on every call) and no alert-evaluation job exists yet.
 *
 * Section 11.2's circuit breaker (lib/ingest/circuit-breaker.ts) is wired
 * in here: a run is skipped entirely - never even calls fetchOdds() - once
 * 3 consecutive failures have opened the breaker, until a cooldown elapses.
 */
import type { PrismaClient } from "@prisma/client";
import { fetchOdds } from "../providers/the-odds-api/client";
import { normalizeEvents } from "../providers/the-odds-api/normalize";
import { resolveEvent, resolveMarketAndOutcome, type ResolvedEvent } from "./identity";
import { computeFreshness } from "../calc/freshness";
import { SLA_SECONDS, HARD_EXPIRY_SECONDS } from "../calc/freshness-config";
import { shouldSkip, recordSuccess, recordFailure } from "./circuit-breaker";
import type { LeagueKey, MarketType, SportsbookKey } from "../types";

const PROVIDER_KEY = "the-odds-api";

export interface IngestSummary {
  runId: string;
  eventsFetched: number;
  eventsResolved: number;
  eventsSkipped: number;
  snapshotsWritten: number;
  warnings: string[];
  circuitBreakerOpen: boolean;
}

async function getOrThrowId(prisma: PrismaClient, model: "provider" | "sportsbook", key: string): Promise<string> {
  const record =
    model === "provider" ? await prisma.provider.findUnique({ where: { key } }) : await prisma.sportsbook.findUnique({ where: { key } });
  if (!record) {
    throw new Error(`${model} "${key}" is not seeded. Run "npm run db:seed" before ingesting.`);
  }
  return record.id;
}

export async function ingestLeague(
  prisma: PrismaClient,
  params: { league: LeagueKey; markets: MarketType[]; sportsbooks: SportsbookKey[] }
): Promise<IngestSummary> {
  const providerId = await getOrThrowId(prisma, "provider", PROVIDER_KEY);

  if (await shouldSkip(prisma, providerId)) {
    const run = await prisma.ingestionRun.create({
      data: {
        providerId,
        status: "skipped",
        finishedAt: new Date(),
        errorSummary: `Circuit breaker open for "${PROVIDER_KEY}" - skipped without calling the provider. Will retry once the cooldown elapses.`
      }
    });
    return { runId: run.id, eventsFetched: 0, eventsResolved: 0, eventsSkipped: 0, snapshotsWritten: 0, warnings: [], circuitBreakerOpen: true };
  }

  const sportsbookIds = new Map<SportsbookKey, string>(
    await Promise.all(params.sportsbooks.map(async (key) => [key, await getOrThrowId(prisma, "sportsbook", key)] as const))
  );

  const run = await prisma.ingestionRun.create({ data: { providerId, status: "running" } });
  const startedAt = Date.now();

  try {
    const fetched = await fetchOdds({ league: params.league, markets: params.markets, sportsbooks: params.sportsbooks });
    const { events, quotes, warnings } = normalizeEvents(fetched.events, fetched.observedAt);

    const resolvedByProviderEventId = new Map<string, ResolvedEvent | null>();
    for (const event of events) {
      resolvedByProviderEventId.set(event.providerEventId, await resolveEvent(prisma, providerId, event));
    }

    let snapshotsWritten = 0;
    for (const quote of quotes) {
      const resolved = resolvedByProviderEventId.get(quote.providerEventId);
      if (!resolved) continue; // mapping exception already recorded in resolveEvent/resolveTeam

      const sportsbookId = sportsbookIds.get(quote.sportsbook);
      if (!sportsbookId) continue; // not one of the books this run was scoped to

      const { marketId, outcomeId } = await resolveMarketAndOutcome(prisma, resolved, quote);

      const snapshot = await prisma.oddsSnapshot.create({
        data: {
          providerId,
          sportsbookId,
          marketId,
          outcomeId,
          decimalOdds: quote.decimalOdds,
          americanOdds: quote.americanOdds,
          point: quote.point,
          observedAt: new Date(quote.bookLastUpdate),
          fetchedAt: new Date(quote.fetchedAt),
          sourceQuoteId: `${quote.providerEventId}:${quote.sportsbook}:${quote.marketType}:${quote.side}`
        }
      });

      const freshness = computeFreshness({
        observedAt: snapshot.observedAt,
        now: snapshot.fetchedAt,
        targetSlaSeconds: SLA_SECONDS[quote.marketType],
        hardExpirySeconds: HARD_EXPIRY_SECONDS
      });

      await prisma.currentOdds.upsert({
        where: { outcomeId_sportsbookId: { outcomeId, sportsbookId } },
        update: { snapshotId: snapshot.id, freshnessState: freshness.state },
        create: { outcomeId, sportsbookId, snapshotId: snapshot.id, freshnessState: freshness.state }
      });

      snapshotsWritten += 1;
    }

    const eventsResolved = [...resolvedByProviderEventId.values()].filter(Boolean).length;

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: warnings.length > 0 ? "partial" : "success",
        finishedAt: new Date(),
        recordsProcessed: snapshotsWritten,
        errorSummary: warnings.length > 0 ? warnings.slice(0, 20).join(" | ") : null
      }
    });

    await prisma.providerHealth.upsert({
      where: { providerId },
      update: { quotaRemaining: fetched.quota.remaining, latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() },
      create: { providerId, quotaRemaining: fetched.quota.remaining, latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() }
    });
    await recordSuccess(prisma, providerId);

    return {
      runId: run.id,
      eventsFetched: events.length,
      eventsResolved,
      eventsSkipped: events.length - eventsResolved,
      snapshotsWritten,
      warnings,
      circuitBreakerOpen: false
    };
  } catch (error) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), errorSummary: error instanceof Error ? error.message : String(error) }
    });
    await recordFailure(prisma, providerId);
    throw error;
  }
}
