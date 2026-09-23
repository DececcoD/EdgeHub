import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { clearBankroll, getBankroll, setBankroll } from "@/lib/mock/user-data";
import { parseBody } from "@/lib/api/error";
import { bankrollSchema } from "@/lib/api/schemas";

// Mock-only, same scope boundary as tracker/alerts/watchlist - Prisma's
// Bankroll model exists but stays unwired regardless of USE_MOCK_DATA.

export async function GET() {
  const session = await getSessionOrDemo();
  return NextResponse.json({ data: getBankroll(session.userId) });
}

export async function PATCH(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, bankrollSchema);
  if (!parsed.ok) return parsed.response;
  const settings = setBankroll(session.userId, parsed.body);
  return NextResponse.json({ data: settings });
}

export async function DELETE() {
  const session = await getSessionOrDemo();
  clearBankroll(session.userId);
  return NextResponse.json({ data: { ok: true } });
}
