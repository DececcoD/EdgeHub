/**
 * Fixture matches The Odds API's real documented v4 response shape
 * (verified 2026-09-20 - see types.ts). If their schema changes, this
 * fixture should be the first thing updated, before touching normalize.ts.
 */
import { describe, expect, it } from "vitest";
import { normalizeEvents } from "./normalize";
import type { RawEvent } from "./types";

const FIXTURE: RawEvent[] = [
  {
    id: "abc123",
    sport_key: "americanfootball_nfl",
    sport_title: "NFL",
    commence_time: "2026-09-21T17:00:00Z",
    home_team: "Baltimore Ravens",
    away_team: "Buffalo Bills",
    bookmakers: [
      {
        key: "fanduel",
        title: "FanDuel",
        last_update: "2026-09-20T12:00:00Z",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Baltimore Ravens", price: -145 },
              { name: "Buffalo Bills", price: 122 }
            ]
          },
          {
            key: "spreads",
            outcomes: [
              { name: "Baltimore Ravens", price: -110, point: -2.5 },
              { name: "Buffalo Bills", price: -110, point: 2.5 }
            ]
          },
          {
            key: "totals",
            outcomes: [
              { name: "Over", price: -108, point: 47.5 },
              { name: "Under", price: -112, point: 47.5 }
            ]
          }
        ]
      },
      {
        key: "williamhill_us", // Caesars' legacy key
        title: "Caesars",
        last_update: "2026-09-20T11:58:00Z",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Baltimore Ravens", price: -140 },
              { name: "Buffalo Bills", price: 118 }
            ]
          }
        ]
      },
      {
        // Not in MVP scope - should be silently skipped, not an error.
        key: "pinnacle",
        title: "Pinnacle",
        last_update: "2026-09-20T12:00:00Z",
        markets: [{ key: "h2h", outcomes: [{ name: "Baltimore Ravens", price: -138 }] }]
      }
    ]
  },
  {
    id: "def456",
    sport_key: "basketball_nba", // unsupported for this test - should be skipped with a warning
    sport_title: "NBA",
    commence_time: "2026-09-21T20:00:00Z",
    home_team: "Boston Celtics",
    away_team: "Denver Nuggets",
    bookmakers: []
  }
];

describe("normalizeEvents against a real-shaped fixture", () => {
  const fetchedAt = new Date("2026-09-20T12:05:00Z");
  const result = normalizeEvents(FIXTURE, fetchedAt);

  it("normalizes every supported event", () => {
    // NBA event in this fixture has sport_key basketball_nba, which IS
    // supported in mappings.ts, so it should still appear.
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toEqual({
      providerEventId: "abc123",
      league: "nfl",
      commenceTime: "2026-09-21T17:00:00Z",
      homeTeamName: "Baltimore Ravens",
      awayTeamName: "Buffalo Bills"
    });
  });

  it("skips bookmakers outside MVP scope (Pinnacle) without warning or error", () => {
    const pinnacleQuotes = result.quotes.filter((q) => q.sportsbook === ("pinnacle" as any));
    expect(pinnacleQuotes).toHaveLength(0);
  });

  it("maps Caesars' legacy williamhill_us key correctly", () => {
    const caesarsQuote = result.quotes.find((q) => q.sportsbook === "caesars");
    expect(caesarsQuote).toBeDefined();
    expect(caesarsQuote!.americanOdds).toBe(-140);
  });

  it("resolves home/away side correctly for moneyline and spread", () => {
    const homeMoneyline = result.quotes.find(
      (q) => q.sportsbook === "fanduel" && q.marketType === "moneyline" && q.side === "home"
    );
    expect(homeMoneyline?.americanOdds).toBe(-145);

    const awaySpread = result.quotes.find(
      (q) => q.sportsbook === "fanduel" && q.marketType === "spread" && q.side === "away"
    );
    expect(awaySpread?.point).toBe(2.5);
  });

  it("resolves over/under side correctly for totals", () => {
    const over = result.quotes.find((q) => q.marketType === "total" && q.side === "over");
    expect(over?.point).toBe(47.5);
    expect(over?.americanOdds).toBe(-108);
  });

  it("converts American odds to decimal correctly (chains into lib/calc/odds)", () => {
    const homeMoneyline = result.quotes.find(
      (q) => q.sportsbook === "fanduel" && q.marketType === "moneyline" && q.side === "home"
    );
    // -145 -> 1 + 100/145
    expect(homeMoneyline?.decimalOdds).toBeCloseTo(1 + 100 / 145, 6);
  });

  it("stamps fetchedAt from the client's observed time, not the bookmaker's last_update", () => {
    const quote = result.quotes[0]!;
    expect(quote.fetchedAt).toBe("2026-09-20T12:05:00.000Z");
    expect(quote.bookLastUpdate).not.toBe(quote.fetchedAt);
  });

  it("produces no warnings for a well-formed fixture", () => {
    expect(result.warnings).toHaveLength(0);
  });

  it("warns instead of throwing when an outcome name matches neither team nor over/under", () => {
    const malformed: RawEvent[] = [
      {
        id: "zzz",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: "2026-09-21T17:00:00Z",
        home_team: "Baltimore Ravens",
        away_team: "Buffalo Bills",
        bookmakers: [
          {
            key: "fanduel",
            title: "FanDuel",
            last_update: "2026-09-20T12:00:00Z",
            markets: [{ key: "h2h", outcomes: [{ name: "Draw", price: 500 }] }]
          }
        ]
      }
    ];
    const badResult = normalizeEvents(malformed, fetchedAt);
    expect(badResult.quotes).toHaveLength(0);
    expect(badResult.warnings).toHaveLength(1);
    expect(badResult.warnings[0]).toMatch(/Draw/);
  });
});
