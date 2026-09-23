/**
 * Liveness/readiness endpoint for a load balancer or container
 * orchestrator to poll (Section 11 operations). In real-data mode, pings
 * Postgres with a trivial query so a broken DATABASE_URL fails the health
 * check instead of silently serving a broken app; mock mode has no
 * database to check, so it's a pure liveness check there.
 */
import { NextResponse } from "next/server";

// Otherwise Next statically renders this route once at build time and
// serves that cached response forever - defeating the point of a liveness
// check that's supposed to reflect the server's actual state right now.
export const dynamic = "force-dynamic";

const USE_MOCK = process.env.USE_MOCK_DATA !== "false";

export async function GET() {
  if (USE_MOCK) {
    return NextResponse.json({ status: "ok", mode: "mock" });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", mode: "real" });
  } catch (error) {
    return NextResponse.json({ status: "error", mode: "real", message: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
