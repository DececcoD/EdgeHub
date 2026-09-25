/** Shared domain types for the mock data layer, API routes, and UI. */

import type { FreshnessState } from "./calc/freshness";
import type { BetStatus } from "./calc/settlement";

export type LeagueKey = "nfl" | "nba" | "mlb" | "nhl";
export type SportsbookKey = "fanduel" | "draftkings" | "betmgm" | "caesars";
export type MarketType = "moneyline" | "spread" | "total";
export type OddsFormat = "american" | "decimal";
export type Plan = "free" | "pro" | "elite";

export interface TeamRef {
  key: string;
  name: string;
  city: string;
  leagueKey: LeagueKey;
}

export interface EventSummary {
  id: string;
  leagueKey: LeagueKey;
  home: TeamRef;
  away: TeamRef;
  startAt: string; // ISO
  status: "scheduled" | "live" | "final";
  venue: string;
  isOutdoor: boolean;
}

export interface BookQuote {
  sportsbookKey: SportsbookKey;
  sportsbookName: string;
  americanOdds: number;
  decimalOdds: number;
  point: number | null;
  observedAt: string; // ISO
  freshness: FreshnessState;
}

export interface OutcomeView {
  outcomeId: string;
  label: string; // "Ravens", "Ravens -3.5", "Over 47.5"
  side: "home" | "away" | "over" | "under";
  point: number | null;
  quotes: BookQuote[]; // one per book that has this outcome, freshest first
  bestQuote: BookQuote | null; // best displayed price among fresh + eligible quotes only
  consensus: {
    methodVersion: string;
    probability: number; // no-vig, 0-1
    eligibleBooks: number;
    overround: number;
  } | null;
  estimate: {
    source: "consensus"; // MVP: no proprietary model at launch
    pEstimate: number;
  } | null;
  edgePp: number | null; // edge in percentage points, using bestQuote's implied prob
  ev: number | null; // EV per $1 staked at bestQuote
  evPercent: number | null;
  score: number | null;
  scoreVersion: string | null;
  dataQuality: "complete" | "partial" | "stale" | "mapping_review" | "unavailable";
}

export interface MarketView {
  marketId: string;
  event: EventSummary;
  marketType: MarketType;
  period: "full_game";
  rulesVersion: string;
  outcomes: OutcomeView[];
}

export interface ProviderHealthRow {
  providerKey: string;
  providerName: string;
  booksCovered: string[];
  status: "healthy" | "degraded" | "down";
  quotaRemaining: number | null;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
}

export interface OpportunityRow {
  outcomeId: string;
  marketId: string;
  marketType: MarketType;
  event: EventSummary;
  outcomeLabel: string;
  point: number | null;
  bestQuote: BookQuote;
  edgePp: number;
  evPercent: number;
  score: number;
  scoreVersion: string;
  consensusEligibleBooks: number;
  dataQuality: "complete" | "partial";
  edgeSource: "market" | "model";
}

export interface TrackedBet {
  id: string;
  userId: string;
  eventId: string;
  eventLabel: string;
  leagueKey: LeagueKey;
  marketType: MarketType;
  selectionLabel: string;
  sportsbookKey: SportsbookKey;
  placedAt: string;
  oddsDecimal: number;
  oddsAmerican: number;
  stakeAmount: number;
  currency: "USD";
  status: BetStatus;
  closingDecimalOdds: number | null; // null = unavailable, never assumed
  notes?: string;
  netProfit: number;
  returnedAmount: number;
  createdAt: string;
  updatedAt: string;
  history: { changedAt: string; field: string; from: string; to: string }[];
}

/**
 * The "prediction portfolio" (Section 15.2) - the Tracker equivalent for
 * Kalshi/Polymarket positions. Deliberately narrower than TrackedBet: no
 * cash-out states, since neither provider's early-exit mechanics are
 * modeled here (Section 6's cash-out formulas are sportsbook-specific) -
 * a contract either resolves or doesn't. Mock-only, same scope boundary
 * as TrackedBet/AlertDef/watchlist - see lib/mock/user-data.ts.
 */
export type PredictionPositionStatus = "open" | "won" | "lost" | "void";

export interface PredictionPosition {
  id: string;
  userId: string;
  provider: "kalshi" | "polymarket";
  providerMarketId: string;
  marketTitle: string;
  outcomeLabel: string; // "Yes" / "No" / a named outcome
  entryPrice: number; // 0-1, price per share/contract at entry
  stakeAmount: number; // dollars paid
  currency: "USD";
  placedAt: string;
  status: PredictionPositionStatus;
  closingPrice: number | null; // null = unavailable, never assumed
  notes?: string;
  netProfit: number;
  returnedAmount: number;
  createdAt: string;
  updatedAt: string;
  history: { changedAt: string; field: string; from: string; to: string }[];
}

export interface AlertDef {
  id: string;
  userId: string;
  subjectLabel: string;
  subjectType: "outcome" | "market";
  subjectId: string;
  conditionType: "odds_threshold" | "edge_threshold" | "book_spread" | "movement" | "start_reminder";
  threshold: number;
  channel: "in_app" | "email";
  quietHoursStart: string;
  quietHoursEnd: string;
  status: "active" | "paused" | "expired";
  cooldownSeconds: number;
  createdAt: string;
  lastTriggeredAt: string | null;
}

export interface AlertFiredEvent {
  id: string;
  alertId: string;
  subjectLabel: string;
  conditionType: AlertDef["conditionType"];
  message: string;
  triggeredAt: string;
}

export interface UserPreferences {
  oddsFormat: OddsFormat;
  favoriteLeagues: LeagueKey[];
  favoriteBooks: SportsbookKey[];
  timezone: string;
  onboardedAt: string | null;
}

export interface MockSession {
  userId: string;
  email: string;
  plan: Plan;
  role: "user" | "admin";
  preferences: UserPreferences;
}

/**
 * A user-declared reference bankroll for Kelly-based stake sizing (Section
 * 6.4). Purely a sizing input the user maintains themselves - not a ledger
 * balance, and never auto-adjusted from tracked bet results.
 */
export interface BankrollSettings {
  startingAmount: number;
  currency: "USD";
  maxStakeFraction: number; // 0-1, capped at DEFAULT_MAX_BANKROLL_FRACTION regardless
  kellySizingEnabled: boolean; // off by default - PRD requires explicit opt-in
  updatedAt: string;
}
