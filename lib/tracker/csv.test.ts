import { describe, expect, it } from "vitest";
import { validateCsv } from "./csv";

const HEADER = "eventLabel,leagueKey,marketType,selectionLabel,sportsbookKey,placedAt,oddsAmerican,stakeAmount,notes";

describe("CSV import validation (TRK-06)", () => {
  it("accepts well-formed rows", () => {
    const csv = `${HEADER}\nRavens @ Bills,nfl,moneyline,Ravens,draftkings,2026-09-01T00:00:00Z,145,25,`;
    const result = validateCsv(csv);
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects invalid rows without dropping valid rows elsewhere in the file", () => {
    const csv = [
      HEADER,
      "Ravens @ Bills,nfl,moneyline,Ravens,draftkings,2026-09-01T00:00:00Z,145,25,",
      "Bad League,zzz,moneyline,Ravens,draftkings,2026-09-01T00:00:00Z,145,25,",
      "Bad Odds,nfl,moneyline,Ravens,draftkings,2026-09-01T00:00:00Z,0,25,",
      "Celtics @ Nuggets,nba,spread,Celtics -3.5,fanduel,2026-09-02T00:00:00Z,-108,40,"
    ].join("\n");

    const result = validateCsv(csv);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]!.reason).toMatch(/leagueKey/);
    expect(result.rejected[1]!.reason).toMatch(/oddsAmerican/);
    // Rejected rows carry their original line and row number for the report.
    expect(result.rejected[0]!.rowNumber).toBe(3);
  });
});
