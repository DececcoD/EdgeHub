/**
 * Real-result ingestion (Section 5.6's automatic settlement) - the "who
 * actually won" counterpart to lib/ingest/pipeline.ts's odds ingestion.
 * Reuses the exact SourceEntity mapping odds ingestion already wrote
 * (providerId + sourceKey=providerEventId + entityType="event") to find
 * each real game's canonical Event.id - no separate team-name matching
 * needed here, since the odds pipeline already solved identity resolution
 * for the same provider event-ID space. A game the odds pipeline never
 * ingested has no SourceEntity row and is correctly skipped, not
 * fuzzy-guessed - the same "suppress rather than guess" rule
 * lib/ingest/identity.ts already follows.
 *
 * Same ProviderHealth/IngestionRun/circuit-breaker bookkeeping as
 * lib/ingest/pipeline.ts, reusing the same "the-odds-api" provider row -
 * this is the same provider account/quota, just a different endpoint.
 */
import type { PrismaClient } from "@prisma/client";
import { fetchScores } from "../providers/the-odds-api/client";
import { shouldSkip, recordSuccess, recordFailure } from "./circuit-breaker";
import type { LeagueKey } from "../types";

const PROVIDER_KEY = "the-odds-api";

export interface ResultsIngestSummary {
  runId: string;
  eventsFetched: number;
  eventsCompleted: number;
  eventsMatched: number;
  eventsUnmatched: number;
  circuitBreakerOpen: boolean;
}

export async function ingestResultsForLeague(prisma: PrismaClient, league: LeagueKey): Promise<ResultsIngestSummary> {
  const provider = await prisma.provider.findUnique({ where: { key: PROVIDER_KEY } });
  if (!provider) {
    throw new Error(`Provider "${PROVIDER_KEY}" is not seeded. Run "npm run db:seed" before ingesting.`);
  }
  const providerId = provider.id;

  if (await shouldSkip(prisma, providerId)) {
    const run = await prisma.ingestionRun.create({
      data: {
        providerId,
        status: "skipped",
        finishedAt: new Date(),
        errorSummary: `Circuit breaker open for "${PROVIDER_KEY}" - skipped without calling the provider. Will retry once the cooldown elapses.`
      }
    });
    return { runId: run.id, eventsFetched: 0, eventsCompleted: 0, eventsMatched: 0, eventsUnmatched: 0, circuitBreakerOpen: true };
  }

  const run = await prisma.ingestionRun.create({ data: { providerId, status: "running" } });
  const startedAt = Date.now();

  try {
    const { events, quota } = await fetchScores(league);
    const completed = events.filter((e) => e.completed && e.scores && e.scores.length === 2);

    let matched = 0;
    let unmatched = 0;

    for (const scoreEvent of completed) {
      const source = await prisma.sourceEntity.findUnique({
        where: { providerId_sourceKey_entityType: { providerId, sourceKey: scoreEvent.id, entityType: "event" } }
      });
      if (!source?.canonicalEntityId) {
        unmatched += 1; // never ingested for odds either - nothing to settle against
        continue;
      }

      const homeScore = Number(scoreEvent.scores!.find((s) => s.name === scoreEvent.home_team)?.score);
      const awayScore = Number(scoreEvent.scores!.find((s) => s.name === scoreEvent.away_team)?.score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        unmatched += 1; // provider's own team-name labeling didn't match either scores[] entry - don't guess
        continue;
      }

      await prisma.event.update({
        where: { id: source.canonicalEntityId },
        data: { status: "final", homeScore, awayScore }
      });
      matched += 1;
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), recordsProcessed: matched }
    });

    await prisma.providerHealth.upsert({
      where: { providerId },
      update: { quotaRemaining: quota.remaining, latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() },
      create: { providerId, quotaRemaining: quota.remaining, latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() }
    });
    await recordSuccess(prisma, providerId);

    return {
      runId: run.id,
      eventsFetched: events.length,
      eventsCompleted: completed.length,
      eventsMatched: matched,
      eventsUnmatched: unmatched,
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
