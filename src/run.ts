import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildUpdate } from "./buildUpdate.js";
import { fetchResults, parseMatches } from "./fetchResults.js";
import { buildMatchLog } from "./matchLog.js";
import { buildOwnerIndex, computeStandings } from "./standings.js";
import type { MatchResult, Owners, Rules, TeamsMap } from "./types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");

async function loadJson<T>(file: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, file), "utf8");
  return JSON.parse(raw) as T;
}

async function saveJson(file: string, value: unknown): Promise<void> {
  await writeFile(path.join(DATA_DIR, file), JSON.stringify(value, null, 2) + "\n", "utf8");
}

function loadTeams(raw: Record<string, unknown>): TeamsMap {
  const teams: TeamsMap = {};
  for (const [code, info] of Object.entries(raw)) {
    if (code.startsWith("_")) continue;
    teams[code] = info as TeamsMap[string];
  }
  return teams;
}

/** משיכת תוצאות: API אם יש טוקן, אחרת fallback לקובץ ידני אם קיים. */
async function getMatches(teams: TeamsMap): Promise<MatchResult[] | null> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (token) {
    console.log("משיכת תוצאות מ-football-data.org ...");
    return fetchResults(token, teams);
  }

  console.warn("⚠️  אין FOOTBALL_DATA_TOKEN — מנסה fallback ל-data/results.manual.json");
  try {
    const raw = await loadJson<{ matches: unknown[] }>("results.manual.json");
    return parseMatches(raw.matches as never[], teams);
  } catch {
    // לא מוגדר עדיין (אין secret ואין קובץ ידני) — מצב הקמה תקין, לא כשל.
    console.warn(
      "ℹ️  לא הוגדר FOOTBALL_DATA_TOKEN ואין data/results.manual.json — מדלג על העדכון. " +
        "הוסף את ה-secret כדי להתחיל למשוך תוצאות."
    );
    return null;
  }
}

async function main(): Promise<void> {
  const teams = loadTeams(await loadJson<Record<string, unknown>>("teams.json"));
  const owners = await loadJson<Owners>("owners.json");
  const rules = await loadJson<Rules>("rules.json");
  const processed = await loadJson<{ matchIds: string[] }>("processed.json");

  const processedSet = new Set(processed.matchIds);
  const allMatches = await getMatches(teams);
  if (allMatches === null) return; // לא מוגדר עדיין — יציאה נקייה.
  const finished = allMatches.length;
  const newMatches = allMatches.filter((m) => !processedSet.has(m.id));

  console.log(`משחקים שהסתיימו: ${finished}, חדשים בריצה זו: ${newMatches.length}`);

  // לוג המשחקים המלא נכתב בכל ריצה: הפלט דטרמיניסטי, כך שכשאין שינוי אמיתי
  // (אותם משחקים, אותן תוצאות) אין diff וה-Action לא יוצר commit.
  await saveJson("matchLog.json", { matches: buildMatchLog(allMatches, rules, teams) });

  // standings מחושב תמיד מהנתונים הנוכחיים — כך תיקוני API (שינוי תוצאה) יתגלגלו
  // גם בריצות שבהן אין משחקים חדשים, ולא רק כשיש newMatches.
  const ownerIndex = buildOwnerIndex(owners);
  const { standings } = computeStandings(allMatches, rules, ownerIndex);

  if (newMatches.length === 0) {
    // שומרים standings רק אם הנתונים השתנו (מונע commit מיותר בגלל timestamp).
    const stored = await loadJson<{ standings: unknown }>("standings.json");
    if (JSON.stringify(standings) !== JSON.stringify(stored.standings)) {
      await saveJson("standings.json", { updatedAt: new Date().toISOString(), standings });
      console.log("תיקון API זוהה — standings עודכן.");
    } else {
      console.log("אין משחקים חדשים — עודכן רק matchLog (אם השתנה).");
    }
    return;
  }

  const now = new Date();
  const lastUpdate = buildUpdate(newMatches, rules, ownerIndex, teams, now);

  const history = await loadJson<{ snapshots: unknown[] }>("history.json");
  history.snapshots.push({ updatedAt: now.toISOString(), standings });

  await saveJson("standings.json", { updatedAt: now.toISOString(), standings });
  await saveJson("lastUpdate.json", lastUpdate);
  await saveJson("history.json", history);
  await saveJson("processed.json", {
    matchIds: [...processedSet, ...newMatches.map((m) => m.id)],
  });

  console.log("✅ עודכן: " + lastUpdate.text);
}

main().catch((err) => {
  console.error("❌ שגיאה בריצה:", err);
  process.exit(1);
});
