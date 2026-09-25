import { describe, expect, it } from "vitest";
import { matchPredictionMarkets, MATCH_THRESHOLD } from "./matching";
import { MOCK_PREDICTION_MARKETS } from "./mock-data";
import type { NormalizedPredictionMarket } from "../providers/prediction-markets/types";

function market(overrides: Partial<NormalizedPredictionMarket>): NormalizedPredictionMarket {
  return {
    provider: "kalshi",
    providerMarketId: "x",
    title: "x",
    closeTime: null,
    status: "open",
    outcomes: [],
    ...overrides
  };
}

describe("matchPredictionMarkets against the real seeded fixture set", () => {
  const result = matchPredictionMarkets(MOCK_PREDICTION_MARKETS);

  it("matches the Fed rate-cut pair across providers", () => {
    const pair = result.matched.find((p) => p.kalshi.providerMarketId === "FED-25DEC-T4.50");
    expect(pair).toBeDefined();
    expect(pair!.polymarket.providerMarketId).toBe("0xfed-rate-cut-dec");
    expect(pair!.similarity).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
  });

  it("matches the open S&P 500 pair, not the closed December Kalshi market with the same topic", () => {
    const pair = result.matched.find((p) => p.polymarket.providerMarketId === "0xsp500-6500-jan");
    expect(pair).toBeDefined();
    expect(pair!.kalshi.providerMarketId).toBe("INX-26JAN-T6500"); // the open one, not INX-26JAN-CLOSED
  });

  it("leaves provider-exclusive markets unmatched", () => {
    const unmatchedIds = result.unmatched.map((m) => m.providerMarketId);
    expect(unmatchedIds).toContain("GOV-SHUTDOWN-26"); // Kalshi-only
    expect(unmatchedIds).toContain("0xnext-fed-chair"); // Polymarket-only
  });

  it("leaves the closed December S&P market unmatched rather than double-matching the January Polymarket market", () => {
    expect(result.unmatched.map((m) => m.providerMarketId)).toContain("INX-26JAN-CLOSED");
  });

  it("never matches the same market on either side twice", () => {
    const kalshiIds = result.matched.map((p) => p.kalshi.providerMarketId);
    const polyIds = result.matched.map((p) => p.polymarket.providerMarketId);
    expect(new Set(kalshiIds).size).toBe(kalshiIds.length);
    expect(new Set(polyIds).size).toBe(polyIds.length);
  });

  it("every market appears exactly once, either matched or unmatched", () => {
    const accountedFor = result.matched.length * 2 + result.unmatched.length;
    expect(accountedFor).toBe(MOCK_PREDICTION_MARKETS.length);
  });
});

describe("matchPredictionMarkets on synthetic edge cases", () => {
  it("does not match two completely unrelated titles", () => {
    const markets = [
      market({ provider: "kalshi", providerMarketId: "k1", title: "Will it snow in Chicago on New Year's Day" }),
      market({ provider: "polymarket", providerMarketId: "p1", title: "Who wins the 2027 Masters golf tournament" })
    ];
    const result = matchPredictionMarkets(markets);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it("matches near-identical titles with only minor wording differences", () => {
    const markets = [
      market({ provider: "kalshi", providerMarketId: "k1", title: "Bitcoin above 100000 dollars by March" }),
      market({ provider: "polymarket", providerMarketId: "p1", title: "Will Bitcoin be above 100000 dollars by March 2027" })
    ];
    const result = matchPredictionMarkets(markets);
    expect(result.matched).toHaveLength(1);
  });

  it("is a stated, known limitation that it does not stem words (\"cuts\" vs \"cut\" are different tokens)", () => {
    const markets = [
      market({ provider: "kalshi", providerMarketId: "k1", title: "cuts" }),
      market({ provider: "polymarket", providerMarketId: "p1", title: "cut" })
    ];
    const result = matchPredictionMarkets(markets);
    expect(result.matched).toHaveLength(0); // documenting the limitation, not asserting it's desirable
  });

  it("handles an empty input cleanly", () => {
    const result = matchPredictionMarkets([]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });

  it("leaves a Kalshi market with no Polymarket candidates entirely unmatched", () => {
    const markets = [market({ provider: "kalshi", providerMarketId: "k1", title: "Solo Kalshi market" })];
    const result = matchPredictionMarkets(markets);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });
});
