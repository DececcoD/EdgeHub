"use client";

import { useMemo, useState } from "react";
import { americanToDecimal, decimalToImpliedProbability } from "@/lib/calc/odds";
import { edgePercentagePoints, evPerDollar, evPercent, netProfit, potentialPayout } from "@/lib/calc/ev";
import { fractionalKelly, fullKelly } from "@/lib/calc/kelly";
import { formatCurrency, formatPercentagePoints, formatProbability, formatSignedPercent } from "@/lib/calc/format";
import { Panel, PanelHeader } from "@/components/ui/primitives";

/** PUB-04: interactive odds/EV calculator. Pure client-side math against lib/calc - identical formulas to the app. */
export function EvCalculator() {
  const [american, setAmerican] = useState(150);
  const [estimatedProbability, setEstimatedProbability] = useState(45);
  const [stake, setStake] = useState(25);

  const result = useMemo(() => {
    try {
      const decimal = americanToDecimal(american);
      const pImplied = decimalToImpliedProbability(decimal);
      const p = estimatedProbability / 100;
      const edge = edgePercentagePoints(p, pImplied);
      const ev = evPerDollar(p, decimal);
      const kelly = fullKelly(p, decimal);
      const quarterKelly = fractionalKelly(p, decimal, 0.25);
      return {
        decimal,
        pImplied,
        edge,
        ev,
        evPct: evPercent(ev),
        kelly,
        quarterKelly,
        payout: potentialPayout(stake, decimal),
        profit: netProfit(stake, decimal)
      };
    } catch {
      return null;
    }
  }, [american, estimatedProbability, stake]);

  return (
    <Panel>
      <PanelHeader title="Odds & EV calculator" subtitle="Same formulas as the app - Section 6" />
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 text-sm">
          <label className="font-medium">
            American odds
            <input
              type="number"
              className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
              value={american}
              onChange={(e) => setAmerican(Number(e.target.value))}
            />
          </label>
          <label className="font-medium">
            Your estimated win probability (%)
            <input
              type="number"
              min={1}
              max={99}
              className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
              value={estimatedProbability}
              onChange={(e) => setEstimatedProbability(Number(e.target.value))}
            />
          </label>
          <label className="font-medium">
            Stake ($)
            <input
              type="number"
              min={1}
              className="mt-0.5 block w-full rounded-xs border border-paper-200 bg-paper-0 px-2 py-1 dark:border-ink-800 dark:bg-ink-900"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
            />
          </label>
        </div>
        {result && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Implied probability" value={formatProbability(result.pImplied, 4)} />
            <Stat label="Edge" value={formatPercentagePoints(result.edge, 3)} tone={result.edge > 0 ? "text-signal-text" : "text-risk-text"} />
            <Stat label="EV / $1 staked" value={formatSignedPercent(result.evPct, 3)} tone={result.evPct > 0 ? "text-signal-text" : "text-risk-text"} />
            <Stat label="Full Kelly" value={`${(result.kelly * 100).toFixed(2)}%`} />
            <Stat label="Quarter Kelly (default)" value={`${(result.quarterKelly * 100).toFixed(2)}%`} />
            <Stat label="Potential payout" value={formatCurrency(result.payout)} />
            <Stat label="Net profit if it wins" value={formatCurrency(result.profit)} tone={result.profit > 0 ? "text-signal-text" : undefined} />
          </div>
        )}
      </div>
      <p className="border-t border-paper-200 px-4 py-2 text-xs text-paper-muted dark:border-ink-800 dark:text-ink-muted">
        This calculator is for education. It does not guarantee any outcome and does not place a wager.
      </p>
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-paper-muted dark:text-ink-muted">{label}</p>
      <p className={`font-mono tabular text-base ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
