import { ENTITLEMENTS } from "@/lib/billing/entitlements";
import Link from "next/link";

export const metadata = { title: "Pricing - EdgeHub" };

export default function PricingPage() {
  const plans = Object.values(ENTITLEMENTS);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-3xl font-bold">Pricing</h1>
      <p className="mt-2 max-w-2xl text-sm text-paper-muted dark:text-ink-muted">
        Every plan is read-only market intelligence. Higher tiers unlock more leagues, faster refresh, and higher
        daily limits - never a better-informed guarantee.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.plan} className="flex flex-col rounded-xs border border-paper-200 p-5 dark:border-ink-800">
            <p className="font-display text-lg font-semibold">{plan.label}</p>
            <p className="mt-1 font-mono tabular text-2xl">{plan.priceMonthly === 0 ? "$0" : `$${plan.priceMonthly}`}<span className="text-sm text-paper-muted dark:text-ink-muted">/mo</span></p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-paper-muted dark:text-ink-muted">
              <li>{plan.oddsComparison === "near_real_time" ? "Near-real-time" : "Delayed/basic"} odds comparison</li>
              <li>{plan.leagueAccess === "all" ? "All MVP leagues" : `${plan.maxFavoriteLeagues} selected leagues`}</li>
              <li>{plan.opportunityRowsPerDay ?? "Unlimited"} opportunity rows/day</li>
              <li>{plan.aiExplanationsPerDay ?? "Unlimited (fair use)"} AI explanations/day</li>
              <li>{plan.betTrackerLimit ?? "Unlimited"} tracked bets</li>
              <li>{plan.activeAlertLimit} active alerts</li>
              <li>{plan.lineHistoryDays ? `${plan.lineHistoryDays}-day` : "Full"} line history</li>
              <li>Exports: {plan.exports === "none" ? "None" : plan.exports === "csv_monthly" ? "CSV, monthly" : "CSV/API-ready"}</li>
            </ul>
            <Link
              href="/signup"
              className="mt-4 rounded-xs bg-ink-950 px-3 py-2 text-center text-sm font-medium text-paper-0 hover:bg-ink-800 dark:bg-signal dark:text-ink-950"
            >
              Start with {plan.label}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-paper-muted dark:text-ink-muted">
        "Near-real-time" is governed by provider rights, polling quotas, processing latency and product SLA - never
        marketed as instantaneous.
      </p>
    </div>
  );
}
