import { describe, expect, it } from "vitest";
import { ensureDemoUser } from "../auth/user-store";
import { DEFAULT_MAX_BANKROLL_FRACTION } from "../calc/kelly";
import { clearBankroll, getBankroll, listAlerts, listBets, setBankroll } from "./user-data";

describe("demo user seed data", () => {
  const demo = ensureDemoUser();

  it("has a believable bet history across won/lost/push/open", () => {
    const bets = listBets(demo.userId);
    const statuses = new Set(bets.map((b) => b.status));
    expect(statuses).toEqual(new Set(["won", "lost", "push", "open"]));
  });

  it("won bet has positive net profit and lost bet has negative net profit equal to stake", () => {
    const bets = listBets(demo.userId);
    const won = bets.find((b) => b.status === "won")!;
    const lost = bets.find((b) => b.status === "lost")!;
    expect(won.netProfit).toBeGreaterThan(0);
    expect(lost.netProfit).toBe(-lost.stakeAmount);
  });

  it("push bet returns stake with zero net profit", () => {
    const push = listBets(demo.userId).find((b) => b.status === "push")!;
    expect(push.netProfit).toBe(0);
    expect(push.returnedAmount).toBe(push.stakeAmount);
  });

  it("has at least one active alert", () => {
    const alerts = listAlerts(demo.userId);
    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts.every((a) => a.status === "active")).toBe(true);
  });
});

describe("bankroll settings", () => {
  const demo = ensureDemoUser();

  it("is null until set", () => {
    expect(getBankroll("nobody")).toBeNull();
  });

  it("stores what was set and defaults kellySizingEnabled off", () => {
    const settings = setBankroll(demo.userId, { startingAmount: 500, maxStakeFraction: 0.02, kellySizingEnabled: false });
    expect(settings.startingAmount).toBe(500);
    expect(settings.kellySizingEnabled).toBe(false);
    expect(getBankroll(demo.userId)).toEqual(settings);
  });

  it("caps maxStakeFraction at the mandatory ceiling even if a higher value is requested", () => {
    const settings = setBankroll(demo.userId, { startingAmount: 500, maxStakeFraction: 0.5, kellySizingEnabled: true });
    expect(settings.maxStakeFraction).toBe(DEFAULT_MAX_BANKROLL_FRACTION);
  });

  it("clears on removal", () => {
    setBankroll(demo.userId, { startingAmount: 500, maxStakeFraction: 0.02, kellySizingEnabled: false });
    expect(clearBankroll(demo.userId)).toBe(true);
    expect(getBankroll(demo.userId)).toBeNull();
  });
});
