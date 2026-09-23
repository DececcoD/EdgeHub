/**
 * Broader unit + property-style coverage per PRD Section 14.2 Test Strategy
 * (odds conversions, de-vig, EV, Kelly caps, P/L, CLV, drawdown, score
 * normalization; probability bounds; no negative payouts).
 */
import { describe, expect, it } from "vitest";
import { americanToDecimal, decimalToAmerican, decimalToImpliedProbability } from "./odds";
import { deVigProportional } from "./devig";
import { potentialPayout } from "./ev";
import { settleBet } from "./settlement";
import { clvDecimalRatio, clvProbability, maxDrawdown, roi } from "./performance";
import { opportunityScore, OPPORTUNITY_SCORE_WEIGHTS } from "./score";
import { computeFreshness } from "./freshness";

describe("odds conversion round trips", () => {
  it.each([110, 150, 200, 500])("positive American %d round-trips through decimal", (a) => {
    const decimal = americanToDecimal(a);
    expect(decimalToAmerican(decimal)).toBeCloseTo(a, 6);
  });

  it.each([-110, -150, -200, -500])("negative American %d round-trips through decimal", (a) => {
    const decimal = americanToDecimal(a);
    expect(decimalToAmerican(decimal)).toBeCloseTo(a, 6);
  });

  it("implied probability is always in (0, 1) for any legal decimal price", () => {
    for (const a of [-1000, -300, -110, -101, 101, 110, 300, 1000]) {
      const p = decimalToImpliedProbability(americanToDecimal(a));
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe("de-vig", () => {
  it("three-way market normalizes to exactly 1.0 total probability", () => {
    const raws = [0.45, 0.32, 0.3];
    const result = deVigProportional(raws);
    const total = result.probabilities.reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("overround is positive whenever the book holds an edge", () => {
    const result = deVigProportional([0.55, 0.55]);
    expect(result.overround).toBeGreaterThan(0);
  });
});

describe("settlement P/L never produces a negative payout", () => {
  it.each([
    ["won", 100] as const,
    ["lost", 100] as const,
    ["push", 100] as const,
    ["void", 100] as const
  ])("status=%s stake=%d -> returnedAmount >= 0", (status, stake) => {
    const result = settleBet({ stakeAmount: stake, decimalOdds: 2.5, status });
    expect(result.returnedAmount).toBeGreaterThanOrEqual(0);
  });

  it("lost bet books the full stake as a loss", () => {
    expect(settleBet({ stakeAmount: 40, decimalOdds: 3.0, status: "lost" }).netProfit).toBe(-40);
  });

  it("full cash-out nets the difference between cash-out and stake", () => {
    const result = settleBet({
      stakeAmount: 50,
      decimalOdds: 2.0,
      status: "full_cash_out",
      cashOutAmount: 65
    });
    expect(result.netProfit).toBe(15);
    expect(result.remainingStake).toBe(0);
  });

  it("partial cash-out leaves the un-cashed portion open and at risk", () => {
    const result = settleBet({
      stakeAmount: 100,
      decimalOdds: 2.0,
      status: "partial_cash_out",
      cashOutAmount: 60,
      cashOutStakePortion: 50
    });
    expect(result.netProfit).toBe(10); // 60 received for a 50 stake slice
    expect(result.remainingStake).toBe(50);
    expect(result.isFinal).toBe(false);
  });
});

describe("CLV and drawdown", () => {
  it("positive decimal-ratio CLV means the placed price was better than closing", () => {
    // Placed at 2.20, line shortened to 2.00 by close -> bettor got value.
    expect(clvDecimalRatio(2.2, 2.0)).toBeGreaterThan(0);
  });

  it("CLV probability delta matches the sign convention", () => {
    // Closing implied prob rose relative to placed -> positive CLV.
    expect(clvProbability(0.52, 0.48)).toBeCloseTo(0.04, 10);
  });

  it("max drawdown finds the worst peak-to-trough decline, not just the final dip", () => {
    // Peaks at 10, falls to -5 (drawdown 15), then recovers to 8 (drawdown 2).
    const series = [0, 4, 10, 6, -5, 2, 8];
    expect(maxDrawdown(series)).toBe(15);
  });

  it("ROI of a break-even book is exactly zero", () => {
    expect(roi(0, 500)).toBe(0);
  });
});

describe("opportunity score normalization", () => {
  it("weights sum to 1.0", () => {
    const total = Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it("all-100 components produce a score of exactly 100", () => {
    const result = opportunityScore({
      edgePercentile: 100,
      priceAdvantage: 100,
      consensusDepth: 100,
      liquidityProxy: 100,
      stability: 100,
      freshness: 100
    });
    expect(result.score).toBeCloseTo(100, 10);
  });

  it("out-of-range components are clamped into 0-100 before weighting", () => {
    const result = opportunityScore({
      edgePercentile: 150,
      priceAdvantage: -20,
      consensusDepth: 50,
      liquidityProxy: 50,
      stability: 50,
      freshness: 50
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("freshness gating", () => {
  const now = new Date("2026-09-18T20:00:00Z");

  it("a quote within SLA is current and rankable", () => {
    const result = computeFreshness({
      observedAt: new Date("2026-09-18T19:59:50Z"),
      now,
      targetSlaSeconds: 30,
      hardExpirySeconds: 300
    });
    expect(result.state).toBe("current");
    expect(result.rankable).toBe(true);
  });

  it("a provider outage always wins over age, even for a fresh timestamp", () => {
    const result = computeFreshness({
      observedAt: new Date("2026-09-18T19:59:59Z"),
      now,
      targetSlaSeconds: 30,
      hardExpirySeconds: 300,
      providerAvailable: false
    });
    expect(result.state).toBe("unavailable");
    expect(result.rankable).toBe(false);
  });

  it("low mapping confidence hides a market from ranking regardless of freshness", () => {
    const result = computeFreshness({
      observedAt: new Date("2026-09-18T19:59:59Z"),
      now,
      targetSlaSeconds: 30,
      hardExpirySeconds: 300,
      mappingConfidence: 0.4,
      mappingConfidenceThreshold: 0.8
    });
    expect(result.state).toBe("mapping_review");
    expect(result.rankable).toBe(false);
  });

  it("a hard-expired quote is stale and never reused as current", () => {
    const result = computeFreshness({
      observedAt: new Date("2026-09-18T19:00:00Z"),
      now,
      targetSlaSeconds: 30,
      hardExpirySeconds: 300
    });
    expect(result.state).toBe("stale");
    expect(result.rankable).toBe(false);
  });
});

describe("no negative payouts", () => {
  it("potential payout is never negative for any positive stake/legal odds", () => {
    for (const a of [-500, -110, 110, 500]) {
      expect(potentialPayout(10, americanToDecimal(a))).toBeGreaterThan(0);
    }
  });
});
