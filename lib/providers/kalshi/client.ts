/**
 * HTTP client for Kalshi's Trade API v2. Pure transport - no mapping to our
 * canonical shapes here (see normalize.ts), no persistence, no ingestion
 * pipeline wiring (Phase 2 groundwork only - see this adapter's directory
 * header comment in normalize.ts).
 *
 * Unlike ../the-odds-api/client.ts, this needs NO API key: GetMarkets and
 * GetMarketOrderbook are confirmed public/unauthenticated endpoints
 * (docs.kalshi.com/getting_started/making_your_first_request - auth errors
 * only occur on trading/account endpoints, never on these market-data
 * reads). Defaults to Kalshi's **demo** environment, not production,
 * matching the PRD's own "demo-first testing" direction (Appendix C) - this
 * is real market data mirrored into a sandbox, not fake data, but it's the
 * environment meant for exactly this kind of building/testing.
 */
import { KalshiApiError, type GetMarketOrderbookResponse, type GetMarketsResponse, type KalshiMarketStatus } from "./types";

const DEFAULT_BASE_URL = "https://external-api.demo.kalshi.co/trade-api/v2";

function baseUrl(): string {
  return process.env.KALSHI_API_BASE_URL || DEFAULT_BASE_URL;
}

export interface FetchMarketsParams {
  limit?: number; // 0-1000, provider default 100
  cursor?: string;
  eventTicker?: string;
  status?: KalshiMarketStatus;
}

export async function fetchMarkets(params: FetchMarketsParams = {}): Promise<GetMarketsResponse> {
  const url = new URL(`${baseUrl()}/markets`);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.eventTicker) url.searchParams.set("event_ticker", params.eventTicker);
  if (params.status) url.searchParams.set("status", params.status);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new KalshiApiError(`Failed to fetch Kalshi markets: ${response.status} ${body}`, response.status);
  }
  return (await response.json()) as GetMarketsResponse;
}

export async function fetchOrderbook(ticker: string, depth?: number): Promise<GetMarketOrderbookResponse> {
  const url = new URL(`${baseUrl()}/markets/${ticker}/orderbook`);
  if (depth !== undefined) url.searchParams.set("depth", String(depth));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new KalshiApiError(`Failed to fetch orderbook for ${ticker}: ${response.status} ${body}`, response.status);
  }
  return (await response.json()) as GetMarketOrderbookResponse;
}
