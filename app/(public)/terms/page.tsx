import { DocPage } from "@/components/docs/doc-page";

export const metadata = { title: "Terms - EdgeHub" };

export default function TermsPage() {
  return (
    <DocPage title="Terms" version="v1.0 (draft - pending counsel review)">
      <p>
        EdgeHub is a market-intelligence and personal-tracking product. It does not operate a sportsbook or exchange,
        does not accept, route, or execute wagers, and does not custody funds or balances. Outbound links may refer
        you to third-party licensed sportsbooks; any wager you place there is between you and that sportsbook.
      </p>
      <h2 className="font-display text-lg font-semibold">No guarantee of outcome</h2>
      <p>
        All probabilities, edges, expected-value figures, and scores are estimates derived from public market data
        and disclosed calculation methods. Nothing on EdgeHub is a "lock," a certainty, or a guarantee of profit or
        result, for a single event or in aggregate.
      </p>
      <h2 className="font-display text-lg font-semibold">Eligibility</h2>
      <p>Use of EdgeHub requires meeting the minimum age and jurisdiction requirements that will be set following counsel review before public launch.</p>
      <h2 className="font-display text-lg font-semibold">Disputes and contact</h2>
      <p>Contact support through your Account page for any billing, data, or calculation dispute.</p>
    </DocPage>
  );
}
