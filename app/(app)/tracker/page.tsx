import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { listBets } from "@/lib/mock/user-data";
import { formatSignedCurrency } from "@/lib/calc/format";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { CreateBetForm } from "@/components/tracker/create-bet-form";
import { SettleControls } from "@/components/tracker/settle-controls";
import { ImportExportControls } from "@/components/tracker/import-export";

const STATUS_TONE: Record<string, string> = {
  won: "text-signal-text",
  lost: "text-risk-text",
  push: "text-info-text",
  void: "text-paper-muted dark:text-ink-muted",
  open: "text-caution-text",
  partial_cash_out: "text-info-text",
  full_cash_out: "text-info-text"
};

export default async function TrackerPage() {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const bets = listBets(session.userId);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CreateBetForm />
        <ImportExportControls exportsEnabled={entitlements.exports !== "none"} />
      </div>

      <Panel>
        <PanelHeader
          title="Bet tracker"
          subtitle={
            entitlements.betTrackerLimit
              ? `${bets.length} of ${entitlements.betTrackerLimit} bets used on the ${entitlements.label} plan`
              : `${bets.length} bets recorded`
          }
        />
        {bets.length === 0 ? (
          <EmptyState title="Nothing tracked yet" description="Record a decision from the Analyzer, or add one manually above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Selection</th>
                  <th className="px-4 py-2">Book</th>
                  <th className="px-4 py-2">Odds</th>
                  <th className="px-4 py-2">Stake</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Net</th>
                  <th className="px-4 py-2">Settle</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="border-t border-paper-200 dark:border-ink-800">
                    <td className="px-4 py-2">{bet.eventLabel}</td>
                    <td className="px-4 py-2">{bet.selectionLabel}</td>
                    <td className="px-4 py-2 capitalize">{bet.sportsbookKey}</td>
                    <td className="px-4 py-2 font-mono tabular">
                      {bet.oddsAmerican > 0 ? "+" : ""}
                      {bet.oddsAmerican}
                    </td>
                    <td className="px-4 py-2 font-mono tabular">{formatSignedCurrency(bet.stakeAmount).replace("+", "")}</td>
                    <td className={`px-4 py-2 font-medium capitalize ${STATUS_TONE[bet.status]}`}>{bet.status.replace(/_/g, " ")}</td>
                    <td className={`px-4 py-2 font-mono tabular ${bet.netProfit >= 0 ? "text-signal-text" : "text-risk-text"}`}>
                      {formatSignedCurrency(bet.netProfit)}
                    </td>
                    <td className="px-4 py-2">
                      <SettleControls betId={bet.id} currentStatus={bet.status} />
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
