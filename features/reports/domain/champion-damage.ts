export type ChampionDamageSnapshot = {
  timestamp: number;
  participantId: number;
  total: number;
  physical: number;
  magic: number;
  trueDamage: number;
  precision: "frame";
};

export type ChampionDamageWindow = ChampionDamageSnapshot & {
  delta: { total: number; physical: number; magic: number; trueDamage: number } | null;
};

export function championDamageWindow(
  snapshots: ChampionDamageSnapshot[],
  participantId: number,
  start: number,
  end: number,
): ChampionDamageWindow[] {
  const observed = snapshots
    .filter((item) => item.participantId === participantId)
    .filter((item) => item.timestamp >= start && item.timestamp <= end)
    .sort((left, right) => left.timestamp - right.timestamp);
  return observed.map((item, index) => {
    const previous = observed[index - 1];
    return {
      ...item,
      delta: previous
        ? {
            total: item.total - previous.total,
            physical: item.physical - previous.physical,
            magic: item.magic - previous.magic,
            trueDamage: item.trueDamage - previous.trueDamage,
          }
        : null,
    };
  });
}
