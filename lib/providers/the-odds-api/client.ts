/**
 * HTTP client for The Odds API v4. Pure transport concern - no mapping to
 * our canonical shapes here (see normalize.ts) and no persistence (see
 * ../../ingest/pipeline.ts). Section 7.3: "Fetch provider payload with
 * request ID, quota headers, and observed_at."
 */
import { OddsApiError, type QuotaInfo, type RawEvent, type RawSport } from "./types";
import { LEAGUE_TO_SPORT_KEY, MARKET_TYPE_TO_KEY, SPORTSBOOK_TO_BOOKMAKER_KEY } from "./mappings";
import type { LeagueKey, MarketType, SportsbookKey } from "../../types";

const DEFAULT_BASE_URL = "https://api.the-odds-api.com/v4";

export interface FetchedOdds {
  events: RawEvent[];
  quota: QuotaInfo;
  requestId: string;
  observedAt: Date;
}

function requireApiKey(): string {
  const key = process.env.ODDS_PROVIDER_API_KEY;
  if (!key) {
    throw new Error(
      "ODDS_PROVIDER_API_KEY is not set. This client is only reachable once a real key is configured - see .env.example."
    );
  }
  return key;
}

function parseQuota(headers: Headers): QuotaInfo {
  const toIntOrNull = (v: string | null) => (v === null ? null : Number.parseInt(v, 10));
  return {
    remaining: toIntOrNull(headers.get("x-requests-remaining")),
    used: toIntOrNull(headers.get("x-requests-used")),
    lastCost: toIntOrNull(headers.get("x-requests-last"))
  };
}

/** Our own correlation ID for internal tracing - the provider's API does not echo one back. */
function newRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

export async function fetchSports(): Promise<{ sports: RawSport[]; quota: QuotaInfo }> {
  const baseUrl = process.env.ODDS_PROVIDER_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}/sports/?apiKey=${requireApiKey()}`;
  const response = await fetch(url);
  const quota = parseQuota(response.headers);
  if (!response.ok) {
    throw new OddsApiError(`Failed to fetch sports list: ${response.status}`, response.status, quota);
  }
  return { sports: await response.json(), quota };
}

export interface FetchOddsParams {
  league: LeagueKey;
  markets: MarketType[];
  sportsbooks: SportsbookKey[];
  oddsFormat?: "american" | "decimal";
}

/**
 * Fetches current odds for one league. `bookmakers` takes priority over
 * `regions` per the API's own docs, so we always pass explicit bookmaker
 * keys rather than `regions=us` - keeps quota cost predictable and scoped
 * to exactly the 4 MVP books, not everything in the US region.
 */
export async function fetchOdds(params: FetchOddsParams): Promise<FetchedOdds> {
  const baseUrl = process.env.ODDS_PROVIDER_BASE_URL || DEFAULT_BASE_URL;
  const sportKey = LEAGUE_TO_SPORT_KEY[params.league];
  const marketKeys = params.markets.map((m) => MARKET_TYPE_TO_KEY[m]).join(",");
  const bookmakerKeys = params.sportsbooks.map((b) => SPORTSBOOK_TO_BOOKMAKER_KEY[b]).join(",");

  const url = new URL(`${baseUrl}/sports/${sportKey}/odds/`);
  url.searchParams.set("apiKey", requireApiKey());
  url.searchParams.set("markets", marketKeys);
  url.searchParams.set("bookmakers", bookmakerKeys);
  url.searchParams.set("oddsFormat", params.oddsFormat ?? "american");
  url.searchParams.set("dateFormat", "iso");

  const requestId = newRequestId();
  const response = await fetch(url.toString());
  const observedAt = new Date();
  const quota = parseQuota(response.headers);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new OddsApiError(`Failed to fetch odds for ${params.league} (${sportKey}): ${response.status} ${body}`, response.status, quota);
  }

  const events = (await response.json()) as RawEvent[];
  return { events, quota, requestId, observedAt };
}
