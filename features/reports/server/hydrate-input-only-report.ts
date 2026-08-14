import { reconcileReport } from "@/features/reports/server/reconcile";
import { db } from "@/shared/server/db";

export async function hydrateInputOnlyReport(accountId: string, reportId: string) {
  const report = await db.report.findFirst({ where: { id: reportId, accountId } });
  const retryDue =
    report?.reconciliationState === "pending" &&
    (!report.retryAt || report.retryAt <= new Date());
  if (report?.reconciliationState !== "input_only" && !retryDue) return report;

  await reconcileReport(report.id);
  return db.report.findFirst({ where: { id: reportId, accountId } });
}
