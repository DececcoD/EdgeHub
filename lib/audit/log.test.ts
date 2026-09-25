/**
 * Tests against a minimal in-memory fake standing in for Prisma - same
 * pattern lib/ingest/circuit-breaker.test.ts uses, for the same reason:
 * proves the write shape/hashing logic is sound, not that the real
 * `prisma.auditLog.create()` query is wired correctly (needs a real
 * database, not available in this environment - see log.ts's header).
 */
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordAuditLog } from "./log";

function makeFakePrisma() {
  const rows: any[] = [];
  return {
    rows,
    prisma: {
      auditLog: {
        create: async ({ data }: { data: any }) => {
          const row = { id: `audit_${rows.length + 1}`, createdAt: new Date(), ...data };
          rows.push(row);
          return row;
        }
      }
    } as any
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordAuditLog", () => {
  it("writes actor/action/object fields as given, and a generated requestId when none is supplied", async () => {
    const { prisma, rows } = makeFakePrisma();
    await recordAuditLog(prisma, { actorType: "system", actorId: "user_1", action: "plan_synced", objectType: "subscription", objectId: "sub_1" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: "system", actorId: "user_1", action: "plan_synced", objectType: "subscription", objectId: "sub_1" });
    expect(typeof rows[0].requestId).toBe("string");
    expect(rows[0].requestId.length).toBeGreaterThan(0);
  });

  it("hashes before/after state rather than storing it raw", async () => {
    const { prisma, rows } = makeFakePrisma();
    const before = { plan: "free" };
    const after = { plan: "pro" };
    await recordAuditLog(prisma, { actorType: "system", actorId: "user_1", action: "plan_synced", objectType: "subscription", objectId: "sub_1", before, after });

    expect(rows[0].beforeHash).toBe(createHash("sha256").update(JSON.stringify(before)).digest("hex"));
    expect(rows[0].afterHash).toBe(createHash("sha256").update(JSON.stringify(after)).digest("hex"));
    expect(JSON.stringify(rows[0])).not.toContain("free");
    expect(JSON.stringify(rows[0])).not.toContain("pro");
  });

  it("leaves beforeHash null when before is omitted (a creation event with no prior state)", async () => {
    const { prisma, rows } = makeFakePrisma();
    await recordAuditLog(prisma, { actorType: "system", actorId: null, action: "user_created", objectType: "user", objectId: "user_2", after: { email: "a@example.com" } });

    expect(rows[0].beforeHash).toBeNull();
    expect(rows[0].afterHash).not.toBeNull();
  });

  it("never throws when the write itself fails - callers should never crash because an audit entry couldn't be recorded", async () => {
    const prisma = { auditLog: { create: async () => { throw new Error("db unreachable"); } } } as any;
    await expect(
      recordAuditLog(prisma, { actorType: "system", actorId: "user_1", action: "plan_synced", objectType: "subscription", objectId: "sub_1" })
    ).resolves.toBeUndefined();
  });

  it("uses an explicitly supplied requestId instead of generating one", async () => {
    const { prisma, rows } = makeFakePrisma();
    await recordAuditLog(prisma, { actorType: "admin", actorId: "admin_1", action: "grant_admin", objectType: "user", objectId: "user_3", requestId: "req_explicit" });
    expect(rows[0].requestId).toBe("req_explicit");
  });
});
