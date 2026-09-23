import { getSessionOrDemo } from "@/lib/auth/session";
import { PreferencesForm } from "@/components/account/preferences-form";
import { PlanSelector } from "@/components/account/plan-selector";
import { Panel, PanelHeader } from "@/components/ui/primitives";

export default async function AccountPage() {
  const session = await getSessionOrDemo();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Panel className="p-4">
        <p className="text-xs uppercase tracking-wide text-paper-muted dark:text-ink-muted">Signed in as</p>
        <p className="font-display text-lg font-semibold">{session.email}</p>
      </Panel>

      <PlanSelector currentPlan={session.plan} />
      <PreferencesForm preferences={session.preferences} />

      <Panel>
        <PanelHeader title="Responsible use" subtitle="Section 12.2 - self-set limits, no coercive copy" />
        <div className="flex flex-col gap-2 p-4 text-sm">
          <p className="text-paper-muted dark:text-ink-muted">
            EdgeHub never places wagers and never guarantees an outcome. If you&apos;d like a break from alerts and
            opportunity notifications, you can pause your account at any time - your tracker history is kept, nothing
            is deleted.
          </p>
          <div className="flex gap-2">
            <button className="inline-flex items-center rounded-xs border border-paper-200 px-3 py-1.5 text-sm font-medium hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
              Pause my account
            </button>
            <a href="/responsible-use" className="inline-flex items-center rounded-xs border border-paper-200 px-3 py-1.5 text-sm font-medium hover:bg-paper-50 dark:border-ink-800 dark:hover:bg-ink-800">
              Get help resources
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}
