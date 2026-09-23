/**
 * Regression test: a Route Handler that calls `request.json()` directly
 * throws an unhandled SyntaxError on an empty/aborted body instead of
 * returning a clean 400. That crashed a request mid-manual-QA and is worth
 * guarding permanently - every route in app/api goes through
 * parseJsonBody instead of calling request.json() itself (see grep in
 * app/api for "await request.json()" - it should never match).
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody, parseJsonBody } from "./error";

function requestWithBody(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body
  });
}

describe("parseJsonBody", () => {
  it("parses a well-formed body", async () => {
    const result = await parseJsonBody<{ status: string }>(requestWithBody('{"status":"won"}'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.status).toBe("won");
  });

  it("returns a clean 400 instead of throwing on an empty body", async () => {
    const result = await parseJsonBody(requestWithBody(""));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("returns a clean 400 instead of throwing on malformed JSON", async () => {
    const result = await parseJsonBody(requestWithBody("{not valid json"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});

/**
 * Section 14 QA pass: most routes used to do their own ad-hoc field checks
 * (or nothing - see lib/db/user-profile.ts's updatePreferences call sites,
 * which used to cast an unvalidated body straight to `any`). parseBody is
 * the one path every route with a body goes through now.
 */
describe("parseBody", () => {
  const schema = z.object({ threshold: z.number().finite(), conditionType: z.enum(["edge_threshold", "odds_threshold"]) });

  it("accepts a body matching the schema", async () => {
    const result = await parseBody(requestWithBody('{"threshold":3.5,"conditionType":"edge_threshold"}'), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.threshold).toBe(3.5);
  });

  it("rejects an enum value outside the schema instead of passing it through", async () => {
    const result = await parseBody(requestWithBody('{"threshold":3.5,"conditionType":"not_a_real_condition"}'), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("rejects a non-numeric threshold instead of silently coercing to NaN downstream", async () => {
    const result = await parseBody(requestWithBody('{"threshold":"not a number","conditionType":"edge_threshold"}'), schema);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing required field", async () => {
    const result = await parseBody(requestWithBody('{"conditionType":"edge_threshold"}'), schema);
    expect(result.ok).toBe(false);
  });

  it("returns a clean 400 instead of throwing on malformed JSON", async () => {
    const result = await parseBody(requestWithBody("{not valid json"), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});
