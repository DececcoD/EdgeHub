import { notFound } from "next/navigation";
import Link from "next/link";
import { findOutcome, getPriceHistory } from "@/lib/data-source";
import { listWatchlist } from "@/lib/mock/user-data";
import { getSessionOrDemo } from "@/lib/auth/session";
import { decimalToImpliedProbability } from "@/lib/calc/odds";
import { fairDecimalOdds } from "@/lib/calc/ev";
import { formatDecimalOdds, formatPercentagePoints, formatProbability, formatSignedPercent } from "@/lib/calc/format";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { OddsCell } from "@/components/ui/odds-cell";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { LineHistoryChart } from "@/components/charts/line-history-chart";
import { TrackBetForm } from "@/components/analyzer/track-bet-form";
import { WatchlistButton } from "@/components/analyzer/watchlist-button";
import { ExplanationPanel } from "@/components/analyzer/explanation-panel";

export default async function AnalyzerDetailPage({ params }: { params: { outcomeId: string } }) {
  const found = await findOutcome(params.outcomeId);
  if (!found) notFound();
  const { market, outcome } = found;

  const session = await getSessionOrDemo();
  const saved = listWatchlist(session.userId).includes(outcome.outcomeId);
  const history = await getPriceHistory(outcome.outcomeId);
  const eligibleQuotes = outcome.quotes.filter((q) => q.freshness === "current" || q.freshness === "aging");

  const pImplied = outcome.bestQuote ? decimalToImpliedProbability(outcome.bestQuote.decimalOdds) : null;
  const fairOdds = outcome.consensus ? fairDecimalOdds(outcome.consensus.probability) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
              {market.event.leagueKey.toUpperCase()} - {market.marketType} - rules {market.rulesVersion}
            </p>
            <h1 className="font-display text-xl font-semibold">
              {market.event.away.name} @ {market.event.home.name}
            </h1>
            <p className="text-sm text-paper-muted dark:text-ink-muted">
              {outcome.label} - {market.event.status} - starts{" "}
              {new Date(market.event.startAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {" "}({market.event.venue}, {market.event.isOutdoor ? "outdoor" : "indoor"})
            </p>
          </div>
          <FreshnessBadge state={outcome.dataQuality === "complete" ? (outcome.bestQuote?.freshness ?? "unavailable") : outcome.dataQuality} />
        </div>
        <div className="mt-3 flex gap-2">
          <WatchlistButton outcomeId={outcome.outcomeId} saved={saved} />
          <Link href={`/alerts?create=1&subjectId=${outcome.outcomeId}&subjectLabel=${encodeURIComponent(`${market.event.away.name} @ ${market.event.home.name} - ${outcome.label}`)}`}>
            <span className="inline-flex items-center rounded-xs border border-paper-200 px-3 py-1.5 text-sm font-medium hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
              Create alert
            </span>
          </Link>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Current book prices" subtitle="Best price highlighted only among fresh, eligible quotes" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                <th className="px-4 py-2">Sportsbook</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Observed</th>
                <th className="px-4 py-2">Freshness</th>
              </tr>
            </thead>
            <tbody>
              {outcome.quotes.map((q) => (
                <tr
                  key={q.sportsbookKey}
                  className={
                    outcome.bestQuote?.sportsbookKey === q.sportsbookKey
                      ? "bg-signal-soft dark:bg-signal/10"
                      : "border-t border-paper-200 dark:border-ink-800"
                  }
                >
                  <td className="px-4 py-2">{q.sportsbookName}</td>
                  <td className="px-4 py-2">
                    <OddsCell american={q.americanOdds} decimal={q.decimalOdds} format={session.preferences.oddsFormat} />
                  </td>
                  <td className="px-4 py-2 text-xs" title={new Date(q.observedAt).toString()}>
                    {new Date(q.observedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2">
                    <FreshnessBadge state={q.freshness} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Line history" subtitle="Decimal odds over the last ~18 hours" />
        <div className="p-4">
          <LineHistoryChart points={history} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Formula breakdown" subtitle="Exact values and rounding - Section 6" />
        <div className="grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-3">
          <FormulaMetric label="Best price implied probability" value={pImplied !== null ? formatProbability(pImplied, 4) : "Unavailable"} />
          <FormulaMetric label="Consensus (no-vig) probability" value={outcome.consensus ? formatProbability(outcome.consensus.probability, 4) : "Partial - fewer than 2 books"} />
          <FormulaMetric label="Fair decimal odds" value={fairOdds !== null ? formatDecimalOdds(fairOdds) : "Unavailable"} />
          <FormulaMetric label="Edge" value={outcome.edgePp !== null ? formatPercentagePoints(outcome.edgePp, 3) : "Unavailable"} tone={outcome.edgePp !== null && outcome.edgePp > 0 ? "signal" : undefined} />
          <FormulaMetric label="EV per $1 staked" value={outcome.evPercent !== null ? formatSignedPercent(outcome.evPercent, 3) : "Unavailable"} tone={outcome.evPercent !== null && outcome.evPercent > 0 ? "signal" : "risk"} />
          <FormulaMetric label="Opportunity score" value={outcome.score !== null ? `${outcome.score.toFixed(2)} / 100` : "Not ranked"} />
        </div>
        <details className="border-t border-paper-200 px-4 py-3 text-xs text-paper-muted dark:border-ink-800 dark:text-ink-muted">
          <summary className="cursor-pointer font-medium">Method notes</summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Consensus uses proportional (multiplicative) no-vig normalization, averaged across {outcome.consensus?.eligibleBooks ?? 0} eligible books.</li>
            <li>Edge = consensus probability - implied probability of the best eligible price (percentage points, not a ratio).</li>
            <li>EV assumes the consensus estimate is correct on average across many similar bets - it is not a guarantee for this single event.</li>
            <li>Opportunity score is a ranking aid (Section 6.6), not a win probability.</li>
          </ul>
        </details>
      </Panel>

      {outcome.bestQuote && (
        <Panel className="p-4">
          <PanelHeader title="Track this decision" subtitle="Recorded privately for your own tracker - no wager is placed" />
          <div className="pt-3">
            <TrackBetForm
              eventId={market.event.id}
              eventLabel={`${market.event.away.name} @ ${market.event.home.name}`}
              leagueKey={market.event.leagueKey}
              marketType={market.marketType}
              selectionLabel={outcome.label}
              quotes={eligibleQuotes}
            />
          </div>
        </Panel>
      )}

      <ExplanationPanel outcomeId={outcome.outcomeId} />
    </div>
  );
}

function FormulaMetric({ label, value, tone }: { label: string; value: string; tone?: "signal" | "risk" }) {
  return (
    <div>
      <p className="text-xs text-paper-muted dark:text-ink-muted">{label}</p>
      <p className={`font-mono tabular text-base ${tone === "signal" ? "text-signal-text" : tone === "risk" ? "text-risk-text" : ""}`}>{value}</p>
    </div>
  );
}
