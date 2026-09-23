"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { BetStatus } from "@/lib/calc/settlement";

const STATUSES: BetStatus[] = ["won", "lost", "push", "void"];

export function SettleControls({ betId, currentStatus }: { betId: string; currentStatus: BetStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (currentStatus !== "open") {
    return <span className="text-xs text-paper-muted dark:text-ink-muted">Settled</span>;
  }

  async function settle(status: BetStatus) {
    setLoading(true);
    try {
      await fetch(`/api/v1/tracker/${betId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-1">
      {STATUSES.map((s) => (
        <Button key={s} variant="ghost" disabled={loading} onClick={() => settle(s)} className="capitalize">
          {s}
        </Button>
      ))}
    </div>
  );
}
