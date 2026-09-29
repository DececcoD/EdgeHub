/**
 * Automatic settlement (PRD Section 5.6 / DECISIONS.md item 7) - matches
 * open TrackedBets against real final event results and either auto-
 * confirms the outcome (confidence at or above the threshold) or surfaces
 * a suggestion for the user to confirm with one click (below it). Never
 * guesses past that line - same "suppress rather than guess" discipline
 * lib/ingest/identity.ts's MappingException path already follows.
 *
 * Two confidence tiers, not a continuous score, because there are exactly
 * two ways a bet can be matched to a real event:
 *
 * - EXACT (1.0): bet.eventId is a real canonical Event.id - true when a
 *   bet was added from a real market screen. No ambiguity at all: this is
 *   the same ID space lib/ingest/identity.ts already resolved.
 * - FUZZY (0.85): bet.eventId is NOT a real Event.id - true for every
 *   CSV-imported bet (app/api/v1/tracker/import/route.ts mints a synthetic
 *   `import_<row>_<ts>` ID, since TRK-06's CSV format has no canonical ID
 *   column at all) - matched instead by parsing eventLabel's "Away @ Home"
 *   convention and requiring an exact, unambiguous team-name match within
 *   36 hours of the bet's own placedAt.
 *
 * AUTO_SETTLE_CONFIDENCE_THRESHOLD defaults to 0.9, which places FUZZY
 * matches (0.85) below the auto-confirm line deliberately - a CSV import's
 * free-text event label should always get a human's one-click confirmation
 * before money moves, even when the match is unambiguous. This is a
 * founder-decision default (DECISIONS.md item 7), not yet explicitly
 * confirmed as final.
 *
 * Spread/total bets are NEVER auto-settled regardless of confidence:
 * TrackedBet has no stored point/line value (Section 5.6 only ever
 * captured oddsAmerican, not the line the bet was placed at), so there is
 * no way to correctly determine won/lost/push without it - a data gap,
 * not a confidence problem, and guessing would risk being silently wrong
 * about someone's money.
 */
import type { BetStatus } from "../calc/settlement";
import type { EventSummary, LeagueKey, MarketType, TrackedBet } from "../types";

export const CONFIDENCE_EXACT_ID_MATCH = 1.0;
export const CONFIDENCE_FUZZY_NAME_MATCH = 0.85;

/** Founder decision (DECISIONS.md item 7), defaulted, not yet confirmed final. */
export const AUTO_SETTLE_CONFIDENCE_THRESHOLD = 0.9;

const FUZZY_MATCH_WINDOW_MS = 36 * 3600_000;

export type SettlementSuggestionReason =
  | "matched_final_result"
  | "insufficient_data_spread_total"
  | "ambiguous_event_match"
  | "no_matching_event";

export interface SettlementSuggestion {
  betId: string;
  confidence: number;
  suggestedStatus: BetStatus | null;
  reason: SettlementSuggestionReason;
  matchedEventId: string | null;
  detail: string;
}

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

/** Parses the "Away @ Home" convention used everywhere else in this
 * codebase (lib/mock/user-data.ts's seeded alerts, CSV export) - returns
 * null for anything that doesn't match, rather than guessing a split. */
function parseEventLabel(eventLabel: string): { away: string; home: string } | null {
  const parts = eventLabel.split("@").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { away: parts[0], home: parts[1] };
}

function findFuzzyMatch(bet: TrackedBet, finalEvents: EventSummary[]): EventSummary[] {
  const parsed = parseEventLabel(bet.eventLabel);
  if (!parsed) return [];
  const away = normalizeTeamName(parsed.away);
  const home = normalizeTeamName(parsed.home);
  const placedAtMs = new Date(bet.placedAt).getTime();

  return finalEvents.filter((event) => {
    if (event.leagueKey !== bet.leagueKey) return false;
    if (normalizeTeamName(event.home.name) !== home || normalizeTeamName(event.away.name) !== away) return false;
    return Math.abs(new Date(event.startAt).getTime() - placedAtMs) <= FUZZY_MATCH_WINDOW_MS;
  });
}

/** Moneyline only - see this file's header for why spread/total can't be
 * determined at all without a stored line value. */
function resolveMoneylineStatus(bet: TrackedBet, event: EventSummary): BetStatus | null {
  if (event.homeScore === null || event.awayScore === null) return null;
  if (event.homeScore === event.awayScore) return "push";

  const selection = normalizeTeamName(bet.selectionLabel);
  const backedHome = selection.includes(normalizeTeamName(event.home.name));
  const backedAway = selection.includes(normalizeTeamName(event.away.name));
  if (backedHome === backedAway) return null; // selectionLabel didn't clearly name either side - don't guess

  const homeWon = event.homeScore > event.awayScore;
  const backedTeamWon = backedHome ? homeWon : !homeWon;
  return backedTeamWon ? "won" : "lost";
}

export function evaluateBetSettlement(bet: TrackedBet, finalEvents: EventSummary[]): SettlementSuggestion {
  const exactMatch = finalEvents.find((e) => e.id === bet.eventId);
  const fuzzyMatches = exactMatch ? [] : findFuzzyMatch(bet, finalEvents);

  const matched = exactMatch ?? (fuzzyMatches.length === 1 ? fuzzyMatches[0] : undefined);
  const confidence = exactMatch ? CONFIDENCE_EXACT_ID_MATCH : matched ? CONFIDENCE_FUZZY_NAME_MATCH : 0;

  if (!matched) {
    return {
      betId: bet.id,
      confidence: 0,
      suggestedStatus: null,
      reason: fuzzyMatches.length > 1 ? "ambiguous_event_match" : "no_matching_event",
      matchedEventId: null,
      detail:
        fuzzyMatches.length > 1
          ? `${fuzzyMatches.length} completed events match "${bet.eventLabel}" within the match window - not settling automatically.`
          : "No completed real event matched this bet yet."
    };
  }

  const marketType: MarketType = bet.marketType;
  if (marketType !== "moneyline") {
    return {
      betId: bet.id,
      confidence: 0,
      suggestedStatus: null,
      reason: "insufficient_data_spread_total",
      matchedEventId: matched.id,
      detail: `${matched.away.name} ${matched.awayScore} - ${matched.home.name} ${matched.homeScore} (final), but ${marketType} bets need the line this bet was placed at, which isn't stored - confirm manually.`
    };
  }

  const suggestedStatus = resolveMoneylineStatus(bet, matched);
  if (!suggestedStatus) {
    return {
      betId: bet.id,
      confidence: 0,
      suggestedStatus: null,
      reason: "no_matching_event",
      matchedEventId: matched.id,
      detail: `Found a final result for "${bet.eventLabel}", but "${bet.selectionLabel}" didn't clearly match either team - confirm manually.`
    };
  }

  return {
    betId: bet.id,
    confidence,
    suggestedStatus,
    reason: "matched_final_result",
    matchedEventId: matched.id,
    detail: `${matched.away.name} ${matched.awayScore} - ${matched.home.name} ${matched.homeScore} (final).`
  };
}

export function collectFinalEvents(marketViewEvents: EventSummary[]): EventSummary[] {
  const seen = new Map<string, EventSummary>();
  for (const event of marketViewEvents) {
    if (event.status === "final") seen.set(event.id, event);
  }
  return [...seen.values()];
}

export function relevantLeagues(bets: TrackedBet[]): LeagueKey[] {
  return [...new Set(bets.map((b) => b.leagueKey))];
}
