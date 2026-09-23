/**
 * Static key translation between The Odds API's vocabulary and ours.
 * Verified against their docs 2026-09-20 (see types.ts header).
 *
 * Deliberately narrow: only the sports/markets/books in the PRD's MVP scope
 * (Decision Log: NFL/NBA/MLB/NHL, moneyline/spread/total,
 * FanDuel/DraftKings/BetMGM/Caesars) have a mapping. Anything else the
 * provider returns is data we're not licensed/scoped to show yet, not a bug
 * - normalize.ts skips it rather than guessing.
 */
import type { LeagueKey, MarketType, SportsbookKey } from "../../types";

export const SPORT_KEY_TO_LEAGUE: Record<string, LeagueKey> = {
  americanfootball_nfl: "nfl",
  basketball_nba: "nba",
  baseball_mlb: "mlb",
  icehockey_nhl: "nhl"
};

export const LEAGUE_TO_SPORT_KEY: Record<LeagueKey, string> = {
  nfl: "americanfootball_nfl",
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  nhl: "icehockey_nhl"
};

export const MARKET_KEY_TO_TYPE: Record<string, MarketType> = {
  h2h: "moneyline",
  spreads: "spread",
  totals: "total"
};

export const MARKET_TYPE_TO_KEY: Record<MarketType, string> = {
  moneyline: "h2h",
  spread: "spreads",
  total: "totals"
};

/**
 * Caesars Sportsbook's key is still "williamhill_us" in this API - a
 * holdover from before Caesars acquired and rebranded William Hill's US
 * operations. Confirmed against their docs; this is exactly the kind of
 * provider-specific quirk that silently breaks a naive "caesars" lookup.
 */
export const BOOKMAKER_KEY_TO_SPORTSBOOK: Record<string, SportsbookKey> = {
  fanduel: "fanduel",
  draftkings: "draftkings",
  betmgm: "betmgm",
  williamhill_us: "caesars"
};

export const SPORTSBOOK_TO_BOOKMAKER_KEY: Record<SportsbookKey, string> = {
  fanduel: "fanduel",
  draftkings: "draftkings",
  betmgm: "betmgm",
  caesars: "williamhill_us"
};

export function isSupportedLeague(sportKey: string): sportKey is keyof typeof SPORT_KEY_TO_LEAGUE {
  return sportKey in SPORT_KEY_TO_LEAGUE;
}

export function isSupportedMarket(marketKey: string): marketKey is keyof typeof MARKET_KEY_TO_TYPE {
  return marketKey in MARKET_KEY_TO_TYPE;
}

export function isSupportedBookmaker(bookmakerKey: string): bookmakerKey is keyof typeof BOOKMAKER_KEY_TO_SPORTSBOOK {
  return bookmakerKey in BOOKMAKER_KEY_TO_SPORTSBOOK;
}
