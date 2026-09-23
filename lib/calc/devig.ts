/**
 * No-vig probability - PRD Section 6.2.
 *
 * MVP method: proportional (multiplicative) normalization across mutually
 * exclusive outcomes of the SAME market and the SAME book/consensus set.
 * Never mix market types or books within one overround calculation.
 *
 * The method name/version is stored alongside every consensus snapshot so
 * alternative de-vig methods (e.g. power/Shin) can be introduced later
 * without breaking historical comparability.
 */

export const DEVIG_METHOD = "proportional";
export const DEVIG_METHOD_VERSION = "v1";

export interface DeVigResult {
  probabilities: number[];
  overround: number;
  rawSum: number;
  method: typeof DEVIG_METHOD;
  methodVersion: typeof DEVIG_METHOD_VERSION;
}

/**
 * @param rawImpliedProbabilities raw q_i = 1/decimal_i for each mutually
 * exclusive outcome in one market.
 */
export function deVigProportional(rawImpliedProbabilities: number[]): DeVigResult {
  if (rawImpliedProbabilities.length < 2) {
    throw new Error("De-vig requires at least two mutually exclusive outcomes");
  }
  const rawSum = rawImpliedProbabilities.reduce((sum, q) => sum + q, 0);
  if (rawSum <= 0) throw new Error("Sum of raw implied probabilities must be positive");

  const probabilities = rawImpliedProbabilities.map((q) => q / rawSum);
  const overround = rawSum - 1;

  return {
    probabilities,
    overround,
    rawSum,
    method: DEVIG_METHOD,
    methodVersion: DEVIG_METHOD_VERSION
  };
}
