import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements, hasQuotaRemaining } from "@/lib/billing/entitlements";
import { getAiUsageToday, incrementAiUsage } from "@/lib/mock/user-data";
import { explainOutcome } from "@/lib/ai/explain";
import { apiError } from "@/lib/api/error";

export async function POST(_request: Request, { params }: { params: { outcomeId: string } }) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const used = getAiUsageToday(session.userId);

  if (!hasQuotaRemaining(entitlements.aiExplanationsPerDay, used)) {
    return apiError(
      "AI_QUOTA_EXCEEDED",
      `Daily AI explanation limit reached for the ${entitlements.label} plan (${entitlements.aiExplanationsPerDay}/day).`,
      429,
      { retryable: false }
    );
  }

  const result = await explainOutcome(params.outcomeId);
  if (!result) return apiError("MARKET_STALE", "This outcome could not be resolved.", 404);

  if (!result.cached) incrementAiUsage(session.userId);

  return NextResponse.json({ ...result, quota: { used: getAiUsageToday(session.userId), limit: entitlements.aiExplanationsPerDay } });
}
