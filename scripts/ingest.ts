#!/usr/bin/env tsx
/**
 * Manual ingestion run. Section 7.1 names Trigger.dev/Inngest as the real
 * scheduled-job runner - this CLI is the groundwork underneath that: once
 * it works correctly run by hand, wiring it to a schedule is a thin wrapper,
 * not a rewrite.
 *
 * Usage:
 *   npm run ingest -- --league nfl
 *   npm run ingest -- --league nfl,nba,mlb,nhl
 *
 * Requires DATABASE_URL (migrated + seeded) and ODDS_PROVIDER_API_KEY to be
 * real - fails fast with a clear message if either is missing, rather than
 * quietly doing nothing.
 */
import { prisma } from "../lib/db/prisma";
import { ingestLeague } from "../lib/ingest/pipeline";
import { persistDerivedSnapshots } from "../lib/ingest/recompute";
import { realtimeBus } from "../lib/realtime/bus";
import type { LeagueKey, MarketType, SportsbookKey } from "../lib/types";

const ALL_LEAGUES: LeagueKey[] = ["nfl", "nba", "mlb", "nhl"];
const ALL_MARKETS: MarketType[] = ["moneyline", "spread", "total"];
const ALL_BOOKS: SportsbookKey[] = ["fanduel", "draftkings", "betmgm", "caesars"];

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
    console.error("ODDS_PROVIDER_API_KEY is not set - see .env.example. Nothing to do against mock data.");
    process.exitCode = 1;
    return;
  }

  const leagues = parseLeagueArg();
  console.log(`Ingesting: ${leagues.join(", ")} | markets: ${ALL_MARKETS.join(", ")} | books: ${ALL_BOOKS.join(", ")}`);

  for (const league of leagues) {
    try {
      const summary = await ingestLeague(prisma, { league, markets: ALL_MARKETS, sportsbooks: ALL_BOOKS });
      if (summary.circuitBreakerOpen) {
        // Distinct from a failure: the breaker did its job and prevented
        // this run from hammering a provider that's already failing
        // repeatedly. Still a nonzero exit so a scheduler watching for
        // "did anything actually happen" notices, just a different message.
        console.warn(`[${league}] skipped - circuit breaker is open for this provider, retrying automatically once its cooldown elapses.`);
        process.exitCode = 1;
        continue;
      }
      console.log(
        `[${league}] run ${summary.runId}: ${summary.eventsFetched} events fetched, ${summary.eventsResolved} resolved, ${summary.eventsSkipped} skipped, ${summary.snapshotsWritten} snapshots written` +
          (summary.warnings.length ? ` (${summary.warnings.length} warnings)` : "")
      );
      for (const warning of summary.warnings) console.warn(`  - ${warning}`);
    } catch (error) {
      console.error(`[${league}] ingestion failed:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  // Recompute + persist consensus/opportunity snapshots once, across every
  // league just ingested - score percentile is a cohort-wide ranking aid, so
  // this has to run after all leagues are in, not per-league.
  let recomputeSummary: { marketsSnapshotted: number; outcomesSnapshotted: number } | null = null;
  try {
    recomputeSummary = await persistDerivedSnapshots(prisma);
    console.log(
      `Snapshots persisted: ${recomputeSummary.marketsSnapshotted} markets, ${recomputeSummary.outcomesSnapshotted} outcomes`
    );
  } catch (error) {
    console.error("Persisting derived snapshots failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }

  // Only reaches a running web server's browsers - and now, also its
  // alert evaluation (lib/alerts/tick-listener.ts) - when REDIS_URL is
  // set. This CLI process and the web server are always separate
  // processes, so an in-memory bus (the default without Redis) can't
  // bridge them. Not fatal either way: a failed/no-op publish shouldn't
  // fail the whole run. Deliberately doesn't call evaluateAlerts()
  // directly here - alerts live in lib/mock/user-data.ts's in-memory
  // store, which belongs to the WEB SERVER process, not this CLI;
  // evaluating them here would only ever see zero alerts. Publishing and
  // letting the web server's own listener react to it is the only way
  // this can work at all, once REDIS_URL bridges the two processes.
  if (recomputeSummary && (recomputeSummary.marketsSnapshotted > 0 || recomputeSummary.outcomesSnapshotted > 0)) {
    try {
      await realtimeBus.publish({
        type: "odds_tick",
        affectedMarkets: recomputeSummary.marketsSnapshotted,
        affectedOutcomes: recomputeSummary.outcomesSnapshotted,
        at: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Publishing odds_tick failed (non-fatal):", error instanceof Error ? error.message : error);
    }
  }

  await prisma.$disconnect();
  // ioredis (used when REDIS_URL is set) keeps a persistent socket open -
  // without an explicit exit, the process would hang after main() resolves
  // instead of returning control to whatever scheduler invoked this CLI.
  process.exit(process.exitCode ?? 0);
}

main();
