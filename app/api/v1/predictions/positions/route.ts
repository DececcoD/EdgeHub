import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { createPredictionPosition, listPredictionPositions } from "@/lib/mock/user-data";
import { parseBody } from "@/lib/api/error";
import { createPredictionPositionSchema } from "@/lib/api/schemas";

export async function GET() {
  const session = await getSessionOrDemo();
  return NextResponse.json({ data: listPredictionPositions(session.userId) });
}

export async function POST(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, createPredictionPositionSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const position = createPredictionPosition({
    userId: session.userId,
    provider: body.provider,
    providerMarketId: body.providerMarketId,
    marketTitle: body.marketTitle,
    outcomeLabel: body.outcomeLabel,
    entryPrice: body.entryPrice,
    stakeAmount: body.stakeAmount,
    placedAt: body.placedAt ?? new Date().toISOString(),
    notes: body.notes
  });

  return NextResponse.json({ data: position }, { status: 201 });
}
