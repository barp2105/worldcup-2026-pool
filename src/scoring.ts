import type { KoRule, MatchResult, Rules } from "./types.js";

export interface MatchPoints {
  home: number;
  away: number;
}

/**
 * מחשב את הנקודות שכל נבחרת מקבלת ממשחק יחיד, לפי טבלת הניקוד.
 * פונקציה טהורה ודטרמיניסטית — כל הלוגיקה נגזרת מ-rules, אין ערכים מקודדים.
 */
export function pointsForMatch(match: MatchResult, rules: Rules): MatchPoints {
  if (match.stage === "GROUP") {
    const r = rules.GROUP;
    if (match.outcome === "DRAW") return { home: r.draw, away: r.draw };
    if (match.outcome === "HOME") return { home: r.win, away: r.loss };
    return { home: r.loss, away: r.win };
  }

  // שלב נוקאאוט — חייב מנצח.
  if (match.outcome === "DRAW") {
    throw new Error(`משחק נוקאאוט ${match.id} (${match.stage}) חזר עם תיקו — לא ייתכן`);
  }

  const r: KoRule = rules[match.stage];
  const decidedInExtra =
    match.duration === "EXTRA_TIME" || match.duration === "PENALTY_SHOOTOUT";
  const loserPts = decidedInExtra ? r.lossExtra : r.lossRegular;

  if (match.outcome === "HOME") return { home: r.win, away: loserPts };
  return { home: loserPts, away: r.win };
}
