/**
 * Pure mapping from Kalshi's wire format to lib/providers/prediction-
 * markets/types.ts's shared canonical shape. No network calls, no
 * persistence - fully testable against fixture JSON (see normalize.test.ts).
 *
 * Phase 2 groundwork (PRD Section 15.2/Appendix C): "Kalshi/Polymarket
 * adapters designed now; UI launched after legal/data review." This file
 * and its sibling client.ts exist so the adapter is ready, not so it's
 * live - nothing in the running app calls normalizeMarkets() today. No
 * ingestion pipeline wiring, no Postgres schema, no UI reads this.
 *
 * Scalar markets (market_type: "scalar") are skipped with a warning, not
 * guessed at - they resolve to a continuous value rather than a discrete
 * Yes/No outcome, so mapping one onto NormalizedPredictionOutcome would be
 * fabricating a shape the instrument doesn't actually have. Only binary
 * markets are normalized.
 */
import type { GetMarketOrderbookResponse, RawKalshiMarket } from "./types";
import type { NormalizedOrderBook, NormalizedPredictionMarket, NormalizedPredictionOutcome, PredictionMarketStatus } from "../prediction-markets/types";

const STATUS_MAP: Record<RawKalshiMarket["status"], PredictionMarketStatus> = {
  initialized: "unknown",
  inactive: "unknown",
  active: "open",
  closed: "closed",
  determined: "resolved",
  disputed: "resolved",
  amended: "resolved",
  finalized: "resolved"
};

function toNumberOrNull(dollars: string | undefined): number | null {
  if (dollars === undefined || dollars === "") return null;
  const n = Number(dollars);
  return Number.isFinite(n) ? n : null;
}

export interface NormalizeMarketsResult {
  markets: NormalizedPredictionMarket[];
  warnings: string[];
}

export function normalizeMarkets(rawMarkets: RawKalshiMarket[]): NormalizeMarketsResult {
  const markets: NormalizedPredictionMarket[] = [];
  const warnings: string[] = [];

  for (const raw of rawMarkets) {
    if (raw.market_type !== "binary") {
      warnings.push(`Market ${raw.ticker}: market_type "${raw.market_type}" is not binary - skipped (no discrete Yes/No outcome to map).`);
      continue;
    }

    const yesOutcome: NormalizedPredictionOutcome = {
      outcomeId: `${raw.ticker}:yes`,
      label: raw.yes_sub_title || "Yes",
      price: toNumberOrNull(raw.last_price_dollars),
      bestBid: toNumberOrNull(raw.yes_bid_dollars),
      bestAsk: toNumberOrNull(raw.yes_ask_dollars)
    };
    // No side has no independent last-trade price on this endpoint - a
    // binary market's Yes/No prices are complementary (1 - yes), but this
    // adapter reports only what the provider actually returned rather than
    // deriving a synthetic "no" price, so it's null unless a real no-side
    // quote exists.
    const noOutcome: NormalizedPredictionOutcome = {
      outcomeId: `${raw.ticker}:no`,
      label: raw.no_sub_title || "No",
      price: null,
      bestBid: toNumberOrNull(raw.no_bid_dollars),
      bestAsk: toNumberOrNull(raw.no_ask_dollars)
    };

    markets.push({
      provider: "kalshi",
      providerMarketId: raw.ticker,
      title: raw.yes_sub_title || raw.ticker,
      closeTime: raw.close_time ?? null,
      status: STATUS_MAP[raw.status] ?? "unknown",
      outcomes: [yesOutcome, noOutcome]
    });
  }

  return { markets, warnings };
}

/** ticker is threaded through explicitly since Kalshi's orderbook response
 * carries no market identifier of its own. */
export function normalizeOrderbook(ticker: string, raw: GetMarketOrderbookResponse): NormalizedOrderBook[] {
  const toLevels = (levels: readonly [string, string][]) =>
    levels.map(([price, size]) => ({ price: Number(price), size: Number(size) }));

  // Kalshi returns bids only for both sides (see types.ts's header comment
  // on GetMarketOrderbookResponse) - there is no separate "asks" array to
  // report, so each side's book here is bids-only by design, not a gap.
  return [
    { outcomeId: `${ticker}:yes`, bids: toLevels(raw.orderbook_fp.yes_dollars), asks: [] },
    { outcomeId: `${ticker}:no`, bids: toLevels(raw.orderbook_fp.no_dollars), asks: [] }
  ];
}
