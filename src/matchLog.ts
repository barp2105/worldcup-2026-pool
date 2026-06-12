import { pointsForMatch } from "./scoring.js";
import type { Duration, MatchResult, Outcome, Rules, Stage, TeamsMap } from "./types.js";

/**
 * רשומת משחק בלוג המלא שמוצג באתר ("פירוט הניקוד").
 * נשמרים גם הקודים (לשיוך לבעלים) וגם השמות בעברית (לתצוגה).
 */
export interface MatchLogEntry {
  id: string;
  stage: Stage;
  utcDate: string;
  homeCode: string;
  awayCode: string;
  home: string;
  away: string;
  outcome: Outcome;
  duration: Duration;
  homeGoals: number | null;
  awayGoals: number | null;
  homePoints: number;
  awayPoints: number;
}

/**
 * בונה לוג מלא של כל המשחקים שהסתיימו, כולל הנקודות שכל נבחרת קיבלה.
 * הפלט דטרמיניסטי (ממוין לפי תאריך ואז id) כדי שכתיבה חוזרת של אותם
 * נתונים לא תיצור diff — וכך לא תיווצר התחייבות (commit) מיותרת.
 */
export function buildMatchLog(
  matches: MatchResult[],
  rules: Rules,
  teams: TeamsMap
): MatchLogEntry[] {
  return [...matches]
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate) || a.id.localeCompare(b.id))
    .map((m) => {
      const pts = pointsForMatch(m, rules);
      return {
        id: m.id,
        stage: m.stage,
        utcDate: m.utcDate,
        homeCode: m.homeCode,
        awayCode: m.awayCode,
        home: teams[m.homeCode]?.he ?? m.homeCode,
        away: teams[m.awayCode]?.he ?? m.awayCode,
        outcome: m.outcome,
        duration: m.duration,
        homeGoals: m.homeGoals ?? null,
        awayGoals: m.awayGoals ?? null,
        homePoints: pts.home,
        awayPoints: pts.away,
      };
    });
}
