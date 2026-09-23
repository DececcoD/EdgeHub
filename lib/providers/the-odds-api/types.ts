/**
 * Raw response shapes for The Odds API v4 - https://the-odds-api.com/liveapi/guides/v4/
 *
 * Verified against their public docs 2026-09-20. Field names here must match
 * exactly what the API returns - this file has no business logic, only the
 * wire format. Any deviation from the real API response breaks silently at
 * runtime, not at compile time, so keep this in lockstep with their docs if
 * their schema ever changes.
 */

export interface RawOutcome {
  name: string;
  price: number;
  /** Present for spreads/totals; absent for h2h. */
  point?: number;
}

export interface RawMarket {
  key: "h2h" | "spreads" | "totals" | string;
  last_update?: string;
  outcomes: RawOutcome[];
}

export interface RawBookmaker {
  key: string;
  title: string;
  last_update: string; // ISO 8601
  markets: RawMarket[];
}

export interface RawEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO 8601
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
}

export interface RawSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

/** Parsed from x-requests-remaining / x-requests-used / x-requests-last response headers. */
export interface QuotaInfo {
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
}

export class OddsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly quota: QuotaInfo
  ) {
    super(message);
    this.name = "OddsApiError";
  }
}
