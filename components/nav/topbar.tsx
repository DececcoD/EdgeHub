import { PlanBadge } from "@/components/ui/primitives";
import { LogoutButton } from "@/components/nav/logout-button";
import { LiveIndicator } from "@/components/realtime/live-indicator";
import type { MockSession } from "@/lib/types";
import Link from "next/link";

export function TopBar({ session }: { session: MockSession }) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-paper-200 bg-paper-0 px-4 dark:border-ink-800 dark:bg-ink-900">
      <p className="text-xs text-paper-muted dark:text-ink-muted">
        Compare the market. Understand the edge. Track every decision.
      </p>
      <div className="flex items-center gap-3">
        <LiveIndicator />
        <PlanBadge plan={session.plan} />
        <Link href="/account" className="text-sm font-medium hover:underline">
          {session.email}
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
