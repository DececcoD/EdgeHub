/**
 * Freshness states - PRD Section 7.4.
 *
 * "Freshness before flash: stale data must never look current." This is the
 * single gate that the Opportunity Finder, Analyzer and Dashboard all defer
 * to before ranking or highlighting anything as a best price.
 */

export type FreshnessState = "current" | "aging" | "stale" | "partial" | "mapping_review" | "unavailable";

export interface FreshnessInput {
  observedAt: Date;
  now: Date;
  /** Seconds within which a quote is considered fully current for its source/market. */
  targetSlaSeconds: number;
  /** Seconds after which a quote is hard-expired regardless of anything else. */
  hardExpirySeconds: number;
  /** True when required books/outcomes are missing or consensus depth is shallow. */
  isPartial?: boolean;
  /** 0-1 confidence that source entity mapping (team/event/market) is correct. */
  mappingConfidence?: number;
  mappingConfidenceThreshold?: number;
  /** False when the upstream provider/source itself is down. */
  providerAvailable?: boolean;
}

export interface FreshnessResult {
  state: FreshnessState;
  ageSeconds: number;
  rankable: boolean;
}

/** Only "current" (and, with a score penalty upstream, "aging") may be ranked or used as a highlighted best price. */
export function isRankable(state: FreshnessState): boolean {
  return state === "current" || state === "aging";
}

export function computeFreshness(input: FreshnessInput): FreshnessResult {
  const {
    observedAt,
    now,
    targetSlaSeconds,
    hardExpirySeconds,
    isPartial = false,
    mappingConfidence,
    mappingConfidenceThreshold = 0.8,
    providerAvailable = true
  } = input;

  const ageSeconds = Math.max(0, (now.getTime() - observedAt.getTime()) / 1000);

  // Provider outage takes priority - never let a suppressed source pass as current.
  if (!providerAvailable) {
    return { state: "unavailable", ageSeconds, rankable: false };
  }

  // Identity confidence below threshold is hidden from public ranking regardless of age.
  if (mappingConfidence !== undefined && mappingConfidence < mappingConfidenceThreshold) {
    return { state: "mapping_review", ageSeconds, rankable: false };
  }

  if (isPartial) {
    return { state: "partial", ageSeconds, rankable: false };
  }

  if (ageSeconds > hardExpirySeconds) {
    return { state: "stale", ageSeconds, rankable: false };
  }

  if (ageSeconds > targetSlaSeconds) {
    return { state: "aging", ageSeconds, rankable: true };
  }

  return { state: "current", ageSeconds, rankable: true };
}
