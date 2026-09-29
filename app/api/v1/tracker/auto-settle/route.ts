import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { runAutoSettlement } from "@/lib/tracker/auto-settle";

/**
 * Runs lib/tracker/settlement.ts's confidence-gated matching against the
 * caller's own open bets - auto-confirms anything at or above
 * AUTO_SETTLE_CONFIDENCE_THRESHOLD, returns the rest as suggestions for
 * the Tracker page's pending-review panel to show. Triggered from the
 * Tracker page itself (see components/tracker/auto-settle-panel.tsx) -
 * not yet wired to the same realtime-tick path lib/alerts/evaluate.ts
 * uses, a disclosed scope choice, see DECISIONS.md item 7.
 */
export async function POST() {
  const session = await getSessionOrDemo();
  const result = await runAutoSettlement(session.userId);
  return NextResponse.json({ data: result });
}
