"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { PredictionPositionStatus } from "@/lib/types";

const STATUSES: PredictionPositionStatus[] = ["won", "lost", "void"];

export function SettlePositionControls({ positionId, currentStatus }: { positionId: string; currentStatus: PredictionPositionStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (currentStatus !== "open") {
    return <span className="text-xs text-paper-muted dark:text-ink-muted">Settled</span>;
  }

  async function settle(status: PredictionPositionStatus) {
    setLoading(true);
    try {
      await fetch(`/api/v1/predictions/positions/${positionId}`, {
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
