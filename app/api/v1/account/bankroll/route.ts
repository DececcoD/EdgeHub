import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { clearBankroll, getBankroll, setBankroll } from "@/lib/data-source";
import { parseBody } from "@/lib/api/error";
import { bankrollSchema } from "@/lib/api/schemas";

// Goes through lib/data-source.ts's USE_MOCK_DATA seam - see that file's
// getBankroll/setBankroll/clearBankroll for the real-mode requirement
// (needs AUTH_PROVIDER=clerk, not just USE_MOCK_DATA=false).

export async function GET() {
  const session = await getSessionOrDemo();
  return NextResponse.json({ data: await getBankroll(session.userId) });
}

export async function PATCH(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, bankrollSchema);
  if (!parsed.ok) return parsed.response;
  const settings = await setBankroll(session.userId, parsed.body);
  return NextResponse.json({ data: settings });
}

export async function DELETE() {
  const session = await getSessionOrDemo();
  await clearBankroll(session.userId);
  return NextResponse.json({ data: { ok: true } });
}
