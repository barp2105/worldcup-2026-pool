import { pointsForMatch } from "./scoring.js";
import type { MatchResult, Owners, ParticipantStanding, Rules } from "./types.js";

export interface OwnerIndex {
  /** קוד נבחרת -> שמות המשתתפים שמחזיקים בה (שניים, אחד מכל קבוצה). */
  ownersOf: Map<string, string[]>;
  /** רשימת כל המשתתפים, בסדר ההגדרה. */
  participants: string[];
}

export function buildOwnerIndex(owners: Owners): OwnerIndex {
  const ownersOf = new Map<string, string[]>();
  const participants: string[] = [];

  for (const group of Object.values(owners.groups)) {
    for (const [name, codes] of Object.entries(group)) {
      participants.push(name);
      for (const code of codes) {
        const arr = ownersOf.get(code) ?? [];
        arr.push(name);
        ownersOf.set(code, arr);
      }
    }
  }

  return { ownersOf, participants };
}

interface Tally {
  points: number;
  matchesPlayed: number;
}

export interface ComputeResult {
  standings: ParticipantStanding[];
  byName: Map<string, Tally>;
}

/**
 * מחשב standings מלא מכל המשחקים שהסתיימו (idempotent).
 * כל נבחרת מזכה את כל בעליה; כל הופעת נבחרת סופרת משחק אחד.
 */
export function computeStandings(
  matches: MatchResult[],
  rules: Rules,
  ownerIndex: OwnerIndex
): ComputeResult {
  const byName = new Map<string, Tally>();
  for (const name of ownerIndex.participants) {
    byName.set(name, { points: 0, matchesPlayed: 0 });
  }

  for (const match of matches) {
    const pts = pointsForMatch(match, rules);
    credit(match.homeCode, pts.home, byName, ownerIndex);
    credit(match.awayCode, pts.away, byName, ownerIndex);
  }

  const rows = ownerIndex.participants.map((name) => ({
    name,
    ...byName.get(name)!,
  }));
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "he"));

  return { standings: assignRanks(rows), byName };
}

function credit(
  code: string,
  teamPts: number,
  byName: Map<string, Tally>,
  ownerIndex: OwnerIndex
): void {
  const owners = ownerIndex.ownersOf.get(code);
  if (!owners) return;
  for (const name of owners) {
    const rec = byName.get(name);
    if (!rec) continue;
    rec.points += teamPts;
    rec.matchesPlayed += 1;
  }
}

/** דירוג תחרותי סטנדרטי ("1224"): נקודות שוות = מקום שווה, הבא בתור מדלג. */
function assignRanks(sorted: Array<{ name: string } & Tally>): ParticipantStanding[] {
  const out: ParticipantStanding[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;

  sorted.forEach((p, i) => {
    let rank: number;
    if (lastPoints !== null && p.points === lastPoints) {
      rank = lastRank;
    } else {
      rank = i + 1;
      lastRank = rank;
      lastPoints = p.points;
    }
    out.push({ rank, name: p.name, points: p.points, matchesPlayed: p.matchesPlayed });
  });

  return out;
}
