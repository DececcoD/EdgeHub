import { describe, expect, it } from "vitest";
import { settlePredictionPosition } from "./prediction-settlement";

describe("settlePredictionPosition", () => {
  it("open: no P/L yet, nothing returned", () => {
    const result = settlePredictionPosition({ stakeAmount: 25, entryPrice: 0.4, status: "open" });
    expect(result).toEqual({ netProfit: 0, returnedAmount: 0, isFinal: false });
  });

  it("won: $25 at 0.40 entry price returns $62.50 (25/0.40), net +$37.50", () => {
    const result = settlePredictionPosition({ stakeAmount: 25, entryPrice: 0.4, status: "won" });
    expect(result.returnedAmount).toBeCloseTo(62.5, 6);
    expect(result.netProfit).toBeCloseTo(37.5, 6);
    expect(result.isFinal).toBe(true);
  });

  it("won at a price near 1 (a near-certain contract) returns close to the stake, small profit", () => {
    const result = settlePredictionPosition({ stakeAmount: 100, entryPrice: 0.95, status: "won" });
    expect(result.returnedAmount).toBeCloseTo(100 / 0.95, 6);
    expect(result.netProfit).toBeCloseTo(100 / 0.95 - 100, 6);
  });

  it("lost: entire stake lost, nothing returned", () => {
    const result = settlePredictionPosition({ stakeAmount: 25, entryPrice: 0.4, status: "lost" });
    expect(result).toEqual({ netProfit: -25, returnedAmount: 0, isFinal: true });
  });

  it("void: stake returned in full, zero net P/L - matches settleBet()'s push/void golden vector shape", () => {
    const result = settlePredictionPosition({ stakeAmount: 30, entryPrice: 0.55, status: "void" });
    expect(result).toEqual({ netProfit: 0, returnedAmount: 30, isFinal: true });
  });

  it("a won contract always nets a positive profit for any valid entry price under 1", () => {
    for (const entryPrice of [0.05, 0.25, 0.5, 0.75, 0.99]) {
      const result = settlePredictionPosition({ stakeAmount: 10, entryPrice, status: "won" });
      expect(result.netProfit).toBeGreaterThan(0);
    }
  });
});
