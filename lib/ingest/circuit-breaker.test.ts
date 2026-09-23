/**
 * Tests the breaker's decision logic against a minimal in-memory fake
 * standing in for Prisma - the same pattern lib/ingest/identity.test.ts
 * uses, for the same reason: proves the state-transition logic is sound,
 * not that the real Prisma queries are wired correctly (needs a real
 * database, not available in this environment).
 */
import { describe, expect, it } from "vitest";
import { shouldSkip, recordSuccess, recordFailure, FAILURE_THRESHOLD, COOLDOWN_MS } from "./circuit-breaker";

interface FakeHealthRow {
  providerId: string;
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
  updatedAt: Date;
}

function makeFakePrisma() {
  const rows = new Map<string, FakeHealthRow>();

  return {
    providerHealth: {
      findUnique: async ({ where }: { where: { providerId: string } }) => rows.get(where.providerId) ?? null,
      upsert: async ({ where, update, create }: { where: { providerId: string }; update: Partial<FakeHealthRow>; create: Partial<FakeHealthRow> }) => {
        const existing = rows.get(where.providerId);
        const next: FakeHealthRow = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { providerId: where.providerId, circuitBreakerOpen: false, consecutiveFailures: 0, ...create, updatedAt: new Date() };
        rows.set(where.providerId, next);
        return next;
      }
    }
  } as any;
}

describe("ingestion circuit breaker (Section 11.2)", () => {
  it("stays closed and does not skip after fewer than the failure threshold", async () => {
    const prisma = makeFakePrisma();
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) await recordFailure(prisma, "p1");
    expect(await shouldSkip(prisma, "p1")).toBe(false);
  });

  it("opens and skips once consecutive failures reach the threshold", async () => {
    const prisma = makeFakePrisma();
    let state;
    for (let i = 0; i < FAILURE_THRESHOLD; i++) state = await recordFailure(prisma, "p1");
    expect(state!.open).toBe(true);
    expect(state!.consecutiveFailures).toBe(FAILURE_THRESHOLD);
    expect(await shouldSkip(prisma, "p1")).toBe(true);
  });

  it("allows a half-open trial once the cooldown elapses, and closes again on success", async () => {
    const prisma = makeFakePrisma();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) await recordFailure(prisma, "p1");
    expect(await shouldSkip(prisma, "p1")).toBe(true);

    // Simulate cooldown having elapsed by backdating updatedAt directly.
    const row = await prisma.providerHealth.findUnique({ where: { providerId: "p1" } });
    row.updatedAt = new Date(Date.now() - COOLDOWN_MS - 1000);

    expect(await shouldSkip(prisma, "p1")).toBe(false); // half-open trial allowed through

    await recordSuccess(prisma, "p1");
    const after = await prisma.providerHealth.findUnique({ where: { providerId: "p1" } });
    expect(after.circuitBreakerOpen).toBe(false);
    expect(after.consecutiveFailures).toBe(0);
    expect(await shouldSkip(prisma, "p1")).toBe(false);
  });

  it("re-opens with a fresh cooldown if the half-open trial also fails", async () => {
    const prisma = makeFakePrisma();
    for (let i = 0; i < FAILURE_THRESHOLD; i++) await recordFailure(prisma, "p1");

    const row = await prisma.providerHealth.findUnique({ where: { providerId: "p1" } });
    row.updatedAt = new Date(Date.now() - COOLDOWN_MS - 1000);
    expect(await shouldSkip(prisma, "p1")).toBe(false);

    await recordFailure(prisma, "p1"); // the half-open trial itself fails
    expect(await shouldSkip(prisma, "p1")).toBe(true); // re-opened, fresh cooldown starting now
  });

  it("a single failure never opens the breaker on its own", async () => {
    const prisma = makeFakePrisma();
    const state = await recordFailure(prisma, "p1");
    expect(state.open).toBe(false);
    expect(await shouldSkip(prisma, "p1")).toBe(false);
  });
});
