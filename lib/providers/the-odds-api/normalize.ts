/**
 * Pure mapping from The Odds API's wire format to our vocabulary. No
 * network calls, no persistence - just translation, so it's fully testable
 * against fixture JSON without a live key or a database (see
 * normalize.test.ts). Team-name -> canonical Team ID resolution is
 * deliberately NOT done here; that's ../../ingest/identity.ts's job, since
 * it needs a database to check against.
 */
import { americanToDecimal } from "../../calc/odds";
import { isSupportedBookmaker, isSupportedMarket, BOOKMAKER_KEY_TO_SPORTSBOOK, MARKET_KEY_TO_TYPE, SPORT_KEY_TO_LEAGUE } from "./mappings";
import type { RawEvent } from "./types";
import type { LeagueKey, MarketType, SportsbookKey } from "../../types";

export interface NormalizedEvent {
  providerEventId: string;
  league: LeagueKey;
  commenceTime: string; // ISO 8601, as returned by the provider
  homeTeamName: string;
  awayTeamName: string;
}

export type QuoteSide = "home" | "away" | "over" | "under";

export interface NormalizedQuote {
  providerEventId: string;
  league: LeagueKey;
  marketType: MarketType;
  side: QuoteSide;
  point: number | null;
  sportsbook: SportsbookKey;
  americanOdds: number;
  decimalOdds: number;
  /** The bookmaker's own last-update time - NOT when we observed it (see fetchedAt). */
  bookLastUpdate: string;
  fetchedAt: string;
}

export interface NormalizeResult {
  events: NormalizedEvent[];
  quotes: NormalizedQuote[];
  /** Outcomes that couldn't be matched to a known side - a data-quality signal, not a crash. */
  warnings: string[];
}

function resolveSide(
  outcomeName: string,
  marketType: MarketType,
  homeTeam: string,
  awayTeam: string
): QuoteSide | null {
  if (marketType === "total") {
    const lower = outcomeName.toLowerCase();
    if (lower === "over") return "over";
    if (lower === "under") return "under";
    return null;
  }
  if (outcomeName === homeTeam) return "home";
  if (outcomeName === awayTeam) return "away";
  return null;
}

export function normalizeEvents(rawEvents: RawEvent[], fetchedAt: Date): NormalizeResult {
  const events: NormalizedEvent[] = [];
  const quotes: NormalizedQuote[] = [];
  const warnings: string[] = [];
  const fetchedAtIso = fetchedAt.toISOString();

  for (const rawEvent of rawEvents) {
    const league = SPORT_KEY_TO_LEAGUE[rawEvent.sport_key];
    if (!league) {
      warnings.push(`Unsupported sport_key "${rawEvent.sport_key}" on event ${rawEvent.id} - skipped.`);
      continue;
    }

    events.push({
      providerEventId: rawEvent.id,
      league,
      commenceTime: rawEvent.commence_time,
      homeTeamName: rawEvent.home_team,
      awayTeamName: rawEvent.away_team
    });

    for (const bookmaker of rawEvent.bookmakers) {
      if (!isSupportedBookmaker(bookmaker.key)) continue; // out of MVP scope, not an error
      const sportsbook = BOOKMAKER_KEY_TO_SPORTSBOOK[bookmaker.key]!; // guarded by isSupportedBookmaker above

      for (const market of bookmaker.markets) {
        if (!isSupportedMarket(market.key)) continue; // out of MVP scope, not an error
        const marketType = MARKET_KEY_TO_TYPE[market.key]!; // guarded by isSupportedMarket above

        for (const outcome of market.outcomes) {
          const side = resolveSide(outcome.name, marketType, rawEvent.home_team, rawEvent.away_team);
          if (!side) {
            warnings.push(
              `Event ${rawEvent.id} (${bookmaker.key}/${market.key}): outcome name "${outcome.name}" did not match home ("${rawEvent.home_team}"), away ("${rawEvent.away_team}"), or over/under - skipped.`
            );
            continue;
          }

          quotes.push({
            providerEventId: rawEvent.id,
            league,
            marketType,
            side,
            point: outcome.point ?? null,
            sportsbook,
            americanOdds: outcome.price,
            decimalOdds: americanToDecimal(outcome.price),
            bookLastUpdate: bookmaker.last_update,
            fetchedAt: fetchedAtIso
          });
        }
      }
    }
  }

  return { events, quotes, warnings };
}
