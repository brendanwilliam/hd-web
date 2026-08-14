-- AlterTable
ALTER TABLE "RiotMatch" ADD COLUMN     "timelineError" TEXT,
ADD COLUMN     "timelineState" TEXT NOT NULL DEFAULT 'pending';
