-- AlterTable
ALTER TABLE "provider_health" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
