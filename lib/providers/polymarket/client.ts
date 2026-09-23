/**
 * HTTP client for Polymarket's public Gamma (market metadata) and CLOB
 * (order books) APIs. Pure transport - no mapping to our canonical shapes
 * here (see normalize.ts), no persistence, no ingestion pipeline wiring
 * (Phase 2 groundwork only - see normalize.ts's header comment).
 *
 * No API key needed for either: both are confirmed public/read-only
 * (docs.polymarket.com/market-data/*.md - no auth section on any of these
 * endpoints, unlike CLOB's trading endpoints). Unlike Kalshi, there is no
 * separate "demo" network here - this is the one real public dataset,
 * since order-book/price reads don't touch trading at all.
 */
import { PolymarketApiError, type GammaMarketsResponse, type RawClobOrderBook } from "./types";

const DEFAULT_GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_BASE_URL = "https://clob.polymarket.com";

function gammaBaseUrl(): string {
  return process.env.POLYMARKET_GAMMA_BASE_URL || DEFAULT_GAMMA_BASE_URL;
}

function clobBaseUrl(): string {
  return process.env.POLYMARKET_CLOB_BASE_URL || DEFAULT_CLOB_BASE_URL;
}

export interface FetchMarketsParams {
  closed?: boolean;
  limit?: number;
  afterCursor?: string;
  tagId?: string;
}

export async function fetchMarkets(params: FetchMarketsParams = {}): Promise<GammaMarketsResponse> {
  const url = new URL(`${gammaBaseUrl()}/markets/keyset`);
  if (params.closed !== undefined) url.searchParams.set("closed", String(params.closed));
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.afterCursor) url.searchParams.set("after_cursor", params.afterCursor);
  if (params.tagId) url.searchParams.set("tag_id", params.tagId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PolymarketApiError(`Failed to fetch Polymarket markets: ${response.status} ${body}`, response.status);
  }
  return (await response.json()) as GammaMarketsResponse;
}

export async function fetchOrderbook(tokenId: string): Promise<RawClobOrderBook> {
  const url = new URL(`${clobBaseUrl()}/book`);
  url.searchParams.set("token_id", tokenId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new PolymarketApiError(`Failed to fetch orderbook for token ${tokenId}: ${response.status} ${body}`, response.status);
  }
  return (await response.json()) as RawClobOrderBook;
}
