-- CreateTable
CREATE TABLE "RiotMatch" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "riotGameId" TEXT,
    "riotIdGameName" TEXT NOT NULL,
    "riotIdTagLine" TEXT NOT NULL,
    "riotRegion" TEXT NOT NULL,
    "gameStartedAt" TIMESTAMP(3) NOT NULL,
    "gameMode" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "matchSummary" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiotMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiotMatch_accountId_gameStartedAt_idx" ON "RiotMatch"("accountId", "gameStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiotMatch_accountId_matchId_key" ON "RiotMatch"("accountId", "matchId");

-- AddForeignKey
ALTER TABLE "RiotMatch" ADD CONSTRAINT "RiotMatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
