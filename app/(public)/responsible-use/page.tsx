import { DocPage } from "@/components/docs/doc-page";

export const metadata = { title: "Responsible use - EdgeHub" };

export default function ResponsibleUsePage() {
  return (
    <DocPage title="Responsible use" version="v1.0">
      <p>
        EdgeHub is an information and tracking tool, not a sportsbook. If wagering stops being fun, or starts feeling
        difficult to control, these resources are here regardless of your plan or account status.
      </p>
      <ul className="list-inside list-disc space-y-1">
        <li>National Council on Problem Gambling helpline: 1-800-522-4700, available 24/7.</li>
        <li>You can set your own alert quiet hours, stake caps, and bankroll limits from Account at any time.</li>
        <li>You can pause your account without deleting your tracker history, or delete your account entirely.</li>
        <li>EdgeHub notification copy never uses urgency, loss-chasing language, or streak framing.</li>
      </ul>
      <p>
        Nothing on EdgeHub is a &quot;lock,&quot; a guaranteed outcome, or advice to wager. Every probability shown is an
        estimate with disclosed uncertainty, and the decision to act on it - or not - is always yours.
      </p>
    </DocPage>
  );
}
