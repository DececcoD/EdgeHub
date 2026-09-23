import Link from "next/link";
import { listMarkets, listSportsbooks } from "@/lib/data-source";
import { getSessionOrDemo } from "@/lib/auth/session";
import { FilterBar } from "@/components/filters/filter-bar";
import { TickButton } from "@/components/markets/tick-button";
import { OddsCell } from "@/components/ui/odds-cell";
import { FreshnessDot } from "@/components/ui/freshness-badge";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import type { LeagueKey, MarketType } from "@/lib/types";
import clsx from "clsx";

export default async function MarketsPage({
  searchParams
}: {
  searchParams: { league?: string; market?: string; q?: string };
}) {
  const session = await getSessionOrDemo();
  const books = await listSportsbooks();
  const allMarkets = await listMarkets({
    leagueKey: (searchParams.league as LeagueKey) || undefined,
    marketType: (searchParams.market as MarketType) || undefined
  });
  const markets = allMarkets.filter((m) => {
    if (!searchParams.q) return true;
    const q = searchParams.q.toLowerCase();
    return (
      m.event.home.name.toLowerCase().includes(q) ||
      m.event.away.name.toLowerCase().includes(q) ||
      m.event.home.city.toLowerCase().includes(q) ||
      m.event.away.city.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <FilterBar />
        <TickButton />
      </div>

      <Panel>
        <PanelHeader
          title="Markets"
          subtitle={`${markets.length} markets - odds format: ${session.preferences.oddsFormat}`}
        />
        {markets.length === 0 ? (
          <EmptyState title="No markets match these filters" description="Try clearing a filter or searching a different team." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Selection</th>
                  {books.map((b) => (
                    <th key={b.key} className="px-3 py-2">
                      {b.name}
                    </th>
                  ))}
                  <th className="px-3 py-2">Consensus</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) =>
                  market.outcomes.map((outcome, idx) => (
                    <tr
                      key={outcome.outcomeId}
                      className="border-t border-paper-200 hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800"
                    >
                      {idx === 0 && (
                        <td rowSpan={market.outcomes.length} className="px-3 py-2 align-top">
                          <Link href={`/analyzer/${outcome.outcomeId}`} className="font-medium hover:underline">
                            {market.event.away.name} @ {market.event.home.name}
                          </Link>
                          <div
                            className="text-xs text-paper-muted dark:text-ink-muted"
                            title={new Date(market.event.startAt).toString()}
                          >
                            {new Date(market.event.startAt).toLocaleString(undefined, {
                              weekday: "short",
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </div>
                        </td>
                      )}
                      {idx === 0 && (
                        <td rowSpan={market.outcomes.length} className="px-3 py-2 align-top capitalize">
                          {market.marketType}
                        </td>
                      )}
                      <td className="px-3 py-2">{outcome.label}</td>
                      {books.map((b) => {
                        const quote = outcome.quotes.find((q) => q.sportsbookKey === b.key);
                        const isBest = outcome.bestQuote?.sportsbookKey === b.key;
                        if (!quote) return <td key={b.key} className="px-3 py-2 text-paper-muted">-</td>;
                        return (
                          <td
                            key={b.key}
                            className={clsx("px-3 py-2", isBest && "bg-signal-soft dark:bg-signal/10")}
                          >
                            <div className="flex items-center gap-1.5">
                              <FreshnessDot state={quote.freshness} />
                              <OddsCell
                                american={quote.americanOdds}
                                decimal={quote.decimalOdds}
                                format={session.preferences.oddsFormat}
                                className={isBest ? "font-semibold text-signal-text" : undefined}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 font-mono tabular text-xs">
                        {outcome.consensus ? `${(outcome.consensus.probability * 100).toFixed(1)}%` : "Partial"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
