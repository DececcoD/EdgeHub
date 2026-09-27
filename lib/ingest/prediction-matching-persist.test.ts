/**
 * Fake Prisma standing in for Postgres - same convention as prediction-
 * pipeline.test.ts. Reuses real lib/predictions/matching.ts logic
 * unmocked, so this proves the persistence layer around real matching
 * output, not persistence logic in isolation against a stub.
 */
import { describe, expect, it } from "vitest";
import { persistPredictionMatches } from "./prediction-matching-persist";

interface FakeMarketRow {
  id: string;
  provider: string;
  providerMarketId: string;
  title: string;
  closeTime: Date | null;
  status: string;
  outcomes: { providerOutcomeId: string; label: string; price: number | null; bestBid: number | null; bestAsk: number | null }[];
}

function makeFakePrisma(marketRows: FakeMarketRow[]) {
  const matches: any[] = [];
  const exceptions: any[] = [];
  const providers = [
    { id: "prov_kalshi", key: "kalshi" },
    { id: "prov_polymarket", key: "polymarket" }
  ];
  let seq = 1;

  return {
    matches,
    exceptions,
    prisma: {
      predictionMarket: {
        findMany: async (args?: any) =>
          args?.select
            ? marketRows.map((m) => ({ id: m.id, provider: m.provider, providerMarketId: m.providerMarketId }))
            : marketRows
      },
      predictionMarketMatch: {
        deleteMany: async () => {
          matches.length = 0;
          return { count: 0 };
        },
        create: async ({ data }: any) => {
          const row = { id: `match_${seq++}`, ...data };
          matches.push(row);
          return row;
        }
      },
      provider: {
        findUnique: async ({ where }: any) => providers.find((p) => p.key === where.key) ?? null
      },
      mappingException: {
        findFirst: async ({ where }: any) =>
          exceptions.find((e) => e.providerId === where.providerId && e.sourceKey === where.sourceKey && e.status === where.status) ?? null,
        create: async ({ data }: any) => {
          const row = { id: `exc_${seq++}`, ...data };
          exceptions.push(row);
          return row;
        }
      }
    } as any
  };
}

const FED_KALSHI: FakeMarketRow = {
  id: "m_kalshi_fed",
  provider: "kalshi",
  providerMarketId: "FED-25DEC-T4.50",
  title: "Fed cuts rates below 4.50% by December",
  closeTime: null,
  status: "open",
  outcomes: [{ providerOutcomeId: "FED-25DEC-T4.50:yes", label: "Yes", price: 0.55, bestBid: 0.54, bestAsk: 0.56 }]
};

const FED_POLY: FakeMarketRow = {
  id: "m_poly_fed",
  provider: "polymarket",
  providerMarketId: "0xfed-rate-cut-dec",
  title: "Will the Fed cut interest rates below 4.5% before December 2026?",
  closeTime: null,
  status: "open",
  outcomes: [{ providerOutcomeId: "tok_fed_yes", label: "Yes", price: 0.58, bestBid: 0.57, bestAsk: 0.59 }]
};

const SHUTDOWN_KALSHI: FakeMarketRow = {
  id: "m_kalshi_shutdown",
  provider: "kalshi",
  providerMarketId: "GOV-SHUTDOWN-26",
  title: "Government shutdown occurs before year end",
  closeTime: null,
  status: "open",
  outcomes: [{ providerOutcomeId: "GOV-SHUTDOWN-26:yes", label: "Yes", price: 0.15, bestBid: 0.14, bestAsk: 0.16 }]
};

describe("persistPredictionMatches", () => {
  it("persists a real matched pair with its similarity score", async () => {
    const { prisma, matches } = makeFakePrisma([FED_KALSHI, FED_POLY]);

    const summary = await persistPredictionMatches(prisma);

    expect(summary.matched).toBe(1);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ leftMarketId: "m_kalshi_fed", rightMarketId: "m_poly_fed" });
    expect(matches[0].similarity).toBeGreaterThan(0);
  });

  it("records a MappingException for a market with no confident match on the other platform", async () => {
    const { prisma, exceptions } = makeFakePrisma([FED_KALSHI, FED_POLY, SHUTDOWN_KALSHI]);

    const summary = await persistPredictionMatches(prisma);

    expect(summary.unmatched).toBe(1);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]).toMatchObject({ providerId: "prov_kalshi", entityType: "prediction_market", sourceKey: "GOV-SHUTDOWN-26", status: "open" });
  });

  it("does not create a duplicate open exception for the same unresolved market on a second run", async () => {
    const { prisma, exceptions } = makeFakePrisma([SHUTDOWN_KALSHI]);

    await persistPredictionMatches(prisma);
    await persistPredictionMatches(prisma);

    expect(exceptions).toHaveLength(1);
  });

  it("clears and fully recomputes matches on every run rather than accumulating stale rows", async () => {
    const { prisma, matches } = makeFakePrisma([FED_KALSHI, FED_POLY]);

    await persistPredictionMatches(prisma);
    await persistPredictionMatches(prisma);

    expect(matches).toHaveLength(1); // not 2 - deleteMany() ran before the second re-insert
  });

  it("handles an empty market set cleanly", async () => {
    const { prisma } = makeFakePrisma([]);
    const summary = await persistPredictionMatches(prisma);
    expect(summary).toEqual({ matched: 0, unmatched: 0 });
  });
});
