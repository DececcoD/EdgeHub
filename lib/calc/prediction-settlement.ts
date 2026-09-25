/**
 * Prediction-position settlement P/L - the Tracker equivalent of
 * lib/calc/settlement.ts's settleBet(), for Kalshi/Polymarket positions
 * (Section 15.2's "prediction portfolio"). Deliberately narrower: no
 * cash-out states, since sportsbook cash-out mechanics don't apply to a
 * binary contract that either resolves or doesn't.
 *
 * A share/contract bought at price P (0-1) pays exactly $1 if it resolves
 * in your favor, $0 otherwise - so stakeAmount dollars buys
 * stakeAmount/entryPrice contracts, each worth $1 on a win.
 */
import type { PredictionPositionStatus } from "../types";

export interface PredictionSettlementInput {
  stakeAmount: number;
  entryPrice: number; // 0-1
  status: PredictionPositionStatus;
}

export interface PredictionSettlementResult {
  netProfit: number;
  returnedAmount: number;
  isFinal: boolean;
}

export function settlePredictionPosition(input: PredictionSettlementInput): PredictionSettlementResult {
  const { stakeAmount, entryPrice, status } = input;

  switch (status) {
    case "open":
      return { netProfit: 0, returnedAmount: 0, isFinal: false };

    case "won": {
      const returnedAmount = stakeAmount / entryPrice;
      return { netProfit: returnedAmount - stakeAmount, returnedAmount, isFinal: true };
    }

    case "lost":
      return { netProfit: -stakeAmount, returnedAmount: 0, isFinal: true };

    case "void":
      // Stake returned in full, matching settleBet()'s "push"/"void" - a
      // cancelled/voided market has no gain or loss.
      return { netProfit: 0, returnedAmount: stakeAmount, isFinal: true };

    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled prediction position status: ${exhaustive}`);
    }
  }
}
