/**
 * Opportunity Score - PRD Section 6.6.
 *
 * "Score is a ranking aid, not a win probability." Only ever compute this
 * after freshness + completeness gates pass (see freshness.ts). Every
 * component must already be normalized to 0-100 within its league/market
 * cohort before calling this function - that normalization is a
 * statistics/query concern, not part of the pure formula below.
 */

export const OPPORTUNITY_SCORE_VERSION = "opportunity-score-v1";

export const OPPORTUNITY_SCORE_WEIGHTS = {
  edgePercentile: 0.35,
  priceAdvantage: 0.2,
  consensusDepth: 0.15,
  liquidityProxy: 0.1,
  stability: 0.1,
  freshness: 0.1
} as const;

export interface OpportunityScoreComponents {
  /** Percentile rank of this outcome's edge within its league/market cohort, 0-100. */
  edgePercentile: number;
  /** Normalized size of the best-vs-field price advantage across books, 0-100. */
  priceAdvantage: number;
  /** Normalized count/depth of books contributing to consensus, 0-100. */
  consensusDepth: number;
  /** Normalized liquidity/data-availability proxy, 0-100. */
  liquidityProxy: number;
  /** Normalized inverse of recent line volatility, 0-100. */
  stability: number;
  /** Normalized recency of the freshest contributing quote, 0-100. */
  freshness: number;
}

export interface OpportunityScoreResult {
  score: number;
  scoreVersion: typeof OPPORTUNITY_SCORE_VERSION;
  components: OpportunityScoreComponents;
  weights: typeof OPPORTUNITY_SCORE_WEIGHTS;
}

function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function opportunityScore(components: OpportunityScoreComponents): OpportunityScoreResult {
  const weightedSum =
    clamp0to100(components.edgePercentile) * OPPORTUNITY_SCORE_WEIGHTS.edgePercentile +
    clamp0to100(components.priceAdvantage) * OPPORTUNITY_SCORE_WEIGHTS.priceAdvantage +
    clamp0to100(components.consensusDepth) * OPPORTUNITY_SCORE_WEIGHTS.consensusDepth +
    clamp0to100(components.liquidityProxy) * OPPORTUNITY_SCORE_WEIGHTS.liquidityProxy +
    clamp0to100(components.stability) * OPPORTUNITY_SCORE_WEIGHTS.stability +
    clamp0to100(components.freshness) * OPPORTUNITY_SCORE_WEIGHTS.freshness;

  return {
    score: weightedSum,
    scoreVersion: OPPORTUNITY_SCORE_VERSION,
    components,
    weights: OPPORTUNITY_SCORE_WEIGHTS
  };
}
