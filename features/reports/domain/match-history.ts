export type HistoryReport = {
  id: string;
  observedStartedAt: Date;
  reconciliationState: string;
  gameMode: string;
  durationMs: number;
  matchId: string | null;
};

export type HistoryRiotMatch = {
  id: string;
  matchId: string;
  gameStartedAt: Date;
  gameMode: string;
  durationMs: number;
};

export type MatchHistoryItem =
  | { kind: "riot"; match: HistoryRiotMatch; inputReport: HistoryReport | undefined; startedAt: Date }
  | { kind: "input"; report: HistoryReport; startedAt: Date };

export function buildMatchHistory(matches: HistoryRiotMatch[], reports: HistoryReport[]) {
  const inputByMatchId = new Map(reports.filter(report => report.matchId).map(report => [report.matchId, report]));
  const matchIds = new Set(matches.map(match => match.matchId));
  const items: MatchHistoryItem[] = [
    ...matches.map(match => ({ kind: "riot" as const, match, inputReport: inputByMatchId.get(match.matchId), startedAt: match.gameStartedAt })),
    ...reports.filter(report => !report.matchId || !matchIds.has(report.matchId)).map(report => ({ kind: "input" as const, report, startedAt: report.observedStartedAt })),
  ];
  return items.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
}
