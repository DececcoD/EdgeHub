/**
 * Ingestion circuit breaker (Section 11.2) - previously a no-op: the
 * pipeline unconditionally set `circuitBreakerOpen: false` on every failed
 * run and never tracked how many failures in a row had happened, so a
 * genuinely broken/rate-limited provider would get hammered with a fresh
 * request every single run, forever.
 *
 * Standard closed -> open -> half-open -> closed shape, reusing
 * ProviderHealth.updatedAt (already `@updatedAt`) as "time of last state
 * change" instead of adding a dedicated timestamp column - it's already
 * exactly that, since every write in this module changes the row.
 */
import type { PrismaClient } from "@prisma/client";

export const FAILURE_THRESHOLD = 3; // consecutive failures before the breaker opens
export const COOLDOWN_MS = 5 * 60_000; // how long the breaker stays open before allowing a half-open trial

export interface CircuitState {
  open: boolean;
  consecutiveFailures: number;
}

/**
 * True if a run should be skipped entirely without ever calling the
 * provider - the breaker is open and the cooldown hasn't elapsed yet.
 * Once cooldown elapses, this returns false exactly once per open period
 * (a "half-open" trial) - the run that follows determines whether
 * recordSuccess() closes the breaker or recordFailure() re-opens it with a
 * fresh cooldown window.
 */
export async function shouldSkip(prisma: PrismaClient, providerId: string): Promise<boolean> {
  const health = await prisma.providerHealth.findUnique({ where: { providerId } });
  if (!health?.circuitBreakerOpen) return false;
  const msSinceOpened = Date.now() - health.updatedAt.getTime();
  return msSinceOpened < COOLDOWN_MS;
}

export async function recordSuccess(prisma: PrismaClient, providerId: string): Promise<void> {
  await prisma.providerHealth.upsert({
    where: { providerId },
    update: { consecutiveFailures: 0, circuitBreakerOpen: false },
    create: { providerId, consecutiveFailures: 0, circuitBreakerOpen: false }
  });
}

export async function recordFailure(prisma: PrismaClient, providerId: string): Promise<CircuitState> {
  const existing = await prisma.providerHealth.findUnique({ where: { providerId } });
  const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
  const open = consecutiveFailures >= FAILURE_THRESHOLD;

  await prisma.providerHealth.upsert({
    where: { providerId },
    update: { consecutiveFailures, circuitBreakerOpen: open },
    create: { providerId, consecutiveFailures, circuitBreakerOpen: open }
  });

  return { open, consecutiveFailures };
}
