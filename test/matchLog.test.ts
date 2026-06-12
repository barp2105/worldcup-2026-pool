import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildMatchLog } from "../src/matchLog.js";
import type { MatchResult, Rules, TeamsMap } from "../src/types.js";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(DATA, f), "utf8"));

const rules: Rules = readJson("rules.json");
const teamsRaw = readJson("teams.json") as Record<string, unknown>;
const teams: TeamsMap = Object.fromEntries(
  Object.entries(teamsRaw).filter(([k]) => !k.startsWith("_"))
) as TeamsMap;

describe("buildMatchLog", () => {
  const matches: MatchResult[] = [
    {
      id: "2",
      stage: "GROUP",
      utcDate: "2026-06-12T01:00:00Z",
      homeCode: "KOR",
      awayCode: "CZE",
      outcome: "HOME",
      duration: "REGULAR",
      homeGoals: 1,
      awayGoals: 0,
    },
    {
      id: "1",
      stage: "GROUP",
      utcDate: "2026-06-11T19:00:00Z",
      homeCode: "MEX",
      awayCode: "RSA",
      outcome: "DRAW",
      duration: "REGULAR",
    },
  ];

  it("ממוין לפי תאריך, כולל שמות בעברית, ניקוד ושערים", () => {
    const log = buildMatchLog(matches, rules, teams);
    expect(log.map((e) => e.id)).toEqual(["1", "2"]);

    const draw = log[0]!;
    expect(draw.home).toBe("מקסיקו");
    expect(draw.away).toBe("דרום אפריקה");
    expect(draw.homePoints).toBe(1);
    expect(draw.awayPoints).toBe(1);
    expect(draw.homeGoals).toBeNull(); // לא סופק — נשמר null

    const win = log[1]!;
    expect(win.home).toBe("דרום קוריאה");
    expect(win.homePoints).toBe(2);
    expect(win.awayPoints).toBe(0);
    expect(win.homeGoals).toBe(1);
    expect(win.awayGoals).toBe(0);
  });

  it("פלט דטרמיניסטי — שתי קריאות מחזירות JSON זהה", () => {
    const a = JSON.stringify(buildMatchLog(matches, rules, teams));
    const b = JSON.stringify(buildMatchLog([...matches].reverse(), rules, teams));
    expect(a).toBe(b);
  });
});
