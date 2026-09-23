import { NextResponse } from "next/server";
import { simulateMarketTick } from "@/lib/data-source";
import { apiError } from "@/lib/api/error";
import { realtimeBus } from "@/lib/realtime/bus";

export async function POST() {
  try {
    const result = await simulateMarketTick();
    // Alert evaluation reacts to this publish server-wide, via
    // lib/alerts/tick-listener.ts's subscription (wired up once at server
    // startup by instrumentation.ts) - it is deliberately NOT called
    // directly here. Calling it both here and from that listener would
    // double-evaluate every local tick, since publishing loops straight
    // back through the same listener.
    await realtimeBus.publish({ type: "odds_tick", ...result, at: new Date().toISOString() });
    return NextResponse.json(result);
  } catch (error) {
    return apiError("MOCK_ONLY_FEATURE", error instanceof Error ? error.message : String(error), 400);
  }
}
