"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";

const LEAGUES = [
  { value: "", label: "All leagues" },
  { value: "nfl", label: "NFL" },
  { value: "nba", label: "NBA" },
  { value: "mlb", label: "MLB" },
  { value: "nhl", label: "NHL" }
];
const MARKET_TYPES = [
  { value: "", label: "All markets" },
  { value: "moneyline", label: "Moneyline" },
  { value: "spread", label: "Spread" },
  { value: "total", label: "Total" }
];

/**
 * Drives league/market/search/min-edge filters through the URL so a filtered
 * view is shareable and restores on reload (MKT-01, OPP-02).
 */
export function FilterBar({ showMinEdge = false }: { showMinEdge?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // The URL is the source of truth - keep the input in sync when it changes
  // out from under us (e.g. the "Clear" button navigating with no params).
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xs border border-paper-200 bg-paper-0 p-2 dark:border-ink-800 dark:bg-ink-900">
      <select
        aria-label="League"
        className="rounded-xs border border-paper-200 bg-transparent px-2 py-1 text-sm dark:border-ink-800"
        value={searchParams.get("league") ?? ""}
        onChange={(e) => setParam("league", e.target.value)}
      >
        {LEAGUES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Market type"
        className="rounded-xs border border-paper-200 bg-transparent px-2 py-1 text-sm dark:border-ink-800"
        value={searchParams.get("market") ?? ""}
        onChange={(e) => setParam("market", e.target.value)}
      >
        {MARKET_TYPES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      {showMinEdge && (
        <select
          aria-label="Minimum edge"
          className="rounded-xs border border-paper-200 bg-transparent px-2 py-1 text-sm dark:border-ink-800"
          value={searchParams.get("minEdge") ?? ""}
          onChange={(e) => setParam("minEdge", e.target.value)}
        >
          <option value="">Any edge</option>
          <option value="1">Edge &gt;= 1 pp</option>
          <option value="2">Edge &gt;= 2 pp</option>
          <option value="3">Edge &gt;= 3 pp</option>
          <option value="5">Edge &gt;= 5 pp</option>
        </select>
      )}
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", query);
        }}
      >
        <input
          aria-label="Search teams or events"
          placeholder="Search teams..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-40 rounded-xs border border-paper-200 bg-transparent px-2 py-1 text-sm dark:border-ink-800"
        />
        <Button type="submit" variant="ghost">
          Search
        </Button>
      </form>
      {(searchParams.get("league") || searchParams.get("market") || searchParams.get("q") || searchParams.get("minEdge")) && (
        <Button variant="ghost" onClick={() => router.push(pathname)}>
          Clear
        </Button>
      )}
    </div>
  );
}
