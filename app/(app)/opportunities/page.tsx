import Link from "next/link";
import { listMarkets, listOpportunities } from "@/lib/data-source";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { FilterBar } from "@/components/filters/filter-bar";
import { OddsCell } from "@/components/ui/odds-cell";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { EmptyState, LinkButton, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatPercentagePoints, formatSignedPercent } from "@/lib/calc/format";
import type { LeagueKey, MarketType } from "@/lib/types";

export default async function OpportunitiesPage({
  searchParams
}: {
  searchParams: { league?: string; market?: string; q?: string; minEdge?: string };
}) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);

  const filters = {
    leagueKey: (searchParams.league as LeagueKey) || undefined,
    marketType: (searchParams.market as MarketType) || undefined,
    minEdgePp: searchParams.minEdge ? Number(searchParams.minEdge) : undefined
  };

  let rows = await listOpportunities(filters);
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    rows = rows.filter(
      (r) => r.event.home.name.toLowerCase().includes(q) || r.event.away.name.toLowerCase().includes(q)
    );
  }

  const capped = entitlements.opportunityRowsPerDay !== null;
  const visibleRows = capped ? rows.slice(0, entitlements.opportunityRowsPerDay!) : rows;

  // OPP-04: explain exclusions rather than silently hiding rows.
  const marketsInScope = await listMarkets({ leagueKey: filters.leagueKey, marketType: filters.marketType });
  const allOutcomesInScope = marketsInScope.flatMap((m) => m.outcomes);
  const excludedByReason = {
    stale: allOutcomesInScope.filter((o) => o.dataQuality === "stale").length,
    partial: allOutcomesInScope.filter((o) => o.dataQuality === "partial").length,
    mapping_review: allOutcomesInScope.filter((o) => o.dataQuality === "mapping_review").length,
    unavailable: allOutcomesInScope.filter((o) => o.dataQuality === "unavailable").length
  };
  const totalExcluded = Object.values(excludedByReason).reduce((s, n) => s + n, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <FilterBar showMinEdge />
        {entitlements.advancedFilters === "full" ? (
          <LinkButton href="/account" variant="ghost">
            Save this view
          </LinkButton>
        ) : null}
      </div>

      {totalExcluded > 0 && (
        <p className="text-xs text-paper-muted dark:text-ink-muted">
          {totalExcluded} market{totalExcluded === 1 ? "" : "s"} excluded from ranking in this scope: {excludedByReason.stale} stale,{" "}
          {excludedByReason.partial} partial consensus, {excludedByReason.mapping_review} pending mapping review,{" "}
          {excludedByReason.unavailable} source unavailable.
        </p>
      )}

      <Panel>
        <PanelHeader
          title="Opportunity Finder"
          subtitle={
            capped
              ? `Showing ${visibleRows.length} of ${rows.length} eligible rows - upgrade for unlimited rows/day`
              : `${rows.length} eligible rows, ranked by Opportunity Score`
          }
        />
        {visibleRows.length === 0 ? (
          <EmptyState
            title="No eligible opportunities match these filters"
            description="Every row here already passed the freshness and completeness gates - try widening a filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-4 py-2">Matchup</th>
                  <th className="px-4 py-2">Market</th>
                  <th className="px-4 py-2">Selection</th>
                  <th className="px-4 py-2">Best price</th>
                  <th className="px-4 py-2">Edge</th>
                  <th className="px-4 py-2">EV</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.outcomeId} className="border-t border-paper-200 hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
                    <td className="px-4 py-2">
                      <Link href={`/analyzer/${row.outcomeId}`} className="hover:underline">
                        {row.event.away.name} @ {row.event.home.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 capitalize">{row.marketType}</td>
                    <td className="px-4 py-2">{row.outcomeLabel}</td>
                    <td className="px-4 py-2">
                      <OddsCell american={row.bestQuote.americanOdds} decimal={row.bestQuote.decimalOdds} format={session.preferences.oddsFormat} />{" "}
                      <span className="text-xs text-paper-muted dark:text-ink-muted">{row.bestQuote.sportsbookName}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono tabular">{formatPercentagePoints(row.edgePp)}</span>{" "}
                      <span className="rounded-xs bg-paper-200 px-1 text-[10px] uppercase text-paper-muted dark:bg-ink-800 dark:text-ink-muted">
                        {row.edgeSource}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono tabular">{formatSignedPercent(row.evPercent)}</td>
                    <td className="px-4 py-2 font-mono tabular">{row.score.toFixed(1)}</td>
                    <td className="px-4 py-2">
                      <FreshnessBadge state={row.bestQuote.freshness} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
