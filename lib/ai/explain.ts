/**
 * AI explanation generator - PRD Section 9.
 *
 * Role (9.1): explain structured evidence; never calculate authoritative
 * odds, invent facts, or produce an unlabeled win probability.
 *
 * Without OPENAI_API_KEY configured, this runs a deterministic template that
 * only ever references fields already present in the evidence block - which
 * trivially satisfies "no fabricated claims" because there is no free-text
 * generation happening at all. When a key is present, a real model call is
 * attempted, then validated against the same schema; anything that fails
 * validation falls back to the deterministic template rather than reaching
 * the user unchecked.
 */
import { AnalysisOutputSchema, type AnalysisOutput } from "./schema";
import { buildEvidence, hashEvidence, type EvidenceBlock } from "./evidence";

export const PROMPT_VERSION = "explain-v1";
const SAFETY_LABEL = "Educational analytics; outcomes uncertain." as const;

interface LogEntry {
  outcomeId: string;
  evidenceHash: string;
  promptVersion: string;
  model: string;
  latencyMs: number;
  refusalOrSafetyState: "ok" | "fallback_used" | "schema_validation_failed";
  requestedAt: string;
}
const logs: LogEntry[] = [];
export function getExplanationLogs(): LogEntry[] {
  return logs;
}

const cache = new Map<string, AnalysisOutput>();

function deterministicExplain(evidence: EvidenceBlock): AnalysisOutput {
  const { marketState, calculatedMetrics, movement } = evidence;

  const summaryParts = [
    `${marketState.selection} in ${marketState.event} (${marketState.league} ${marketState.marketType}).`
  ];
  if (marketState.bestBook && calculatedMetrics.edge) {
    summaryParts.push(
      `Best displayed price is ${marketState.bestBook}, showing ${calculatedMetrics.edge} of edge against the ${marketState.eligibleBooks}-book consensus.`
    );
  } else {
    summaryParts.push("No currently eligible best price is available to evaluate.");
  }
  summaryParts.push("This is a probability-based read of current market data, not a prediction of the outcome.");

  const supportingFactors: string[] = [];
  if (calculatedMetrics.consensusProbability) {
    supportingFactors.push(`Consensus implied probability: ${calculatedMetrics.consensusProbability}.`);
  }
  if (calculatedMetrics.ev) {
    supportingFactors.push(`Expected value at the best price: ${calculatedMetrics.ev} per $1 staked.`);
  }
  if (movement.openDecimal && movement.currentDecimal) {
    const direction = movement.currentDecimal > movement.openDecimal ? "lengthened" : "shortened";
    supportingFactors.push(`Price has ${direction} from ${movement.openDecimal.toFixed(2)} to ${movement.currentDecimal.toFixed(2)} (decimal).`);
  }
  if (calculatedMetrics.score !== null) {
    supportingFactors.push(`Opportunity score: ${calculatedMetrics.score.toFixed(1)}/100 (ranking aid, not a win probability).`);
  }

  const riskFactors: string[] = [
    "Odds and consensus can move before you act on this information.",
    ...(movement.hadDataGap ? ["Line history includes at least one unrecorded data gap."] : [])
  ];

  return {
    summary: summaryParts.join(" ").slice(0, 600),
    supportingFactors: supportingFactors.slice(0, 5),
    riskFactors,
    dataLimitations: evidence.limitations,
    metricExplanation:
      "Edge is the difference between the consensus (no-vig) probability and the implied probability of the best available price - it is a ranking aid, not a guarantee. EV is the expected return per $1 staked if the consensus estimate is correct on average across many similar bets.",
    citations: [
      { evidenceId: "market_state", label: "Current market state" },
      { evidenceId: "calculated_metrics", label: "Calculated metrics" },
      { evidenceId: "movement", label: "Price movement" }
    ],
    generatedAt: new Date().toISOString(),
    safetyLabel: SAFETY_LABEL
  };
}

export interface ExplainResult {
  output: AnalysisOutput;
  cached: boolean;
  model: string;
}

export async function explainOutcome(
  outcomeId: string,
  userRequest: EvidenceBlock["userRequest"] = "summarize_risks"
): Promise<ExplainResult | null> {
  const evidence = await buildEvidence(outcomeId, userRequest);
  if (!evidence) return null;

  const evidenceHash = hashEvidence(evidence);
  const cacheKey = `${PROMPT_VERSION}:${evidenceHash}`;
  const cached = cache.get(cacheKey);
  if (cached) return { output: cached, cached: true, model: "cache" };

  const startedAt = Date.now();
  const useOpenAI = Boolean(process.env.OPENAI_API_KEY);
  let output: AnalysisOutput;
  let model = "deterministic-template-v1";
  let state: LogEntry["refusalOrSafetyState"] = "ok";

  if (useOpenAI) {
    try {
      output = await callOpenAI(evidence);
      model = "gpt-4o-mini";
    } catch {
      output = deterministicExplain(evidence);
      state = "fallback_used";
    }
  } else {
    output = deterministicExplain(evidence);
  }

  const parsed = AnalysisOutputSchema.safeParse(output);
  if (!parsed.success) {
    output = deterministicExplain(evidence);
    model = "deterministic-template-v1";
    state = "schema_validation_failed";
  }

  cache.set(cacheKey, output);
  logs.push({
    outcomeId,
    evidenceHash,
    promptVersion: PROMPT_VERSION,
    model,
    latencyMs: Date.now() - startedAt,
    refusalOrSafetyState: state,
    requestedAt: new Date().toISOString()
  });

  return { output, cached: false, model };
}

/**
 * Real model call, only exercised when OPENAI_API_KEY is set. Kept minimal
 * and isolated so it's easy to swap for the Responses API / structured
 * outputs mode later without touching callers.
 */
async function callOpenAI(evidence: EvidenceBlock): Promise<AnalysisOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You explain sports-betting market data. You may ONLY reference facts present in the JSON evidence provided by the user. Never invent injuries, news, or probabilities. Never claim a guaranteed outcome. Respond as JSON matching this shape: {summary, supportingFactors[], riskFactors[], dataLimitations[], metricExplanation, citations[{evidenceId,label}], generatedAt, safetyLabel}. safetyLabel must be exactly \"Educational analytics; outcomes uncertain.\""
        },
        { role: "user", content: JSON.stringify(evidence) }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  return JSON.parse(content);
}
