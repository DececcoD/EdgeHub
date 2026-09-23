import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { settleTrackedBet } from "@/lib/mock/user-data";
import { apiError, parseBody } from "@/lib/api/error";
import { settleBetSchema } from "@/lib/api/schemas";

export async function PATCH(request: Request, { params }: { params: { betId: string } }) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, settleBetSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const updated = settleTrackedBet(session.userId, params.betId, body.status, {
    cashOutAmount: body.cashOutAmount,
    cashOutStakePortion: body.cashOutStakePortion,
    closingDecimalOdds: body.closingDecimalOdds
  });

  if (!updated) return apiError("NOT_FOUND", "Bet not found.", 404);
  return NextResponse.json({ data: updated });
}
