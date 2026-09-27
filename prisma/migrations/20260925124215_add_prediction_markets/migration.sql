-- CreateTable
CREATE TABLE "prediction_markets" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMarketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "closeTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prediction_markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_outcomes" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "providerOutcomeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(6,4),
    "bestBid" DECIMAL(6,4),
    "bestAsk" DECIMAL(6,4),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_market_matches" (
    "id" TEXT NOT NULL,
    "leftMarketId" TEXT NOT NULL,
    "rightMarketId" TEXT NOT NULL,
    "similarity" DECIMAL(5,4) NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_market_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prediction_markets_provider_providerMarketId_key" ON "prediction_markets"("provider", "providerMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_outcomes_marketId_providerOutcomeId_key" ON "prediction_outcomes"("marketId", "providerOutcomeId");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_market_matches_leftMarketId_rightMarketId_key" ON "prediction_market_matches"("leftMarketId", "rightMarketId");

-- AddForeignKey
ALTER TABLE "prediction_outcomes" ADD CONSTRAINT "prediction_outcomes_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "prediction_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_market_matches" ADD CONSTRAINT "prediction_market_matches_leftMarketId_fkey" FOREIGN KEY ("leftMarketId") REFERENCES "prediction_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_market_matches" ADD CONSTRAINT "prediction_market_matches_rightMarketId_fkey" FOREIGN KEY ("rightMarketId") REFERENCES "prediction_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
