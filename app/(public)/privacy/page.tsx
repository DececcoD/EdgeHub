import { DocPage } from "@/components/docs/doc-page";

export const metadata = { title: "Privacy - EdgeHub" };

export default function PrivacyPage() {
  return (
    <DocPage title="Privacy" version="v1.0 (draft - pending counsel review)">
      <p>
        This page describes EdgeHub's intended data practices for the prototype/beta phase. It is not yet a final
        legal document - specialized U.S. counsel review of the full data map, retention schedule, and deletion
        workflow is required before public launch.
      </p>
      <h2 className="font-display text-lg font-semibold">What we collect</h2>
      <p>Account email and preferences; bet-tracker entries you enter yourself; consent and unsubscribe events; product usage events needed to operate the service.</p>
      <h2 className="font-display text-lg font-semibold">What we never collect</h2>
      <p>Sportsbook credentials, payment-account access, or the ability to place a wager on your behalf.</p>
      <h2 className="font-display text-lg font-semibold">Your controls</h2>
      <p>You can export your tracker history, correct your preferences, or request account deletion from Account at any time.</p>
    </DocPage>
  );
}
