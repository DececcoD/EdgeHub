/**
 * Audit logging - PRD Section 12.2 ("audit logging" listed alongside CSP/
 * CSRF/dependency scanning as a required security control) and the Beta
 * Launch Checklist ("Admin MFA/RBAC/audit tested"). The `AuditLog` Prisma
 * model has existed since this project's schema was first written, but
 * nothing anywhere ever called `prisma.auditLog.create()` - documented-but-
 * unwired, the same pattern the `Bankroll` model was in before Section 6.4
 * got built. Real-mode only, like the model itself: mock mode has no
 * Postgres to write an audit trail to, same reasoning `require-admin.ts`
 * already gives for why mock mode has no MFA story either.
 *
 * `beforeHash`/`afterHash` (not raw before/after state) is the schema's own
 * existing design, not a choice made here - a SHA-256 digest of the
 * JSON-serialized state lets you prove *what changed* (compare hashes) and
 * detect tampering, without duplicating potentially sensitive data (email
 * addresses, plan/billing details) a second time in a log table that may
 * have different retention/access rules than the primary tables.
 *
 * Takes an explicit `PrismaClient` param (not the module singleton) so
 * this is unit-testable against a fake, matching lib/ingest/circuit-
 * breaker.ts's own convention - the real Prisma write path itself isn't
 * live-tested against a real Postgres in this pass (Docker's daemon was
 * unresponsive when this was built - see DECISIONS.md), same disclosed
 * gap that project has hit before and closed once Docker recovered.
 *
 * Never throws: a failed audit write should never block the real
 * operation it's describing (a plan sync, a user sync) from completing -
 * logged and reported through the observability seam instead, matching
 * lib/notifications/email.ts's own "best effort, never crash the caller"
 * contract.
 */
import { randomUUID, createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { captureException, log } from "../observability";

export type AuditActorType = "user" | "admin" | "system";

export interface RecordAuditLogParams {
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string;
  /** Omit entirely (not `null`) when there is genuinely no "before" state - e.g. a creation event. */
  before?: unknown;
  after?: unknown;
  /** Defaults to a fresh UUID - this codebase has no shared per-HTTP-request correlation ID to thread through yet (a stated scope boundary, not an oversight). */
  requestId?: string;
}

function hashState(value: unknown): string | null {
  if (value === undefined) return null;
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function recordAuditLog(prisma: PrismaClient, params: RecordAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId,
        beforeHash: hashState(params.before),
        afterHash: hashState(params.after),
        requestId: params.requestId ?? randomUUID()
      }
    });
    log.info("audit_log_recorded", { action: params.action, objectType: params.objectType, objectId: params.objectId });
  } catch (error) {
    captureException(error, { source: "audit_log", action: params.action, objectType: params.objectType, objectId: params.objectId });
  }
}
