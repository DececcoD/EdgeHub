import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { getEntitlements, hasQuotaRemaining } from "@/lib/billing/entitlements";
import { createBet, listBets } from "@/lib/mock/user-data";
import { validateCsv } from "@/lib/tracker/csv";
import { parseBody } from "@/lib/api/error";
import { importCsvSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  const session = await getSessionOrDemo();
  const entitlements = getEntitlements(session.plan);
  const parsed = await parseBody(request, importCsvSchema);
  if (!parsed.ok) return parsed.response;
  const { csv } = parsed.body;

  const { valid, rejected } = validateCsv(csv);
  const existingCount = listBets(session.userId).length;
  const createdBets = [];
  const skippedForLimit: number[] = [];

  for (const row of valid) {
    if (!hasQuotaRemaining(entitlements.betTrackerLimit, existingCount + createdBets.length)) {
      skippedForLimit.push(row.rowNumber);
      continue;
    }
    createdBets.push(
      createBet({
        userId: session.userId,
        eventId: `import_${row.rowNumber}_${Date.now()}`,
        eventLabel: row.eventLabel,
        leagueKey: row.leagueKey,
        marketType: row.marketType,
        selectionLabel: row.selectionLabel,
        sportsbookKey: row.sportsbookKey,
        placedAt: row.placedAt,
        oddsAmerican: row.oddsAmerican,
        stakeAmount: row.stakeAmount,
        notes: row.notes
      })
    );
  }

  return NextResponse.json({
    created: createdBets.length,
    rejected,
    skippedForPlanLimit: skippedForLimit
  });
}
