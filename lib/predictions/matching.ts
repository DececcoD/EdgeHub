/**
 * Matches a Kalshi market to its Polymarket equivalent for the same real-
 * world proposition - the prediction-market analogue of comparing the
 * same sportsbook outcome across FanDuel/DraftKings/etc. PRD Section 11.1
 * frames this the same way it frames sportsbook identity resolution:
 * "Unmatched/ambiguous teams, events, markets, books; merge/split with
 * audit" - an admin review queue for what an automated pass can't
 * confidently resolve, not a fully automatic system.
 *
 * Deliberately simple and deterministic - normalized-token Jaccard
 * similarity, no ML/embeddings, no stemming (so "cuts" and "cut" don't
 * match each other, a real known limitation, not an oversight) - a stated
 * scope boundary for this pass. Real market titles vary more than these
 * two providers' own wording of the same event, so a production version
 * of this would need admin-driven merge/split (the PRD's own words) for
 * cases this can't confidently resolve, the same way sportsbook mapping
 * exceptions already work (lib/mock/store.ts's listMappingReviewItems()) -
 * not built here, since there's no real ingestion pipeline for these two
 * providers yet to hang a review queue off of.
 */
import type { NormalizedPredictionMarket } from "../providers/prediction-markets/types";

const STOPWORDS = new Set([
  "will", "the", "a", "an", "be", "is", "are", "by", "in", "on", "to", "of", "for", "before", "after", "at", "than"
]);

function tokenize(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersectionSize = 0;
  for (const token of a) if (b.has(token)) intersectionSize += 1;
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** Conservative on purpose - a false match (comparing two unrelated
 * markets as if they were the same bet) is worse than a false negative
 * (an honestly-unmatched market a user can still see on its own). */
export const MATCH_THRESHOLD = 0.35;

export interface MatchedPredictionPair {
  key: string;
  kalshi: NormalizedPredictionMarket;
  polymarket: NormalizedPredictionMarket;
  similarity: number; // 0-1
}

export interface MatchPredictionMarketsResult {
  matched: MatchedPredictionPair[];
  /** From both providers - anything that didn't clear the threshold against anything on the other side. */
  unmatched: NormalizedPredictionMarket[];
}

export function matchPredictionMarkets(markets: NormalizedPredictionMarket[]): MatchPredictionMarketsResult {
  const kalshiMarkets = markets.filter((m) => m.provider === "kalshi");
  const polyMarkets = markets.filter((m) => m.provider === "polymarket");

  const candidates: MatchedPredictionPair[] = [];
  for (const kalshi of kalshiMarkets) {
    const kalshiTokens = tokenize(kalshi.title);
    for (const polymarket of polyMarkets) {
      const similarity = jaccardSimilarity(kalshiTokens, tokenize(polymarket.title));
      if (similarity >= MATCH_THRESHOLD) {
        candidates.push({ key: `${kalshi.providerMarketId}__${polymarket.providerMarketId}`, kalshi, polymarket, similarity });
      }
    }
  }

  // Greedy, highest-confidence-first, one match per market on either
  // side - resolves cases where one market would otherwise pass threshold
  // against more than one candidate on the other side (e.g. a closed
  // market whose title overlaps an open one covering a different date).
  candidates.sort((a, b) => b.similarity - a.similarity);
  const usedKalshi = new Set<string>();
  const usedPoly = new Set<string>();
  const matched: MatchedPredictionPair[] = [];

  for (const candidate of candidates) {
    if (usedKalshi.has(candidate.kalshi.providerMarketId) || usedPoly.has(candidate.polymarket.providerMarketId)) continue;
    usedKalshi.add(candidate.kalshi.providerMarketId);
    usedPoly.add(candidate.polymarket.providerMarketId);
    matched.push(candidate);
  }

  const unmatched = markets.filter((m) =>
    m.provider === "kalshi" ? !usedKalshi.has(m.providerMarketId) : !usedPoly.has(m.providerMarketId)
  );

  return { matched, unmatched };
}
