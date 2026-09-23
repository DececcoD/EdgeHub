import type { APIRequestContext } from "@playwright/test";

/** A real outcomeId from the mock opportunity feed - tests that need a live
 * Analyzer detail page use this instead of hardcoding a seed ID, since
 * mock data can be regenerated with different IDs. */
export async function getSampleOutcomeId(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/v1/opportunities");
  const json = await res.json();
  const first = json.data[0];
  if (!first) throw new Error("No opportunities in mock data - can't run outcome-dependent e2e tests");
  return first.outcomeId as string;
}
