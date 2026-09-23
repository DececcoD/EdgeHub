/**
 * Odds conversion - PRD Section 6.1.
 *
 * All internal math is done at full floating-point precision. Rounding is a
 * display concern only (see format.ts) - never round before storing or
 * chaining another calculation, per the PRD's "keep full precision
 * internally" note.
 */

export class InvalidOddsError extends Error {}

/** American -> decimal. A > 0: d = 1 + A/100. A < 0: d = 1 + 100/|A|. */
export function americanToDecimal(american: number): number {
  if (american === 0) throw new InvalidOddsError("American odds cannot be 0");
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

/**
 * Decimal -> American.
 * d >= 2: A = 100(d-1). d < 2: A = -100/(d-1).
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) throw new InvalidOddsError("Decimal odds must be > 1");
  return decimal >= 2 ? 100 * (decimal - 1) : -100 / (decimal - 1);
}

/** Decimal -> implied probability (pre-de-vig). p = 1/d. */
export function decimalToImpliedProbability(decimal: number): number {
  if (decimal <= 1) throw new InvalidOddsError("Decimal odds must be > 1");
  return 1 / decimal;
}

/**
 * American -> implied probability, using the direct formulas from the PRD
 * (equivalent to decimalToImpliedProbability(americanToDecimal(a)); kept as
 * a direct formula for auditability against the spec table).
 */
export function americanToImpliedProbability(american: number): number {
  if (american === 0) throw new InvalidOddsError("American odds cannot be 0");
  return american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);
}

export function impliedProbabilityToDecimal(p: number): number {
  if (p <= 0 || p >= 1) throw new InvalidOddsError("Probability must be in (0, 1)");
  return 1 / p;
}
