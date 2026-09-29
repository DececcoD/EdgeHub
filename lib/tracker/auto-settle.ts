/**
 * Orchestrates lib/tracker/settlement.ts's pure matching logic against
 * real data: pulls open bets + final events, applies auto-confirms, and
 * returns pending-review suggestions for the UI. Kept separate from
 * settlement.ts so the matching rules stay unit-testable without mocking
 * the data-source/mock-store I/O this file does.
 */
import { listMarkets } from "../data-source";
import { listBets, settleTrackedBet } from "../mock/user-data";
import {
  AUTO_SETTLE_CONFIDENCE_THRESHOLD,
  collectFinalEvents,
  evaluateBetSettlement,
  relevantLeagues,
  type SettlementSuggestion
} from "./settlement";

export interface AutoSettleResult {
  autoConfirmed: SettlementSuggestion[];
  pendingReview: SettlementSuggestion[];
}

export async function runAutoSettlement(userId: string): Promise<AutoSettleResult> {
  const openBets = listBets(userId).filter((b) => b.status === "open");
  if (openBets.length === 0) return { autoConfirmed: [], pendingReview: [] };

  const leagues = relevantLeagues(openBets);
  const marketViewLists = await Promise.all(leagues.map((leagueKey) => listMarkets({ leagueKey })));
  const finalEvents = collectFinalEvents(marketViewLists.flat().map((m) => m.event));

  const autoConfirmed: SettlementSuggestion[] = [];
  const pendingReview: SettlementSuggestion[] = [];

  for (const bet of openBets) {
    const suggestion = evaluateBetSettlement(bet, finalEvents);
    if (!suggestion.suggestedStatus) continue; // no confident-enough signal either way

    if (suggestion.confidence >= AUTO_SETTLE_CONFIDENCE_THRESHOLD) {
      const updated = settleTrackedBet(userId, bet.id, suggestion.suggestedStatus);
      if (updated) {
        updated.history.push({
          changedAt: new Date().toISOString(),
          field: "settlement_source",
          from: "manual",
          to: `auto-confirmed (confidence ${suggestion.confidence.toFixed(2)}): ${suggestion.detail}`
        });
        autoConfirmed.push(suggestion);
      }
    } else {
      pendingReview.push(suggestion);
    }
  }

  return { autoConfirmed, pendingReview };
}
