import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMarkets, fetchOrderbook } from "./client";
import { KalshiApiError } from "./types";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.KALSHI_API_BASE_URL = "https://external-api.demo.kalshi.co/trade-api/v2";
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

describe("fetchMarkets", () => {
  it("calls GET /markets with no auth params, since this endpoint is public", async () => {
    mockFetch({ ok: true, status: 200, body: { markets: [], cursor: "" } });

    await fetchMarkets({ limit: 50, eventTicker: "FED-25DEC", status: "active" });

    const calledUrl = new URL((global.fetch as any).mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/trade-api/v2/markets");
    expect(calledUrl.searchParams.get("limit")).toBe("50");
    expect(calledUrl.searchParams.get("event_ticker")).toBe("FED-25DEC");
    expect(calledUrl.searchParams.get("status")).toBe("active");
    expect(calledUrl.searchParams.has("apiKey")).toBe(false);
  });

  it("defaults to the demo environment host", async () => {
    delete process.env.KALSHI_API_BASE_URL;
    mockFetch({ ok: true, status: 200, body: { markets: [], cursor: "" } });

    await fetchMarkets();

    const calledUrl = new URL((global.fetch as any).mock.calls[0][0] as string);
    expect(calledUrl.hostname).toBe("external-api.demo.kalshi.co");
  });

  it("throws KalshiApiError (not a raw fetch error) on a non-2xx response", async () => {
    mockFetch({ ok: false, status: 500, body: { error: "internal" } });
    await expect(fetchMarkets()).rejects.toThrow(KalshiApiError);
  });

  it("returns the response's markets/cursor wrapper as-is", async () => {
    const body = { markets: [{ ticker: "X" }], cursor: "abc" };
    mockFetch({ ok: true, status: 200, body });
    const result = await fetchMarkets();
    expect(result).toEqual(body);
  });
});

describe("fetchOrderbook", () => {
  it("calls GET /markets/:ticker/orderbook with an optional depth param", async () => {
    mockFetch({ ok: true, status: 200, body: { orderbook_fp: { yes_dollars: [], no_dollars: [] } } });

    await fetchOrderbook("FED-25DEC-T4.50", 25);

    const calledUrl = new URL((global.fetch as any).mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe("/trade-api/v2/markets/FED-25DEC-T4.50/orderbook");
    expect(calledUrl.searchParams.get("depth")).toBe("25");
  });

  it("throws KalshiApiError on a non-2xx response", async () => {
    mockFetch({ ok: false, status: 404, body: { error: "not found" } });
    await expect(fetchOrderbook("nonexistent")).rejects.toThrow(KalshiApiError);
  });
});
