import { describe, expect, it } from "vitest";
import { inputRollingOverlays, normalizedPoints, reportSeriesGroups, trailingRollingAverage } from "@/features/reports/visualizations/data";

const pointValues = (payload: object, group: "input" | "economy" | "combat", key: string, mode: "cumulative" | "rate" | "acceleration") => reportSeriesGroups(payload, mode).find(item => item.key === group)!.series.find(item => item.key === key)!;

describe("report visualization data", () => {
  const payload = {
    timeline_samples: [
      { seconds: 0, gold_earned: 500, gold_spent: 0, unspent_gold: 500, experience: 0, cs: 0, damage_to_enemy_champions: 0, damage_to_objectives: 0 },
      { seconds: 30, gold_earned: 800, gold_spent: 200, unspent_gold: 600, experience: 300, cs: 3, damage_to_enemy_champions: 100, damage_to_objectives: 50 },
      { seconds: 90, gold_earned: 1_400, gold_spent: 500, unspent_gold: 900, experience: 900, cs: 15, damage_to_enemy_champions: 400, damage_to_objectives: 200 },
    ],
    input_samples: [{ seconds: 0, actions: 0, mouse_distance_pixels: 0 }, { seconds: 20, actions: 10, mouse_distance_pixels: 100 }, { seconds: 70, actions: 20, mouse_distance_pixels: 200 }],
  };

  it("separates Input, Economy, and Combat into their own series groups", () => {
    const groups = reportSeriesGroups(payload, "cumulative");
    expect(groups.map(group => group.key)).toEqual(["input", "economy", "combat"]);
    expect(groups[0].series.map(series => series.key)).toEqual(["actions", "distance"]);
    expect(groups[1].series.map(series => series.key)).toEqual(["gold_earned", "gold_spent", "unspent_gold", "experience", "cs"]);
    expect(groups[2].series.map(series => series.key)).toEqual(["damage_to_enemy_champions", "damage_to_objectives"]);
  });

  it("calculates CS cumulative, velocity, and acceleration from sample intervals", () => {
    expect(pointValues(payload, "economy", "cs", "cumulative").points).toEqual([{ x: 0, y: 0 }, { x: 30, y: 3 }, { x: 90, y: 15 }]);
    expect(pointValues(payload, "economy", "cs", "rate")).toMatchObject({ unit: " CS/min", points: [{ x: 30, y: 6 }, { x: 90, y: 12 }] });
    expect(pointValues(payload, "economy", "cs", "acceleration")).toMatchObject({ unit: " CS/min²", points: [{ x: 90, y: 6 }] });
  });

  it("uses per-minute units for Economy and Combat velocity and acceleration", () => {
    expect(pointValues(payload, "economy", "gold_earned", "rate")).toMatchObject({ unit: " gold/min", points: [{ x: 30, y: 600 }, { x: 90, y: 600 }] });
    expect(pointValues(payload, "economy", "experience", "acceleration")).toMatchObject({ unit: " XP/min²", points: [{ x: 90, y: 0 }] });
    expect(pointValues(payload, "combat", "damage_to_enemy_champions", "rate")).toMatchObject({ unit: " damage/min", points: [{ x: 30, y: 200 }, { x: 90, y: 300 }] });
    expect(pointValues(payload, "combat", "damage_to_objectives", "acceleration")).toMatchObject({ unit: " damage/min²", points: [{ x: 90, y: 50 }] });
  });

  it("uses total earned gold as the shared scale for cumulative gold statistics", () => {
    const goldEarned = pointValues(payload, "economy", "gold_earned", "cumulative");
    const unspent = pointValues({ timeline_samples: [{ seconds: 0, gold_earned: 500, unspent_gold: 500 }, { seconds: 30, gold_earned: 800, unspent_gold: 700 }, { seconds: 60, gold_earned: 1_000, unspent_gold: 200 }] }, "economy", "unspent_gold", "cumulative");
    expect(goldEarned.normalization).toEqual({ minimum: 0, maximum: 1_400 });
    expect(unspent.normalization).toEqual({ minimum: 0, maximum: 1_000 });
    expect(normalizedPoints(unspent).map(point => point.normalized)).toEqual([50, 70, 20]);
  });

  it("creates 60-second trailing input overlays only outside cumulative mode", () => {
    const actions = pointValues(payload, "input", "actions", "rate");
    expect(actions).toMatchObject({ unit: " APM", points: [{ x: 20, y: 30 }, { x: 70, y: 24 }] });
    expect(trailingRollingAverage(actions).points).toEqual([{ x: 20, y: 30 }, { x: 70, y: 27 }]);
    expect(inputRollingOverlays([actions], "rate")).toHaveLength(1);
    expect(inputRollingOverlays([pointValues(payload, "input", "actions", "cumulative")], "cumulative")).toEqual([]);
  });

  it("omits unavailable legacy series without removing the panel definitions", () => {
    const groups = reportSeriesGroups({ samples: [{ seconds: 0, gold: 500 }, { seconds: 60, gold: 900 }] }, "cumulative");
    expect(groups.map(group => group.key)).toEqual(["input", "economy", "combat"]);
    expect(groups[1].series.map(series => series.key)).toEqual(["gold_earned"]);
    expect(groups[0].series).toEqual([]);
    expect(groups[2].series).toEqual([]);
  });
});
