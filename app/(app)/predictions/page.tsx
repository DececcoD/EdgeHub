import { listMockPredictionMarkets } from "@/lib/predictions/mock-data";
import { matchPredictionMarkets } from "@/lib/predictions/matching";
import { formatProbability, formatSignedCurrency } from "@/lib/calc/format";
import { getSessionOrDemo } from "@/lib/auth/session";
import { listPredictionPositions } from "@/lib/mock/user-data";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { CreatePositionForm } from "@/components/predictions/create-position-form";
import { SettlePositionControls } from "@/components/predictions/settle-position-controls";
import type { NormalizedPredictionMarket, NormalizedPredictionOutcome } from "@/lib/providers/prediction-markets/types";

export const metadata = { title: "Prediction markets - EdgeHub" };

const STATUS_TONE: Record<string, string> = {
  won: "text-signal-text",
  lost: "text-risk-text",
  void: "text-paper-muted dark:text-ink-muted",
  open: "text-caution-text"
};

function findYesOutcome(market: NormalizedPredictionMarket): NormalizedPredictionOutcome | null {
  return market.outcomes.find((o) => o.label.toLowerCase() === "yes") ?? null;
}

function statusLabel(status: NormalizedPredictionMarket["status"]): string {
  return status === "open" ? "Open" : status === "closed" ? "Closed" : status === "resolved" ? "Resolved" : "Unknown";
}

export default async function PredictionsPage() {
  const session = await getSessionOrDemo();
  const markets = listMockPredictionMarkets();
  const { matched, unmatched } = matchPredictionMarkets(markets);
  const positions = listPredictionPositions(session.userId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Panel className="p-4">
        <p className="font-display text-lg font-semibold">Prediction markets</p>
        <p className="mt-1 text-sm text-paper-muted dark:text-ink-muted">
          Comparing Kalshi and Polymarket prices for the same real-world question - the same idea as comparing
          sportsbook odds across FanDuel/DraftKings, applied to prediction markets. EdgeHub never places a trade on
          either platform; this is read-only market intelligence.
        </p>
        <p className="mt-2 text-xs text-paper-muted dark:text-ink-muted">
          Phase 2 build, running on seeded fixture data - the real Kalshi/Polymarket adapters (
          <code>lib/providers/kalshi/</code>, <code>lib/providers/polymarket/</code>) are built and unit-tested
          against each provider&apos;s real API shape, but not yet wired into a live ingestion pipeline. Matching
          between providers is automatic, deterministic, and deliberately conservative - see &quot;Unmatched
          markets&quot; below for what it can&apos;t confidently resolve on its own.
        </p>
      </Panel>

      <Panel>
        <PanelHeader title="Matched markets" subtitle="Same real-world question, priced independently on both platforms" />
        {matched.length === 0 ? (
          <EmptyState title="No matches yet" description="Nothing on Kalshi and Polymarket currently describes the same question closely enough to compare." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-4 py-2">Question</th>
                  <th className="px-4 py-2">Kalshi (Yes)</th>
                  <th className="px-4 py-2">Polymarket (Yes)</th>
                  <th className="px-4 py-2">Spread</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((pair) => {
                  const kalshiYes = findYesOutcome(pair.kalshi);
                  const polyYes = findYesOutcome(pair.polymarket);
                  const spread = kalshiYes?.price !== null && kalshiYes?.price !== undefined && polyYes?.price !== null && polyYes?.price !== undefined
                    ? Math.abs(kalshiYes.price - polyYes.price)
                    : null;
                  return (
                    <tr key={pair.key} className="border-t border-paper-200 dark:border-ink-800">
                      <td className="px-4 py-2">
                        <p>{pair.kalshi.title}</p>
                        <p className="text-xs text-paper-muted dark:text-ink-muted">vs. &quot;{pair.polymarket.title}&quot;</p>
                      </td>
                      <td className="px-4 py-2 font-mono tabular">{kalshiYes?.price !== null && kalshiYes?.price !== undefined ? formatProbability(kalshiYes.price, 1) : "-"}</td>
                      <td className="px-4 py-2 font-mono tabular">{polyYes?.price !== null && polyYes?.price !== undefined ? formatProbability(polyYes.price, 1) : "-"}</td>
                      <td className={`px-4 py-2 font-mono tabular ${spread !== null && spread >= 0.05 ? "text-signal-text" : ""}`}>
                        {spread !== null ? formatProbability(spread, 1) : "-"}
                      </td>
                      <td className="px-4 py-2">
                        {statusLabel(pair.kalshi.status)} / {statusLabel(pair.polymarket.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Unmatched markets"
          subtitle="Only on one platform, or not confidently matched - same honesty as the sportsbook mapping review queue"
        />
        {unmatched.length === 0 ? (
          <EmptyState title="Nothing unmatched" description="Every current market has a counterpart on the other platform." />
        ) : (
          <ul className="divide-y divide-paper-200 dark:divide-ink-800">
            {unmatched.map((market) => {
              const yes = findYesOutcome(market);
              return (
                <li key={`${market.provider}:${market.providerMarketId}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{market.title}</p>
                    <p className="text-xs text-paper-muted dark:text-ink-muted capitalize">
                      {market.provider} - {statusLabel(market.status)}
                    </p>
                  </div>
                  <span className="font-mono tabular text-sm">{yes?.price !== null && yes?.price !== undefined ? formatProbability(yes.price, 1) : "-"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="flex items-center justify-between">
        <CreatePositionForm />
      </div>

      <Panel>
        <PanelHeader
          title="Your positions"
          subtitle="Recorded privately for your own tracking - EdgeHub never places a trade on Kalshi or Polymarket"
        />
        {positions.length === 0 ? (
          <EmptyState title="Nothing tracked yet" description="Add a position manually above to start your prediction portfolio." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-4 py-2">Market</th>
                  <th className="px-4 py-2">Outcome</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Entry price</th>
                  <th className="px-4 py-2">Stake</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Net</th>
                  <th className="px-4 py-2">Settle</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id} className="border-t border-paper-200 dark:border-ink-800">
                    <td className="px-4 py-2">{position.marketTitle}</td>
                    <td className="px-4 py-2">{position.outcomeLabel}</td>
                    <td className="px-4 py-2 capitalize">{position.provider}</td>
                    <td className="px-4 py-2 font-mono tabular">{formatProbability(position.entryPrice, 1)}</td>
                    <td className="px-4 py-2 font-mono tabular">{formatSignedCurrency(position.stakeAmount).replace("+", "")}</td>
                    <td className={`px-4 py-2 font-medium capitalize ${STATUS_TONE[position.status]}`}>{position.status}</td>
                    <td className={`px-4 py-2 font-mono tabular ${position.netProfit >= 0 ? "text-signal-text" : "text-risk-text"}`}>
                      {formatSignedCurrency(position.netProfit)}
                    </td>
                    <td className="px-4 py-2">
                      <SettlePositionControls positionId={position.id} currentStatus={position.status} />
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
