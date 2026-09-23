import { Panel, PanelHeader } from "@/components/ui/primitives";
import { EvCalculator } from "@/components/calculator/ev-calculator";

const TERMS: { term: string; definition: string; example: string }[] = [
  {
    term: "Implied probability",
    definition: "The win probability a price implies before removing the book's built-in margin (vig).",
    example: "+150 implies 40.00% (100 / (150 + 100)); -200 implies 66.67% (200 / (200 + 100))."
  },
  {
    term: "No-vig (de-vig) probability",
    definition: "Each side's implied probability rescaled so the set sums to 100%, removing the book's margin.",
    example: "Two sides both at -110 imply 52.38% each (104.76% total) - normalized, that's 50.00% each."
  },
  {
    term: "Edge",
    definition: "The difference, in percentage points, between a probability estimate and the implied probability of the best available price. A ranking aid, not a guarantee.",
    example: "Consensus 44% vs. a price implying 40% is +4.00 pp of edge."
  },
  {
    term: "Expected value (EV)",
    definition: "The average return per $1 staked if the probability estimate is correct across many similar bets.",
    example: "Decimal 2.10 at p=0.50 -> EV = 0.50 x 1.10 - 0.50 = +0.05, or +5.00%."
  },
  {
    term: "Kelly stake",
    definition: "A bankroll-sizing formula, shown at a quarter of full Kelly by default and capped at 2% of bankroll. Off by default - it is risk-management math, not advice to wager.",
    example: "Decimal 2.00 at p=0.55 -> full Kelly 10%, quarter Kelly 2.5%, capped to 2% by the default ceiling."
  },
  {
    term: "Closing-line value (CLV)",
    definition: "How your price compared to the price right before the event started. Positive means you got a better number than the market settled on.",
    example: "Placed at 2.20, closed at 2.00 -> positive CLV; shown as unavailable (never zero) when no closing price was recorded."
  },
  {
    term: "Freshness states",
    definition: "Current, aging, stale, partial, mapping review, or unavailable. Only current/aging quotes are ever ranked or highlighted as a best price.",
    example: "A quote 8 minutes old on a 45-second-SLA market shows as stale, not current."
  }
];

export default function LearnPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Panel>
        <PanelHeader title="Learn" subtitle="Plain-language definitions for every metric in the product" />
        <dl className="divide-y divide-paper-200 dark:divide-ink-800">
          {TERMS.map((t) => (
            <div key={t.term} className="px-4 py-3">
              <dt className="font-display text-sm font-semibold">{t.term}</dt>
              <dd className="mt-1 text-sm text-paper-muted dark:text-ink-muted">{t.definition}</dd>
              <dd className="mt-1 font-mono tabular text-xs">{t.example}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <EvCalculator />
    </div>
  );
}
