#!/usr/bin/env tsx
/**
 * Manual prediction-market ingestion run - the Kalshi/Polymarket
 * equivalent of scripts/ingest.ts. Separate script rather than a flag on
 * that one: sportsbook ingestion takes league/market/sportsbook args that
 * don't apply here, and keeping them apart avoids a shared CLI with two
 * unrelated argument shapes.
 *
 * Usage:
 *   npm run ingest:predictions
 *
 * No API key needed - both providers' market-data reads are public (see
 * lib/providers/{kalshi,polymarket}/client.ts). Requires DATABASE_URL
 * (migrated + seeded) to be real.
 *
 * A bare `tsx` process doesn't auto-load .env the way Next's own dev/
 * build/start commands do - see scripts/ingest.ts's header for the same
 * note. Must be the very first import.
 */
import "dotenv/config";
import "../sentry.server.config";
import { prisma } from "../lib/db/prisma";
import { ingestPredictionProvider, type PredictionProviderKey } from "../lib/ingest/prediction-pipeline";
import { persistPredictionMatches } from "../lib/ingest/prediction-matching-persist";
import { captureException, log } from "../lib/observability";

const PROVIDERS: PredictionProviderKey[] = ["kalshi", "polymarket"];

async function main() {
  log.info("predictions_ingest_started", { providers: PROVIDERS });

  for (const provider of PROVIDERS) {
    try {
      const summary = await ingestPredictionProvider(prisma, provider);
      if (summary.circuitBreakerOpen) {
        log.warn("predictions_ingest_skipped_circuit_breaker_open", { provider });
        process.exitCode = 1;
        continue;
      }
      log.info("predictions_ingest_provider_completed", {
        provider,
        runId: summary.runId,
        marketsFetched: summary.marketsFetched,
        marketsWritten: summary.marketsWritten,
        warnings: summary.warnings
      });
    } catch (error) {
      captureException(error, { provider, stage: "ingestPredictionProvider" });
      process.exitCode = 1;
    }
  }

  // Matching compares markets to EACH OTHER, so it only makes sense once
  // per run, after both providers have ingested - not per-provider inside
  // the loop above.
  try {
    const matchSummary = await persistPredictionMatches(prisma);
    log.info("predictions_matches_persisted", { ...matchSummary });
  } catch (error) {
    captureException(error, { stage: "persistPredictionMatches" });
    process.exitCode = 1;
  }

  await prisma.$disconnect();
  process.exit(process.exitCode ?? 0);
}

main();
