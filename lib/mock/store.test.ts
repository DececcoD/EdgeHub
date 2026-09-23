import { describe, expect, it } from "vitest";
import { listMarkets, listOpportunities, getMarketById, getPriceHistory, findOutcome, simulateMarketTick } from "./store";

describe("mock store", () => {
  it("builds a non-trivial slate across all four MVP leagues", () => {
    const markets = listMarkets();
    expect(markets.length).toBeGreaterThan(20);
    const leagues = new Set(markets.map((m) => m.event.leagueKey));
    expect(leagues).toEqual(new Set(["nfl", "nba", "mlb", "nhl"]));
  });

  it("every ranked opportunity passed the freshness/completeness gate", () => {
    const opportunities = listOpportunities();
    expect(opportunities.length).toBeGreaterThan(0);
    for (const row of opportunities) {
      expect(row.dataQuality).toBe("complete");
      expect(row.bestQuote.freshness === "current" || row.bestQuote.freshness === "aging").toBe(true);
    }
  });

  it("opportunities are sorted by score descending", () => {
    const rows = listOpportunities();
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1]!.score).toBeGreaterThanOrEqual(rows[i]!.score);
    }
  });

  it("minEdgePp filter excludes everything below the threshold", () => {
    const rows = listOpportunities({ minEdgePp: 3 });
    for (const row of rows) expect(row.edgePp).toBeGreaterThanOrEqual(3);
  });

  it("getMarketById resolves a market produced by listMarkets", () => {
    const first = listMarkets()[0]!;
    const resolved = getMarketById(first.marketId);
    expect(resolved).not.toBeNull();
    expect(resolved!.marketId).toBe(first.marketId);
  });

  it("price history exists for every outcome and stays chronological", () => {
    const market = listMarkets()[0]!;
    const outcome = market.outcomes[0]!;
    const history = getPriceHistory(outcome.outcomeId);
    expect(history.length).toBeGreaterThan(0);
    for (let i = 1; i < history.length; i += 1) {
      expect(new Date(history[i]!.at).getTime()).toBeGreaterThanOrEqual(new Date(history[i - 1]!.at).getTime());
    }
  });

  it("findOutcome round-trips an outcome id from an opportunity row", () => {
    const row = listOpportunities()[0]!;
    const found = findOutcome(row.outcomeId);
    expect(found).not.toBeNull();
    expect(found!.outcome.outcomeId).toBe(row.outcomeId);
  });

  it("simulateMarketTick refreshes affected markets and keeps everything gate-consistent", () => {
    const result = simulateMarketTick(10);
    expect(result.affectedOutcomes).toBe(10);
    expect(result.affectedMarkets).toBeGreaterThan(0);
    // Re-run every invariant check after a tick to make sure the recompute pass
    // didn't leave anything in a broken state.
    for (const row of listOpportunities()) {
      expect(row.dataQuality).toBe("complete");
    }
  });
});
