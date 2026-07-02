import type { Duration, MatchResult, Outcome, Stage, TeamsMap } from "./types.js";
import { buildMatcher } from "./teamMatcher.js";

const API_URL = "https://api.football-data.org/v4/competitions/WC/matches";

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  LAST_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "THIRD",
  FINAL: "FINAL",
};

interface RawTeam {
  name?: string;
  shortName?: string;
}
type RawScoreLine = { home?: number | null; away?: number | null } | undefined;
interface RawMatch {
  id: number | string;
  status: string;
  stage: string;
  utcDate: string;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  score?: {
    winner?: string | null;
    duration?: string;
    fullTime?: RawScoreLine;
    regularTime?: RawScoreLine;
    extraTime?: RawScoreLine;
    penalties?: RawScoreLine;
  };
}

/** האם שורת ניקוד קיימת עם שני מספרים (כלומר השלב הזה שוחק בפועל). */
function hasScore(line: RawScoreLine): boolean {
  return typeof line?.home === "number" && typeof line?.away === "number";
}

/** מחזיר "HOME"/"AWAY" אם שורת הניקוד מוכרעת (שני מספרים שונים), אחרת null. */
function winnerOf(line: RawScoreLine): Outcome | null {
  const h = line?.home;
  const a = line?.away;
  if (typeof h === "number" && typeof a === "number" && h !== a) {
    return h > a ? "HOME" : "AWAY";
  }
  return null;
}

/** מנרמל את ערך ה-duration הגולמי לערכי המערכת (football-data משנה וריאנטים). */
function normalizeDuration(raw: string | undefined): Duration {
  const d = (raw ?? "REGULAR").toUpperCase();
  if (d.startsWith("PENALT")) return "PENALTY_SHOOTOUT";
  if (d === "EXTRA_TIME" || d === "EXTRA" || d === "AET") return "EXTRA_TIME";
  return "REGULAR";
}

/**
 * קובע את משך המשחק בשלב נוקאאוט מתוך כל הרמזים הזמינים, ולא רק מתווית
 * ה-duration של football-data (שהוכחה כלא-אמינה). זהו הבסיס לחוק הניקוד:
 * המפסידה מקבלת נקודה רק אם המשחק נמשך מעבר ל-90' (תיקו ב-90').
 * מזהים "מעבר ל-90'" לפי: קיום פנדלים / קיום שלב הארכה / תוצאת 90' שוויונית /
 * תווית duration מתאימה.
 */
function resolveKnockoutDuration(score: RawMatch["score"], labeled: Duration): Duration {
  const s = score;
  const tiedAt90 = s?.regularTime != null && hasScore(s.regularTime) && !winnerOf(s.regularTime);

  if (labeled === "PENALTY_SHOOTOUT" || hasScore(s?.penalties)) return "PENALTY_SHOOTOUT";
  if (labeled === "EXTRA_TIME" || hasScore(s?.extraTime) || tiedAt90) return "EXTRA_TIME";
  return "REGULAR";
}

/** מושך את כל משחקי המונדיאל מ-football-data ומחזיר רק את אלה שהסתיימו. */
export async function fetchResults(token: string, teams: TeamsMap): Promise<MatchResult[]> {
  const res = await fetch(API_URL, { headers: { "X-Auth-Token": token } });
  if (!res.ok) {
    throw new Error(`football-data API error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { matches?: RawMatch[] };
  return parseMatches(data.matches ?? [], teams);
}

/** ממיר את ה-JSON הגולמי ל-MatchResult[] (מופרד למען בדיקות ללא רשת). */
export function parseMatches(raw: RawMatch[], teams: TeamsMap): MatchResult[] {
  const matchTeam = buildMatcher(teams);
  const out: MatchResult[] = [];

  for (const m of raw) {
    if (m.status !== "FINISHED") continue;

    const stage = STAGE_MAP[m.stage];
    if (!stage) throw new Error(`שלב לא מוכר מה-API: ${m.stage} (משחק ${m.id})`);

    const winner = m.score?.winner ?? "DRAW";
    let outcome: Outcome =
      winner === "HOME_TEAM" ? "HOME" : winner === "AWAY_TEAM" ? "AWAY" : "DRAW";
    let duration = normalizeDuration(m.score?.duration);

    if (stage !== "GROUP") {
      // משחק נוקאאוט לא יכול להסתיים בתיקו. כש-football-data לא ממלא winner
      // (קורה כשההכרעה בהארכה/פנדלים — fullTime נשאר שווה), גוזרים את המנצחת
      // מכל שדה ניקוד זמין, בלי תלות בערך duration (שלפעמים חסר/לא תקני).
      if (outcome === "DRAW") {
        const s = m.score;
        outcome =
          winnerOf(s?.penalties) ??
          winnerOf(s?.fullTime) ??
          winnerOf(s?.extraTime) ??
          winnerOf(s?.regularTime) ??
          "DRAW";

        if (outcome === "DRAW") {
          // לא ניתן לפענח מנצח — מדלגים על המשחק היחיד הזה במקום להפיל את כל
          // הריצה (תיקו בנוקאאוט זורק שגיאה בניקוד). רושמים את ה-score לאבחון.
          console.error(
            `⚠️ משחק נוקאאוט ${m.id} (${stage}) חזר ללא מנצח — מדלג. score גולמי: ${JSON.stringify(m.score)}`
          );
          continue;
        }
      }

      // קובעים את משך המשחק מכל הרמזים בנתונים ולא רק מתווית football-data,
      // כדי להבטיח שהמפסידה תקבל את נקודת ההארכה בכל פעם שהמשחק עבר את 90'
      // (בין אם הוכרע בהארכה ובין אם בפנדלים).
      duration = resolveKnockoutDuration(m.score, duration);
    }

    const homeName = m.homeTeam?.name ?? m.homeTeam?.shortName ?? "";
    const awayName = m.awayTeam?.name ?? m.awayTeam?.shortName ?? "";

    const ft = m.score?.fullTime;
    out.push({
      id: String(m.id),
      stage,
      utcDate: m.utcDate,
      homeCode: matchTeam(homeName),
      awayCode: matchTeam(awayName),
      outcome,
      duration,
      homeGoals: typeof ft?.home === "number" ? ft.home : null,
      awayGoals: typeof ft?.away === "number" ? ft.away : null,
    });
  }

  return out;
}
