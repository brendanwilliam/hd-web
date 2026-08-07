ALTER TABLE "Profile" ADD COLUMN "riotPuuid" TEXT;
ALTER TABLE "Profile" ADD COLUMN "riotRegion" TEXT;
ALTER TABLE "Profile" ADD COLUMN "riotHistoryFetchedAt" TIMESTAMP(3);

ALTER TABLE "Report" ADD COLUMN "riotGameId" TEXT;
UPDATE "Report" SET "riotGameId" = "payload" ->> 'game_id'
WHERE "payload" ? 'game_id' AND "payload" ->> 'game_id' <> '';
CREATE INDEX "Report_profileId_riotGameId_idx" ON "Report"("profileId", "riotGameId");

CREATE TABLE "RiotMatchSnapshot" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "playedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiotMatchSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiotMatchSnapshot_profileId_gameId_key" ON "RiotMatchSnapshot"("profileId", "gameId");
CREATE INDEX "RiotMatchSnapshot_profileId_playedAt_idx" ON "RiotMatchSnapshot"("profileId", "playedAt");
ALTER TABLE "RiotMatchSnapshot" ADD CONSTRAINT "RiotMatchSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
