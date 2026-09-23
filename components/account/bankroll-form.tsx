"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { DEFAULT_MAX_BANKROLL_FRACTION } from "@/lib/calc/kelly";
import type { BankrollSettings } from "@/lib/types";

const MAX_STAKE_PERCENT = DEFAULT_MAX_BANKROLL_FRACTION * 100;

export function BankrollForm({ bankroll }: { bankroll: BankrollSettings | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    startingAmount: bankroll?.startingAmount ?? 1000,
    maxStakePercent: (bankroll?.maxStakeFraction ?? DEFAULT_MAX_BANKROLL_FRACTION) * 100,
    kellySizingEnabled: bankroll?.kellySizingEnabled ?? false
  });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/v1/account/bankroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startingAmount: form.startingAmount,
          maxStakeFraction: form.maxStakePercent / 100,
          kellySizingEnabled: form.kellySizingEnabled
        })
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await fetch("/api/v1/account/bankroll", { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Bankroll & stake sizing"
        subtitle="Optional - a reference amount for risk-management calculations only, never a recommendation to wager"
      />
      <form className="flex flex-col gap-4 p-4 text-sm" onSubmit={save}>
        <label className="text-xs font-medium">
          Starting bankroll ($)
          <input
            type="number"
            min={1}
            step="1"
            className="mt-0.5 block w-full max-w-xs rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.startingAmount}
            onChange={(e) => setForm({ ...form, startingAmount: Number(e.target.value) })}
          />
        </label>

        <label className="text-xs font-medium">
          Max stake per bet (% of bankroll, capped at {MAX_STAKE_PERCENT}%)
          <input
            type="number"
            min={0}
            max={MAX_STAKE_PERCENT}
            step="0.1"
            className="mt-0.5 block w-full max-w-xs rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.maxStakePercent}
            onChange={(e) => setForm({ ...form, maxStakePercent: Math.min(Number(e.target.value), MAX_STAKE_PERCENT) })}
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.kellySizingEnabled}
            onChange={(e) => setForm({ ...form, kellySizingEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium">Show a suggested stake size on opportunity pages</span>
            <br />
            <span className="text-paper-muted dark:text-ink-muted">
              Off by default. Uses fractional Kelly math capped at {MAX_STAKE_PERCENT}% of your bankroll - a sizing
              guide, not advice, and never placed automatically.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save bankroll"}
          </Button>
          {bankroll && (
            <Button variant="ghost" type="button" disabled={removing} onClick={remove}>
              {removing ? "Removing..." : "Remove bankroll"}
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
