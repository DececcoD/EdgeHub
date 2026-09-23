import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { limit: 5, windowSeconds: 60 }).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit, with a positive retryAfterSeconds", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key, { limit: 5, windowSeconds: 60 });
    const blocked = checkRateLimit(key, { limit: 5, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, { limit: 5, windowSeconds: 60 });
    expect(checkRateLimit(keyA, { limit: 5, windowSeconds: 60 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { limit: 5, windowSeconds: 60 }).allowed).toBe(true);
  });
});
