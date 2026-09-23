"use client";

import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui/primitives";

/** Only ever rendered when AUTH_MODE === "clerk" - useSignIn() requires a ClerkProvider ancestor. */
export function LoginFormClerk() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Panel className="p-6">
      <form
        className="flex flex-col gap-3 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!isLoaded) return;
          setLoading(true);
          setError(null);
          try {
            const result = await signIn.create({ strategy: "password", identifier: email, password });
            if (result.status === "complete") {
              await setActive({ session: result.createdSessionId });
              router.push("/dashboard");
              router.refresh();
            } else {
              // Multi-factor or another step is required - out of scope for
              // this pass, but surfaced honestly rather than silently stuck.
              setError(`Additional verification required (status: ${result.status}) - not yet handled by this form.`);
              setLoading(false);
            }
          } catch (err: any) {
            setError(err?.errors?.[0]?.longMessage ?? err?.message ?? "Could not log in.");
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
            autoComplete="email"
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-xs text-risk-text">{error}</p>}
        <Button variant="primary" type="submit" disabled={loading || !isLoaded}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </Panel>
  );
}
