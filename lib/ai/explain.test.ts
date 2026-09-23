import { describe, expect, it, beforeAll } from "vitest";
import { listOpportunities } from "../mock/store";
import { explainOutcome } from "./explain";
import { AnalysisOutputSchema } from "./schema";

describe("AI explanation (deterministic mode, no OPENAI_API_KEY)", () => {
  beforeAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("produces schema-valid output grounded only in structured evidence", async () => {
    const row = listOpportunities()[0]!;
    const result = await explainOutcome(row.outcomeId);
    expect(result).not.toBeNull();
    const parsed = AnalysisOutputSchema.safeParse(result!.output);
    expect(parsed.success).toBe(true);
    expect(result!.output.riskFactors.length).toBeGreaterThanOrEqual(1);
    expect(result!.output.safetyLabel).toBe("Educational analytics; outcomes uncertain.");
  });

  it("caches by evidence hash so a repeat request is instant and marked cached", async () => {
    const row = listOpportunities()[0]!;
    await explainOutcome(row.outcomeId);
    const second = await explainOutcome(row.outcomeId);
    expect(second!.cached).toBe(true);
  });

  it("returns null for an unknown outcome id instead of fabricating evidence", async () => {
    const result = await explainOutcome("does-not-exist");
    expect(result).toBeNull();
  });
});
