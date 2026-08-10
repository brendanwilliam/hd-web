-- Hands Diff is pre-release. v2 deliberately discards every profile-centric table.
DROP TABLE IF EXISTS "RiotMatchSnapshot" CASCADE;
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "Profile" CASCADE;

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "githubId" TEXT NOT NULL,
  "login" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_githubId_key" ON "Account"("githubId");

CREATE TABLE IF NOT EXISTS "DeviceGrant" (
  "id" TEXT NOT NULL,
  "deviceCodeHash" TEXT NOT NULL,
  "userCode" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "accountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceGrant_deviceCodeHash_key" ON "DeviceGrant"("deviceCodeHash");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceGrant_userCode_key" ON "DeviceGrant"("userCode");
CREATE INDEX IF NOT EXISTS "DeviceGrant_expiresAt_idx" ON "DeviceGrant"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeviceGrant_accountId_idx" ON "DeviceGrant"("accountId");

CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'reports:write',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "accountId" TEXT NOT NULL,
  "grantId" TEXT,
  CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApiToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ApiToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "DeviceGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_grantId_key" ON "ApiToken"("grantId");
CREATE INDEX IF NOT EXISTS "ApiToken_accountId_revokedAt_idx" ON "ApiToken"("accountId", "revokedAt");

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
