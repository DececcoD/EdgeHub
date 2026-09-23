/**
 * Bet settlement P/L - PRD Section 5.6 (TRK-02): "Support open, won, lost,
 * push, void, partial cash-out, full cash-out. P/L calculation verified for
 * each state."
 *
 * netProfit is always realized profit/loss booked so far (before tax/fees).
 * remainingStake is the portion still at risk (nonzero only for "open" and
 * "partial_cash_out").
 */

import { netProfit as winNetProfit } from "./ev";

export type BetStatus = "open" | "won" | "lost" | "push" | "void" | "partial_cash_out" | "full_cash_out";

export interface SettlementInput {
  stakeAmount: number;
  decimalOdds: number;
  status: BetStatus;
  /** Total cash received for a cash-out (partial or full). */
  cashOutAmount?: number;
  /** For partial cash-out only: the slice of the original stake being cashed out now. */
  cashOutStakePortion?: number;
}

export interface SettlementResult {
  netProfit: number;
  returnedAmount: number;
  remainingStake: number;
  isFinal: boolean;
}

export function settleBet(input: SettlementInput): SettlementResult {
  const { stakeAmount, decimalOdds, status } = input;

  switch (status) {
    case "open":
      return { netProfit: 0, returnedAmount: 0, remainingStake: stakeAmount, isFinal: false };

    case "won":
      return {
        netProfit: winNetProfit(stakeAmount, decimalOdds),
        returnedAmount: stakeAmount * decimalOdds,
        remainingStake: 0,
        isFinal: true
      };

    case "lost":
      return { netProfit: -stakeAmount, returnedAmount: 0, remainingStake: 0, isFinal: true };

    case "push":
    case "void":
      // Stake returned in full; no gain or loss. Matches golden vector:
      // $25 stake -> Net $0; returned $25.
      return { netProfit: 0, returnedAmount: stakeAmount, remainingStake: 0, isFinal: true };

    case "full_cash_out": {
      const cashOutAmount = input.cashOutAmount ?? 0;
      return {
        netProfit: cashOutAmount - stakeAmount,
        returnedAmount: cashOutAmount,
        remainingStake: 0,
        isFinal: true
      };
    }

    case "partial_cash_out": {
      const cashOutAmount = input.cashOutAmount ?? 0;
      const cashOutStakePortion = input.cashOutStakePortion ?? 0;
      if (cashOutStakePortion > stakeAmount) {
        throw new Error("cashOutStakePortion cannot exceed the original stake");
      }
      return {
        netProfit: cashOutAmount - cashOutStakePortion,
        returnedAmount: cashOutAmount,
        remainingStake: stakeAmount - cashOutStakePortion,
        isFinal: false
      };
    }

    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled settlement status: ${exhaustive}`);
    }
  }
}
