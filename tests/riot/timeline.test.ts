import { describe, expect, it } from "vitest";
import { normalizeTimeline } from "@/features/riot/domain/timeline";
import { reportSeries, timelineEvents } from "@/features/reports/visualizations/data";

const participants = [
  { participantId: 1, teamId: 100, riotIdGameName: "Me", riotIdTagline: "NA1", championName: "Ahri", teamPosition: "MIDDLE" },
  { participantId: 2, teamId: 200, riotIdGameName: "Them", riotIdTagline: "NA1", championName: "Zed", teamPosition: "MIDDLE" },
  { participantId: 3, teamId: 100, riotIdGameName: "Ally", riotIdTagline: "NA1", championName: "Nami", teamPosition: "UTILITY" },
];
const frame = (timestamp: number, totalGold: number, events: object[] = []) => ({ timestamp, events, participantFrames: { "1": { totalGold, currentGold: totalGold, xp: totalGold * 2, level: 1, minionsKilled: 0, jungleMinionsKilled: 0, position: { x: 1, y: 1 } }, "2": { totalGold: 500, xp: 1000, position: { x: 2, y: 2 } }, "3": { totalGold: 500, xp: 1000, position: { x: 3, y: 3 } } } });
const items = { "1001": { name: "Boots", gold: { total: 300, sell: 90 }, maps: { "11": true } }, "1002": { name: "Big item", gold: { total: 1000, sell: 700 }, maps: { "11": true } } };

describe("Riot Match-v5 timeline normalization", () => {
  it("normalizes player-aware events, item ledger, structures, and buff ranges", () => {
    const match = { info: { gameDuration: 300, participants } };
    const timeline = { info: { frames: [
      frame(0, 500),
      frame(60_000, 900, [{ type: "CHAMPION_KILL", timestamp: 60_000, killerId: 1, victimId: 2 }, { type: "LEVEL_UP", timestamp: 58_000, participantId: 1, level: 2 }, { type: "SKILL_LEVEL_UP", timestamp: 60_000, participantId: 1, skillSlot: 1 }, { type: "ITEM_PURCHASED", timestamp: 60_000, participantId: 1, itemId: 1001 }, { type: "ITEM_SOLD", timestamp: 60_000, participantId: 1, itemId: 1001 }]),
      frame(120_000, 1_400, [{ type: "ITEM_PURCHASED", timestamp: 120_000, participantId: 1, itemId: 1002 }, { type: "ITEM_UNDO", timestamp: 120_000, participantId: 1, beforeId: 1002 }, { type: "BUILDING_KILL", timestamp: 120_000, teamId: 200, buildingType: "TOWER_BUILDING", laneType: "TOP_LANE", towerType: "OUTER_TURRET" }, { type: "BUILDING_KILL", timestamp: 120_000, teamId: 100, buildingType: "INHIBITOR_BUILDING", laneType: "MID_LANE" }, { type: "ELITE_MONSTER_KILL", timestamp: 120_000, killerId: 1, monsterType: "BARON_NASHOR" }]),
      frame(150_000, 1_600, [{ type: "CHAMPION_KILL", timestamp: 135_000, killerId: 2, victimId: 3 }, { type: "CHAMPION_KILL", timestamp: 150_000, killerId: 2, victimId: 1 }]),
    ] } };
    const normalized = normalizeTimeline(match, timeline, 1, items);
    const kill = normalized.events.find(event => event.kind === "player_kill");
    expect(kill).toMatchObject({ killer_name: "Me#NA1", killer_role: "MIDDLE", victim_name: "Them#NA1", victim_role: "MIDDLE", reward_estimate_note: expect.stringContaining("Estimated") });
    expect(normalized.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "level_up", seconds: 58, level: 2, ability: "Q", ability_rank: 1, ability_level_up_seconds: 60, ability_level_up_delay_seconds: 2 }), expect.objectContaining({ kind: "enemy_structure", structure: "Top Tier 1 turret" }), expect.objectContaining({ kind: "team_structure", structure: "Mid inhibitor" })]));
    expect(normalized.items.map(item => item.transaction_gold)).toEqual([300, -90, 1000, -1000]);
    expect(normalized.items[0]).toMatchObject({ item_id: 1001, item_name: "Boots", item_cost: 300, item_sell_price: 90 });
    expect(normalizeTimeline(match, timeline, 1).items[0]).toMatchObject({ item_id: 1001, transaction_gold: undefined, price_available: false });
    expect(normalized.samples.filter(sample => sample.seconds === 120).at(-1)).toMatchObject({ gold_spent: 210, unspent_gold: 1190 });
    expect(normalized.events.find(event => event.kind === "objective")).toMatchObject({ end_seconds: 150, buff_active_seconds: 30, buff_holders: expect.arrayContaining([expect.objectContaining({ name: "Me#NA1", duration_seconds: 30 }), expect.objectContaining({ name: "Ally#NA1", duration_seconds: 15 })]) });
    expect(normalized.events.find(event => event.kind === "team_structure")).toMatchObject({ structure_down_seconds: 180, end_seconds: 300 });
    expect(normalized.events.find(event => event.kind === "player_death")).toMatchObject({ death_timer_seconds: 150, cumulative_dead_seconds: 150, end_seconds: 300 });
  });

  it("maps enriched events and all three gold series for visualizations", () => {
    const payload = { timeline_samples: [{ seconds: 0, gold_earned: 500, gold_spent: 0, unspent_gold: 500 }, { seconds: 60, gold_earned: 900, gold_spent: 300, unspent_gold: 600 }], timeline_events: [{ seconds: 1, kind: "player_kill" }, { seconds: 2, kind: "team_structure" }, { seconds: 3, kind: "enemy_structure" }, { seconds: 4, kind: "objective_buff", end_seconds: 10 }] };
    expect(reportSeries(payload, "cumulative").map(series => series.key)).toEqual(expect.arrayContaining(["gold_earned", "gold_spent", "unspent_gold"]));
    expect(timelineEvents(payload).map(event => event.kind)).toEqual(["kills", "team_structures", "enemy_structures", "objectives"]);
    expect(timelineEvents(payload)[3].endSeconds).toBe(10);
  });
});
