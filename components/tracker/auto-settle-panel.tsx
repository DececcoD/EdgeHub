"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { BetStatus } from "@/lib/calc/settlement";

interface SettlementSuggestion {
  betId: string;
  confidence: number;
  suggestedStatus: BetStatus | null;
  reason: string;
  matchedEventId: string | null;
  detail: string;
}

/**
 * Runs the confidence-gated auto-settlement check once when the Tracker
 * page loads (see app/api/v1/tracker/auto-settle/route.ts) - the
 * page-load-triggered equivalent of a real scheduled job. Auto-confirmed
 * bets refresh the table above silently; anything below the confidence
 * threshold shows here for a one-click human confirmation instead of
 * being applied automatically.
 */
export function AutoSettlePanel() {
  const router = useRouter();
  const [pendingReview, setPendingReview] = useState<SettlementSuggestion[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/tracker/auto-settle", { method: "POST" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setPendingReview(body.data.pendingReview);
        if (body.data.autoConfirmed.length > 0) router.refresh();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm(betId: string, status: BetStatus) {
    setConfirming(betId);
    try {
      await fetch(`/api/v1/tracker/${betId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      setPendingReview((prev) => prev?.filter((s) => s.betId !== betId) ?? null);
      router.refresh();
    } finally {
      setConfirming(null);
    }
  }

  if (!pendingReview || pendingReview.length === 0) return null;

  return (
    <Panel>
      <PanelHeader
        title="Needs your confirmation"
        subtitle={`${pendingReview.length} bet${pendingReview.length === 1 ? "" : "s"} found a likely result, but not confident enough to settle automatically`}
      />
      <ul className="flex flex-col gap-2">
        {pendingReview.map((s) => (
          <li key={s.betId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-paper-200 px-3 py-2 dark:border-ink-800">
            <div className="text-sm">
              <span className="font-medium capitalize">{s.suggestedStatus ?? "unknown"}</span>{" "}
              <span className="text-paper-muted dark:text-ink-muted">
                ({(s.confidence * 100).toFixed(0)}% confidence) - {s.detail}
              </span>
            </div>
            {s.suggestedStatus && (
              <div className="flex gap-1">
                <Button variant="ghost" disabled={confirming === s.betId} onClick={() => confirm(s.betId, s.suggestedStatus!)}>
                  Confirm {s.suggestedStatus}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
