"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel } from "@/components/ui/primitives";
import { americanToDecimal, decimalToImpliedProbability } from "@/lib/calc/odds";
import { deVigProportional } from "@/lib/calc/devig";
import { edgePercentagePoints } from "@/lib/calc/ev";
import { formatPercentagePoints, formatProbability } from "@/lib/calc/format";
import type { LeagueKey, OddsFormat, SportsbookKey } from "@/lib/types";

type Step = "age" | "account" | "preferences" | "example";

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

// Worked example for the interactive walkthrough (Section 4.2): a book priced
// at +135 against a two-way -110/-110 consensus.
const exampleDecimal = americanToDecimal(135);
const exampleImplied = decimalToImpliedProbability(exampleDecimal);
const consensusRaw = decimalToImpliedProbability(americanToDecimal(-110));
const consensus = deVigProportional([consensusRaw, consensusRaw]).probabilities[0]!;
const exampleEdge = edgePercentagePoints(consensus, exampleImplied);

export function SignupFlowMock() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("age");
  const [email, setEmail] = useState("");
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
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setStep("preferences");
          }}
        >
          <p className="font-display text-lg font-semibold">Create your account</p>
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
            No password needed for this prototype - a real deployment verifies email and manages credentials through
            Clerk.
          </p>
          <Button variant="primary" type="submit">
            Continue
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
          <Button variant="primary" onClick={() => setStep("example")}>
            Continue
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
          {error && <p className="text-xs text-risk-text">{error}</p>}
          <Button
            variant="primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, oddsFormat, favoriteLeagues, favoriteBooks })
              });
              if (res.ok) {
                router.push("/dashboard");
                router.refresh();
              } else {
                const json = await res.json();
                setError(json.message ?? "Could not create your account.");
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating account..." : "Go to my dashboard"}
          </Button>
        </div>
      )}
    </Panel>
  );
}
