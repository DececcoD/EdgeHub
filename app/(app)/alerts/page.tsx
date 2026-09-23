import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { listAlerts, listAlertEvents } from "@/lib/mock/user-data";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { CreateAlertForm } from "@/components/alerts/create-alert-form";
import { AlertControls } from "@/components/alerts/alert-controls";

const STATUS_TONE: Record<string, string> = {
  active: "text-signal-text",
  paused: "text-caution-text",
  expired: "text-paper-muted dark:text-ink-muted"
};

export default async function AlertsPage({ searchParams }: { searchParams: { create?: string; subjectId?: string; subjectLabel?: string } }) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const alerts = listAlerts(session.userId);
  const activeCount = alerts.filter((a) => a.status === "active").length;
  const recentEvents = listAlertEvents(session.userId);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-paper-muted dark:text-ink-muted">
          {activeCount} of {entitlements.activeAlertLimit} active alerts used on the {entitlements.label} plan
        </p>
        {!searchParams.create && <CreateAlertForm />}
      </div>

      {searchParams.create && (
        <CreateAlertForm defaultSubjectId={searchParams.subjectId} defaultSubjectLabel={searchParams.subjectLabel} />
      )}

      <Panel>
        <PanelHeader title="Your alerts" />
        {alerts.length === 0 ? (
          <EmptyState title="No alerts yet" description="Create one from a market in the Analyzer, or add one above." />
        ) : (
          <ul className="divide-y divide-paper-200 dark:divide-ink-800">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{alert.subjectLabel}</p>
                  <p className="text-xs text-paper-muted dark:text-ink-muted">
                    {alert.conditionType.replace(/_/g, " ")} - threshold {alert.threshold} - {alert.channel} - quiet hours{" "}
                    {alert.quietHoursStart}-{alert.quietHoursEnd}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium uppercase ${STATUS_TONE[alert.status]}`}>{alert.status}</span>
                  <AlertControls alertId={alert.id} status={alert.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Recent triggers" subtitle="Fires live on every market tick - see the Live indicator in the top bar" />
        {recentEvents.length === 0 ? (
          <EmptyState title="Nothing triggered yet" description="Firing conditions are checked on every market tick (try 'Simulate market tick' on Markets)." />
        ) : (
          <ul className="divide-y divide-paper-200 dark:divide-ink-800">
            {recentEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{event.subjectLabel}</p>
                  <p className="text-xs text-paper-muted dark:text-ink-muted">{event.message}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-paper-muted dark:text-ink-muted">
                  {new Date(event.triggeredAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
