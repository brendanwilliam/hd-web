-- Hands Diff is pre-release. v2 deliberately discards every profile-centric table.
DROP TABLE IF EXISTS "RiotMatchSnapshot" CASCADE;
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "Profile" CASCADE;

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "riotIdGameName" TEXT NOT NULL,
  "riotIdTagLine" TEXT NOT NULL,
  "observedStartedAt" TIMESTAMP(3) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "gameMode" TEXT NOT NULL,
  "mapNumber" INTEGER NOT NULL,
  "resolvedPuuid" TEXT,
  "riotRegion" TEXT,
  "matchId" TEXT,
  "riotGameId" TEXT,
  "participantId" INTEGER,
  "reconciliationState" TEXT NOT NULL DEFAULT 'pending',
  "reconciliationAttempt" INTEGER NOT NULL DEFAULT 0,
  "retryAt" TIMESTAMP(3),
  "reconciliationError" TEXT,
  "matchSummary" JSONB,
  "riotEvents" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Report_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Report_accountId_id_key" ON "Report"("accountId", "id");
CREATE INDEX "Report_accountId_observedStartedAt_idx" ON "Report"("accountId", "observedStartedAt");
CREATE INDEX "Report_reconciliationState_retryAt_idx" ON "Report"("reconciliationState", "retryAt");
