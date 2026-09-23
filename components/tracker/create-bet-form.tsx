"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { LeagueKey, MarketType, SportsbookKey } from "@/lib/types";

export function CreateBetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [form, setForm] = useState({
    eventLabel: "",
    leagueKey: "nfl" as LeagueKey,
    marketType: "moneyline" as MarketType,
    selectionLabel: "",
    sportsbookKey: "fanduel" as SportsbookKey,
    oddsAmerican: -110,
    stakeAmount: 25
  });

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Add a bet manually
      </Button>
    );
  }

  return (
    <form
      className="grid grid-cols-2 gap-2 rounded-xs border border-paper-200 bg-paper-50 p-3 text-sm dark:border-ink-800 dark:bg-ink-800 sm:grid-cols-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("saving");
        const res = await fetch("/api/v1/tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, eventId: `manual_${Date.now()}` })
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
      <label className="col-span-2 text-xs font-medium">
        Event
        <input
          required
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.eventLabel}
          onChange={(e) => setForm({ ...form, eventLabel: e.target.value })}
        />
      </label>
      <label className="text-xs font-medium">
        League
        <select
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.leagueKey}
          onChange={(e) => setForm({ ...form, leagueKey: e.target.value as LeagueKey })}
        >
          <option value="nfl">NFL</option>
          <option value="nba">NBA</option>
          <option value="mlb">MLB</option>
          <option value="nhl">NHL</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Market
        <select
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.marketType}
          onChange={(e) => setForm({ ...form, marketType: e.target.value as MarketType })}
        >
          <option value="moneyline">Moneyline</option>
          <option value="spread">Spread</option>
          <option value="total">Total</option>
        </select>
      </label>
      <label className="col-span-2 text-xs font-medium">
        Selection
        <input
          required
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.selectionLabel}
          onChange={(e) => setForm({ ...form, selectionLabel: e.target.value })}
        />
      </label>
      <label className="text-xs font-medium">
        Sportsbook
        <select
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.sportsbookKey}
          onChange={(e) => setForm({ ...form, sportsbookKey: e.target.value as SportsbookKey })}
        >
          <option value="fanduel">FanDuel</option>
          <option value="draftkings">DraftKings</option>
          <option value="betmgm">BetMGM</option>
          <option value="caesars">Caesars</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        Odds (American)
        <input
          type="number"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
          value={form.oddsAmerican}
          onChange={(e) => setForm({ ...form, oddsAmerican: Number(e.target.value) })}
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
          {status === "saving" ? "Saving..." : "Save bet"}
        </Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {status === "error" && <span className="text-xs text-risk-text">Could not save - check your plan&apos;s bet limit.</span>}
      </div>
    </form>
  );
}
