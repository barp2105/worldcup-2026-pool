import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { pointsForMatch } from "../src/scoring.js";
import { buildOwnerIndex, computeStandings } from "../src/standings.js";
import type { Duration, MatchResult, Outcome, Owners, Rules, Stage, TeamsMap } from "../src/types.js";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const readJson = (f: string) => JSON.parse(readFileSync(path.join(DATA, f), "utf8"));

const rules: Rules = readJson("rules.json");
const owners: Owners = readJson("owners.json");

function match(
  stage: Stage,
  outcome: Outcome,
  duration: Duration = "REGULAR",
  homeCode = "ENG",
  awayCode = "CRO"
): MatchResult {
  return { id: "m1", stage, utcDate: "2026-06-14T00:00:00Z", homeCode, awayCode, outcome, duration };
}

describe("pointsForMatch — שלב הבתים", () => {
  it("ניצחון בית = 2/0", () => {
    expect(pointsForMatch(match("GROUP", "HOME"), rules)).toEqual({ home: 2, away: 0 });
  });
  it("תיקו בית = 1/1", () => {
    expect(pointsForMatch(match("GROUP", "DRAW"), rules)).toEqual({ home: 1, away: 1 });
  });
  it("ניצחון חוץ = 0/2", () => {
    expect(pointsForMatch(match("GROUP", "AWAY"), rules)).toEqual({ home: 0, away: 2 });
  });
});

describe("pointsForMatch — שמינית ורבע גמר (3)", () => {
  it("ניצחון בזמן רגיל = 3, מפסידה 0", () => {
    expect(pointsForMatch(match("R16", "HOME"), rules)).toEqual({ home: 3, away: 0 });
    expect(pointsForMatch(match("QF", "HOME"), rules)).toEqual({ home: 3, away: 0 });
  });
  it("ניצחון בהארכה = 3, מפסידה 1", () => {
    expect(pointsForMatch(match("R16", "AWAY", "EXTRA_TIME"), rules)).toEqual({ home: 1, away: 3 });
  });
  it("ניצחון בפנדלים = 3, מפסידה 1", () => {
    expect(pointsForMatch(match("QF", "HOME", "PENALTY_SHOOTOUT"), rules)).toEqual({ home: 3, away: 1 });
  });
});

describe("pointsForMatch — חצי גמר (4)", () => {
  it("ניצחון רגיל = 4/0", () => {
    expect(pointsForMatch(match("SF", "HOME"), rules)).toEqual({ home: 4, away: 0 });
  });
  it("ניצחון בהארכה/פנדלים = 4, מפסידה 1", () => {
    expect(pointsForMatch(match("SF", "HOME", "EXTRA_TIME"), rules)).toEqual({ home: 4, away: 1 });
  });
});

describe("pointsForMatch — גמר (6)", () => {
  it("ניצחון רגיל = 6/0", () => {
    expect(pointsForMatch(match("FINAL", "HOME"), rules)).toEqual({ home: 6, away: 0 });
  });
  it("ניצחון בהארכה = 6, מפסידה 2", () => {
    expect(pointsForMatch(match("FINAL", "AWAY", "EXTRA_TIME"), rules)).toEqual({ home: 2, away: 6 });
  });
});

describe("pointsForMatch — מקום שלישי (2)", () => {
  it("ניצחון = 2, מפסידה 0 גם בהארכה", () => {
    expect(pointsForMatch(match("THIRD", "HOME"), rules)).toEqual({ home: 2, away: 0 });
    expect(pointsForMatch(match("THIRD", "HOME", "PENALTY_SHOOTOUT"), rules)).toEqual({ home: 2, away: 0 });
  });
});

describe("pointsForMatch — מקרי קצה", () => {
  it("תיקו בנוקאאוט זורק שגיאה", () => {
    expect(() => pointsForMatch(match("FINAL", "DRAW"), rules)).toThrow();
  });
});

describe("buildOwnerIndex", () => {
  it("כל נבחרת שייכת לבדיוק 2 משתתפים, ויש 8 משתתפים", () => {
    const idx = buildOwnerIndex(owners);
    expect(idx.participants).toHaveLength(8);
    for (const [code, names] of idx.ownersOf) {
      expect(names, `נבחרת ${code}`).toHaveLength(2);
    }
    // 48 נבחרות ייחודיות
    expect(idx.ownersOf.size).toBe(48);
  });
});

describe("computeStandings — קרדיט כפול וספירת משחקים", () => {
  const idx = buildOwnerIndex(owners);

  it("נבחרת מזכה את שני בעליה", () => {
    // ESP מנצחת: בעלים = עומרי (קב' 1) + יניב (קב' 2)
    const matches: MatchResult[] = [match("GROUP", "HOME", "REGULAR", "ESP", "MAR")];
    const { byName } = computeStandings(matches, rules, idx);
    expect(byName.get("עומרי")!.points).toBe(2);
    expect(byName.get("יניב")!.points).toBe(2);
  });

  it("משתתף שמחזיק בשתי הנבחרות במשחק → 2 משחקים נספרים", () => {
    // בר מחזיק גם ב-ENG וגם ב-CRO (שתיהן בבית L). ENG מנצחת.
    const matches: MatchResult[] = [match("GROUP", "HOME", "REGULAR", "ENG", "CRO")];
    const { byName } = computeStandings(matches, rules, idx);
    expect(byName.get("בר")!.points).toBe(2); // 2 (ENG) + 0 (CRO)
    expect(byName.get("בר")!.matchesPlayed).toBe(2);
    // בנימין מחזיק ב-ENG בלבד מקב' 2
    expect(byName.get("בנימין")!.points).toBe(2);
    expect(byName.get("בנימין")!.matchesPlayed).toBe(1);
    // יניב מחזיק ב-CRO בלבד מקב' 2 → 0 נקודות אבל משחק 1
    expect(byName.get("יניב")!.points).toBe(0);
    expect(byName.get("יניב")!.matchesPlayed).toBe(1);
  });
});

describe("דירוג 1224 (ללא שובר שוויון)", () => {
  it("שלושה ראשונים שווים → הבא הוא מקום 4", () => {
    // owners מינימלי: 4 משתתפים, נבחרות יחידות
    const mini: Owners = {
      groups: {
        "1": { A: ["T1"], B: ["T2"], C: ["T3"], D: ["T4"] },
      },
    };
    const idx = buildOwnerIndex(mini);
    // T1,T2,T3 מנצחות (2 כל אחת), T4 מפסידה (0)
    const matches: MatchResult[] = [
      match("GROUP", "HOME", "REGULAR", "T1", "T4"),
      match("GROUP", "HOME", "REGULAR", "T2", "T4"),
      match("GROUP", "HOME", "REGULAR", "T3", "T4"),
    ];
    const { standings } = computeStandings(matches, rules, idx);
    const ranks = Object.fromEntries(standings.map((s) => [s.name, s.rank]));
    expect(ranks["A"]).toBe(1);
    expect(ranks["B"]).toBe(1);
    expect(ranks["C"]).toBe(1);
    expect(ranks["D"]).toBe(4);
  });
});
