import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMarkets, fetchOrderbook } from "./client";
import { PolymarketApiError } from "./types";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.POLYMARKET_GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
  process.env.POLYMARKET_CLOB_BASE_URL = "https://clob.polymarket.com";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
    text: async () => JSON.stringify(response.body)
  }) as unknown as typeof fetch;
}

describe("fetchMarkets (Gamma)", () => {
  it("calls GET /markets/keyset with no auth params, since this endpoint is public", async () => {
    mockFetch({ ok: true, status: 200, body: { markets: [], next_cursor: "" } });

    await fetchMarkets({ closed: false, limit: 20, tagId: "745" });

    const calledUrl = new URL((global.fetch as any).mock.calls[0][0] as string);
    expect(calledUrl.hostname).toBe("gamma-api.polymarket.com");
    expect(calledUrl.pathname).toBe("/markets/keyset");
    expect(calledUrl.searchParams.get("closed")).toBe("false");
    expect(calledUrl.searchParams.get("limit")).toBe("20");
    expect(calledUrl.searchParams.get("tag_id")).toBe("745");
    expect(calledUrl.searchParams.has("apiKey")).toBe(false);
  });

  it("throws PolymarketApiError (not a raw fetch error) on a non-2xx response", async () => {
    mockFetch({ ok: false, status: 500, body: { error: "internal" } });
    await expect(fetchMarkets()).rejects.toThrow(PolymarketApiError);
  });

  it("returns the response's markets/next_cursor wrapper as-is", async () => {
    const body = { markets: [{ id: "1" }], next_cursor: "abc" };
    mockFetch({ ok: true, status: 200, body });
    const result = await fetchMarkets();
    expect(result).toEqual(body);
  });
});

describe("fetchOrderbook (CLOB)", () => {
  it("calls GET /book?token_id=... on the CLOB host", async () => {
    mockFetch({ ok: true, status: 200, body: { market: "x", asset_id: "tok", bids: [], asks: [] } });

    await fetchOrderbook("tok_123");

    const calledUrl = new URL((global.fetch as any).mock.calls[0][0] as string);
    expect(calledUrl.hostname).toBe("clob.polymarket.com");
    expect(calledUrl.pathname).toBe("/book");
    expect(calledUrl.searchParams.get("token_id")).toBe("tok_123");
  });

  it("throws PolymarketApiError on a non-2xx response", async () => {
    mockFetch({ ok: false, status: 404, body: { error: "not found" } });
    await expect(fetchOrderbook("nonexistent")).rejects.toThrow(PolymarketApiError);
  });
});
