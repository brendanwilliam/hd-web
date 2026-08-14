-- CreateTable
CREATE TABLE "InputEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "second" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InputEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InputEvent_reportId_second_idx" ON "InputEvent"("reportId", "second");

-- AddForeignKey
ALTER TABLE "InputEvent" ADD CONSTRAINT "InputEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
