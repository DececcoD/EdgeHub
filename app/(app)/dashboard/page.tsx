import Link from "next/link";
import { getSessionOrDemo } from "@/lib/auth/session";
import { findOutcome, getFreshnessHealth, listOpportunities } from "@/lib/data-source";
import { listBets, listWatchlist } from "@/lib/mock/user-data";
import { roi } from "@/lib/calc/performance";
import { formatPercentagePoints, formatSignedCurrency, formatSignedPercent } from "@/lib/calc/format";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { OddsCell } from "@/components/ui/odds-cell";
import { EmptyState, LinkButton, Metric, Panel, PanelHeader } from "@/components/ui/primitives";

export default async function DashboardPage() {
  const session = await getSessionOrDemo();
  const opportunities = (
    await listOpportunities({
      leagueKey: session.preferences.favoriteLeagues[0]
    })
  ).slice(0, 8);
  const fallbackOpportunities = opportunities.length ? opportunities : (await listOpportunities()).slice(0, 8);

  const bets = listBets(session.userId);
  const settled = bets.filter((b) => b.status !== "open");
  const totalStaked = settled.reduce((s, b) => s + b.stakeAmount, 0);
  const totalNet = settled.reduce((s, b) => s + b.netProfit, 0);
  const openStake = bets.filter((b) => b.status === "open").reduce((s, b) => s + b.stakeAmount, 0);

  const watchlist = (
    await Promise.all(listWatchlist(session.userId).map((id) => findOutcome(id)))
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  const seenEventIds = new Set<string>();
  const upcoming = [...fallbackOpportunities]
    .sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime())
    .filter((row) => {
      if (seenEventIds.has(row.event.id)) return false;
      seenEventIds.add(row.event.id);
      return true;
    })
    .slice(0, 5);

  const health = await getFreshnessHealth();
  const slaBreached = health.pctHealthy < 0.9;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {slaBreached && (
        <div className="rounded-xs border border-caution bg-caution-soft px-4 py-3 text-sm text-ink-950">
          <span className="font-medium">Data health notice:</span> {(health.pctHealthy * 100).toFixed(1)}% of quotes are
          within their freshness SLA right now. Rankings below only ever use current/aging, gate-eligible quotes -
          nothing stale is shown as current.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4">
          <Metric label="Net P/L (settled)" value={formatSignedCurrency(totalNet)} tone={totalNet >= 0 ? "signal" : "risk"} />
        </Panel>
        <Panel className="p-4">
          <Metric label="ROI" value={formatSignedPercent(roi(totalNet, totalStaked) * 100)} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Open exposure" value={formatSignedCurrency(openStake).replace("+", "")} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Active watchlist" value={String(watchlist.length)} />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Top opportunities"
          subtitle="Ranked by Opportunity Score - a ranking aid, not a win probability"
          action={<LinkButton href="/opportunities" variant="ghost">View all</LinkButton>}
        />
        {fallbackOpportunities.length === 0 ? (
          <EmptyState title="Nothing eligible right now" description="Rows appear here once a market clears the freshness and completeness gates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-4 py-2">Matchup</th>
                  <th className="px-4 py-2">Selection</th>
                  <th className="px-4 py-2">Best price</th>
                  <th className="px-4 py-2">Edge</th>
                  <th className="px-4 py-2">EV</th>
                  <th className="px-4 py-2">Score</th>
                  <th className="px-4 py-2">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {fallbackOpportunities.map((row) => (
                  <tr key={row.outcomeId} className="border-t border-paper-200 hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
                    <td className="px-4 py-2">
                      <Link href={`/analyzer/${row.outcomeId}`} className="hover:underline">
                        {row.event.away.name} @ {row.event.home.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{row.outcomeLabel}</td>
                    <td className="px-4 py-2">
                      <OddsCell american={row.bestQuote.americanOdds} decimal={row.bestQuote.decimalOdds} />{" "}
                      <span className="text-xs text-paper-muted dark:text-ink-muted">{row.bestQuote.sportsbookName}</span>
                    </td>
                    <td className="px-4 py-2 font-mono tabular">{formatPercentagePoints(row.edgePp)}</td>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Upcoming starts" subtitle="Next events across your slate" />
          <ul className="divide-y divide-paper-200 dark:divide-ink-800">
            {upcoming.map((row) => (
              <li key={row.outcomeId} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {row.event.away.name} @ {row.event.home.name}
                </span>
                <time className="font-mono tabular text-xs text-paper-muted dark:text-ink-muted">
                  {new Date(row.event.startAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Saved markets" subtitle="Your watchlist" action={<LinkButton href="/opportunities" variant="ghost">Add more</LinkButton>} />
          {watchlist.length === 0 ? (
            <EmptyState title="Nothing saved yet" description="Save a market from Opportunities or the Analyzer to follow it here." />
          ) : (
            <ul className="divide-y divide-paper-200 dark:divide-ink-800">
              {watchlist.map(({ market, outcome }) => (
                <li key={outcome.outcomeId} className="flex items-center justify-between px-4 py-2 text-sm">
                  <Link href={`/analyzer/${outcome.outcomeId}`} className="hover:underline">
                    {market.event.away.name} @ {market.event.home.name} - {outcome.label}
                  </Link>
                  <FreshnessBadge state={outcome.dataQuality === "complete" ? "current" : "partial"} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
