import { DocPage } from "@/components/docs/doc-page";

export const metadata = { title: "FAQ - EdgeHub" };

const FAQS = [
  { q: "Does EdgeHub place bets for me?", a: "No. EdgeHub never accepts, routes, or executes a wager. It shows you public market data, timestamps, and calculations; any wager is placed by you, directly with a licensed sportsbook." },
  { q: "Does EdgeHub hold my money?", a: "No. EdgeHub does not custody funds or balances. Your bankroll figure, if you enter one, is used only to size suggested stakes and is never a deposit." },
  { q: 'Is a high "edge" a guarantee?', a: "No. Edge and EV are probability-based estimates derived from consensus market pricing. They are ranking aids, not predictions of what will happen in a single event." },
  { q: "Why did a price disappear from the ranking?", a: "A quote is only ranked while it is current or aging under its freshness SLA and has enough book coverage for a reliable consensus. Stale, partial, or unmapped markets are excluded rather than shown as if they were current." },
  { q: "Which sportsbooks and leagues are supported at launch?", a: "FanDuel, DraftKings, BetMGM, and Caesars across NFL, NBA, MLB, and NHL moneyline, spread, and total markets - subject to provider coverage and license terms." },
  { q: "Are prediction markets (Kalshi, Polymarket) supported?", a: "Adapters are designed but gated behind legal and data review; the UI is not enabled in the MVP." }
];

export default function FaqPage() {
  return (
    <DocPage title="Frequently asked questions" version="v1.0">
      {FAQS.map((f) => (
        <div key={f.q}>
          <p className="font-semibold">{f.q}</p>
          <p className="text-paper-muted dark:text-ink-muted">{f.a}</p>
        </div>
      ))}
    </DocPage>
  );
}
