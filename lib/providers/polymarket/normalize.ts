/**
 * Pure mapping from Polymarket's wire format to lib/providers/prediction-
 * markets/types.ts's shared canonical shape. No network calls, no
 * persistence - fully testable against fixture JSON (see normalize.test.ts).
 *
 * Phase 2 groundwork (PRD Section 15.2/Appendix C): "Kalshi/Polymarket
 * adapters designed now; UI launched after legal/data review." This file
 * and its sibling client.ts exist so the adapter is ready, not so it's
 * live - nothing in the running app calls normalizeMarkets() today. No
 * ingestion pipeline wiring, no Postgres schema, no UI reads this.
 *
 * The one real gotcha (see types.ts's header): `outcomes`, `outcomePrices`,
 * and `clobTokenIds` arrive as JSON-encoded STRINGS, not arrays - each
 * needs its own JSON.parse() before the index-aligned zip that maps a
 * token ID to its outcome label and price. A market whose three fields
 * don't parse to equal-length arrays is skipped with a warning rather than
 * guessed at, since there's no safe way to align a mismatched set.
 */
import type { RawClobOrderBook, RawGammaMarket } from "./types";
import type { NormalizedOrderBook, NormalizedPredictionMarket, NormalizedPredictionOutcome } from "../prediction-markets/types";

function parseJsonArray(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface NormalizeMarketsResult {
  markets: NormalizedPredictionMarket[];
  warnings: string[];
}

export function normalizeMarkets(rawMarkets: RawGammaMarket[]): NormalizeMarketsResult {
  const markets: NormalizedPredictionMarket[] = [];
  const warnings: string[] = [];

  for (const raw of rawMarkets) {
    const outcomes = parseJsonArray(raw.outcomes);
    const prices = parseJsonArray(raw.outcomePrices);
    const tokenIds = parseJsonArray(raw.clobTokenIds);

    if (!outcomes || !prices || !tokenIds) {
      warnings.push(`Market ${raw.id}: outcomes/outcomePrices/clobTokenIds did not parse as JSON arrays - skipped.`);
      continue;
    }
    if (outcomes.length !== prices.length || outcomes.length !== tokenIds.length) {
      warnings.push(`Market ${raw.id}: outcomes/outcomePrices/clobTokenIds have mismatched lengths (${outcomes.length}/${prices.length}/${tokenIds.length}) - skipped, can't safely align by index.`);
      continue;
    }

    const normalizedOutcomes: NormalizedPredictionOutcome[] = outcomes.map((label, i) => {
      const price = Number(prices[i]);
      return {
        outcomeId: tokenIds[i]!,
        label,
        price: Number.isFinite(price) ? price : null,
        // bestBid/bestAsk are market-level fields on the Gamma market object
        // itself (an indicative top-of-book), not per-outcome - Polymarket's
        // binary Yes/No markets only ever expose one side's indicative
        // quote here. See fetchOrderbook()/normalizeOrderbook() for a real
        // per-token order book instead of this indicative figure.
        bestBid: i === 0 ? raw.bestBid ?? null : null,
        bestAsk: i === 0 ? raw.bestAsk ?? null : null
      };
    });

    markets.push({
      provider: "polymarket",
      providerMarketId: raw.conditionId,
      title: raw.question,
      closeTime: raw.endDate ?? null,
      status: raw.closed ? "closed" : raw.active ? "open" : "unknown",
      outcomes: normalizedOutcomes
    });
  }

  return { markets, warnings };
}

export function normalizeOrderbook(raw: RawClobOrderBook): NormalizedOrderBook {
  const toLevels = (levels: RawClobOrderBook["bids"]) => levels.map((l) => ({ price: Number(l.price), size: Number(l.size) }));
  return {
    outcomeId: raw.asset_id,
    bids: toLevels(raw.bids),
    asks: toLevels(raw.asks)
  };
}
