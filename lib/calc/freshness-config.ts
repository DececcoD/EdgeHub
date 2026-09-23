/**
 * Freshness SLA policy - Section 7.4 ("Configured per source/market").
 * Single source of truth shared by the mock data generator, the real
 * ingestion pipeline, and the Postgres read layer, so all three ever agree
 * on what "current" vs "stale" means. Previously duplicated across two of
 * those; centralized here before a third copy could drift.
 */
import type { MarketType } from "../types";

export const SLA_SECONDS: Record<MarketType, number> = {
  moneyline: 45,
  spread: 45,
  total: 60
};

export const HARD_EXPIRY_SECONDS = 600;
