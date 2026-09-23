/**
 * Evidence contract - PRD Section 9.2. Assembles exactly the structured
 * inputs the explanation is allowed to reference. Nothing outside this
 * object may be cited - that's the whole point of "explanation, not
 * calculation" (Decision Log, Section 9.1).
 */
import { findOutcome, getPriceHistory } from "../data-source";
import { formatAmerican, formatPercentagePoints, formatProbability, formatSignedPercent } from "../calc/format";

export interface EvidenceBlock {
  marketState: {
    event: string;
    league: string;
    marketType: string;
    selection: string;
    startAt: string;
    eligibleBooks: number;
    bestBook: string | null;
    bestAmerican: number | null;
  };
  calculatedMetrics: {
    impliedProbability: string | null;
    consensusProbability: string | null;
    edge: string | null;
    ev: string | null;
    score: number | null;
  };
  movement: {
    openDecimal: number | null;
    currentDecimal: number | null;
    hadDataGap: boolean;
  };
  limitations: string[];
  userRequest: "explain_movement" | "compare_prices" | "summarize_risks";
}

export async function buildEvidence(
  outcomeId: string,
  userRequest: EvidenceBlock["userRequest"] = "summarize_risks"
): Promise<EvidenceBlock | null> {
  const found = await findOutcome(outcomeId);
  if (!found) return null;
  const { market, outcome } = found;
  const history = await getPriceHistory(outcomeId);
  const hadDataGap = history.some((p) => p.gapBefore);

  const limitations: string[] = [];
  if (outcome.dataQuality === "partial") limitations.push("Fewer than two books currently contribute to consensus.");
  if (outcome.dataQuality === "stale") limitations.push("All available quotes are past their freshness window.");
  if (!outcome.bestQuote) limitations.push("No currently eligible book price is available.");
  if (hadDataGap) limitations.push("Line history has at least one unrecorded data gap.");
  if (limitations.length === 0) limitations.push("None identified from current structured evidence.");

  return {
    marketState: {
      event: `${market.event.away.name} @ ${market.event.home.name}`,
      league: market.event.leagueKey.toUpperCase(),
      marketType: market.marketType,
      selection: outcome.label,
      startAt: market.event.startAt,
      eligibleBooks: outcome.consensus?.eligibleBooks ?? 0,
      bestBook: outcome.bestQuote?.sportsbookName ?? null,
      bestAmerican: outcome.bestQuote?.americanOdds ?? null
    },
    calculatedMetrics: {
      impliedProbability: outcome.bestQuote
        ? formatProbability(1 / outcome.bestQuote.decimalOdds)
        : null,
      consensusProbability: outcome.consensus ? formatProbability(outcome.consensus.probability) : null,
      edge: outcome.edgePp !== null ? formatPercentagePoints(outcome.edgePp) : null,
      ev: outcome.evPercent !== null ? formatSignedPercent(outcome.evPercent) : null,
      score: outcome.score
    },
    movement: {
      openDecimal: history[0]?.decimalOdds ?? null,
      currentDecimal: history.at(-1)?.decimalOdds ?? null,
      hadDataGap
    },
    limitations,
    userRequest
  };
}

export function hashEvidence(evidence: EvidenceBlock): string {
  const json = JSON.stringify(evidence);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `ev_${Math.abs(hash).toString(36)}`;
}

export { formatAmerican };
