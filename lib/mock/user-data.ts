/**
 * Per-user tracker/alert/watchlist state - stands in for `bet_entries`,
 * `ledger_entries`, `alerts`, `watchlists` (Section 8.1) until Postgres is
 * wired up. In-memory only; resets on server restart.
 */

import { americanToDecimal, decimalToAmerican } from "../calc/odds";
import { DEFAULT_MAX_BANKROLL_FRACTION } from "../calc/kelly";
import { settleBet, type BetStatus } from "../calc/settlement";
import { settlePredictionPosition } from "../calc/prediction-settlement";
import type {
  AlertDef,
  AlertFiredEvent,
  BankrollSettings,
  LeagueKey,
  MarketType,
  PredictionPosition,
  PredictionPositionStatus,
  SportsbookKey,
  TrackedBet
} from "../types";
import { ensureDemoUser } from "../auth/user-store";
import { listOpportunities } from "./store";

const betsByUser = new Map<string, TrackedBet[]>();
const alertsByUser = new Map<string, AlertDef[]>();
const watchlistByUser = new Map<string, string[]>(); // userId -> outcomeId[]
const alertEventsByUser = new Map<string, AlertFiredEvent[]>();
const bankrollByUser = new Map<string, BankrollSettings>();
const predictionPositionsByUser = new Map<string, PredictionPosition[]>();
let betSeq = 1;
let alertSeq = 1;
let predictionPositionSeq = 1;
let alertEventSeq = 1;

function nextBetId(): string {
  const id = `bet_${betSeq.toString(36)}`;
  betSeq += 1;
  return id;
}
function nextAlertId(): string {
  const id = `alert_${alertSeq.toString(36)}`;
  alertSeq += 1;
  return id;
}
function nextPredictionPositionId(): string {
  const id = `predpos_${predictionPositionSeq.toString(36)}`;
  predictionPositionSeq += 1;
  return id;
}
function nextAlertEventId(): string {
  const id = `alertevt_${alertEventSeq.toString(36)}`;
  alertEventSeq += 1;
  return id;
}

export interface CreateBetInput {
  userId: string;
  eventId: string;
  eventLabel: string;
  leagueKey: LeagueKey;
  marketType: MarketType;
  selectionLabel: string;
  sportsbookKey: SportsbookKey;
  placedAt: string;
  oddsAmerican: number;
  stakeAmount: number;
  notes?: string;
}

export function createBet(input: CreateBetInput): TrackedBet {
  const decimal = americanToDecimal(input.oddsAmerican);
  const settled = settleBet({ stakeAmount: input.stakeAmount, decimalOdds: decimal, status: "open" });
  const bet: TrackedBet = {
    id: nextBetId(),
    userId: input.userId,
    eventId: input.eventId,
    eventLabel: input.eventLabel,
    leagueKey: input.leagueKey,
    marketType: input.marketType,
    selectionLabel: input.selectionLabel,
    sportsbookKey: input.sportsbookKey,
    placedAt: input.placedAt,
    oddsDecimal: decimal,
    oddsAmerican: input.oddsAmerican,
    stakeAmount: input.stakeAmount,
    currency: "USD",
    status: "open",
    closingDecimalOdds: null,
    notes: input.notes,
    netProfit: settled.netProfit,
    returnedAmount: settled.returnedAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: []
  };
  const list = betsByUser.get(input.userId) ?? [];
  list.unshift(bet);
  betsByUser.set(input.userId, list);
  return bet;
}

export function listBets(userId: string): TrackedBet[] {
  return betsByUser.get(userId) ?? [];
}

export function settleTrackedBet(
  userId: string,
  betId: string,
  status: BetStatus,
  opts?: { cashOutAmount?: number; cashOutStakePortion?: number; closingDecimalOdds?: number }
): TrackedBet | null {
  const list = betsByUser.get(userId);
  const bet = list?.find((b) => b.id === betId);
  if (!bet) return null;

  const previousStatus = bet.status;
  const settled = settleBet({
    stakeAmount: bet.stakeAmount,
    decimalOdds: bet.oddsDecimal,
    status,
    cashOutAmount: opts?.cashOutAmount,
    cashOutStakePortion: opts?.cashOutStakePortion
  });

  bet.history.push({ changedAt: new Date().toISOString(), field: "status", from: previousStatus, to: status });
  bet.status = status;
  bet.netProfit = settled.netProfit;
  bet.returnedAmount = settled.returnedAmount;
  if (opts?.closingDecimalOdds) bet.closingDecimalOdds = opts.closingDecimalOdds;
  bet.updatedAt = new Date().toISOString();
  return bet;
}

// ---------------------------------------------------------------------------
// Prediction portfolio (Section 15.2) - the Tracker equivalent for Kalshi/
// Polymarket positions. Mock-only, same scope boundary as bets/alerts/
// watchlist above - see lib/types.ts's PredictionPosition header.
// ---------------------------------------------------------------------------

export interface CreatePredictionPositionInput {
  userId: string;
  provider: "kalshi" | "polymarket";
  providerMarketId: string;
  marketTitle: string;
  outcomeLabel: string;
  entryPrice: number;
  stakeAmount: number;
  placedAt: string;
  notes?: string;
}

export function createPredictionPosition(input: CreatePredictionPositionInput): PredictionPosition {
  const settled = settlePredictionPosition({ stakeAmount: input.stakeAmount, entryPrice: input.entryPrice, status: "open" });
  const position: PredictionPosition = {
    id: nextPredictionPositionId(),
    userId: input.userId,
    provider: input.provider,
    providerMarketId: input.providerMarketId,
    marketTitle: input.marketTitle,
    outcomeLabel: input.outcomeLabel,
    entryPrice: input.entryPrice,
    stakeAmount: input.stakeAmount,
    currency: "USD",
    placedAt: input.placedAt,
    status: "open",
    closingPrice: null,
    notes: input.notes,
    netProfit: settled.netProfit,
    returnedAmount: settled.returnedAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: []
  };
  const list = predictionPositionsByUser.get(input.userId) ?? [];
  list.unshift(position);
  predictionPositionsByUser.set(input.userId, list);
  return position;
}

export function listPredictionPositions(userId: string): PredictionPosition[] {
  return predictionPositionsByUser.get(userId) ?? [];
}

export function settleTrackedPredictionPosition(
  userId: string,
  positionId: string,
  status: PredictionPositionStatus,
  opts?: { closingPrice?: number }
): PredictionPosition | null {
  const list = predictionPositionsByUser.get(userId);
  const position = list?.find((p) => p.id === positionId);
  if (!position) return null;

  const previousStatus = position.status;
  const settled = settlePredictionPosition({ stakeAmount: position.stakeAmount, entryPrice: position.entryPrice, status });

  position.history.push({ changedAt: new Date().toISOString(), field: "status", from: previousStatus, to: status });
  position.status = status;
  position.netProfit = settled.netProfit;
  position.returnedAmount = settled.returnedAmount;
  if (opts?.closingPrice !== undefined) position.closingPrice = opts.closingPrice;
  position.updatedAt = new Date().toISOString();
  return position;
}

export function createAlert(input: Omit<AlertDef, "id" | "createdAt" | "lastTriggeredAt" | "status">): AlertDef {
  const alert: AlertDef = { ...input, id: nextAlertId(), status: "active", createdAt: new Date().toISOString(), lastTriggeredAt: null };
  const list = alertsByUser.get(input.userId) ?? [];
  list.unshift(alert);
  alertsByUser.set(input.userId, list);
  return alert;
}

export function listAlerts(userId: string): AlertDef[] {
  return alertsByUser.get(userId) ?? [];
}

export function setAlertStatus(userId: string, alertId: string, status: AlertDef["status"]): AlertDef | null {
  const alert = alertsByUser.get(userId)?.find((a) => a.id === alertId);
  if (!alert) return null;
  alert.status = status;
  return alert;
}

export function deleteAlert(userId: string, alertId: string): boolean {
  const list = alertsByUser.get(userId);
  if (!list) return false;
  const idx = list.findIndex((a) => a.id === alertId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/** Every user's alerts, active only - the evaluator (lib/alerts/evaluate.ts) runs system-wide, not scoped to one request's session. */
export function listAllActiveAlerts(): AlertDef[] {
  return [...alertsByUser.values()].flat().filter((a) => a.status === "active");
}

export function markAlertTriggered(userId: string, alertId: string, at: string): void {
  const alert = alertsByUser.get(userId)?.find((a) => a.id === alertId);
  if (alert) alert.lastTriggeredAt = at;
}

export function recordAlertEvent(userId: string, input: Omit<AlertFiredEvent, "id">): AlertFiredEvent {
  const event: AlertFiredEvent = { ...input, id: nextAlertEventId() };
  const list = alertEventsByUser.get(userId) ?? [];
  list.unshift(event);
  alertEventsByUser.set(userId, list.slice(0, 50)); // recent history only, not an unbounded log
  return event;
}

export function listAlertEvents(userId: string): AlertFiredEvent[] {
  return alertEventsByUser.get(userId) ?? [];
}

export function addToWatchlist(userId: string, outcomeId: string): void {
  const list = watchlistByUser.get(userId) ?? [];
  if (!list.includes(outcomeId)) list.unshift(outcomeId);
  watchlistByUser.set(userId, list);
}

export function removeFromWatchlist(userId: string, outcomeId: string): void {
  const list = watchlistByUser.get(userId);
  if (!list) return;
  watchlistByUser.set(userId, list.filter((id) => id !== outcomeId));
}

export function listWatchlist(userId: string): string[] {
  return watchlistByUser.get(userId) ?? [];
}

// ---------------------------------------------------------------------------
// Bankroll settings (Section 6.4) - mock-only, same as tracker/alerts/
// watchlist above. Prisma's Bankroll model exists but stays unwired; this
// is a sizing input the user maintains themselves, not a ledger balance.
// ---------------------------------------------------------------------------

export function getBankroll(userId: string): BankrollSettings | null {
  return bankrollByUser.get(userId) ?? null;
}

export function setBankroll(
  userId: string,
  input: { startingAmount: number; maxStakeFraction: number; kellySizingEnabled: boolean }
): BankrollSettings {
  const settings: BankrollSettings = {
    startingAmount: input.startingAmount,
    currency: "USD",
    maxStakeFraction: Math.min(input.maxStakeFraction, DEFAULT_MAX_BANKROLL_FRACTION),
    kellySizingEnabled: input.kellySizingEnabled,
    updatedAt: new Date().toISOString()
  };
  bankrollByUser.set(userId, settings);
  return settings;
}

export function clearBankroll(userId: string): boolean {
  return bankrollByUser.delete(userId);
}

// ---------------------------------------------------------------------------
// AI explanation daily quota (Section 3.3 entitlements: N per day by plan).
// ---------------------------------------------------------------------------

const aiUsageByUser = new Map<string, { date: string; count: number }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAiUsageToday(userId: string): number {
  const entry = aiUsageByUser.get(userId);
  if (!entry || entry.date !== todayKey()) return 0;
  return entry.count;
}

export function incrementAiUsage(userId: string): number {
  const entry = aiUsageByUser.get(userId);
  const today = todayKey();
  if (!entry || entry.date !== today) {
    aiUsageByUser.set(userId, { date: today, count: 1 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

// ---------------------------------------------------------------------------
// Seed the demo account with a believable history so Tracker/Portfolio/
// Alerts are populated on first load.
// ---------------------------------------------------------------------------

function seedDemoData() {
  const demo = ensureDemoUser();
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  const seedBets: Array<Omit<CreateBetInput, "userId"> & { status: BetStatus; closingDecimalOdds?: number }> = [
    {
      eventId: "seed_evt_1",
      eventLabel: "Ravens @ Bills",
      leagueKey: "nfl",
      marketType: "moneyline",
      selectionLabel: "Ravens",
      sportsbookKey: "draftkings",
      placedAt: daysAgo(9),
      oddsAmerican: 145,
      stakeAmount: 25,
      status: "won",
      closingDecimalOdds: americanToDecimal(120)
    },
    {
      eventId: "seed_evt_2",
      eventLabel: "Celtics @ Nuggets",
      leagueKey: "nba",
      marketType: "spread",
      selectionLabel: "Celtics -3.5",
      sportsbookKey: "fanduel",
      placedAt: daysAgo(6),
      oddsAmerican: -108,
      stakeAmount: 40,
      status: "lost",
      closingDecimalOdds: americanToDecimal(-115)
    },
    {
      eventId: "seed_evt_3",
      eventLabel: "Dodgers @ Yankees",
      leagueKey: "mlb",
      marketType: "total",
      selectionLabel: "Over 8.5",
      sportsbookKey: "betmgm",
      placedAt: daysAgo(4),
      oddsAmerican: -105,
      stakeAmount: 30,
      status: "push"
    },
    {
      eventId: "seed_evt_4",
      eventLabel: "Avalanche @ Panthers",
      leagueKey: "nhl",
      marketType: "moneyline",
      selectionLabel: "Avalanche",
      sportsbookKey: "caesars",
      placedAt: daysAgo(1),
      oddsAmerican: 130,
      stakeAmount: 20,
      status: "open"
    }
  ];

  for (const seed of seedBets) {
    const bet = createBet({ ...seed, userId: demo.userId });
    if (seed.status !== "open") {
      settleTrackedBet(demo.userId, bet.id, seed.status, { closingDecimalOdds: seed.closingDecimalOdds });
    }
  }

  // Real outcome IDs, not placeholders - alert evaluation (lib/alerts/
  // evaluate.ts) looks these up via findOutcome() on every tick, so a fake
  // ID would mean these two alerts could never actually fire. Thresholds
  // are set just under each outcome's real current value so both are
  // realistic to trigger on the very next tick, the same "see it work
  // immediately" property the rest of the demo data has.
  const topOpportunities = listOpportunities().slice(0, 3);
  const [firstOpp, secondOpp] = topOpportunities;

  if (firstOpp) {
    createAlert({
      userId: demo.userId,
      subjectLabel: `${firstOpp.event.away.name} @ ${firstOpp.event.home.name} - ${firstOpp.outcomeLabel}`,
      subjectType: "outcome",
      subjectId: firstOpp.outcomeId,
      conditionType: "edge_threshold",
      threshold: Math.max(0.5, firstOpp.edgePp - 0.5),
      channel: "in_app",
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      cooldownSeconds: 1800
    });
  }
  if (secondOpp) {
    createAlert({
      userId: demo.userId,
      subjectLabel: `${secondOpp.event.away.name} @ ${secondOpp.event.home.name} - ${secondOpp.outcomeLabel}`,
      subjectType: "outcome",
      subjectId: secondOpp.outcomeId,
      conditionType: "start_reminder",
      threshold: 10080, // 7 days - generously covers any seeded event's scheduled start
      channel: "email",
      quietHoursStart: "23:00",
      quietHoursEnd: "07:00",
      cooldownSeconds: 0
    });
  }

  for (const row of topOpportunities) addToWatchlist(demo.userId, row.outcomeId);
}

seedDemoData();

// Re-export for convenience in API routes that need the American<->decimal
// helper alongside these functions.
export { decimalToAmerican };
