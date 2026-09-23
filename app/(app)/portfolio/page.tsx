import { getSessionOrDemo } from "@/lib/auth/session";
import { listBets } from "@/lib/mock/user-data";
import { clvDecimalRatio, exposureByGroup, maxDrawdown, roi } from "@/lib/calc/performance";
import { formatSignedCurrency, formatSignedPercent } from "@/lib/calc/format";
import { EmptyState, Metric, Panel, PanelHeader } from "@/components/ui/primitives";

export default async function PortfolioPage() {
  const session = await getSessionOrDemo();
  const bets = listBets(session.userId);
  const settled = bets.filter((b) => b.status === "won" || b.status === "lost" || b.status === "push" || b.status === "void");
  const decisive = settled.filter((b) => b.status === "won" || b.status === "lost");

  const totalStaked = settled.reduce((s, b) => s + b.stakeAmount, 0);
  const totalNet = settled.reduce((s, b) => s + b.netProfit, 0);
  const winRate = decisive.length ? decisive.filter((b) => b.status === "won").length / decisive.length : null;

  const chronological = [...settled].sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());
  let cumulative = 0;
  const series = chronological.map((b) => (cumulative += b.netProfit));
  const drawdown = maxDrawdown(series);

  const withClv = decisive.filter((b) => b.closingDecimalOdds !== null);
  const avgClv = withClv.length
    ? withClv.reduce((s, b) => s + clvDecimalRatio(b.oddsDecimal, b.closingDecimalOdds!), 0) / withClv.length
    : null;

  const exposure = exposureByGroup(
    bets.map((b) => ({
      stakeAmount: b.stakeAmount,
      eventId: b.eventId,
      leagueId: b.leagueKey,
      marketType: b.marketType,
      placedAtDay: b.placedAt.slice(0, 10),
      status: b.status
    }))
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Panel className="p-4">
          <Metric label="Net P/L" value={formatSignedCurrency(totalNet)} tone={totalNet >= 0 ? "signal" : "risk"} />
        </Panel>
        <Panel className="p-4">
          <Metric label="ROI" value={formatSignedPercent(roi(totalNet, totalStaked) * 100)} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Win rate" value={winRate !== null ? `${(winRate * 100).toFixed(1)}%` : "N/A"} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Avg CLV (decimal ratio)" value={avgClv !== null ? formatSignedPercent(avgClv * 100) : "Unavailable"} tone={avgClv !== null && avgClv > 0 ? "signal" : undefined} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Max drawdown" value={formatSignedCurrency(-drawdown).replace("+", "-").replace("--", "-")} tone="risk" />
        </Panel>
        <Panel className="p-4">
          <Metric label="Open exposure" value={formatSignedCurrency(exposure.totalOpenStake).replace("+", "")} />
        </Panel>
      </div>

      {withClv.length < decisive.length && decisive.length > 0 && (
        <p className="text-xs text-caution-text">
          Closing-line data is unavailable for {decisive.length - withClv.length} of {decisive.length} settled bets - those are
          excluded from the CLV average rather than counted as zero.
        </p>
      )}

      <Panel>
        <PanelHeader title="Open exposure by league" />
        {exposure.byLeague.size === 0 ? (
          <EmptyState title="No open exposure" description="Open bets will show grouped exposure here." />
        ) : (
          <ul className="divide-y divide-paper-200 px-4 dark:divide-ink-800">
            {[...exposure.byLeague.entries()].map(([league, amount]) => (
              <li key={league} className="flex justify-between py-2 text-sm uppercase">
                <span>{league}</span>
                <span className="font-mono tabular">{formatSignedCurrency(amount).replace("+", "")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Settlement history" />
        {settled.length === 0 ? (
          <EmptyState title="No settled bets yet" description="Once you settle a tracked bet, it appears here with P/L." />
        ) : (
          <ul className="divide-y divide-paper-200 px-4 dark:divide-ink-800">
            {settled.map((bet) => (
              <li key={bet.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {bet.eventLabel} - {bet.selectionLabel}
                </span>
                <span className={`font-mono tabular ${bet.netProfit >= 0 ? "text-signal-text" : "text-risk-text"}`}>
                  {formatSignedCurrency(bet.netProfit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
