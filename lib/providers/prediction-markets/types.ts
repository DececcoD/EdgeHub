/**
 * Canonical shape both prediction-market adapters (../kalshi, ../polymarket)
 * normalize into - Phase 2 groundwork (PRD Section 15.2/Appendix C): "Kalshi/
 * Polymarket adapters designed now; UI launched after legal/data review."
 *
 * This is a deliberately separate vocabulary from lib/types.ts's OutcomeView
 * (sportsbook moneyline/spread/total quotes) - the PRD itself calls these out
 * as "Separate adapter[s]" per provider, and the underlying instruments are a
 * different asset class (binary/scalar contracts priced 0-1, not American/
 * decimal odds on a two-sided line). Nothing in the app reads this yet: no
 * ingestion pipeline wiring, no Postgres schema, no UI. See each adapter's
 * client.ts/normalize.ts for what's actually verified against real API docs
 * vs. still a gap.
 */

export type PredictionMarketProvider = "kalshi" | "polymarket";

export type PredictionMarketStatus = "open" | "closed" | "resolved" | "unknown";

export interface NormalizedPredictionOutcome {
  /** Provider-specific: Kalshi's "{ticker}:yes"/"{ticker}:no", Polymarket's CLOB token ID. */
  outcomeId: string;
  label: string; // "Yes" / "No" / a named outcome
  /** 0-1, the contract's current price (~= implied probability). Null if the provider gave no usable quote. */
  price: number | null;
  bestBid: number | null; // 0-1
  bestAsk: number | null; // 0-1
}

export interface NormalizedPredictionMarket {
  provider: PredictionMarketProvider;
  /** Kalshi's market ticker, or Polymarket's conditionId. */
  providerMarketId: string;
  title: string;
  closeTime: string | null; // ISO 8601
  status: PredictionMarketStatus;
  outcomes: NormalizedPredictionOutcome[];
}

export interface NormalizedOrderBookLevel {
  price: number; // 0-1
  size: number; // contracts
}

export interface NormalizedOrderBook {
  outcomeId: string;
  bids: NormalizedOrderBookLevel[];
  asks: NormalizedOrderBookLevel[];
}
