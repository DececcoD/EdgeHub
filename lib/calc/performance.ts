/**
 * Closing-line value and performance - PRD Section 6.5.
 */

export function roi(totalNetProfit: number, totalStaked: number): number {
  if (totalStaked === 0) return 0;
  return totalNetProfit / totalStaked;
}

/** Yield is an alias for ROI; the UI must pick one label and use it consistently. */
export const yieldPct = roi;

/**
 * CLV in probability terms: closing implied probability - placed implied
 * probability, for the SAME selection (never compare across sides of a
 * market). Positive means the market moved toward the bettor's side after
 * placement, i.e. a better price than what closed.
 */
export function clvProbability(closingImpliedP: number, placedImpliedP: number): number {
  return closingImpliedP - placedImpliedP;
}

/**
 * CLV as a decimal-odds ratio. Positive indicates the placed price was
 * better than the closing price.
 */
export function clvDecimalRatio(placedDecimalOdds: number, closingDecimalOdds: number): number {
  return placedDecimalOdds / closingDecimalOdds - 1;
}

/** Largest peak-to-trough decline in a cumulative net-units series. */
export function maxDrawdown(cumulativeUnitsSeries: number[]): number {
  let peak = -Infinity;
  let worstDrawdown = 0;
  for (const value of cumulativeUnitsSeries) {
    if (value > peak) peak = value;
    const drawdown = peak - value;
    if (drawdown > worstDrawdown) worstDrawdown = drawdown;
  }
  return worstDrawdown;
}

export interface ExposureBucketKey {
  eventId?: string;
  leagueId?: string;
  marketType?: string;
  day?: string;
  correlatedTag?: string;
}

export interface ExposedBet {
  stakeAmount: number;
  eventId: string;
  leagueId: string;
  marketType: string;
  placedAtDay: string; // YYYY-MM-DD
  correlatedTag?: string;
  status: "open" | "won" | "lost" | "push" | "void" | "partial_cash_out" | "full_cash_out";
}

/** Sum open stake grouped by event, league, market type, day, and correlated tag (Section 6.5). */
export function exposureByGroup(bets: ExposedBet[]) {
  const openBets = bets.filter((b) => b.status === "open");
  const group = (keyFn: (b: ExposedBet) => string) => {
    const map = new Map<string, number>();
    for (const bet of openBets) {
      const key = keyFn(bet);
      map.set(key, (map.get(key) ?? 0) + bet.stakeAmount);
    }
    return map;
  };

  return {
    byEvent: group((b) => b.eventId),
    byLeague: group((b) => b.leagueId),
    byMarketType: group((b) => b.marketType),
    byDay: group((b) => b.placedAtDay),
    byCorrelatedTag: group((b) => b.correlatedTag ?? "none"),
    totalOpenStake: openBets.reduce((sum, b) => sum + b.stakeAmount, 0)
  };
}
