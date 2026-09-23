import { EvCalculator } from "@/components/calculator/ev-calculator";

export const metadata = { title: "Odds & EV calculator - EdgeHub" };

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-bold">Odds & EV calculator</h1>
      <p className="mt-2 text-sm text-paper-muted dark:text-ink-muted">
        Try the exact math EdgeHub runs on every market - no account required.
      </p>
      <div className="mt-6">
        <EvCalculator />
      </div>
    </div>
  );
}
