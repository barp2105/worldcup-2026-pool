import { pointsForMatch } from "./scoring.js";
import type { OwnerIndex } from "./standings.js";
import type { MatchResult, Rules, Stage, TeamsMap } from "./types.js";

export interface UpdateMatch {
  id: string;
  stage: Stage;
  home: string;
  away: string;
  homeOwners: string[];
  awayOwners: string[];
  homePoints: number;
  awayPoints: number;
}

export interface Delta {
  name: string;
  points: number;
}

export interface LastUpdate {
  updatedAt: string;
  matches: UpdateMatch[];
  deltas: Delta[];
  text: string;
}

/** בונה את תיאור העדכון האחרון מתוך המשחקים החדשים שעובדו בריצה זו. */
export function buildUpdate(
  newMatches: MatchResult[],
  rules: Rules,
  ownerIndex: OwnerIndex,
  teams: TeamsMap,
  now: Date = new Date()
): LastUpdate {
  const deltaPoints = new Map<string, number>();
  const detail = new Map<string, string[]>();
  const matchesOut: UpdateMatch[] = [];

  for (const m of newMatches) {
    const pts = pointsForMatch(m, rules);
    const homeOwners = ownerIndex.ownersOf.get(m.homeCode) ?? [];
    const awayOwners = ownerIndex.ownersOf.get(m.awayCode) ?? [];
    const homeHe = teams[m.homeCode]?.he ?? m.homeCode;
    const awayHe = teams[m.awayCode]?.he ?? m.awayCode;

    accrue(homeOwners, pts.home, homeHe, verb(m, "home"), deltaPoints, detail);
    accrue(awayOwners, pts.away, awayHe, verb(m, "away"), deltaPoints, detail);

    matchesOut.push({
      id: m.id,
      stage: m.stage,
      home: homeHe,
      away: awayHe,
      homeOwners,
      awayOwners,
      homePoints: pts.home,
      awayPoints: pts.away,
    });
  }

  const deltas = [...deltaPoints.entries()]
    .map(([name, points]) => ({ name, points }))
    .filter((d) => d.points > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "he"));

  return { updatedAt: now.toISOString(), matches: matchesOut, deltas, text: buildText(deltas, detail) };
}

function accrue(
  owners: string[],
  teamPts: number,
  teamHe: string,
  verbStr: string,
  deltaPoints: Map<string, number>,
  detail: Map<string, string[]>
): void {
  for (const name of owners) {
    deltaPoints.set(name, (deltaPoints.get(name) ?? 0) + teamPts);
    if (teamPts > 0) {
      const arr = detail.get(name) ?? [];
      arr.push(`${teamHe} ${verbStr} +${teamPts}`);
      detail.set(name, arr);
    }
  }
}

function verb(m: MatchResult, side: "home" | "away"): string {
  if (m.outcome === "DRAW") return "תיקו";
  const isWinner =
    (m.outcome === "HOME" && side === "home") || (m.outcome === "AWAY" && side === "away");
  if (isWinner) return "ניצחה";
  return "הפסידה בהארכה";
}

function buildText(deltas: Delta[], detail: Map<string, string[]>): string {
  if (deltas.length === 0) return "בעדכון האחרון אף משתתף לא הוסיף נקודות.";
  const parts = deltas.map((d) => {
    const det = detail.get(d.name) ?? [];
    return det.length ? `${d.name} +${d.points} (${det.join(", ")})` : `${d.name} +${d.points}`;
  });
  return "בעדכון האחרון: " + parts.join(" · ");
}
