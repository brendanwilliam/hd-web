type Data = Record<string, unknown>;

const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(data) : [];
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "";
const playerName = (player: Data) => `${text(player.riotIdGameName)}#${text(player.riotIdTagline)}`;
const seconds = (value: unknown) => Math.round(number(value) / 1000);
const hasPosition = (frame: Data | undefined, id: number) => Object.keys(data(data(data(data(frame).participantFrames)[String(id)]).position)).length > 0;

export type ItemData = { name?: string; gold?: { total?: number; sell?: number }; maps?: Record<string, boolean>; into?: string[] };
export type Participant = { id: number; teamId: number; riotId: string; champion: string; role: string };
export type NormalizedTimeline = { samples: Data[]; events: Data[]; abilities: Data[]; items: Data[] };

function participantsFor(match: unknown) {
  return list(data(data(match).info).participants).map(player => ({
    id: number(player.participantId), teamId: number(player.teamId), riotId: playerName(player),
    champion: text(player.championName), role: text(player.teamPosition) || "Unknown",
  }));
}

function player(participants: Participant[], id: number) {
  return participants.find(participant => participant.id === id);
}

function person(prefix: string, participant: Participant | undefined): Data {
  return participant ? { [`${prefix}_id`]: participant.id, [`${prefix}_name`]: participant.riotId, [`${prefix}_champion`]: participant.champion, [`${prefix}_role`]: participant.role } : {};
}

function structureLabel(event: Data) {
  const lane = text(event.laneType), tower = text(event.towerType), building = text(event.buildingType);
  if (building === "INHIBITOR_BUILDING") return `${lane === "BOT_LANE" ? "Bot" : lane === "MID_LANE" ? "Mid" : "Top"} inhibitor`;
  if (tower === "NEXUS_TURRET") return `Nexus ${number(data(event.position).y) > 0 ? "top" : "bottom"} turret`;
  if (tower === "BASE_TURRET") return `${lane === "BOT_LANE" ? "Bot" : "Top"} inhibitor turret`;
  const laneName = lane === "BOT_LANE" ? "Bot" : lane === "MID_LANE" ? "Mid" : "Top";
  const tier = tower === "OUTER_TURRET" ? 1 : tower === "INNER_TURRET" ? 2 : 3;
  return building === "TOWER_BUILDING" ? `${laneName} Tier ${tier} turret` : "Nexus";
}

function objectiveLabel(event: Data) {
  const monster = text(event.monsterType);
  if (monster === "DRAGON") return `${text(event.monsterSubType).replace("_DRAGON", "").replaceAll("_", " ") || "Dragon"} Dragon`;
  return monster === "BARON_NASHOR" ? "Baron Nashor" : monster === "ELDER_DRAGON" ? "Elder Dragon" : monster.replaceAll("_", " ") || "Neutral objective";
}

function itemDetails(itemId: number, items: Record<string, ItemData>) {
  const item = items[String(itemId)];
  return { item_id: itemId, item_name: item?.name || `Item ${itemId}`, item_cost: typeof item?.gold?.total === "number" ? item.gold.total : undefined, item_sell_price: typeof item?.gold?.sell === "number" ? item.gold.sell : undefined, completed_item: !!item && !item.into?.length };
}

function frameStats(frames: Data[], id: number, at: number) {
  const before = [...frames].reverse().find(frame => number(frame.timestamp) <= at && Object.keys(data(data(frame.participantFrames)[String(id)])).length);
  const after = frames.find(frame => number(frame.timestamp) >= at && Object.keys(data(data(frame.participantFrames)[String(id)])).length);
  return { before: data(data(data(before).participantFrames)[String(id)]), after: data(data(data(after).participantFrames)[String(id)]), beforeAt: number(data(before).timestamp), afterAt: number(data(after).timestamp) };
}

function rewardEstimate(frames: Data[], killerId: number, at: number) {
  if (!killerId) return {};
  const beforeFrame = [...frames].reverse().find(frame => number(frame.timestamp) < at);
  const afterFrame = frames.find(frame => number(frame.timestamp) >= at);
  const before = data(data(data(beforeFrame).participantFrames)[String(killerId)]), after = data(data(data(afterFrame).participantFrames)[String(killerId)]);
  const beforeAt = number(data(beforeFrame).timestamp), afterAt = number(data(afterFrame).timestamp);
  const gainedGold = number(after.totalGold) - number(before.totalGold);
  const gainedXp = number(after.xp) - number(before.xp);
  return Object.keys(before).length && Object.keys(after).length ? {
    estimated_killer_gold: gainedGold, estimated_killer_xp: gainedXp,
    reward_estimate_start: seconds(beforeAt || at), reward_estimate_end: seconds(afterAt || at),
    reward_estimate_note: "Estimated from surrounding participant frames; includes all gold and XP earned in this window.",
  } : {};
}

export function normalizeTimeline(match: unknown, timeline: unknown, selectedId: number, items: Record<string, ItemData> = {}): NormalizedTimeline {
  const frames = list(data(data(timeline).info).frames), participants = participantsFor(match);
  const selected = player(participants, selectedId), selectedTeam = selected?.teamId;
  const matchEnd = number(data(data(match).info).gameDuration) * 1000;
  const events: Data[] = [], abilities: Data[] = [], itemLedger: Data[] = [], transactionSamples: Data[] = [];
  const levels: Record<number, number> = {}, transactions: { itemId: number; spent: number }[] = [];
  const levelUps: { id: string; at: number; level: number }[] = [], skillUps: { id: string; at: number; ability: string; rank: number }[] = [];
  const kills: { id: string; at: number; victim: number }[] = [];
  let spent = 0;
  const addTransaction = (event: Data, index: string, change: number | undefined, detail: Data) => {
    if (change !== undefined) spent += change;
    const gold = frameStats(frames, selectedId, number(event.timestamp)).before.totalGold;
    const record = { id: index, seconds: seconds(event.timestamp), kind: "item_transaction", category: "Item", detail: text(detail.item_name), transaction_gold: change, price_available: change !== undefined, gold_spent: spent, ...detail };
    events.push(record); itemLedger.push(record); transactionSamples.push({ seconds: seconds(event.timestamp), gold_earned: number(gold), gold_spent: spent, unspent_gold: number(gold) - spent });
  };
  for (const [frameIndex, frame] of frames.entries()) {
    for (const [eventIndex, event] of list(frame.events).entries()) {
      const type = text(event.type), at = number(event.timestamp), id = `${frameIndex}-${eventIndex}`;
      if (type === "CHAMPION_KILL") {
        const killerId = number(event.killerId), victimId = number(event.victimId), killer = player(participants, killerId), victim = player(participants, victimId);
        kills.push({ id, at, victim: victimId });
        if (killerId === selectedId || victimId === selectedId) events.push({ id, seconds: seconds(at), kind: killerId === selectedId ? "player_kill" : "player_death", category: killerId === selectedId ? "Kill" : "Death", detail: killerId === selectedId ? `Killed ${victim?.riotId || "a player"}` : `Killed by ${killer?.riotId || "an unknown player"}`, team: killer?.teamId === selectedTeam ? "team" : "enemy", ...person("killer", killer), ...person("victim", victim), ...rewardEstimate(frames, killerId, at) });
      } else if (type === "SKILL_LEVEL_UP" && number(event.participantId) === selectedId) {
        const slot = number(event.skillSlot);
        if (slot >= 1 && slot <= 4) { const ability = "QWER"[slot - 1], rank = levels[slot] = (levels[slot] ?? 0) + 1; const record = { id, seconds: seconds(at), ability, level: rank }; abilities.push(record); skillUps.push({ id, at, ability, rank }); }
      } else if (type === "LEVEL_UP" && number(event.participantId) === selectedId) levelUps.push({ id, at, level: number(event.level) });
      else if (type === "ITEM_PURCHASED" && number(event.participantId) === selectedId) { const details = itemDetails(number(event.itemId), items); const cost = details.item_cost; if (cost !== undefined) transactions.push({ itemId: number(event.itemId), spent: cost }); addTransaction(event, id, cost, { ...details, transaction: "Purchased" }); }
      else if (type === "ITEM_SOLD" && number(event.participantId) === selectedId) { const details = itemDetails(number(event.itemId), items); addTransaction(event, id, details.item_sell_price === undefined ? undefined : -details.item_sell_price, { ...details, transaction: "Sold" }); }
      else if (type === "ITEM_UNDO" && number(event.participantId) === selectedId) { const beforeId = number(event.beforeId); let transactionIndex = -1; for (let index = transactions.length - 1; index >= 0; index--) if (transactions[index].itemId === beforeId) { transactionIndex = index; break; } const transaction = transactionIndex >= 0 ? transactions.splice(transactionIndex, 1)[0] : undefined; const details = itemDetails(beforeId, items); addTransaction(event, id, transaction ? -transaction.spent : undefined, { ...details, transaction: "Undo" }); }
      else if (type === "BUILDING_KILL") { const destroyedTeam = number(event.teamId), team = destroyedTeam === selectedTeam ? "enemy" : "team", structure = structureLabel(event), inhibitor = text(event.buildingType) === "INHIBITOR_BUILDING", end = inhibitor ? Math.min(at + 300_000, matchEnd) : at; events.push({ id, seconds: seconds(at), ...(inhibitor ? { end_seconds: seconds(end), structure_down_seconds: seconds(end) - seconds(at) } : {}), kind: team === "team" ? "enemy_structure" : "team_structure", category: "Structure", team, detail: `${structure} destroyed`, structure }); }
      else if (type === "ELITE_MONSTER_KILL") { const killer = player(participants, number(event.killerId)); events.push({ id, seconds: seconds(at), kind: "objective", category: "Objective", detail: objectiveLabel(event), objective: objectiveLabel(event), objective_team: killer?.teamId === selectedTeam ? "team" : "enemy", ...person("killer", killer) }); }
    }
  }
  const unmatchedSkills = new Set(skillUps.map(skill => skill.id));
  for (const [index, levelUp] of levelUps.entries()) {
    const skill = skillUps.filter(value => unmatchedSkills.has(value.id)).sort((left, right) => Math.abs(left.at - levelUp.at) - Math.abs(right.at - levelUp.at))[0];
    const matched = skill && Math.abs(skill.at - levelUp.at) <= 5_000 ? skill : undefined;
    if (matched) unmatchedSkills.delete(matched.id);
    const level = levelUp.level || index + 1;
    events.push({ id: levelUp.id, seconds: seconds(levelUp.at), kind: "level_up", category: "Level", detail: `Level ${level}${matched ? ` · ${matched.ability} rank ${matched.rank}` : ""}`, level, level_up_seconds: seconds(levelUp.at), ability: matched?.ability, ability_rank: matched?.rank, ability_level_up_seconds: matched ? seconds(matched.at) : undefined, ability_level_up_delay_seconds: matched ? Math.round((matched.at - levelUp.at) / 1000) : undefined });
  }
  const deathWindows = kills.sort((left, right) => left.at - right.at).map(kill => ({ ...kill, end: Math.min(frames.find(frame => number(frame.timestamp) > kill.at && hasPosition(frame, kill.victim))?.timestamp as number || matchEnd, matchEnd) }));
  const cumulativeDead = new Map<number, number>();
  for (const death of deathWindows) {
    const duration = seconds(death.end) - seconds(death.at), total = (cumulativeDead.get(death.victim) ?? 0) + duration;
    cumulativeDead.set(death.victim, total);
    const displayed = events.find(event => text(event.id) === death.id);
    if (displayed) Object.assign(displayed, { end_seconds: seconds(death.end), death_timer_seconds: duration, cumulative_dead_seconds: total, death_timer_note: "Estimated from the next participant frame with a position." });
  }
  for (const event of events.filter(event => text(event.kind) === "objective" && ["Baron Nashor", "Elder Dragon"].includes(text(event.objective)))) {
    const at = number(event.seconds) * 1000, duration = text(event.objective) === "Baron Nashor" ? 180 : 150, killer = number(event.killer_id), team = player(participants, killer)?.teamId;
    const holders = participants.filter(participant => participant.teamId === team).map(holder => {
      const dead = deathWindows.find(death => death.victim === holder.id && death.at <= at && death.end > at);
      const death = deathWindows.find(value => value.victim === holder.id && value.at > at);
      const end = dead ? at : Math.min(at + duration * 1000, death?.at ?? matchEnd, matchEnd);
      return { name: holder.riotId, role: holder.role, duration_seconds: seconds(end) - seconds(at), end_seconds: seconds(end) };
    });
    const end = Math.max(at, ...holders.map(holder => holder.end_seconds * 1000));
    Object.assign(event, { end_seconds: seconds(end), buff_active_seconds: seconds(end) - seconds(at), buff_holders: holders });
  }
  const samples = frames.flatMap(frame => { const stats = data(data(frame.participantFrames)[String(selectedId)]); const at = seconds(frame.timestamp); return Object.keys(stats).length ? [{ seconds: at, cs: number(stats.minionsKilled) + number(stats.jungleMinionsKilled), level: number(stats.level), gold: number(stats.currentGold), estimatedGold: number(stats.totalGold), gold_earned: number(stats.totalGold), experience: number(stats.xp), gold_spent: spentAt(transactionSamples, at), unspent_gold: number(stats.totalGold) - spentAt(transactionSamples, at) }] : []; });
  return { samples: [...samples, ...transactionSamples].sort((left, right) => number(left.seconds) - number(right.seconds)), events: events.sort((left, right) => number(left.seconds) - number(right.seconds)), abilities, items: itemLedger };
}

function spentAt(samples: Data[], at: number) {
  return samples.filter(sample => number(sample.seconds) <= at).at(-1)?.gold_spent as number | undefined ?? 0;
}
