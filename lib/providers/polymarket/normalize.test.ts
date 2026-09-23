/**
 * Fixture matches Polymarket's real documented Gamma Market object shape
 * (verified 2026-09-23 against docs.polymarket.com/market-data/market-
 * details.md, whose own example is reused for the JSON-encoded-string
 * fields - see types.ts's header). This is the one field-shape most worth
 * re-verifying first if a live call ever disagrees with this fixture.
 */
import { describe, expect, it } from "vitest";
import { normalizeMarkets, normalizeOrderbook } from "./normalize";
import type { RawClobOrderBook, RawGammaMarket } from "./types";

const FIXTURE: RawGammaMarket[] = [
  {
    id: "540817",
    conditionId: "0x1fad72fae204143ff1c3035e99e7c0f65ea8d5cd9bd1070987bd1a3316f772be",
    question: "Will the Fed cut rates in December?",
    outcomes: '["Yes", "No"]',
    outcomePrices: '["0.085", "0.915"]',
    clobTokenIds:
      '["107505882767731489358349912513945399569560393482969656700824895970500493757150417", "7305630249804085635496399869905769372294302716159034447326228509068694952392"]',
    active: true,
    closed: false,
    endDate: "2026-12-31T00:00:00Z",
    bestBid: 0.08,
    bestAsk: 0.09
  },
  {
    id: "540818",
    conditionId: "0xclosedmarket",
    question: "Resolved market",
    outcomes: '["Yes", "No"]',
    outcomePrices: '["1", "0"]',
    clobTokenIds: '["tok_yes_resolved", "tok_no_resolved"]',
    active: false,
    closed: true,
    endDate: "2026-01-01T00:00:00Z"
  },
  {
    id: "540819",
    conditionId: "0xmalformed",
    question: "Malformed arrays",
    outcomes: '["Yes", "No", "Maybe"]', // 3 outcomes but only 2 prices - mismatched, should be skipped
    outcomePrices: '["0.5", "0.5"]',
    clobTokenIds: '["tok_a", "tok_b", "tok_c"]',
    active: true,
    closed: false,
    endDate: "2026-12-31T00:00:00Z"
  }
];

describe("normalizeMarkets against a real-shaped Polymarket fixture", () => {
  const result = normalizeMarkets(FIXTURE);

  it("normalizes well-formed markets and skips mismatched-length arrays with a warning", () => {
    expect(result.markets).toHaveLength(2);
    expect(result.markets.map((m) => m.providerMarketId)).toEqual(["0x1fad72fae204143ff1c3035e99e7c0f65ea8d5cd9bd1070987bd1a3316f772be", "0xclosedmarket"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/540819/);
    expect(result.warnings[0]).toMatch(/mismatched lengths/);
  });

  it("parses the JSON-encoded outcomes/prices/tokenIds strings and zips them by index", () => {
    const market = result.markets[0]!;
    expect(market.outcomes).toEqual([
      { outcomeId: "107505882767731489358349912513945399569560393482969656700824895970500493757150417", label: "Yes", price: 0.085, bestBid: 0.08, bestAsk: 0.09 },
      { outcomeId: "7305630249804085635496399869905769372294302716159034447326228509068694952392", label: "No", price: 0.915, bestBid: null, bestAsk: null }
    ]);
  });

  it("maps active/closed to open/closed", () => {
    expect(result.markets[0]!.status).toBe("open");
    expect(result.markets[1]!.status).toBe("closed");
  });

  it("defaults bestBid/bestAsk to null when the market object omits them", () => {
    const resolved = result.markets[1]!;
    expect(resolved.outcomes[0]!.bestBid).toBeNull();
    expect(resolved.outcomes[0]!.bestAsk).toBeNull();
  });

  it("warns instead of throwing when a field isn't valid JSON", () => {
    const broken: RawGammaMarket[] = [{ ...FIXTURE[0]!, outcomes: "not json" }];
    const brokenResult = normalizeMarkets(broken);
    expect(brokenResult.markets).toHaveLength(0);
    expect(brokenResult.warnings[0]).toMatch(/did not parse as JSON arrays/);
  });
});

describe("normalizeOrderbook against a real-shaped Polymarket CLOB fixture", () => {
  const RAW: RawClobOrderBook = {
    market: "0x1fad72fae204143ff1c3035e99e7c0f65ea8d5cd9bd1070987bd1a3316f772be",
    asset_id: "107505882767731489358349912513945399569560393482969656700824895970500493757150417",
    bids: [{ price: "0.08", size: "2151131.59" }],
    asks: [{ price: "0.09", size: "500000.00" }]
  };

  it("parses price/size strings into numbers for both bids and asks", () => {
    const book = normalizeOrderbook(RAW);
    expect(book).toEqual({
      outcomeId: "107505882767731489358349912513945399569560393482969656700824895970500493757150417",
      bids: [{ price: 0.08, size: 2151131.59 }],
      asks: [{ price: 0.09, size: 500000 }]
    });
  });
});
