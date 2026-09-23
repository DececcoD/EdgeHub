/**
 * Appendix B - Golden Calculation Vectors.
 * Every case here is copied verbatim from the PRD. If one of these fails,
 * the product is showing users wrong math - treat it as a release blocker,
 * per Section 2.2 "Critical calculation defects: 0".
 */
import { describe, expect, it } from "vitest";
import { americanToDecimal, americanToImpliedProbability, decimalToImpliedProbability } from "./odds";
import { deVigProportional } from "./devig";
import { evPerDollar, evPercent, netProfit, potentialPayout } from "./ev";
import { fullKelly, fractionalKelly, suggestStake } from "./kelly";
import { settleBet } from "./settlement";

const EPS = 1e-4;

describe("Appendix B golden vectors", () => {
  it("Positive American: +150 -> decimal 2.5000; implied 40.0000%", () => {
    const decimal = americanToDecimal(150);
    expect(decimal).toBeCloseTo(2.5, 4);
    expect(americanToImpliedProbability(150) * 100).toBeCloseTo(40.0, 4);
    // Cross-check the two independent formulas agree.
    expect(decimalToImpliedProbability(decimal) * 100).toBeCloseTo(40.0, 4);
  });

  it("Negative American: -200 -> decimal 1.5000; implied 66.6667%", () => {
    const decimal = americanToDecimal(-200);
    expect(decimal).toBeCloseTo(1.5, 4);
    expect(americanToImpliedProbability(-200) * 100).toBeCloseTo(66.6667, 4);
    expect(decimalToImpliedProbability(decimal) * 100).toBeCloseTo(66.6667, 4);
  });

  it("Two-way de-vig: -110 / -110 -> raw 52.381% each; normalized 50.000% each", () => {
    const decimal = americanToDecimal(-110);
    const rawP = decimalToImpliedProbability(decimal);
    expect(rawP * 100).toBeCloseTo(52.381, 3);

    const result = deVigProportional([rawP, rawP]);
    expect(result.probabilities[0]! * 100).toBeCloseTo(50.0, 3);
    expect(result.probabilities[1]! * 100).toBeCloseTo(50.0, 3);
  });

  it("Positive EV: decimal 2.10, p=0.50 -> EV +0.05 per $1; +5.00%", () => {
    const ev = evPerDollar(0.5, 2.1);
    expect(ev).toBeCloseTo(0.05, 4);
    expect(evPercent(ev)).toBeCloseTo(5.0, 4);
  });

  it("Negative EV: decimal 1.80, p=0.50 -> EV -0.10 per $1; -10.00%", () => {
    const ev = evPerDollar(0.5, 1.8);
    expect(ev).toBeCloseTo(-0.1, 4);
    expect(evPercent(ev)).toBeCloseTo(-10.0, 4);
  });

  it("Kelly: decimal 2.00, p=0.55 -> full Kelly 10%; quarter Kelly 2.5%, then cap applies", () => {
    const full = fullKelly(0.55, 2.0);
    expect(full * 100).toBeCloseTo(10.0, 4);

    const quarter = fractionalKelly(0.55, 2.0, 0.25);
    expect(quarter * 100).toBeCloseTo(2.5, 4);

    // Default cap is 2% of bankroll, which is below the 2.5% quarter-Kelly
    // suggestion, so the cap must bind.
    const suggestion = suggestStake({ p: 0.55, decimalOdds: 2.0, bankroll: 1000 });
    expect(suggestion.capApplied).toBe(true);
    expect(suggestion.cappedFraction * 100).toBeCloseTo(2.0, 4);
    expect(suggestion.cappedAmount).toBeCloseTo(20.0, 2);
  });

  it("Win P/L: $25 at +150 -> net +$37.50; payout $62.50", () => {
    const decimal = americanToDecimal(150);
    expect(netProfit(25, decimal)).toBeCloseTo(37.5, 2);
    expect(potentialPayout(25, decimal)).toBeCloseTo(62.5, 2);

    const settled = settleBet({ stakeAmount: 25, decimalOdds: decimal, status: "won" });
    expect(settled.netProfit).toBeCloseTo(37.5, 2);
    expect(settled.returnedAmount).toBeCloseTo(62.5, 2);
  });

  it("Push P/L: $25 stake -> net $0; returned $25", () => {
    const decimal = americanToDecimal(150);
    const settled = settleBet({ stakeAmount: 25, decimalOdds: decimal, status: "push" });
    expect(settled.netProfit).toBe(0);
    expect(settled.returnedAmount).toBe(25);
  });
});
