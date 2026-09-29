#!/usr/bin/env tsx
/**
 * Manual results-ingestion run - the "who actually won" counterpart to
 * scripts/ingest.ts, feeding Section 5.6's automatic settlement
 * (lib/tracker/settlement.ts). Same manual-CLI-now/real-scheduler-later
 * posture as scripts/ingest.ts.
 *
 * Usage:
 *   npm run ingest:results -- --league nfl
 *   npm run ingest:results -- --league nfl,nba,mlb,nhl
 *
 * Requires DATABASE_URL (migrated + seeded) and ODDS_PROVIDER_API_KEY to be
 * real, and only ever matches events this same key already ingested odds
 * for (see lib/ingest/results-pipeline.ts's header) - running this before
 * `npm run ingest` for the same league will correctly match nothing.
 */
import "dotenv/config";
import "../sentry.server.config";
import { prisma } from "../lib/db/prisma";
import { ingestResultsForLeague } from "../lib/ingest/results-pipeline";
import { captureException, log } from "../lib/observability";
import type { LeagueKey } from "../lib/types";

const ALL_LEAGUES: LeagueKey[] = ["nfl", "nba", "mlb", "nhl"];

function parseLeagueArg(): LeagueKey[] {
  const arg = process.argv.find((a) => a.startsWith("--league"));
  if (!arg) return ALL_LEAGUES;
  const value = arg.includes("=") ? arg.split("=")[1] : process.argv[process.argv.indexOf(arg) + 1];
  const requested = (value ?? "").split(",").map((s) => s.trim()) as LeagueKey[];
  const invalid = requested.filter((l) => !ALL_LEAGUES.includes(l));
  if (invalid.length > 0) {
    throw new Error(`Unknown league(s): ${invalid.join(", ")}. Valid: ${ALL_LEAGUES.join(", ")}`);
  }
  return requested;
}

async function main() {
  if (!process.env.ODDS_PROVIDER_API_KEY) {
    log.error("ODDS_PROVIDER_API_KEY is not set - see .env.example. Nothing to do against mock data.");
    process.exitCode = 1;
    return;
  }

  const leagues = parseLeagueArg();
  log.info("results_ingest_started", { leagues });

  for (const league of leagues) {
    try {
      const summary = await ingestResultsForLeague(prisma, league);
      if (summary.circuitBreakerOpen) {
        log.warn("results_ingest_skipped_circuit_breaker_open", { league });
        process.exitCode = 1;
        continue;
      }
      log.info("results_ingest_league_completed", {
        league,
        runId: summary.runId,
        eventsFetched: summary.eventsFetched,
        eventsCompleted: summary.eventsCompleted,
        eventsMatched: summary.eventsMatched,
        eventsUnmatched: summary.eventsUnmatched
      });
    } catch (error) {
      captureException(error, { league, stage: "ingestResultsForLeague" });
      process.exitCode = 1;
    }
  }

  await prisma.$disconnect();
  process.exit(process.exitCode ?? 0);
}

main();
