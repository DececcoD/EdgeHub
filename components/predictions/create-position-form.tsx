"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function CreatePositionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [form, setForm] = useState({
    provider: "kalshi" as "kalshi" | "polymarket",
    providerMarketId: "",
    marketTitle: "",
    outcomeLabel: "Yes",
    entryPrice: 0.5,
    stakeAmount: 25
  });

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Add a position manually
      </Button>
    );
  }

  return (
    <form
      className="grid grid-cols-2 gap-2 rounded-xs border border-paper-200 bg-paper-50 p-3 text-sm dark:border-ink-800 dark:bg-ink-800 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("saving");
        const res = await fetch("/api/v1/predictions/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (res.ok) {
          setOpen(false);
          setStatus("idle");
          router.refresh();
        } else {
          setStatus("error");
        }
      }}
    >
      <label className="text-xs font-medium">
        Provider
        <select
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value as "kalshi" | "polymarket" })}
        >
          <option value="kalshi">Kalshi</option>
          <option value="polymarket">Polymarket</option>
        </select>
      </label>
      <label className="col-span-2 text-xs font-medium">
        Market
        <input
          required
          placeholder="e.g. Fed cuts rates below 4.50% by December"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.marketTitle}
          onChange={(e) => setForm({ ...form, marketTitle: e.target.value })}
        />
      </label>
      <label className="text-xs font-medium">
        Outcome
        <input
          required
          placeholder="Yes"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.outcomeLabel}
          onChange={(e) => setForm({ ...form, outcomeLabel: e.target.value })}
        />
      </label>
      <label className="col-span-2 text-xs font-medium">
        Market ID (from the provider)
        <input
          required
          placeholder="e.g. FED-25DEC-T4.50"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.providerMarketId}
          onChange={(e) => setForm({ ...form, providerMarketId: e.target.value })}
        />
      </label>
      <label className="text-xs font-medium">
        Entry price (0-1)
        <input
          type="number"
          min={0.01}
          max={0.99}
          step="0.01"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.entryPrice}
          onChange={(e) => setForm({ ...form, entryPrice: Number(e.target.value) })}
        />
      </label>
      <label className="text-xs font-medium">
        Stake ($)
        <input
          type="number"
          min={1}
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.stakeAmount}
          onChange={(e) => setForm({ ...form, stakeAmount: Number(e.target.value) })}
        />
      </label>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
        <Button variant="primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save position"}
        </Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {status === "error" && <span className="text-xs text-risk-text">Could not save - check the entry price is between 0 and 1.</span>}
      </div>
    </form>
  );
}
