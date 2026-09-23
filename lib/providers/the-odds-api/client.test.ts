import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOdds } from "./client";
import { OddsApiError } from "./types";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.ODDS_PROVIDER_API_KEY = "test_key_123";
  process.env.ODDS_PROVIDER_BASE_URL = "https://api.the-odds-api.com/v4";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function mockFetch(response: { ok: boolean; status: number; headers?: Record<string, string>; body: unknown }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers: new Headers(response.headers ?? {}),
    json: async () => response.body,
    text: async () => JSON.stringify(response.body)
  }) as unknown as typeof fetch;
}

describe("fetchOdds", () => {
  it("builds the URL with mapped sport/market/bookmaker keys and the required query params", async () => {
    mockFetch({ ok: true, status: 200, body: [] });

    await fetchOdds({ league: "nfl", markets: ["moneyline", "spread"], sportsbooks: ["fanduel", "caesars"] });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    expect(url.pathname).toBe("/v4/sports/americanfootball_nfl/odds/");
    expect(url.searchParams.get("apiKey")).toBe("test_key_123");
    expect(url.searchParams.get("markets")).toBe("h2h,spreads");
    // Caesars maps to its legacy provider key, not our internal name.
    expect(url.searchParams.get("bookmakers")).toBe("fanduel,williamhill_us");
    expect(url.searchParams.get("oddsFormat")).toBe("american");
  });

  it("parses quota headers from a successful response", async () => {
    mockFetch({
      ok: true,
      status: 200,
      headers: { "x-requests-remaining": "483", "x-requests-used": "17", "x-requests-last": "2" },
      body: []
    });

    const result = await fetchOdds({ league: "nba", markets: ["moneyline"], sportsbooks: ["fanduel"] });
    expect(result.quota).toEqual({ remaining: 483, used: 17, lastCost: 2 });
  });

  it("throws OddsApiError (not a raw fetch error) on a non-2xx response, carrying quota info along", async () => {
    mockFetch({
      ok: false,
      status: 401,
      headers: { "x-requests-remaining": "0" },
      body: { message: "Invalid API key" }
    });

    await expect(fetchOdds({ league: "nfl", markets: ["moneyline"], sportsbooks: ["fanduel"] })).rejects.toThrow(OddsApiError);
  });

  it("throws a clear error instead of silently calling the API with no key", async () => {
    delete process.env.ODDS_PROVIDER_API_KEY;
    mockFetch({ ok: true, status: 200, body: [] });

    await expect(fetchOdds({ league: "nfl", markets: ["moneyline"], sportsbooks: ["fanduel"] })).rejects.toThrow(
      /ODDS_PROVIDER_API_KEY/
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("stamps observedAt as a real Date close to call time, not the bookmaker's own timestamp", async () => {
    mockFetch({ ok: true, status: 200, body: [] });
    const before = Date.now();
    const result = await fetchOdds({ league: "mlb", markets: ["total"], sportsbooks: ["draftkings"] });
    expect(result.observedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.observedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
