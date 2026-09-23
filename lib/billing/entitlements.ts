/**
 * Plan entitlements - PRD Section 3.3.
 *
 * This is the single source of truth for what each plan unlocks. The real
 * Stripe integration (Section 7.1, 11) would sync `Subscription`/
 * `Entitlement` rows from webhooks; in this prototype a user's plan is just
 * a field on the mock session, and every screen reads limits from here.
 */

import type { Plan } from "../types";

export interface PlanEntitlements {
  plan: Plan;
  label: string;
  priceMonthly: number | null;
  oddsComparison: "delayed" | "near_real_time";
  leagueAccess: "limited" | "all";
  maxFavoriteLeagues: number | null;
  opportunityRowsPerDay: number | null; // null = unlimited
  aiExplanationsPerDay: number | null; // null = unlimited (fair use)
  betTrackerLimit: number | null; // null = unlimited
  activeAlertLimit: number;
  lineHistoryDays: number | null; // null = full retained history
  exports: "none" | "csv_monthly" | "csv_api";
  advancedFilters: "limited" | "full";
  arbitrageDisplay: "none" | "phase_gated";
  backtesting: "none" | "phase_gated";
}

export const ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  free: {
    plan: "free",
    label: "Free",
    priceMonthly: 0,
    oddsComparison: "delayed",
    leagueAccess: "limited",
    maxFavoriteLeagues: 2,
    opportunityRowsPerDay: 20,
    aiExplanationsPerDay: 3,
    betTrackerLimit: 50,
    activeAlertLimit: 2,
    lineHistoryDays: 1,
    exports: "none",
    advancedFilters: "limited",
    arbitrageDisplay: "none",
    backtesting: "none"
  },
  pro: {
    plan: "pro",
    label: "Pro",
    priceMonthly: 24.99,
    oddsComparison: "near_real_time",
    leagueAccess: "all",
    maxFavoriteLeagues: null,
    opportunityRowsPerDay: null,
    aiExplanationsPerDay: 30,
    betTrackerLimit: null,
    activeAlertLimit: 25,
    lineHistoryDays: 30,
    exports: "csv_monthly",
    advancedFilters: "full",
    arbitrageDisplay: "none",
    backtesting: "none"
  },
  elite: {
    plan: "elite",
    label: "Elite",
    priceMonthly: 59.99,
    oddsComparison: "near_real_time",
    leagueAccess: "all",
    maxFavoriteLeagues: null,
    opportunityRowsPerDay: null,
    aiExplanationsPerDay: null,
    betTrackerLimit: null,
    activeAlertLimit: 100,
    lineHistoryDays: null,
    exports: "csv_api",
    advancedFilters: "full",
    arbitrageDisplay: "phase_gated",
    backtesting: "phase_gated"
  }
};

export function getEntitlements(plan: Plan): PlanEntitlements {
  return ENTITLEMENTS[plan];
}

/** True if `used` has room for one more unit against a possibly-unlimited (null) daily cap. */
export function hasQuotaRemaining(limit: number | null, used: number): boolean {
  if (limit === null) return true;
  return used < limit;
}
