"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/**
 * Demo affordance for a prototype with no live feed: nudges a sample of
 * quotes to brand-new "current" observations server-side and recomputes
 * consensus/edge/score for the affected markets, then reloads server data so
 * the tick-flash and freshness-pulse have something real to react to.
 */
export function TickButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/v1/simulate-tick", { method: "POST" });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Refreshing..." : "Simulate market tick"}
    </Button>
  );
}
