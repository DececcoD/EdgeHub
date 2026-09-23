import { NextResponse } from "next/server";
import { getSessionOrDemo } from "@/lib/auth/session";
import { addToWatchlist, removeFromWatchlist } from "@/lib/mock/user-data";
import { parseBody } from "@/lib/api/error";
import { watchlistSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, watchlistSchema);
  if (!parsed.ok) return parsed.response;
  addToWatchlist(session.userId, parsed.body.outcomeId);
  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSessionOrDemo();
  const parsed = await parseBody(request, watchlistSchema);
  if (!parsed.ok) return parsed.response;
  removeFromWatchlist(session.userId, parsed.body.outcomeId);
  return NextResponse.json({ data: { ok: true } });
}
