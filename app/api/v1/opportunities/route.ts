/**
 * GET /api/v1/opportunities - Appendix A.1 illustrative contract.
 * Real params: league, market, min_edge_pp, book.
 */
import { NextResponse } from "next/server";
import { listOpportunities } from "@/lib/data-source";
import type { LeagueKey, MarketType, SportsbookKey } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league") as LeagueKey | null;
  const market = searchParams.get("market") as MarketType | null;
  const minEdgePp = searchParams.get("min_edge_pp");
  const book = searchParams.get("book") as SportsbookKey | null;

  const rows = await listOpportunities({
    leagueKey: league ?? undefined,
    marketType: market ?? undefined,
    minEdgePp: minEdgePp ? Number(minEdgePp) : undefined,
    sportsbookKey: book ?? undefined
  });

  return NextResponse.json({ data: rows, count: rows.length });
}
