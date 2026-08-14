-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "playbackOmittedCount" INTEGER,
ADD COLUMN     "playbackPrecisionMs" INTEGER,
ADD COLUMN     "playbackTruncated" BOOLEAN;

-- CreateTable
CREATE TABLE "PlaybackRecord" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "gameTimeMs" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "normalizedX" DOUBLE PRECISION,
    "normalizedY" DOUBLE PRECISION,
    "actionLabel" TEXT,

    CONSTRAINT "PlaybackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaybackRecord_reportId_gameTimeMs_idx" ON "PlaybackRecord"("reportId", "gameTimeMs");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackRecord_reportId_ordinal_key" ON "PlaybackRecord"("reportId", "ordinal");

-- AddForeignKey
ALTER TABLE "PlaybackRecord" ADD CONSTRAINT "PlaybackRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
