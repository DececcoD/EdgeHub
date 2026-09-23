"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui/primitives";
import { americanToDecimal, decimalToImpliedProbability } from "@/lib/calc/odds";
import { deVigProportional } from "@/lib/calc/devig";
import { edgePercentagePoints } from "@/lib/calc/ev";
import { formatPercentagePoints, formatProbability } from "@/lib/calc/format";
import type { LeagueKey, OddsFormat, SportsbookKey } from "@/lib/types";

// One extra step vs. the mock flow: Clerk requires email verification
// before a sign-up can be finalized into an active session.
type Step = "age" | "account" | "verify" | "preferences" | "example";

const LEAGUES: { key: LeagueKey; label: string }[] = [
  { key: "nfl", label: "NFL" },
  { key: "nba", label: "NBA" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" }
];
const BOOKS: { key: SportsbookKey; label: string }[] = [
  { key: "fanduel", label: "FanDuel" },
  { key: "draftkings", label: "DraftKings" },
  { key: "betmgm", label: "BetMGM" },
  { key: "caesars", label: "Caesars" }
];

const exampleDecimal = americanToDecimal(135);
const exampleImplied = decimalToImpliedProbability(exampleDecimal);
const consensusRaw = decimalToImpliedProbability(americanToDecimal(-110));
const consensus = deVigProportional([consensusRaw, consensusRaw]).probabilities[0]!;
const exampleEdge = edgePercentagePoints(consensus, exampleImplied);

/** Only ever rendered when AUTH_MODE === "clerk" - useSignUp() requires a ClerkProvider ancestor. */
export function SignupFlowClerk() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [step, setStep] = useState<Step>("age");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("american");
  const [favoriteLeagues, setFavoriteLeagues] = useState<LeagueKey[]>(["nfl"]);
  const [favoriteBooks, setFavoriteBooks] = useState<SportsbookKey[]>(["fanduel"]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <Panel className="p-6">
      {step === "age" && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-display text-lg font-semibold">Before you continue</p>
          <p className="text-paper-muted dark:text-ink-muted">
            EdgeHub is market-intelligence and tracking software, not a sportsbook. It will require you to confirm
            you meet the minimum age and jurisdiction requirements for your region. Availability and required
            controls are finalized under legal counsel review before public launch.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" required id="age-confirm" />
            <span>I confirm I meet the applicable age and jurisdiction requirements.</span>
          </label>
          <Button
            variant="primary"
            onClick={() => {
              const checked = (document.getElementById("age-confirm") as HTMLInputElement)?.checked;
              if (checked) setStep("account");
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "account" && (
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isLoaded) return;
            setSaving(true);
            setError(null);
            try {
              await signUp.create({ emailAddress: email, password });
              await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
              setStep("verify");
            } catch (err: any) {
              setError(err?.errors?.[0]?.longMessage ?? err?.message ?? "Could not create your account.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="font-display text-lg font-semibold">Create your account</p>
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
              minLength={8}
              autoComplete="new-password"
              className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-risk-text">{error}</p>}
          <Button variant="primary" type="submit" disabled={saving || !isLoaded}>
            {saving ? "Creating account..." : "Continue"}
          </Button>
        </form>
      )}

      {step === "verify" && (
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!isLoaded) return;
            setSaving(true);
            setError(null);
            try {
              const result = await signUp.attemptEmailAddressVerification({ code });
              if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                setStep("preferences");
              } else {
                setError(`Verification incomplete (status: ${result.status}).`);
              }
            } catch (err: any) {
              setError(err?.errors?.[0]?.longMessage ?? err?.message ?? "Could not verify that code.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="font-display text-lg font-semibold">Check your email</p>
          <p className="text-paper-muted dark:text-ink-muted">We sent a verification code to {email}.</p>
          <label className="text-xs font-medium">
            Verification code
            <input
              type="text"
              required
              autoComplete="one-time-code"
              className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-risk-text">{error}</p>}
          <Button variant="primary" type="submit" disabled={saving || !isLoaded}>
            {saving ? "Verifying..." : "Verify"}
          </Button>
        </form>
      )}

      {step === "preferences" && (
        <div className="flex flex-col gap-4 text-sm">
          <p className="font-display text-lg font-semibold">Set your preferences</p>
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">Odds format</legend>
            <div className="mt-1 flex gap-3">
              {(["american", "decimal"] as OddsFormat[]).map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input type="radio" checked={oddsFormat === f} onChange={() => setOddsFormat(f)} />
                  <span className="capitalize">{f}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">Favorite leagues</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {LEAGUES.map((l) => (
                <label key={l.key} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={favoriteLeagues.includes(l.key)} onChange={() => setFavoriteLeagues(toggle(favoriteLeagues, l.key))} />
                  {l.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">Favorite books</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {BOOKS.map((b) => (
                <label key={b.key} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={favoriteBooks.includes(b.key)} onChange={() => setFavoriteBooks(toggle(favoriteBooks, b.key))} />
                  {b.label}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-xs text-risk-text">{error}</p>}
          <Button
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                const res = await fetch("/api/v1/account/preferences", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ oddsFormat, favoriteLeagues, favoriteBooks, onboardedAt: new Date().toISOString() })
                });
                if (!res.ok) throw new Error("Could not save preferences.");
                setStep("example");
              } catch (err: any) {
                setError(err?.message ?? "Could not save preferences.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      )}

      {step === "example" && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-display text-lg font-semibold">One quick example</p>
          <p className="text-paper-muted dark:text-ink-muted">
            A book prices a side at +135. The two-way consensus (from -110/-110 across other books) says that side is
            really worth about {formatProbability(consensus, 2)}.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>+135 implies {formatProbability(exampleImplied, 2)} to win.</li>
            <li>No-vig consensus estimate: {formatProbability(consensus, 2)}.</li>
            <li>
              Edge: {formatPercentagePoints(exampleEdge, 2)} - the price is offering more than the consensus thinks
              that side is worth.
            </li>
          </ul>
          <p className="text-xs text-caution-text">This is a worked example, not a live recommendation - your dashboard shows real current markets.</p>
          <Button
            variant="primary"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            Go to my dashboard
          </Button>
        </div>
      )}
    </Panel>
  );
}
