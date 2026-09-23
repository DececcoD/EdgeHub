"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { LeagueKey, OddsFormat, SportsbookKey, UserPreferences } from "@/lib/types";

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

export function PreferencesForm({ preferences }: { preferences: UserPreferences }) {
  const router = useRouter();
  const [form, setForm] = useState(preferences);
  const [saving, setSaving] = useState(false);

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  return (
    <Panel>
      <PanelHeader title="Preferences" subtitle="Odds format, favorite leagues/books, timezone" />
      <form
        className="flex flex-col gap-4 p-4 text-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await fetch("/api/v1/account/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form)
            });
            router.refresh();
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-paper-muted dark:text-ink-muted">Odds format</legend>
          <div className="mt-1 flex gap-3">
            {(["american", "decimal"] as OddsFormat[]).map((f) => (
              <label key={f} className="flex items-center gap-1.5">
                <input type="radio" name="oddsFormat" checked={form.oddsFormat === f} onChange={() => setForm({ ...form, oddsFormat: f })} />
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
                <input
                  type="checkbox"
                  checked={form.favoriteLeagues.includes(l.key)}
                  onChange={() => setForm({ ...form, favoriteLeagues: toggle(form.favoriteLeagues, l.key) })}
                />
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
                <input
                  type="checkbox"
                  checked={form.favoriteBooks.includes(b.key)}
                  onChange={() => setForm({ ...form, favoriteBooks: toggle(form.favoriteBooks, b.key) })}
                />
                {b.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-xs font-medium">
          Timezone (IANA)
          <input
            className="mt-0.5 block w-full max-w-xs rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </label>

        <div>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save preferences"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
