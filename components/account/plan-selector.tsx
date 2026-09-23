"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { ENTITLEMENTS } from "@/lib/billing/entitlements";
import { BILLING_MODE } from "@/lib/billing/client-mode";
import type { Plan } from "@/lib/types";

const PLANS: Plan[] = ["free", "pro", "elite"];

async function goToUrl(path: string) {
  const res = await fetch(path, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Request failed.");
  window.location.href = json.data.url as string;
}

export function PlanSelector({ currentPlan }: { currentPlan: Plan }) {
  const router = useRouter();
  const [saving, setSaving] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStripe = BILLING_MODE === "stripe";

  async function switchPlan(plan: Plan) {
    setError(null);
    setSaving(plan);
    try {
      if (isStripe) {
        if (plan === "free") {
          // Downgrading to free means cancelling the active subscription -
          // that only happens through the Stripe-hosted portal, never a
          // direct write from here.
          await goToUrl("/api/v1/account/billing-portal");
        } else {
          await goToUrl("/api/v1/account/checkout");
        }
      } else {
        await fetch("/api/v1/account/plan", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan })
        });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Plan and billing"
        subtitle={
          isStripe
            ? "Billed through Stripe - upgrades open Checkout, downgrades and card changes open the billing portal (Section 7.1, 11)"
            : "Mock billing for this prototype - Stripe Billing wires up here (Section 7.1, 11)"
        }
      />
      {error ? <p className="px-4 pt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const e = ENTITLEMENTS[plan];
          const active = plan === currentPlan;
          return (
            <div
              key={plan}
              className={clsx(
                "flex flex-col gap-2 rounded-xs border p-3 text-sm",
                active ? "border-signal bg-signal-soft dark:bg-signal/10" : "border-paper-200 dark:border-ink-800"
              )}
            >
              <p className="font-display font-semibold">{e.label}</p>
              <p className="font-mono tabular text-lg">{e.priceMonthly === 0 ? "$0" : `$${e.priceMonthly}/mo`}</p>
              <ul className="flex-1 space-y-0.5 text-xs text-paper-muted dark:text-ink-muted">
                <li>{e.opportunityRowsPerDay ?? "Unlimited"} opportunity rows/day</li>
                <li>{e.aiExplanationsPerDay ?? "Unlimited"} AI explanations/day</li>
                <li>{e.activeAlertLimit} active alerts</li>
                <li>{e.lineHistoryDays ? `${e.lineHistoryDays}d` : "Full"} line history</li>
              </ul>
              <Button
                variant={active ? "secondary" : "primary"}
                disabled={active || saving !== null}
                onClick={() => switchPlan(plan)}
              >
                {active ? "Current plan" : saving === plan ? "Switching..." : `Switch to ${e.label}`}
              </Button>
            </div>
          );
        })}
      </div>
      {isStripe ? (
        <div className="border-t border-paper-200 p-4 dark:border-ink-800">
          <Button
            variant="secondary"
            disabled={portalLoading}
            onClick={async () => {
              setError(null);
              setPortalLoading(true);
              try {
                await goToUrl("/api/v1/account/billing-portal");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              } finally {
                setPortalLoading(false);
              }
            }}
          >
            {portalLoading ? "Opening..." : "Manage billing"}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}
