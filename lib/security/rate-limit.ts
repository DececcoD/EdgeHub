/**
 * Fixed-window rate limiting (Section 14 QA pass) - there was none
 * anywhere in the app before this, including on login/signup, which had
 * no defense against a scripted brute-force/enumeration loop.
 *
 * In-process only, by design, matching this project's existing "in-
 * process default, Redis for cross-process correctness" pattern (see
 * lib/realtime/bus.ts) - but NOT extended to Redis here. A real multi-
 * instance deployment needs a shared store for this to actually work (an
 * attacker could otherwise spread requests across instances to bypass a
 * per-instance counter entirely) - that's a stated, deliberate scope
 * boundary, not an oversight: this project has no live multi-instance
 * environment to size or test a distributed limiter against, and a
 * single-instance limiter is still real protection against the common
 * single-source scripted-abuse case.
 */

interface Bucket {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Best-effort client identifier - the standard proxy header, falling back to a shared bucket if absent (e.g. direct connections in dev) rather than skipping the limit entirely. */
export function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, opts: { limit: number; windowSeconds: number }): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.windowStartedAt + windowMs - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
