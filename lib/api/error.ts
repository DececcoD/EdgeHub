/** Appendix A.2 error contract - shared shape for every API route in the app. */
import { NextResponse } from "next/server";
import type { z } from "zod";

export function apiError(code: string, message: string, status: number, opts?: { retryable?: boolean; details?: unknown }) {
  return NextResponse.json(
    {
      code,
      message,
      request_id: `req_${Math.random().toString(36).slice(2, 10)}`,
      retryable: opts?.retryable ?? false,
      details: opts?.details ?? null
    },
    { status }
  );
}

/**
 * `request.json()` throws on an empty or malformed body (e.g. a client that
 * aborts mid-request, or a hand-crafted call with no body) - and an
 * unhandled throw inside a Route Handler is a 500 with no clean error
 * contract. Every route that reads a JSON body should go through this
 * instead of calling `request.json()` directly.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request
): Promise<{ ok: true; body: T } | { ok: false; response: ReturnType<typeof apiError> }> {
  try {
    const body = await request.json();
    return { ok: true, body: body as T };
  } catch {
    return { ok: false, response: apiError("VALIDATION_ERROR", "Request body must be valid JSON.", 400) };
  }
}

/**
 * Section 14 QA pass: most routes used to do their own ad-hoc field-
 * presence checks (or nothing at all - see lib/db/user-profile.ts's
 * updatePreferences call sites, which cast an unvalidated body straight
 * to `any`). This is the one path every route with a body should go
 * through now - parses JSON, then validates shape/types/enums against a
 * real zod schema (lib/api/schemas.ts) instead of trusting the caller.
 * Real invalid-input cases this actually catches that hand-rolled checks
 * didn't: an alert's `conditionType` set to a string that isn't one of
 * the 5 real values (silently never evaluates, forever), preferences'
 * `favoriteLeagues` sent as a non-array (breaks every `.map()` call on it
 * downstream), a bet's `oddsAmerican` sent as a non-numeric string
 * (produces NaN that propagates through every settlement calculation).
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<{ ok: true; body: z.infer<S> } | { ok: false; response: ReturnType<typeof apiError> }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: apiError("VALIDATION_ERROR", "Request body must be valid JSON.", 400) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue ? `${firstIssue.path.join(".") || "body"}: ${firstIssue.message}` : "Invalid request body.";
    return { ok: false, response: apiError("VALIDATION_ERROR", message, 400, { details: result.error.flatten() }) };
  }

  return { ok: true, body: result.data };
}
