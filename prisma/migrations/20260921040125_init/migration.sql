-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'elite');

-- CreateEnum
CREATE TYPE "OddsFormat" AS ENUM ('american', 'decimal');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('scheduled', 'live', 'final', 'postponed', 'canceled');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('moneyline', 'spread', 'total');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('open', 'suspended', 'settled', 'voided');

-- CreateEnum
CREATE TYPE "AlertConditionType" AS ENUM ('odds_threshold', 'edge_threshold', 'book_spread', 'movement', 'start_reminder', 'freshness_recovery');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('active', 'paused', 'expired');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('open', 'won', 'lost', 'push', 'void', 'partial_cash_out', 'full_cash_out');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oddsFormat" "OddsFormat" NOT NULL DEFAULT 'american',
    "favoriteLeagues" TEXT[],
    "favoriteBooks" TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "displayUnits" TEXT NOT NULL DEFAULT 'currency',
    "onboardedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "opportunityRowsPerDay" INTEGER NOT NULL DEFAULT 20,
    "aiExplanationsPerDay" INTEGER NOT NULL DEFAULT 3,
    "betTrackerLimit" INTEGER DEFAULT 50,
    "activeAlertLimit" INTEGER NOT NULL DEFAULT 2,
    "lineHistoryDays" INTEGER NOT NULL DEFAULT 1,
    "exportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedFiltersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "venueId" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "isOutdoor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "canonicalStartAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'scheduled',
    "venueId" TEXT,
    "sourceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "side" TEXT NOT NULL,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'full_game',
    "lineKey" TEXT,
    "status" "MarketStatus" NOT NULL DEFAULT 'open',
    "rulesVersion" TEXT NOT NULL DEFAULT 'v1',

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_rules" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "market_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcomes" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "participantId" TEXT,
    "side" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,

    CONSTRAINT "outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sportsbooks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "affiliateUrl" TEXT,

    CONSTRAINT "sportsbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_entities" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "canonicalEntityId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "source_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_mappings" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sportsbookId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "decimalOdds" DECIMAL(10,4) NOT NULL,
    "americanOdds" INTEGER NOT NULL,
    "point" DECIMAL(6,2),
    "observedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceQuoteId" TEXT NOT NULL,
    "rawRef" TEXT,

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_odds" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "sportsbookId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "freshnessState" TEXT NOT NULL DEFAULT 'current',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_odds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_history_rollups" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "bucketEnd" TIMESTAMP(3) NOT NULL,
    "openDecimal" DECIMAL(10,4) NOT NULL,
    "closeDecimal" DECIMAL(10,4) NOT NULL,
    "minDecimal" DECIMAL(10,4) NOT NULL,
    "maxDecimal" DECIMAL(10,4) NOT NULL,
    "hadGap" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "line_history_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consensus_snapshots" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "eligibleBooks" INTEGER NOT NULL,
    "probabilities" JSONB NOT NULL,
    "overround" DECIMAL(6,4) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consensus_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_snapshots" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "estimateSource" TEXT NOT NULL,
    "pEstimate" DECIMAL(8,6) NOT NULL,
    "pImplied" DECIMAL(8,6) NOT NULL,
    "edgePp" DECIMAL(6,3) NOT NULL,
    "ev" DECIMAL(8,5) NOT NULL,
    "score" DECIMAL(6,3) NOT NULL,
    "scoreVersion" TEXT NOT NULL,
    "dataQuality" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_versions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_predictions" (
    "id" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "pEstimate" DECIMAL(8,6) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My watchlist',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "conditionType" "AlertConditionType" NOT NULL,
    "threshold" DECIMAL(10,4),
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "quietHoursStart" TEXT NOT NULL DEFAULT '23:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00',
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 1800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitionKey" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bankrolls" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startingAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxStakeFraction" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "kellySizingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bankrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportsbookId" TEXT NOT NULL,
    "marketType" "MarketType" NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL,
    "oddsDecimal" DECIMAL(10,4) NOT NULL,
    "stakeAmount" DECIMAL(12,2) NOT NULL,
    "stakeUnits" DECIMAL(8,3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "BetStatus" NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notesEncrypted" TEXT,
    "closingDecimalOdds" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_legs" (
    "id" TEXT NOT NULL,
    "betEntryId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "bet_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_settlements" (
    "id" TEXT NOT NULL,
    "betEntryId" TEXT NOT NULL,
    "status" "BetStatus" NOT NULL,
    "netProfit" DECIMAL(12,2) NOT NULL,
    "returnedAmount" DECIMAL(12,2) NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledBy" TEXT NOT NULL DEFAULT 'system',
    "previousValues" JSONB,

    CONSTRAINT "bet_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "units" DECIMAL(8,3),
    "effectiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_evidence" (
    "id" TEXT NOT NULL,
    "analysisRequestId" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "analysis_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_outputs" (
    "id" TEXT NOT NULL,
    "analysisRequestId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "supportingFactors" JSONB NOT NULL,
    "riskFactors" JSONB NOT NULL,
    "dataLimitations" JSONB NOT NULL,
    "metricExplanation" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "safetyLabel" TEXT NOT NULL DEFAULT 'Educational analytics; outcomes uncertain.',
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_health" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "quotaRemaining" INTEGER,
    "latencyMs" INTEGER,
    "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "circuitBreakerOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_exceptions" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "mapping_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "beforeHash" TEXT,
    "afterHash" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "plans" "Plan"[],
    "regions" TEXT[],
    "cohorts" TEXT[],
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlements_userId_key" ON "entitlements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sports_key_key" ON "sports"("key");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_key_key" ON "leagues"("key");

-- CreateIndex
CREATE UNIQUE INDEX "teams_leagueId_key_key" ON "teams"("leagueId", "key");

-- CreateIndex
CREATE INDEX "events_leagueId_canonicalStartAt_idx" ON "events"("leagueId", "canonicalStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "markets_eventId_marketType_period_lineKey_key" ON "markets"("eventId", "marketType", "period", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "outcomes_marketId_canonicalKey_key" ON "outcomes"("marketId", "canonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "providers_key_key" ON "providers"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sportsbooks_key_key" ON "sportsbooks"("key");

-- CreateIndex
CREATE UNIQUE INDEX "source_entities_providerId_sourceKey_entityType_key" ON "source_entities"("providerId", "sourceKey", "entityType");

-- CreateIndex
CREATE INDEX "odds_snapshots_marketId_observedAt_idx" ON "odds_snapshots"("marketId", "observedAt");

-- CreateIndex
CREATE INDEX "odds_snapshots_outcomeId_observedAt_idx" ON "odds_snapshots"("outcomeId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "current_odds_outcomeId_sportsbookId_key" ON "current_odds"("outcomeId", "sportsbookId");

-- CreateIndex
CREATE INDEX "line_history_rollups_outcomeId_bucketStart_idx" ON "line_history_rollups"("outcomeId", "bucketStart");

-- CreateIndex
CREATE INDEX "consensus_snapshots_marketId_calculatedAt_idx" ON "consensus_snapshots"("marketId", "calculatedAt");

-- CreateIndex
CREATE INDEX "opportunity_snapshots_outcomeId_calculatedAt_idx" ON "opportunity_snapshots"("outcomeId", "calculatedAt");

-- CreateIndex
CREATE INDEX "opportunity_snapshots_score_idx" ON "opportunity_snapshots"("score");

-- CreateIndex
CREATE UNIQUE INDEX "model_versions_key_key" ON "model_versions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "alert_events_alertId_transitionKey_key" ON "alert_events"("alertId", "transitionKey");

-- CreateIndex
CREATE INDEX "bet_entries_userId_placedAt_idx" ON "bet_entries"("userId", "placedAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_health_providerId_key" ON "provider_health"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_rules" ADD CONSTRAINT "market_rules_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "event_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entities" ADD CONSTRAINT "source_entities_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_sportsbookId_fkey" FOREIGN KEY ("sportsbookId") REFERENCES "sportsbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_odds" ADD CONSTRAINT "current_odds_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_odds" ADD CONSTRAINT "current_odds_sportsbookId_fkey" FOREIGN KEY ("sportsbookId") REFERENCES "sportsbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_odds" ADD CONSTRAINT "current_odds_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "odds_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_snapshots" ADD CONSTRAINT "opportunity_snapshots_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_predictions" ADD CONSTRAINT "model_predictions_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bankrolls" ADD CONSTRAINT "bankrolls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_entries" ADD CONSTRAINT "bet_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_entries" ADD CONSTRAINT "bet_entries_sportsbookId_fkey" FOREIGN KEY ("sportsbookId") REFERENCES "sportsbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_betEntryId_fkey" FOREIGN KEY ("betEntryId") REFERENCES "bet_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_settlements" ADD CONSTRAINT "bet_settlements_betEntryId_fkey" FOREIGN KEY ("betEntryId") REFERENCES "bet_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_betEntryId_fkey" FOREIGN KEY ("betEntryId") REFERENCES "bet_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_requests" ADD CONSTRAINT "analysis_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_evidence" ADD CONSTRAINT "analysis_evidence_analysisRequestId_fkey" FOREIGN KEY ("analysisRequestId") REFERENCES "analysis_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_outputs" ADD CONSTRAINT "analysis_outputs_analysisRequestId_fkey" FOREIGN KEY ("analysisRequestId") REFERENCES "analysis_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_health" ADD CONSTRAINT "provider_health_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
