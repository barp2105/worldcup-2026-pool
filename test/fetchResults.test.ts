import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseMatches } from "../src/fetchResults.js";
import { pointsForMatch } from "../src/scoring.js";
import type { Rules, TeamsMap } from "../src/types.js";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(DATA, f), "utf8"));

const rules: Rules = readJson("rules.json");
const teamsRaw = readJson("teams.json") as Record<string, unknown>;
const teams: TeamsMap = Object.fromEntries(
  Object.entries(teamsRaw).filter(([k]) => !k.startsWith("_"))
) as TeamsMap;

/** משחק R32 שהוכרע בפנדלים, כפי ש-football-data מחזיר: winner=DRAW + score.penalties. */
function penaltyMatch(penalties: { home: number; away: number }) {
  return {
    id: "999",
    status: "FINISHED",
    stage: "LAST_32",
    utcDate: "2026-07-01T19:00:00Z",
    homeTeam: { name: "Argentina" },
    awayTeam: { name: "Austria" },
    score: {
      winner: "DRAW",
      duration: "PENALTY_SHOOTOUT",
      fullTime: { home: 1, away: 1 },
      penalties,
    },
  };
}

describe("parseMatches — הכרעה בפנדלים", () => {
  it("winner=DRAW + פנדלים לבית → outcome=HOME ושומר את תוצאת ה-120' כשערים", () => {
    const [m] = parseMatches([penaltyMatch({ home: 4, away: 3 })], teams);
    expect(m!.outcome).toBe("HOME");
    expect(m!.duration).toBe("PENALTY_SHOOTOUT");
    expect(m!.homeGoals).toBe(1);
    expect(m!.awayGoals).toBe(1);
  });

  it("פנדלים לחוץ → outcome=AWAY", () => {
    const [m] = parseMatches([penaltyMatch({ home: 2, away: 4 })], teams);
    expect(m!.outcome).toBe("AWAY");
  });

  it("מנצחת בפנדלים מקבלת 2, מפסידה (הגיעה להארכה) מקבלת 1 בשלב 32", () => {
    const [m] = parseMatches([penaltyMatch({ home: 5, away: 4 })], teams);
    expect(pointsForMatch(m!, rules)).toEqual({ home: 2, away: 1 });
  });

  it("ניצחון בזמן רגיל ממופה כרגיל (לא משתנה)", () => {
    const raw = {
      id: "1",
      status: "FINISHED",
      stage: "GROUP_STAGE",
      utcDate: "2026-06-12T16:00:00Z",
      homeTeam: { name: "Argentina" },
      awayTeam: { name: "Austria" },
      score: { winner: "HOME_TEAM", duration: "REGULAR", fullTime: { home: 2, away: 0 } },
    };
    const [m] = parseMatches([raw], teams);
    expect(m!.outcome).toBe("HOME");
    expect(m!.duration).toBe("REGULAR");
  });
});
