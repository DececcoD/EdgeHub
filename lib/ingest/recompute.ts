/**
 * Persists ConsensusSnapshot/OpportunitySnapshot rows after an ingestion run
 * (Section 7.3 step 5; Section 8.1's "derived metrics with lineage/version"
 * tables). Reuses lib/db/queries.ts's getAllMarketViewsWithScores() as the
 * single source of truth for the consensus/edge/EV/score math - this
 * module's only job is to persist that computation's output as an
 * auditable, versioned time series, not to recompute it a second way that
 * could drift from the live read path.
 *
 * The live read path is deliberately unchanged by this: it still recomputes
 * at read time, which is always at least as fresh as the latest snapshot
 * written here. These rows exist for lineage/audit/historical analysis, not
 * to serve reads - wiring reads to consume the latest snapshot instead of
 * recomputing is a further optimization this doesn't attempt.
 */
import type { PrismaClient } from "@prisma/client";
import { getAllMarketViewsWithScores } from "../db/queries";
import { decimalToImpliedProbability } from "../calc/odds";

const CONSENSUS_METHOD_VERSION = "proportional-v1";

export interface RecomputeSummary {
  marketsSnapshotted: number;
  outcomesSnapshotted: number;
}

export async function persistDerivedSnapshots(prisma: PrismaClient): Promise<RecomputeSummary> {
  const views = await getAllMarketViewsWithScores();
  let marketsSnapshotted = 0;
  let outcomesSnapshotted = 0;

  for (const view of views) {
    const probabilities: Record<string, number> = {};
    let eligibleBooks = 0;
    for (const outcome of view.outcomes) {
      if (!outcome.consensus) continue;
      probabilities[outcome.outcomeId] = outcome.consensus.probability;
      eligibleBooks = Math.max(eligibleBooks, outcome.consensus.eligibleBooks);
    }
    if (Object.keys(probabilities).length === 0) continue; // nothing eligible yet - not worth a snapshot row

    await prisma.consensusSnapshot.create({
      data: {
        marketId: view.marketId,
        methodVersion: CONSENSUS_METHOD_VERSION,
        eligibleBooks,
        probabilities,
        overround: 0 // no true overround computed yet - same placeholder the read path's consensus object uses
      }
    });
    marketsSnapshotted += 1;

    for (const outcome of view.outcomes) {
      if (!outcome.estimate || outcome.edgePp === null || outcome.ev === null || outcome.score === null || !outcome.bestQuote) continue;

      await prisma.opportunitySnapshot.create({
        data: {
          outcomeId: outcome.outcomeId,
          estimateSource: outcome.estimate.source,
          pEstimate: outcome.estimate.pEstimate,
          pImplied: decimalToImpliedProbability(outcome.bestQuote.decimalOdds),
          edgePp: outcome.edgePp,
          ev: outcome.ev,
          score: outcome.score,
          scoreVersion: outcome.scoreVersion ?? "unknown",
          dataQuality: outcome.dataQuality
        }
      });
      outcomesSnapshotted += 1;
    }
  }

  return { marketsSnapshotted, outcomesSnapshotted };
}
