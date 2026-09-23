"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui/primitives";

export function LoginFormMock() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@edgehub.app");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Panel className="p-6">
      <form
        className="flex flex-col gap-3 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
          if (res.ok) {
            router.push("/dashboard");
            router.refresh();
          } else {
            const json = await res.json();
            setError(json.message ?? "Could not log in.");
            setLoading(false);
          }
        }}
      >
        <p className="font-display text-lg font-semibold">Log in</p>
        <label className="text-xs font-medium">
          Email
          <input
            type="email"
            required
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <p className="text-xs text-paper-muted dark:text-ink-muted">
          Prototype login - no password. Use <code>demo@edgehub.app</code> to see a pre-populated account, or sign up
          for a fresh one.
        </p>
        {error && <p className="text-xs text-risk-text">{error}</p>}
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </Panel>
  );
}
