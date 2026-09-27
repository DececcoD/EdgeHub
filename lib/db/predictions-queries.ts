/**
 * Real-mode read path for prediction markets - the Kalshi/Polymarket
 * equivalent of lib/db/queries.ts. Deliberately recomputes matching at
 * read time via lib/predictions/matching.ts rather than reading back
 * PredictionMarketMatch - the exact same design lib/db/queries.ts's own
 * header documents for ConsensusSnapshot/OpportunitySnapshot: recomputing
 * is always at least as fresh, and the persisted table is a lineage/audit
 * trail (Section 11.1's "Audit" module), not a cache to read from.
 *
 * Takes an explicit PrismaClient (unlike lib/db/queries.ts's singleton),
 * matching lib/ingest/*.ts's own convention - this function is shared by
 * both the real-mode page (which passes the singleton) and
 * lib/ingest/prediction-matching-persist.ts (which needs it testable
 * against a fake Prisma, the same as the rest of the ingestion pipeline).
 */
import type { PrismaClient } from "@prisma/client";
import type { NormalizedPredictionMarket, PredictionMarketStatus } from "../providers/prediction-markets/types";

export async function listPredictionMarkets(prisma: PrismaClient): Promise<NormalizedPredictionMarket[]> {
  const rows = await prisma.predictionMarket.findMany({ include: { outcomes: true } });
  return rows.map((row) => ({
    provider: row.provider as "kalshi" | "polymarket",
    providerMarketId: row.providerMarketId,
    title: row.title,
    closeTime: row.closeTime ? row.closeTime.toISOString() : null,
    status: row.status as PredictionMarketStatus,
    outcomes: row.outcomes.map((o) => ({
      outcomeId: o.providerOutcomeId,
      label: o.label,
      price: o.price !== null ? Number(o.price) : null,
      bestBid: o.bestBid !== null ? Number(o.bestBid) : null,
      bestAsk: o.bestAsk !== null ? Number(o.bestAsk) : null
    }))
  }));
}
