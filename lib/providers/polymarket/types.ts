/**
 * Raw response shapes for Polymarket's two public, unauthenticated APIs -
 * verified 2026-09-23 directly against docs.polymarket.com/market-data/
 * {discover-markets,market-details,prices-order-books}.md. Field names here
 * must match the real API exactly (mirrors ../the-odds-api/types.ts's own
 * convention).
 *
 * Two separate services, both public/read-only, no API key:
 *  - Gamma API (gamma-api.polymarket.com): market/event metadata.
 *  - CLOB API (clob.polymarket.com): order books/prices, keyed by token ID.
 *
 * The one real gotcha, confirmed with a literal example from their own
 * docs page ("Gamma returns the outcome labels, prices, and CLOB token IDs
 * as JSON-encoded arrays"): `outcomes`, `outcomePrices`, and `clobTokenIds`
 * are NOT arrays on the wire - each is a STRING containing JSON-encoded
 * text (e.g. `"[\"Yes\", \"No\"]"`), and must be JSON.parse()'d a second
 * time. Getting this wrong is a silent runtime bug, not a type error - see
 * normalize.ts.
 */

export interface RawGammaMarket {
  id: string;
  conditionId: string;
  question: string;
  /** JSON-encoded string, e.g. `"[\"Yes\", \"No\"]"` - see header comment. */
  outcomes: string;
  /** JSON-encoded string of decimal-string prices, index-aligned with `outcomes`. */
  outcomePrices: string;
  /** JSON-encoded string of CLOB token IDs, index-aligned with `outcomes` - this alignment is how a token ID maps to "Yes" vs "No" (or any named outcome), no separate lookup needed. */
  clobTokenIds: string;
  active: boolean;
  closed: boolean;
  endDate: string; // ISO 8601
  bestBid?: number;
  bestAsk?: number;
}

export interface GammaMarketsResponse {
  markets: RawGammaMarket[];
  next_cursor: string;
}

export interface RawClobPriceLevel {
  price: string; // decimal string, e.g. "0.5500"
  size: string;
}

export interface RawClobOrderBook {
  market: string; // condition ID
  asset_id: string; // token ID
  bids: RawClobPriceLevel[];
  asks: RawClobPriceLevel[];
}

export class PolymarketApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "PolymarketApiError";
  }
}
