import { getFreshnessHealth, getProviderHealth, listMappingReviewItems, listMarkets } from "@/lib/data-source";
import { getUserCount as getMockUserCount } from "@/lib/auth/user-store";
import { getUserCount as getRealUserCount } from "@/lib/db/user-profile";
import { getRecentAuditLogs, type AuditLogRow } from "@/lib/db/queries";
import { getExplanationLogs } from "@/lib/ai/explain";
import { requireAdmin } from "@/lib/auth/require-admin";
import { EmptyState, Metric, Panel, PanelHeader } from "@/components/ui/primitives";

const IS_CLERK = process.env.AUTH_PROVIDER === "clerk";
const USE_MOCK = process.env.USE_MOCK_DATA !== "false";

export default async function AdminPage() {
  await requireAdmin();

  const [health, mappingReview, providerHealth, markets, userCount, auditLogs] = await Promise.all([
    getFreshnessHealth(),
    listMappingReviewItems(),
    getProviderHealth(),
    listMarkets(),
    IS_CLERK ? getRealUserCount() : Promise.resolve(getMockUserCount()),
    USE_MOCK ? Promise.resolve<AuditLogRow[]>([]) : getRecentAuditLogs()
  ]);
  const aiLogs = getExplanationLogs().slice(-10).reverse();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="rounded-xs border border-info bg-info-soft px-4 py-2 text-xs text-ink-950">
        Section 12.3: RBAC is enforced - only the {"role: \"admin\""} account can reach this page, in mock or real mode.
        {IS_CLERK
          ? " MFA is also enforced here via a fresh two-factor check - your Clerk project must have MFA enabled for that to mean anything."
          : " Mock mode has no MFA story by design - mock auth has no first factor to begin with, so there's nothing to layer a second one on top of. See README.md's \"Admin access\" section."}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel className="p-4">
          <Metric label="Quote freshness SLA" value={`${(health.pctHealthy * 100).toFixed(1)}%`} tone={health.pctHealthy >= 0.95 ? "signal" : "caution"} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Markets tracked" value={String(markets.length)} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Registered users" value={String(userCount)} />
        </Panel>
        <Panel className="p-4">
          <Metric label="Mapping exceptions" value={String(mappingReview.length)} tone={mappingReview.length > 0 ? "caution" : "signal"} />
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Provider health"
          subtitle={
            process.env.USE_MOCK_DATA !== "false"
              ? "Mock mode - static stand-in, not reading from the real ProviderHealth table"
              : "Real mode - reading live from the ProviderHealth table, written by each ingestion run"
          }
        />
        {providerHealth.length === 0 ? (
          <EmptyState title="No provider health recorded yet" description="Run `npm run ingest` at least once to populate this." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Books covered</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Quota remaining</th>
                <th className="px-4 py-2">Latency</th>
                <th className="px-4 py-2">Last success</th>
                <th className="px-4 py-2">Circuit breaker</th>
                <th className="px-4 py-2">Consecutive failures</th>
              </tr>
            </thead>
            <tbody>
              {providerHealth.map((row) => (
                <tr key={row.providerKey} className="border-t border-paper-200 dark:border-ink-800">
                  <td className="px-4 py-2">{row.providerKey}</td>
                  <td className="px-4 py-2">{row.booksCovered.join(", ")}</td>
                  <td
                    className={
                      row.status === "healthy" ? "px-4 py-2 text-signal-text" : row.status === "degraded" ? "px-4 py-2 text-caution-text" : "px-4 py-2 text-risk-text"
                    }
                  >
                    {row.status === "healthy" ? "Healthy" : row.status === "degraded" ? "Degraded" : "Down"}
                  </td>
                  <td className="px-4 py-2 font-mono tabular">{row.quotaRemaining ?? "-"}</td>
                  <td className="px-4 py-2 font-mono tabular">{row.latencyMs !== null ? `${row.latencyMs}ms` : "-"}</td>
                  <td className="px-4 py-2 font-mono tabular text-xs">{row.lastSuccessAt ? new Date(row.lastSuccessAt).toLocaleString() : "-"}</td>
                  <td className={row.circuitBreakerOpen ? "px-4 py-2 text-risk-text" : "px-4 py-2"}>{row.circuitBreakerOpen ? "Open" : "Closed"}</td>
                  <td className="px-4 py-2 font-mono tabular">{row.consecutiveFailures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Audit log"
          subtitle={
            USE_MOCK
              ? "Mock mode - no real audit trail; mock actions aren't real security events (see README.md's \"Admin access\")"
              : "Real mode - immutable record of plan syncs and user sync events (Section 12.2/11.1)"
          }
        />
        {USE_MOCK ? (
          <EmptyState title="Not available in mock mode" description="Audit logging (Section 11.1) is a real-mode-only concern, same reasoning as the admin MFA check having no mock equivalent." />
        ) : auditLogs.length === 0 ? (
          <EmptyState title="No audit entries yet" description="Plan changes (Stripe webhook) and user sync events (Clerk webhook) will appear here." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Object</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((entry) => (
                <tr key={entry.id} className="border-t border-paper-200 dark:border-ink-800">
                  <td className="px-4 py-2 font-mono tabular text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 capitalize">{entry.actorType}{entry.actorId ? ` (${entry.actorId})` : ""}</td>
                  <td className="px-4 py-2">{entry.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 font-mono tabular text-xs">{entry.objectType}:{entry.objectId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Mapping review queue" subtitle="Identity confidence below threshold - hidden from public ranking" />
        {mappingReview.length === 0 ? (
          <EmptyState title="Nothing pending review" description="Quotes with low mapping confidence will appear here." />
        ) : (
          <ul className="divide-y divide-paper-200 dark:divide-ink-800">
            {mappingReview.map((item) => (
              <li key={item.key} className="flex justify-between px-4 py-2 text-sm">
                <span>{item.label}</span>
                <span className="text-xs text-paper-muted dark:text-ink-muted">{item.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="AI explanation log" subtitle="Prompt version, model, latency, safety state (Section 9.4)" />
        {aiLogs.length === 0 ? (
          <EmptyState title="No explanations generated yet" description="Requests from the Analyzer will be logged here." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Latency</th>
                <th className="px-4 py-2">State</th>
              </tr>
            </thead>
            <tbody>
              {aiLogs.map((log, i) => (
                <tr key={i} className="border-t border-paper-200 dark:border-ink-800">
                  <td className="px-4 py-2 font-mono tabular text-xs">{log.outcomeId}</td>
                  <td className="px-4 py-2">{log.model}</td>
                  <td className="px-4 py-2 font-mono tabular">{log.latencyMs}ms</td>
                  <td className="px-4 py-2 capitalize">{log.refusalOrSafetyState.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
