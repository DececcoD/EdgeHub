"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function WatchlistButton({ outcomeId, saved }: { outcomeId: string; saved: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant={saved ? "secondary" : "primary"}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/v1/watchlist", {
            method: saved ? "DELETE" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outcomeId })
          });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {saved ? "Remove from watchlist" : "Save to watchlist"}
    </Button>
  );
}
