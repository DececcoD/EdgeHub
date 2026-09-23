/**
 * AI output schema - PRD Section 9.3. Every explanation, whether produced by
 * the deterministic template or a real model, is validated against this
 * schema before it reaches the UI (Section 9.4 guardrail: "Use structured
 * JSON output and validate against schema").
 */
import { z } from "zod";

export const AnalysisOutputSchema = z.object({
  summary: z.string().max(600), // ~80 words
  supportingFactors: z.array(z.string()).max(5),
  riskFactors: z.array(z.string()).min(1),
  dataLimitations: z.array(z.string()),
  metricExplanation: z.string(),
  citations: z.array(z.object({ evidenceId: z.string(), label: z.string() })),
  generatedAt: z.string(),
  safetyLabel: z.literal("Educational analytics; outcomes uncertain.")
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
