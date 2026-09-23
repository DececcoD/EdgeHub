"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { AlertDef } from "@/lib/types";

export function AlertControls({ alertId, status }: { alertId: string; status: AlertDef["status"] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(next: AlertDef["status"]) {
    setLoading(true);
    try {
      await fetch(`/api/v1/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/v1/alerts/${alertId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-1">
      {status === "active" ? (
        <Button variant="ghost" disabled={loading} onClick={() => patch("paused")}>
          Pause
        </Button>
      ) : (
        <Button variant="ghost" disabled={loading} onClick={() => patch("active")}>
          Resume
        </Button>
      )}
      <Button variant="ghost" disabled={loading} onClick={remove}>
        Delete
      </Button>
    </div>
  );
}
