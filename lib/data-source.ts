/**
 * The single seam every screen/route reads through - callers never branch
 * on data source themselves. USE_MOCK_DATA (default "true") picks the
 * implementation. Mock functions are synchronous; wrapped in Promise.
 * resolve() here so the exported interface is async either way, meaning
 * flipping the env var never requires touching a call site.
 */
import * as mock from "./mock/store";
import * as real from "./db/queries";
import type { LeagueKey, MarketType, SportsbookKey } from "./types";

const USE_MOCK = process.env.USE_MOCK_DATA !== "false";

export type { OpportunityFilters } from "./mock/store";
export type { MappingReviewItem } from "./mock/store";

export async function listMarkets(filters?: { leagueKey?: LeagueKey; marketType?: MarketType }) {
  return USE_MOCK ? mock.listMarkets(filters) : real.listMarkets(filters);
}

export async function getMarketById(marketId: string) {
  return USE_MOCK ? mock.getMarketById(marketId) : real.getMarketById(marketId);
}

export async function getPriceHistory(outcomeId: string) {
  return USE_MOCK ? mock.getPriceHistory(outcomeId) : real.getPriceHistory(outcomeId);
}

export async function listOpportunities(filters?: import("./mock/store").OpportunityFilters) {
  return USE_MOCK ? mock.listOpportunities(filters) : real.listOpportunities(filters);
}

export async function findOutcome(outcomeId: string) {
  return USE_MOCK ? mock.findOutcome(outcomeId) : real.findOutcome(outcomeId);
}

export async function listMappingReviewItems() {
  return USE_MOCK ? mock.listMappingReviewItems() : real.listMappingReviewItems();
}

export async function getFreshnessHealth() {
  return USE_MOCK ? mock.getFreshnessHealth() : real.getFreshnessHealth();
}

export async function listSportsbooks(): Promise<{ key: SportsbookKey; name: string }[]> {
  return USE_MOCK ? mock.listSportsbooks() : real.listSportsbooks();
}

export async function listLeagues(): Promise<{ key: LeagueKey; name: string }[]> {
  return USE_MOCK ? mock.listLeagues() : real.listLeagues();
}

export async function getProviderHealth() {
  return USE_MOCK ? mock.getProviderHealth() : real.getProviderHealth();
}

/**
 * Demo-only affordance - see lib/mock/store.ts's docstring. Has no real
 * counterpart: real market updates come from actual ingestion runs
 * (`npm run ingest`), not a button. Throws a clear, catchable error in real
 * mode instead of silently doing nothing.
 */
export async function simulateMarketTick(sampleSize?: number) {
  if (!USE_MOCK) {
    throw new Error(
      "simulateMarketTick is a mock-data-only demo affordance and has no effect in real mode. Real market updates come from running the ingestion pipeline (npm run ingest), not this endpoint."
    );
  }
  return mock.simulateMarketTick(sampleSize);
}
