import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { settleTrackedPredictionPosition } from "@/lib/mock/user-data";
import { apiError, parseBody } from "@/lib/api/error";
import { settlePredictionPositionSchema } from "@/lib/api/schemas";

export async function PATCH(request: Request, { params }: { params: { positionId: string } }) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, settlePredictionPositionSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const updated = settleTrackedPredictionPosition(session.userId, params.positionId, body.status, {
    closingPrice: body.closingPrice
  });

  if (!updated) return apiError("NOT_FOUND", "Position not found.", 404);
  return NextResponse.json({ data: updated });
}
