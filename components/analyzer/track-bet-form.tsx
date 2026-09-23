"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import type { BookQuote, LeagueKey, MarketType } from "@/lib/types";

export function TrackBetForm({
  eventId,
  eventLabel,
  leagueKey,
  marketType,
  selectionLabel,
  quotes
}: {
  eventId: string;
  eventLabel: string;
  leagueKey: LeagueKey;
  marketType: MarketType;
  selectionLabel: string;
  quotes: BookQuote[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bookKey, setBookKey] = useState(quotes[0]?.sportsbookKey ?? "");
  const [odds, setOdds] = useState(quotes[0]?.americanOdds ?? -110);
  const [stake, setStake] = useState(25);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Track this bet
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-xs border border-paper-200 bg-paper-50 p-3 dark:border-ink-800 dark:bg-ink-800"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("saving");
        const res = await fetch("/api/v1/tracker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            eventLabel,
            leagueKey,
            marketType,
            selectionLabel,
            sportsbookKey: bookKey,
            oddsAmerican: odds,
            stakeAmount: stake,
            notes
          })
        });
        setStatus(res.ok ? "done" : "error");
        if (res.ok) router.refresh();
      }}
    >
      <p className="text-xs text-paper-muted dark:text-ink-muted">
        This records your decision for your own tracking only - EdgeHub does not place or transmit any wager to the
        sportsbook.
      </p>
      <label className="text-xs font-medium">
        Sportsbook you actually used
        <select
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 text-sm dark:border-ink-800 dark:bg-ink-900"
          value={bookKey}
          onChange={(e) => {
            setBookKey(e.target.value);
            const q = quotes.find((q) => q.sportsbookKey === e.target.value);
            if (q) setOdds(q.americanOdds);
          }}
        >
          {quotes.map((q) => (
            <option key={q.sportsbookKey} value={q.sportsbookKey}>
              {q.sportsbookName} ({q.americanOdds > 0 ? "+" : ""}
              {q.americanOdds})
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        Odds you got (American)
        <input
          type="number"
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 text-sm dark:border-ink-800 dark:bg-ink-900"
          value={odds}
          onChange={(e) => setOdds(Number(e.target.value))}
        />
      </label>
      <label className="text-xs font-medium">
        Stake ($)
        <input
          type="number"
          min={1}
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 text-sm dark:border-ink-800 dark:bg-ink-900"
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
        />
      </label>
      <label className="text-xs font-medium">
        Notes (optional)
        <textarea
          className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 text-sm dark:border-ink-800 dark:bg-ink-900"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Confirm record"}
        </Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {status === "done" && <span className="text-xs text-signal-text">Saved to your tracker.</span>}
        {status === "error" && <span className="text-xs text-risk-text">Could not save - check your plan&apos;s bet limit.</span>}
      </div>
    </form>
  );
}
