/**
 * Fixture matches Kalshi's real documented Market object shape (verified
 * 2026-09-23 against docs.kalshi.com/api-reference/market/get-markets - see
 * types.ts's header). No example payload is published on their docs, so
 * this fixture is built field-by-field from the OpenAPI schema, not copied
 * from a real response - the first thing to re-verify if a live call ever
 * disagrees with it.
 */
import { describe, expect, it } from "vitest";
import { normalizeMarkets, normalizeOrderbook } from "./normalize";
import type { GetMarketOrderbookResponse, RawKalshiMarket } from "./types";

const FIXTURE: RawKalshiMarket[] = [
  {
    ticker: "FED-25DEC-T4.50",
    event_ticker: "FED-25DEC",
    market_type: "binary",
    yes_sub_title: "Fed cuts rates below 4.50% by December",
    no_sub_title: "Fed holds rates at or above 4.50%",
    status: "active",
    close_time: "2026-12-18T19:00:00Z",
    yes_bid_dollars: "0.5400",
    yes_ask_dollars: "0.5600",
    no_bid_dollars: "0.4400",
    no_ask_dollars: "0.4600",
    last_price_dollars: "0.5500",
    result: ""
  },
  {
    ticker: "FED-25DEC-RANGE",
    event_ticker: "FED-25DEC",
    market_type: "scalar",
    yes_sub_title: "Rate range",
    no_sub_title: "",
    status: "active",
    close_time: "2026-12-18T19:00:00Z",
    yes_bid_dollars: "0.0000",
    yes_ask_dollars: "0.0000",
    no_bid_dollars: "0.0000",
    no_ask_dollars: "0.0000",
    last_price_dollars: "0.0000",
    result: ""
  },
  {
    ticker: "INX-26JAN-CLOSED",
    event_ticker: "INX-26JAN",
    market_type: "binary",
    yes_sub_title: "S&P 500 closes above 6500 in January",
    no_sub_title: "S&P 500 closes at or below 6500 in January",
    status: "finalized",
    close_time: "2026-01-31T21:00:00Z",
    yes_bid_dollars: "1.0000",
    yes_ask_dollars: "1.0000",
    no_bid_dollars: "0.0000",
    no_ask_dollars: "0.0000",
    last_price_dollars: "1.0000",
    result: "yes"
  }
];

describe("normalizeMarkets against a real-shaped Kalshi fixture", () => {
  const result = normalizeMarkets(FIXTURE);

  it("normalizes binary markets and skips scalar markets with a warning", () => {
    expect(result.markets).toHaveLength(2);
    expect(result.markets.map((m) => m.providerMarketId)).toEqual(["FED-25DEC-T4.50", "INX-26JAN-CLOSED"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/FED-25DEC-RANGE/);
    expect(result.warnings[0]).toMatch(/scalar/);
  });

  it("maps yes/no dollar strings to numeric 0-1 prices", () => {
    const market = result.markets[0]!;
    expect(market.outcomes).toEqual([
      { outcomeId: "FED-25DEC-T4.50:yes", label: "Fed cuts rates below 4.50% by December", price: 0.55, bestBid: 0.54, bestAsk: 0.56 },
      { outcomeId: "FED-25DEC-T4.50:no", label: "Fed holds rates at or above 4.50%", price: null, bestBid: 0.44, bestAsk: 0.46 }
    ]);
  });

  it("maps active status to open", () => {
    expect(result.markets[0]!.status).toBe("open");
  });

  it("maps finalized status to resolved", () => {
    expect(result.markets[1]!.status).toBe("resolved");
  });

  it("carries close_time through as-is", () => {
    expect(result.markets[0]!.closeTime).toBe("2026-12-18T19:00:00Z");
  });
});

describe("normalizeOrderbook against a real-shaped Kalshi fixture", () => {
  const RAW: GetMarketOrderbookResponse = {
    orderbook_fp: {
      yes_dollars: [
        ["0.5400", "120.00"],
        ["0.5300", "85.00"]
      ],
      no_dollars: [["0.4400", "60.00"]]
    }
  };

  it("parses price/size string tuples into numbers, bids-only per side", () => {
    const [yesBook, noBook] = normalizeOrderbook("FED-25DEC-T4.50", RAW);
    expect(yesBook).toEqual({
      outcomeId: "FED-25DEC-T4.50:yes",
      bids: [
        { price: 0.54, size: 120 },
        { price: 0.53, size: 85 }
      ],
      asks: []
    });
    expect(noBook).toEqual({
      outcomeId: "FED-25DEC-T4.50:no",
      bids: [{ price: 0.44, size: 60 }],
      asks: []
    });
  });
});
