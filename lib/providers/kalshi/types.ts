/**
 * Raw response shapes for Kalshi's Trade API v2 - verified 2026-09-23
 * directly against https://docs.kalshi.com/api-reference/market/get-markets
 * and .../get-market-orderbook (per-field schema quotes, not a live call -
 * no example payloads are published on their docs). Field names here must
 * match the real API exactly; this file has no business logic, only wire
 * format (mirrors ../the-odds-api/types.ts's own convention).
 *
 * Only the fields this adapter actually normalizes are modeled - Kalshi's
 * Market object has several more (rules_primary, price_ranges, etc.) that
 * are out of scope here, same "deliberately narrow, documented" choice as
 * ../the-odds-api/mappings.ts makes for sports/books/markets.
 */

export type KalshiMarketType = "binary" | "scalar";

/** Kalshi's own lifecycle states - deliberately not "unopened/open/paused/
 * closed/settled" (that's the GetMarkets *query filter* enum, a different,
 * coarser vocabulary than the Market object's own `status` field). */
export type KalshiMarketStatus =
  | "initialized"
  | "inactive"
  | "active"
  | "closed"
  | "determined"
  | "disputed"
  | "amended"
  | "finalized";

export type KalshiResult = "yes" | "no" | "scalar" | "";

/** All price/size fields are decimal STRINGS (Kalshi's "FixedPoint" wire
 * convention), e.g. "0.5600" for 56 cents - never numbers on the wire. */
export interface RawKalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: KalshiMarketType;
  yes_sub_title: string;
  no_sub_title: string;
  status: KalshiMarketStatus;
  close_time: string; // ISO 8601
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  last_price_dollars: string;
  result: KalshiResult;
}

export interface GetMarketsResponse {
  markets: RawKalshiMarket[];
  cursor: string;
}

/** A 2-element [price_dollars_string, quantity_string] tuple - NOT an
 * object with named keys. Confirmed against the OpenAPI schema
 * (PriceLevelDollarsCountFp: array, minItems/maxItems 2, items: string). */
export type KalshiPriceLevel = [price: string, quantity: string];

export interface GetMarketOrderbookResponse {
  orderbook_fp: {
    /** Bids only, for both sides - a bid for yes at X is equivalent to an
     * ask for no at (1-X), per Kalshi's own docs, so there is no separate
     * "asks" array on either side. */
    yes_dollars: KalshiPriceLevel[];
    no_dollars: KalshiPriceLevel[];
  };
}

export class KalshiApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "KalshiApiError";
  }
}
