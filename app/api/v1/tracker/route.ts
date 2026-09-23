import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements, hasQuotaRemaining } from "@/lib/billing/entitlements";
import { createBet, listBets } from "@/lib/mock/user-data";
import { apiError, parseBody } from "@/lib/api/error";
import { createBetSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSessionOrDemo();
  return NextResponse.json({ data: listBets(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const existing = listBets(session.userId);

  if (!hasQuotaRemaining(entitlements.betTrackerLimit, existing.length)) {
    return apiError(
      "TRACKER_LIMIT_REACHED",
      `The ${entitlements.label} plan supports up to ${entitlements.betTrackerLimit} tracked bets.`,
      429
    );
  }

  const parsed = await parseBody(request, createBetSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const bet = createBet({
    userId: session.userId,
    eventId: body.eventId,
    eventLabel: body.eventLabel,
    leagueKey: body.leagueKey,
    marketType: body.marketType,
    selectionLabel: body.selectionLabel,
    sportsbookKey: body.sportsbookKey,
    placedAt: body.placedAt ?? new Date().toISOString(),
    oddsAmerican: body.oddsAmerican,
    stakeAmount: body.stakeAmount,
    notes: body.notes
  });

  return NextResponse.json({ data: bet }, { status: 201 });
}
