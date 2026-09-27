/**
 * Persists lib/predictions/matching.ts's matchPredictionMarkets() against
 * REAL stored PredictionMarket rows - previously that logic only ever ran
 * against lib/predictions/mock-data.ts's fixture set in-memory. Run once
 * per ingestion pass, after both Kalshi and Polymarket have ingested
 * (scripts/ingest-predictions.ts), not per-provider inside
 * prediction-pipeline.ts - matching compares markets to EACH OTHER, so it
 * only makes sense once both sides are current.
 *
 * PredictionMarketMatch is treated as a fully-recomputed analytics table,
 * the same way ConsensusSnapshot is (see prisma/schema.prisma's comment
 * on it) - every run deletes and reinserts, rather than trying to detect
 * which old matches are now stale.
 *
 * Unmatched markets get a MappingException (entityType: "prediction_
 * market") - the same admin-review-queue concept Section 11.1 already
 * uses for sportsbook team/event identity. recordMappingException here
 * intentionally duplicates lib/ingest/identity.ts's own (unexported)
 * helper of the same name rather than importing it - these are two
 * otherwise-independent ingestion domains, and the dedup logic is a few
 * lines, not worth coupling them over.
 */
import type { PrismaClient } from "@prisma/client";
import { matchPredictionMarkets } from "../predictions/matching";
import { listPredictionMarkets } from "../db/predictions-queries";

async function recordMappingException(prisma: PrismaClient, providerId: string, sourceKey: string, reason: string): Promise<void> {
  const existing = await prisma.mappingException.findFirst({
    where: { providerId, entityType: "prediction_market", sourceKey, status: "open" }
  });
  if (existing) return; // don't spam duplicate exceptions for the same unresolved key
  await prisma.mappingException.create({ data: { providerId, entityType: "prediction_market", sourceKey, reason, status: "open" } });
}

export interface PersistMatchesSummary {
  matched: number;
  unmatched: number;
}

export async function persistPredictionMatches(prisma: PrismaClient): Promise<PersistMatchesSummary> {
  const markets = await listPredictionMarkets(prisma);
  const { matched, unmatched } = matchPredictionMarkets(markets);

  const dbRows = await prisma.predictionMarket.findMany({ select: { id: true, provider: true, providerMarketId: true } });
  const idByKey = new Map<string, string>(dbRows.map((r) => [`${r.provider}:${r.providerMarketId}`, r.id]));

  await prisma.predictionMarketMatch.deleteMany({});
  for (const pair of matched) {
    const leftId = idByKey.get(`${pair.kalshi.provider}:${pair.kalshi.providerMarketId}`);
    const rightId = idByKey.get(`${pair.polymarket.provider}:${pair.polymarket.providerMarketId}`);
    if (!leftId || !rightId) continue; // shouldn't happen - every matched market came from these same stored rows
    await prisma.predictionMarketMatch.create({ data: { leftMarketId: leftId, rightMarketId: rightId, similarity: pair.similarity } });
  }

  const providerIds = new Map<string, string>();
  for (const key of ["kalshi", "polymarket"] as const) {
    const provider = await prisma.provider.findUnique({ where: { key } });
    if (provider) providerIds.set(key, provider.id);
  }

  for (const market of unmatched) {
    const providerId = providerIds.get(market.provider);
    if (!providerId) continue; // provider not seeded - nothing to attach the exception to
    await recordMappingException(
      prisma,
      providerId,
      market.providerMarketId,
      `No confident match found on the other platform for "${market.title}".`
    );
  }

  return { matched: matched.length, unmatched: unmatched.length };
}
