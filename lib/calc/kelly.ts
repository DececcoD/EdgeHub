/**
 * Bankroll sizing - PRD Section 6.4.
 *
 * SAFETY REQUIREMENT (verbatim from PRD): stake guidance must be framed as a
 * risk-management calculation, not a recommendation to wager. Users can
 * disable sizing entirely - callers should treat every export here as
 * optional, off-by-default guidance, never as instruction.
 */

import { evPerDollar, netProfitPerDollarWin } from "./ev";

export const DEFAULT_FRACTIONAL_MULTIPLIER = 0.25;
export const DEFAULT_MAX_BANKROLL_FRACTION = 0.02;

/**
 * Full Kelly fraction: f* = (b*p - (1-p)) / b.
 * Returns 0 when EV <= 0 - the PRD requires no positive Kelly stake in that
 * case rather than a negative "short" suggestion.
 */
export function fullKelly(p: number, decimalOdds: number): number {
  const b = netProfitPerDollarWin(decimalOdds);
  if (evPerDollar(p, decimalOdds) <= 0) return 0;
  return (b * p - (1 - p)) / b;
}

export function fractionalKelly(
  p: number,
  decimalOdds: number,
  multiplier: number = DEFAULT_FRACTIONAL_MULTIPLIER
): number {
  return fullKelly(p, decimalOdds) * multiplier;
}

export interface StakeSuggestion {
  fullKellyFraction: number;
  fractionalKellyFraction: number;
  cappedFraction: number;
  cappedAmount: number;
  capApplied: boolean;
}

/**
 * Applies the mandatory ceiling: min(user max, 2% bankroll) unless the user
 * has explicitly configured a lower cap.
 */
export function suggestStake(params: {
  p: number;
  decimalOdds: number;
  bankroll: number;
  fractionalMultiplier?: number;
  userMaxFraction?: number;
}): StakeSuggestion {
  const {
    p,
    decimalOdds,
    bankroll,
    fractionalMultiplier = DEFAULT_FRACTIONAL_MULTIPLIER,
    userMaxFraction
  } = params;

  const fullKellyFraction = fullKelly(p, decimalOdds);
  const fractionalKellyFraction = fullKellyFraction * fractionalMultiplier;

  const ceiling = Math.min(userMaxFraction ?? DEFAULT_MAX_BANKROLL_FRACTION, DEFAULT_MAX_BANKROLL_FRACTION);
  const cappedFraction = Math.min(fractionalKellyFraction, ceiling);

  return {
    fullKellyFraction,
    fractionalKellyFraction,
    cappedFraction,
    cappedAmount: cappedFraction * bankroll,
    capApplied: cappedFraction < fractionalKellyFraction
  };
}
