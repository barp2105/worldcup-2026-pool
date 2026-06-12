import type { TeamsMap } from "./types.js";

/** נורמליזציה: הסרת דיאקריטיקה, אותיות קטנות, רק a-z0-9. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type TeamMatcher = (apiName: string) => string;

/**
 * בונה פונקציה שממפה שם נבחרת שמגיע מה-API לקוד הקנוני (לפי teams.json).
 * שם לא מזוהה => זריקת שגיאה רועשת, כדי שנוסיף alias ולא נחשב לא נכון בשקט.
 */
export function buildMatcher(teams: TeamsMap): TeamMatcher {
  const lookup = new Map<string, string>();
  for (const [code, info] of Object.entries(teams)) {
    if (code.startsWith("_")) continue;
    lookup.set(normalize(code), code);
    lookup.set(normalize(info.fdName), code);
    for (const alias of info.aliases) lookup.set(normalize(alias), code);
  }

  return (apiName: string): string => {
    const code = lookup.get(normalize(apiName));
    if (!code) {
      throw new Error(
        `לא זוהתה נבחרת מה-API: "${apiName}". הוסף alias מתאים ב-data/teams.json`
      );
    }
    return code;
  };
}
