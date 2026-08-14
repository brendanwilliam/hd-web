import { db } from "@/shared/server/db";

export async function playbackForReport(accountId: string, reportId: string) {
  const report = await db.report.findFirst({
    where: { id: reportId, accountId },
    select: {
      playbackTruncated: true,
      playbackOmittedCount: true,
      playbackPrecisionMs: true,
      playbackRecords: {
        select: {
          ordinal: true,
          gameTimeMs: true,
          kind: true,
          normalizedX: true,
          normalizedY: true,
          actionLabel: true,
        },
        orderBy: { gameTimeMs: "asc" },
      },
    },
  });
  if (!report) return null;
  return {
    available: report.playbackPrecisionMs !== null,
    truncated: report.playbackTruncated ?? false,
    omittedRecordCount: report.playbackOmittedCount ?? 0,
    timestampPrecisionMs: report.playbackPrecisionMs,
    records: report.playbackRecords,
  };
}
