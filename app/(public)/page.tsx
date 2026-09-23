import Link from "next/link";
import { listOpportunities } from "@/lib/data-source";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { OddsCell } from "@/components/ui/odds-cell";
import { formatPercentagePoints, formatSignedPercent } from "@/lib/calc/format";

const PRINCIPLES = [
  { title: "Freshness before flash", body: "Stale data must never look current. Every price carries its own age and eligibility state." },
  { title: "Explain the math", body: "Every score links to its inputs and formula - nothing is a black box." },
  { title: "Probability, not certainty", body: "We show uncertainty and downside, not a promise." },
  { title: "Read-only, always", body: "EdgeHub never places a wager. Outbound links may refer you to licensed sportsbooks." },
  { title: "Evidence over hype", body: "Sources and timestamps are visible; model, consensus, and opinion are never blurred together." },
  { title: "Responsible use by design", body: "Limits, cooling-off controls, and neutral notification copy - no urgency, no loss-chasing." }
];

export default async function LandingPage() {
  const featured = (await listOpportunities()).slice(0, 4);

  return (
    <div>
      <section className="border-b border-paper-200 px-6 py-16 dark:border-ink-800 sm:py-24">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-signal-text">Market intelligence, not a sportsbook</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Compare the market.
              <br /> Understand the edge.
              <br /> Track every decision.
            </h1>
            <p className="mt-4 max-w-md text-paper-muted dark:text-ink-muted">
              EdgeHub aggregates licensed sportsbook prices, converts them into comparable probabilities, and shows
              you the math behind every number - without ever placing a wager on your behalf.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/signup" className="rounded-xs bg-ink-950 px-4 py-2 text-sm font-medium text-paper-0 hover:bg-ink-800 dark:bg-signal dark:text-ink-950">
                Start free
              </Link>
              <Link href="/pricing" className="rounded-xs border border-paper-200 px-4 py-2 text-sm font-medium hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
                See pricing
              </Link>
            </div>
          </div>

          <div className="rounded-xs border border-paper-200 bg-paper-0 shadow-sm dark:border-ink-800 dark:bg-ink-900">
            <div className="border-b border-paper-200 px-4 py-2 text-xs uppercase tracking-wide text-paper-muted dark:border-ink-800 dark:text-ink-muted">
              Live from the Opportunity Finder
            </div>
            <ul className="divide-y divide-paper-200 dark:divide-ink-800">
              {featured.map((row) => (
                <li key={row.outcomeId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {row.event.away.name} @ {row.event.home.name}
                    </p>
                    <p className="text-xs text-paper-muted dark:text-ink-muted">
                      {row.outcomeLabel} - {row.bestQuote.sportsbookName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <OddsCell american={row.bestQuote.americanOdds} decimal={row.bestQuote.decimalOdds} />
                    <span className="font-mono tabular text-xs text-signal-text">{formatPercentagePoints(row.edgePp)}</span>
                    <FreshnessBadge state={row.bestQuote.freshness} className="text-[10px]" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-semibold">Six principles, no exceptions</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 className="font-display text-base font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-paper-muted dark:text-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-paper-200 bg-paper-0 px-6 py-16 dark:border-ink-800 dark:bg-ink-900">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl font-semibold">What EdgeHub is not</h2>
          <p className="mt-3 text-sm text-paper-muted dark:text-ink-muted">
            Not a sportsbook or exchange. Not a way to place or copy wagers. Not a custodian of your money. Not a
            source of guaranteed picks or &quot;locks.&quot; Every number here is a probability-based read of public market
            data, timestamped and explained - the decision, and the risk, stay yours.
          </p>
          <p className="mt-6 font-mono tabular text-xs text-caution-text">
            Example EV: decimal 2.10 at p=0.50 -&gt; {formatSignedPercent(5)} expected return - on average, over many
            similar bets, not this one specifically.
          </p>
        </div>
      </section>
    </div>
  );
}
