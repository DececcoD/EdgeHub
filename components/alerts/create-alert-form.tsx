"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { AlertDef } from "@/lib/types";

const CONDITIONS: { value: AlertDef["conditionType"]; label: string; unitHint: string }[] = [
  { value: "odds_threshold", label: "Price reaches a value (American odds)", unitHint: "e.g. 120" },
  { value: "edge_threshold", label: "Displayed edge crosses a threshold (pp)", unitHint: "e.g. 3" },
  { value: "book_spread", label: "Best-vs-second-best gap exceeds (pp)", unitHint: "e.g. 2" },
  { value: "movement", label: "Probability moves within 60 minutes (pp)", unitHint: "e.g. 5" },
  { value: "start_reminder", label: "Event starts within (minutes)", unitHint: "e.g. 30" }
];

export function CreateAlertForm({ defaultSubjectId, defaultSubjectLabel }: { defaultSubjectId?: string; defaultSubjectLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultSubjectId));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [form, setForm] = useState({
    subjectLabel: defaultSubjectLabel ?? "",
    subjectId: defaultSubjectId ?? "",
    conditionType: "edge_threshold" as AlertDef["conditionType"],
    threshold: 3,
    channel: "in_app" as AlertDef["channel"]
  });

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Create alert
      </Button>
    );
  }

  return (
    <Panel>
      <PanelHeader title="New alert" subtitle="Preview the exact trigger before saving" />
      <form
        className="flex flex-col gap-2 p-4 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus("saving");
          const res = await fetch("/api/v1/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, subjectType: "outcome" })
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
          What to watch
          <input
            required
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.subjectLabel}
            onChange={(e) => setForm({ ...form, subjectLabel: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium">
          Condition
          <select
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.conditionType}
            onChange={(e) => setForm({ ...form, conditionType: e.target.value as AlertDef["conditionType"] })}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Threshold ({CONDITIONS.find((c) => c.value === form.conditionType)?.unitHint})
          <input
            type="number"
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
          />
        </label>
        <label className="text-xs font-medium">
          Channel
          <select
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value as AlertDef["channel"] })}
          >
            <option value="in_app">In-app</option>
            <option value="email">Email</option>
          </select>
        </label>
        <p className="rounded-xs bg-paper-50 px-3 py-2 text-xs text-paper-muted dark:bg-ink-800 dark:text-ink-muted">
          You&apos;ll be notified at most once per condition change, respecting quiet hours (11pm-7am local by default). No
          urgency language, no loss-chasing prompts - just the fact and a link back to the current market state.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="primary" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving..." : "Save alert"}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {status === "error" && <span className="text-xs text-risk-text">Could not save - check your plan&apos;s alert limit.</span>}
        </div>
      </form>
    </Panel>
  );
}
