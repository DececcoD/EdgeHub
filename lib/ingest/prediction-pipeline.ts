/**
 * Prediction-market ingestion - the Kalshi/Polymarket equivalent of
 * lib/ingest/pipeline.ts's ingestLeague(), reusing the exact same
 * ProviderHealth/IngestionRun bookkeeping and circuit breaker (both
 * already provider-agnostic - see prisma/schema.prisma's header comment
 * on the new prediction_markets tables).
 *
 * No identity-resolution step here, unlike the sportsbook pipeline: there
 * is no canonical Team/Event catalog a Kalshi/Polymarket market needs to
 * resolve against - each provider's own market IS the canonical unit.
 * "Market matching" (Kalshi <-> Polymarket) is a separate, later step -
 * see lib/ingest/prediction-matching-persist.ts - since it compares
 * markets to EACH OTHER, not to a fixed catalog, so it only makes sense
 * to run once per ingestion pass, after both providers have ingested.
 *
 * Deliberately single-page fetch (no cursor-pagination loop) - a stated
 * scope simplification, not an oversight: proving out the pipeline
 * architecture doesn't need every market on either platform, and paging
 * through thousands of rows is a mechanical addition, not a design one.
 */
import type { PrismaClient } from "@prisma/client";
import { fetchMarkets as fetchKalshiMarkets } from "../providers/kalshi/client";
import { normalizeMarkets as normalizeKalshiMarkets } from "../providers/kalshi/normalize";
import { fetchMarkets as fetchPolymarketMarkets } from "../providers/polymarket/client";
import { normalizeMarkets as normalizePolymarketMarkets } from "../providers/polymarket/normalize";
import { shouldSkip, recordSuccess, recordFailure } from "./circuit-breaker";
import type { NormalizedPredictionMarket } from "../providers/prediction-markets/types";

export type PredictionProviderKey = "kalshi" | "polymarket";

export interface PredictionIngestSummary {
  runId: string;
  provider: PredictionProviderKey;
  marketsFetched: number;
  marketsWritten: number;
  warnings: string[];
  circuitBreakerOpen: boolean;
}

async function getProviderId(prisma: PrismaClient, key: PredictionProviderKey): Promise<string> {
  const record = await prisma.provider.findUnique({ where: { key } });
  if (!record) {
    throw new Error(`provider "${key}" is not seeded. Run "npm run db:seed" before ingesting.`);
  }
  return record.id;
}

async function fetchAndNormalize(provider: PredictionProviderKey): Promise<{ markets: NormalizedPredictionMarket[]; warnings: string[] }> {
  if (provider === "kalshi") {
    const { markets } = await fetchKalshiMarkets({ limit: 200, status: "active" });
    return normalizeKalshiMarkets(markets);
  }
  const { markets } = await fetchPolymarketMarkets({ limit: 200, closed: false });
  return normalizePolymarketMarkets(markets);
}

export async function ingestPredictionProvider(prisma: PrismaClient, provider: PredictionProviderKey): Promise<PredictionIngestSummary> {
  const providerId = await getProviderId(prisma, provider);

  if (await shouldSkip(prisma, providerId)) {
    const run = await prisma.ingestionRun.create({
      data: {
        providerId,
        status: "skipped",
        finishedAt: new Date(),
        errorSummary: `Circuit breaker open for "${provider}" - skipped without calling the provider. Will retry once the cooldown elapses.`
      }
    });
    return { runId: run.id, provider, marketsFetched: 0, marketsWritten: 0, warnings: [], circuitBreakerOpen: true };
  }

  const run = await prisma.ingestionRun.create({ data: { providerId, status: "running" } });
  const startedAt = Date.now();

  try {
    const { markets, warnings } = await fetchAndNormalize(provider);

    let marketsWritten = 0;
    for (const market of markets) {
      const row = await prisma.predictionMarket.upsert({
        where: { provider_providerMarketId: { provider: market.provider, providerMarketId: market.providerMarketId } },
        update: { title: market.title, closeTime: market.closeTime ? new Date(market.closeTime) : null, status: market.status },
        create: {
          provider: market.provider,
          providerMarketId: market.providerMarketId,
          title: market.title,
          closeTime: market.closeTime ? new Date(market.closeTime) : null,
          status: market.status
        }
      });

      for (const outcome of market.outcomes) {
        await prisma.predictionOutcome.upsert({
          where: { marketId_providerOutcomeId: { marketId: row.id, providerOutcomeId: outcome.outcomeId } },
          update: { label: outcome.label, price: outcome.price, bestBid: outcome.bestBid, bestAsk: outcome.bestAsk, observedAt: new Date() },
          create: {
            marketId: row.id,
            providerOutcomeId: outcome.outcomeId,
            label: outcome.label,
            price: outcome.price,
            bestBid: outcome.bestBid,
            bestAsk: outcome.bestAsk
          }
        });
      }

      marketsWritten += 1;
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: warnings.length > 0 ? "partial" : "success",
        finishedAt: new Date(),
        recordsProcessed: marketsWritten,
        errorSummary: warnings.length > 0 ? warnings.slice(0, 20).join(" | ") : null
      }
    });

    await prisma.providerHealth.upsert({
      where: { providerId },
      update: { latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() },
      create: { providerId, latencyMs: Date.now() - startedAt, lastSuccessAt: new Date() }
    });
    await recordSuccess(prisma, providerId);

    return { runId: run.id, provider, marketsFetched: markets.length, marketsWritten, warnings, circuitBreakerOpen: false };
  } catch (error) {
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), errorSummary: error instanceof Error ? error.message : String(error) }
    });
    await recordFailure(prisma, providerId);
    throw error;
  }
}
