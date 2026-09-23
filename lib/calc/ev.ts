/**
 * Edge and expected value - PRD Section 6.3.
 */

/** Edge in percentage points: a difference, never a percent increase. */
export function edgePercentagePoints(pEstimate: number, pImplied: number): number {
  return (pEstimate - pImplied) * 100;
}

/** Net profit per $1 win, excluding the returned stake. */
export function netProfitPerDollarWin(decimalOdds: number): number {
  return decimalOdds - 1;
}

/** Expected net return per $1 staked. */
export function evPerDollar(p: number, decimalOdds: number): number {
  const b = netProfitPerDollarWin(decimalOdds);
  return p * b - (1 - p);
}

export function evPercent(evPerDollarValue: number): number {
  return evPerDollarValue * 100;
}

/** Model/consensus fair price implied by an estimated probability. */
export function fairDecimalOdds(pEstimate: number): number {
  if (pEstimate <= 0 || pEstimate >= 1) throw new Error("Probability must be in (0, 1)");
  return 1 / pEstimate;
}

/** Includes the returned stake. */
export function potentialPayout(stake: number, decimalOdds: number): number {
  return stake * decimalOdds;
}

/** Before tax or fees; excludes the returned stake. */
export function netProfit(stake: number, decimalOdds: number): number {
  return stake * (decimalOdds - 1);
}
