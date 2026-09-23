"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeEvent } from "@/lib/realtime/bus";

type ConnectionState = "connecting" | "live" | "offline";
type Toast = { id: string; subjectLabel: string; message: string };

/**
 * Mounted once in the app shell (components/nav/topbar.tsx) - the single
 * EventSource connection for this tab, shared by both concerns it renders:
 * the connection-status dot (reacting to public odds_tick events) and a
 * small toast queue (reacting to this user's own alert_fired events only -
 * the stream route already filters those server-side, but rendering stays
 * defensive rather than assuming that never changes).
 */
export function LiveIndicator() {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>("connecting");
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/v1/stream");

    source.onopen = () => setState("live");
    source.onerror = () => setState("offline");
    source.onmessage = (e) => {
      const event = JSON.parse(e.data) as RealtimeEvent;

      if (event.type === "odds_tick") {
        router.refresh();
        setFlashing(true);
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setFlashing(false), 900);
        return;
      }

      if (event.type === "alert_fired") {
        router.refresh(); // so the Alerts page's recent-triggers list picks it up if it's open
        const toast: Toast = { id: event.alertId + event.at, subjectLabel: event.subjectLabel, message: event.message };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 8000);
      }
    };

    return () => {
      source.close();
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [router]);

  const dotClass =
    state === "live"
      ? flashing
        ? "bg-signal animate-tick-up"
        : "bg-signal animate-pulse-current"
      : state === "connecting"
        ? "bg-caution"
        : "bg-risk";

  const label = state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Offline";

  return (
    <>
      <span className="flex items-center gap-1.5 text-xs text-paper-muted dark:text-ink-muted" title="Real-time odds push connection">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </span>
      {toasts.length > 0 && (
        <div className="fixed right-4 top-14 z-50 flex w-80 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xs border border-signal bg-paper-0 p-3 text-sm shadow-sm dark:bg-ink-900"
              role="status"
            >
              <p className="font-medium">{toast.subjectLabel}</p>
              <p className="text-xs text-paper-muted dark:text-ink-muted">{toast.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
