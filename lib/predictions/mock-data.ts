/**
 * Seeded fixture data for the Prediction Markets browse/compare screen -
 * stands in for a real ingestion pipeline the same way lib/mock/store.ts
 * does for sportsbook odds, while the real Kalshi/Polymarket adapters
 * (lib/providers/{kalshi,polymarket}/) stay unwired to any pipeline.
 *
 * Phase 2 build (legal review cleared 2026-09-24, DECISIONS.md items 3-4) -
 * this is a deliberate, disclosed scope choice: mock data proves out the
 * matching logic (matching.ts) and UI end-to-end without needing a second
 * full real-ingestion-pipeline build (identity resolution, circuit
 * breaker, Postgres schema/migrations) for two more providers in the same
 * pass - see README.md's "Prediction markets" section for the full
 * picture of what's built vs. deferred.
 *
 * Hand-written, not procedurally generated (lib/mock/store.ts's own
 * approach for sportsbook odds) - a handful of realistic markets is
 * enough to exercise real matching logic, and hand-written pairs make it
 * easy to see at a glance which ones SHOULD match.
 */
import type { NormalizedPredictionMarket } from "../providers/prediction-markets/types";

export const MOCK_PREDICTION_MARKETS: NormalizedPredictionMarket[] = [
  // --- Matching pair: Fed rate decision ---
  {
    provider: "kalshi",
    providerMarketId: "FED-25DEC-T4.50",
    title: "Fed cuts rates below 4.50% by December",
    closeTime: "2026-12-18T19:00:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "FED-25DEC-T4.50:yes", label: "Yes", price: 0.62, bestBid: 0.61, bestAsk: 0.63 },
      { outcomeId: "FED-25DEC-T4.50:no", label: "No", price: null, bestBid: 0.37, bestAsk: 0.39 }
    ]
  },
  {
    provider: "polymarket",
    providerMarketId: "0xfed-rate-cut-dec",
    title: "Will the Fed cut interest rates below 4.5% before December 2026?",
    closeTime: "2026-12-31T00:00:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "tok_fed_yes", label: "Yes", price: 0.58, bestBid: 0.57, bestAsk: 0.59 },
      { outcomeId: "tok_fed_no", label: "No", price: 0.42, bestBid: 0.41, bestAsk: 0.43 }
    ]
  },

  // --- Matching pair: S&P 500 level ---
  {
    provider: "kalshi",
    providerMarketId: "INX-26JAN-T6500",
    title: "S&P 500 closes above 6500 in January",
    closeTime: "2027-01-31T21:00:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "INX-26JAN-T6500:yes", label: "Yes", price: 0.44, bestBid: 0.43, bestAsk: 0.45 },
      { outcomeId: "INX-26JAN-T6500:no", label: "No", price: null, bestBid: 0.55, bestAsk: 0.57 }
    ]
  },
  {
    provider: "polymarket",
    providerMarketId: "0xsp500-6500-jan",
    title: "Will the S&P 500 close above 6500 in January 2027?",
    closeTime: "2027-01-31T23:59:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "tok_spx_yes", label: "Yes", price: 0.5, bestBid: 0.49, bestAsk: 0.51 },
      { outcomeId: "tok_spx_no", label: "No", price: 0.5, bestBid: 0.49, bestAsk: 0.51 }
    ]
  },

  // --- Unmatched: Kalshi-only ---
  {
    provider: "kalshi",
    providerMarketId: "GOV-SHUTDOWN-26",
    title: "Government shutdown occurs before year end",
    closeTime: "2026-12-31T23:59:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "GOV-SHUTDOWN-26:yes", label: "Yes", price: 0.15, bestBid: 0.14, bestAsk: 0.16 },
      { outcomeId: "GOV-SHUTDOWN-26:no", label: "No", price: null, bestBid: 0.84, bestAsk: 0.86 }
    ]
  },

  // --- Unmatched: Polymarket-only ---
  {
    provider: "polymarket",
    providerMarketId: "0xnext-fed-chair",
    title: "Who will be the next Federal Reserve Chair?",
    closeTime: "2027-02-01T00:00:00Z",
    status: "open",
    outcomes: [
      { outcomeId: "tok_chair_a", label: "Kevin Hassett", price: 0.45, bestBid: 0.44, bestAsk: 0.46 },
      { outcomeId: "tok_chair_b", label: "Christopher Waller", price: 0.3, bestBid: 0.29, bestAsk: 0.31 },
      { outcomeId: "tok_chair_c", label: "Someone else", price: 0.25, bestBid: 0.24, bestAsk: 0.26 }
    ]
  },

  // --- Resolved (closed) market - exercises the "resolved" status path in the UI ---
  {
    provider: "kalshi",
    providerMarketId: "INX-26JAN-CLOSED",
    title: "S&P 500 closes above 6500 in December",
    closeTime: "2026-12-31T21:00:00Z",
    status: "resolved",
    outcomes: [
      { outcomeId: "INX-26JAN-CLOSED:yes", label: "Yes", price: 1, bestBid: 1, bestAsk: 1 },
      { outcomeId: "INX-26JAN-CLOSED:no", label: "No", price: null, bestBid: 0, bestAsk: 0 }
    ]
  }
];

export function listMockPredictionMarkets(): NormalizedPredictionMarket[] {
  return MOCK_PREDICTION_MARKETS;
}
