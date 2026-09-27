/**
 * Only the network boundary (fetchMarkets) is mocked - normalize logic
 * runs for real, so this exercises fetch+normalize+persist together, not
 * just the persistence layer in isolation. Fake Prisma mirrors lib/ingest/
 * circuit-breaker.test.ts's own convention: proves the write shape is
 * sound, not that the real Postgres queries are wired correctly (needs a
 * real database, not available in this environment).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../providers/kalshi/client", () => ({ fetchMarkets: vi.fn() }));
vi.mock("../providers/polymarket/client", () => ({ fetchMarkets: vi.fn() }));

import { fetchMarkets as fetchKalshiMarkets } from "../providers/kalshi/client";
import { fetchMarkets as fetchPolymarketMarkets } from "../providers/polymarket/client";
import { ingestPredictionProvider } from "./prediction-pipeline";
import { FAILURE_THRESHOLD } from "./circuit-breaker";
import type { RawKalshiMarket } from "../providers/kalshi/types";
import type { RawGammaMarket } from "../providers/polymarket/types";

const KALSHI_FIXTURE: RawKalshiMarket[] = [
  {
    ticker: "FED-25DEC-T4.50",
    event_ticker: "FED-25DEC",
    market_type: "binary",
    yes_sub_title: "Fed cuts rates below 4.50% by December",
    no_sub_title: "Fed holds rates at or above 4.50%",
    status: "active",
    close_time: "2026-12-18T19:00:00Z",
    yes_bid_dollars: "0.5400",
    yes_ask_dollars: "0.5600",
    no_bid_dollars: "0.4400",
    no_ask_dollars: "0.4600",
    last_price_dollars: "0.5500",
    result: ""
  }
];

const POLYMARKET_FIXTURE: RawGammaMarket[] = [
  {
    id: "540817",
    conditionId: "0xfed-rate-cut-dec",
    question: "Will the Fed cut interest rates below 4.5% before December 2026?",
    outcomes: '["Yes", "No"]',
    outcomePrices: '["0.58", "0.42"]',
    clobTokenIds: '["tok_fed_yes", "tok_fed_no"]',
    active: true,
    closed: false,
    endDate: "2026-12-31T00:00:00Z"
  }
];

interface FakeProvider {
  id: string;
  key: string;
}
interface FakeMarket {
  id: string;
  provider: string;
  providerMarketId: string;
  title: string;
  closeTime: Date | null;
  status: string;
}
interface FakeOutcome {
  id: string;
  marketId: string;
  providerOutcomeId: string;
  label: string;
  price: number | null;
  bestBid: number | null;
  bestAsk: number | null;
}

function makeFakePrisma() {
  const providers: FakeProvider[] = [
    { id: "prov_kalshi", key: "kalshi" },
    { id: "prov_polymarket", key: "polymarket" }
  ];
  const runs: any[] = [];
  const health = new Map<string, any>();
  const markets: FakeMarket[] = [];
  const outcomes: FakeOutcome[] = [];
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}_${seq++}`;

  return {
    markets,
    outcomes,
    runs,
    prisma: {
      provider: {
        findUnique: async ({ where }: any) => providers.find((p) => p.key === where.key) ?? null
      },
      ingestionRun: {
        create: async ({ data }: any) => {
          const run = { id: nextId("run"), ...data };
          runs.push(run);
          return run;
        },
        update: async ({ where, data }: any) => {
          const run = runs.find((r) => r.id === where.id);
          Object.assign(run, data);
          return run;
        }
      },
      providerHealth: {
        findUnique: async ({ where }: any) => health.get(where.providerId) ?? null,
        upsert: async ({ where, update, create }: any) => {
          const existing = health.get(where.providerId);
          const next = existing ? { ...existing, ...update, updatedAt: new Date() } : { providerId: where.providerId, circuitBreakerOpen: false, consecutiveFailures: 0, ...create, updatedAt: new Date() };
          health.set(where.providerId, next);
          return next;
        }
      },
      predictionMarket: {
        upsert: async ({ where, update, create }: any) => {
          const key = where.provider_providerMarketId;
          const existing = markets.find((m) => m.provider === key.provider && m.providerMarketId === key.providerMarketId);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const row: FakeMarket = { id: nextId("market"), ...create };
          markets.push(row);
          return row;
        },
        findMany: async () => markets
      },
      predictionOutcome: {
        upsert: async ({ where, update, create }: any) => {
          const key = where.marketId_providerOutcomeId;
          const existing = outcomes.find((o) => o.marketId === key.marketId && o.providerOutcomeId === key.providerOutcomeId);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const row: FakeOutcome = { id: nextId("outcome"), price: null, bestBid: null, bestAsk: null, ...create };
          outcomes.push(row);
          return row;
        }
      }
    } as any
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ingestPredictionProvider", () => {
  it("fetches, normalizes, and persists real-shaped Kalshi markets and their outcomes", async () => {
    (fetchKalshiMarkets as any).mockResolvedValue({ markets: KALSHI_FIXTURE, cursor: "" });
    const { prisma, markets, outcomes } = makeFakePrisma();

    const summary = await ingestPredictionProvider(prisma, "kalshi");

    expect(summary.circuitBreakerOpen).toBe(false);
    expect(summary.marketsWritten).toBe(1);
    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({ provider: "kalshi", providerMarketId: "FED-25DEC-T4.50", status: "open" });
    expect(outcomes).toHaveLength(2);
    expect(outcomes.map((o) => o.providerOutcomeId).sort()).toEqual(["FED-25DEC-T4.50:no", "FED-25DEC-T4.50:yes"]);
  });

  it("fetches, normalizes, and persists real-shaped Polymarket markets, parsing the JSON-encoded outcome fields", async () => {
    (fetchPolymarketMarkets as any).mockResolvedValue({ markets: POLYMARKET_FIXTURE, next_cursor: "" });
    const { prisma, markets, outcomes } = makeFakePrisma();

    const summary = await ingestPredictionProvider(prisma, "polymarket");

    expect(summary.marketsWritten).toBe(1);
    expect(markets[0]).toMatchObject({ provider: "polymarket", providerMarketId: "0xfed-rate-cut-dec" });
    expect(outcomes.map((o) => o.providerOutcomeId).sort()).toEqual(["tok_fed_no", "tok_fed_yes"]);
  });

  it("re-running ingestion updates the existing row instead of creating a duplicate", async () => {
    (fetchKalshiMarkets as any).mockResolvedValue({ markets: KALSHI_FIXTURE, cursor: "" });
    const { prisma, markets } = makeFakePrisma();

    await ingestPredictionProvider(prisma, "kalshi");
    await ingestPredictionProvider(prisma, "kalshi");

    expect(markets).toHaveLength(1);
  });

  it("records a failed IngestionRun and rethrows when the fetch itself fails", async () => {
    (fetchKalshiMarkets as any).mockRejectedValue(new Error("network down"));
    const { prisma, runs } = makeFakePrisma();

    await expect(ingestPredictionProvider(prisma, "kalshi")).rejects.toThrow("network down");
    expect(runs[0].status).toBe("failed");
  });

  it("skips the run entirely once the circuit breaker is open, without calling fetchMarkets", async () => {
    (fetchKalshiMarkets as any).mockClear();
    const { prisma } = makeFakePrisma();

    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      (fetchKalshiMarkets as any).mockRejectedValueOnce(new Error("boom"));
      await ingestPredictionProvider(prisma, "kalshi").catch(() => {});
    }

    (fetchKalshiMarkets as any).mockClear();
    const summary = await ingestPredictionProvider(prisma, "kalshi");

    expect(summary.circuitBreakerOpen).toBe(true);
    expect(fetchKalshiMarkets).not.toHaveBeenCalled();
  });

  it("throws a clear error if the provider isn't seeded", async () => {
    const { prisma } = makeFakePrisma();
    prisma.provider.findUnique = async () => null;
    await expect(ingestPredictionProvider(prisma, "kalshi")).rejects.toThrow(/not seeded/);
  });
});
