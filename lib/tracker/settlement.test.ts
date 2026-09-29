import { describe, expect, it } from "vitest";
import { evaluateBetSettlement, AUTO_SETTLE_CONFIDENCE_THRESHOLD, CONFIDENCE_EXACT_ID_MATCH, CONFIDENCE_FUZZY_NAME_MATCH } from "./settlement";
import type { EventSummary, TrackedBet } from "../types";

function team(name: string) {
  return { key: name.toLowerCase(), name, city: "", leagueKey: "nfl" as const };
}

function finalEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "evt_real_1",
    leagueKey: "nfl",
    home: team("Cowboys"),
    away: team("Ravens"),
    startAt: "2026-09-27T17:00:00Z",
    status: "final",
    homeScore: 20,
    awayScore: 24,
    venue: "Dallas Arena",
    isOutdoor: true,
    ...overrides
  };
}

function bet(overrides: Partial<TrackedBet> = {}): TrackedBet {
  return {
    id: "bet_1",
    userId: "user_1",
    eventId: "evt_real_1",
    eventLabel: "Ravens @ Cowboys",
    leagueKey: "nfl",
    marketType: "moneyline",
    selectionLabel: "Ravens",
    sportsbookKey: "fanduel",
    placedAt: "2026-09-27T16:00:00Z",
    oddsDecimal: 2.0,
    oddsAmerican: 100,
    stakeAmount: 25,
    currency: "USD",
    status: "open",
    closingDecimalOdds: null,
    netProfit: 0,
    returnedAmount: 0,
    createdAt: "2026-09-27T16:00:00Z",
    updatedAt: "2026-09-27T16:00:00Z",
    history: [],
    ...overrides
  };
}

describe("evaluateBetSettlement", () => {
  it("exact eventId match, backed team won -> won, full confidence", () => {
    const result = evaluateBetSettlement(bet({ selectionLabel: "Ravens" }), [finalEvent()]);
    expect(result).toMatchObject({ confidence: CONFIDENCE_EXACT_ID_MATCH, suggestedStatus: "won", reason: "matched_final_result" });
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_SETTLE_CONFIDENCE_THRESHOLD);
  });

  it("exact eventId match, backed team lost -> lost", () => {
    const result = evaluateBetSettlement(bet({ selectionLabel: "Cowboys" }), [finalEvent()]);
    expect(result.suggestedStatus).toBe("lost");
  });

  it("tied final score -> push", () => {
    const result = evaluateBetSettlement(bet(), [finalEvent({ homeScore: 21, awayScore: 21 })]);
    expect(result.suggestedStatus).toBe("push");
  });

  it("fuzzy match via eventLabel when eventId isn't a real canonical event (CSV-import case) - below the auto-confirm threshold", () => {
    const result = evaluateBetSettlement(
      bet({ eventId: "import_5_1234567890", eventLabel: "Ravens @ Cowboys", selectionLabel: "Ravens" }),
      [finalEvent()]
    );
    expect(result).toMatchObject({ confidence: CONFIDENCE_FUZZY_NAME_MATCH, suggestedStatus: "won", reason: "matched_final_result" });
    expect(result.confidence).toBeLessThan(AUTO_SETTLE_CONFIDENCE_THRESHOLD);
  });

  it("ambiguous fuzzy match (two final events with the same team names) - no suggestion, never guesses", () => {
    const result = evaluateBetSettlement({ ...bet({ eventId: "import_1_1" }) }, [
      finalEvent({ id: "evt_a" }),
      finalEvent({ id: "evt_b", startAt: "2026-09-27T17:05:00Z" })
    ]);
    expect(result).toMatchObject({ confidence: 0, suggestedStatus: null, reason: "ambiguous_event_match" });
  });

  it("no matching final event at all - no suggestion", () => {
    const result = evaluateBetSettlement(bet({ eventId: "import_9_9", eventLabel: "Chiefs @ Bills" }), [finalEvent()]);
    expect(result).toMatchObject({ confidence: 0, suggestedStatus: null, reason: "no_matching_event" });
  });

  it("spread bets are never auto-settled, even with an exact event match - no stored line value", () => {
    const result = evaluateBetSettlement(bet({ marketType: "spread", selectionLabel: "Ravens +3.5" }), [finalEvent()]);
    expect(result).toMatchObject({ confidence: 0, suggestedStatus: null, reason: "insufficient_data_spread_total" });
  });

  it("total bets are never auto-settled either", () => {
    const result = evaluateBetSettlement(bet({ marketType: "total", selectionLabel: "Over 47.5" }), [finalEvent()]);
    expect(result.reason).toBe("insufficient_data_spread_total");
  });

  it("selectionLabel that doesn't clearly name either team never guesses a side", () => {
    const result = evaluateBetSettlement(bet({ selectionLabel: "Something else entirely" }), [finalEvent()]);
    expect(result.suggestedStatus).toBeNull();
  });

  it("a fuzzy match outside the 36-hour placedAt window is not matched at all", () => {
    const result = evaluateBetSettlement(
      bet({ eventId: "import_2_2", placedAt: "2026-09-01T00:00:00Z" }),
      [finalEvent()]
    );
    expect(result.suggestedStatus).toBeNull();
    expect(result.reason).toBe("no_matching_event");
  });
});
