/**
 * CSV import/export - PRD Section 5.6 (TRK-06): "Validation report identifies
 * rejected rows without dropping valid rows."
 */
import type { TrackedBet, LeagueKey, MarketType, SportsbookKey } from "../types";

export const CSV_COLUMNS = [
  "eventLabel",
  "leagueKey",
  "marketType",
  "selectionLabel",
  "sportsbookKey",
  "placedAt",
  "oddsAmerican",
  "stakeAmount",
  "status",
  "notes"
] as const;

const VALID_LEAGUES: LeagueKey[] = ["nfl", "nba", "mlb", "nhl"];
const VALID_MARKETS: MarketType[] = ["moneyline", "spread", "total"];
const VALID_BOOKS: SportsbookKey[] = ["fanduel", "draftkings", "betmgm", "caesars"];

export interface ParsedRow {
  rowNumber: number;
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

export interface RejectedRow {
  rowNumber: number;
  raw: string;
  reason: string;
}

export interface CsvValidationResult {
  valid: ParsedRow[];
  rejected: RejectedRow[];
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV split - good enough for a prototype import; a real
  // implementation should use a proper CSV parser for quoted commas.
  return line.split(",").map((cell) => cell.trim());
}

export function validateCsv(text: string): CsvValidationResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const valid: ParsedRow[] = [];
  const rejected: RejectedRow[] = [];

  const [header, ...dataLines] = lines;
  if (!header) return { valid, rejected };

  const headerCells = parseCsvLine(header).map((h) => h.toLowerCase());

  dataLines.forEach((line, i) => {
    const rowNumber = i + 2; // 1-indexed, +1 for header row
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headerCells.forEach((h, idx) => (row[h] = cells[idx] ?? ""));

    const leagueKey = row.leaguekey?.toLowerCase() as LeagueKey;
    const marketType = row.markettype?.toLowerCase() as MarketType;
    const sportsbookKey = row.sportsbookkey?.toLowerCase() as SportsbookKey;
    const oddsAmerican = Number(row.oddsamerican);
    const stakeAmount = Number(row.stakeamount);

    if (!row.eventlabel) return rejected.push({ rowNumber, raw: line, reason: "Missing eventLabel" });
    if (!VALID_LEAGUES.includes(leagueKey)) return rejected.push({ rowNumber, raw: line, reason: `Invalid leagueKey: ${row.leaguekey}` });
    if (!VALID_MARKETS.includes(marketType)) return rejected.push({ rowNumber, raw: line, reason: `Invalid marketType: ${row.markettype}` });
    if (!row.selectionlabel) return rejected.push({ rowNumber, raw: line, reason: "Missing selectionLabel" });
    if (!VALID_BOOKS.includes(sportsbookKey)) return rejected.push({ rowNumber, raw: line, reason: `Invalid sportsbookKey: ${row.sportsbookkey}` });
    if (!Number.isFinite(oddsAmerican) || oddsAmerican === 0) return rejected.push({ rowNumber, raw: line, reason: `Invalid oddsAmerican: ${row.oddsamerican}` });
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) return rejected.push({ rowNumber, raw: line, reason: `Invalid stakeAmount: ${row.stakeamount}` });

    valid.push({
      rowNumber,
      eventLabel: row.eventlabel,
      leagueKey,
      marketType,
      selectionLabel: row.selectionlabel,
      sportsbookKey,
      placedAt: row.placedat || new Date().toISOString(),
      oddsAmerican,
      stakeAmount,
      notes: row.notes || undefined
    });
  });

  return { valid, rejected };
}

export function betsToCsv(bets: TrackedBet[]): string {
  const header = [
    "eventLabel",
    "leagueKey",
    "marketType",
    "selectionLabel",
    "sportsbookKey",
    "placedAt",
    "oddsAmerican",
    "stakeAmount",
    "status",
    "netProfit",
    "returnedAmount",
    "closingDecimalOdds",
    "notes"
  ];
  const rows = bets.map((b) =>
    [
      b.eventLabel,
      b.leagueKey,
      b.marketType,
      b.selectionLabel,
      b.sportsbookKey,
      b.placedAt,
      b.oddsAmerican,
      b.stakeAmount,
      b.status,
      b.netProfit.toFixed(2),
      b.returnedAmount.toFixed(2),
      b.closingDecimalOdds?.toFixed(4) ?? "unavailable",
      (b.notes ?? "").replace(/,/g, ";")
    ].join(",")
  );
  return [header.join(","), ...rows].join("\n");
}
