export const reportPath = (reportId: string) =>
  `/reports/${encodeURIComponent(reportId)}`;
export const riotMatchPath = (matchId: string) =>
  `/reports/matches/${encodeURIComponent(matchId)}`;
