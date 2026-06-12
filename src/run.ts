import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildUpdate } from "./buildUpdate.js";
import { fetchResults, parseMatches } from "./fetchResults.js";
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
async function getMatches(teams: TeamsMap): Promise<MatchResult[]> {
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
    throw new Error(
      "אין FOOTBALL_DATA_TOKEN וגם אין data/results.manual.json. הגדר את ה-secret או צור קובץ ידני."
    );
  }
}

async function main(): Promise<void> {
  const teams = loadTeams(await loadJson<Record<string, unknown>>("teams.json"));
  const owners = await loadJson<Owners>("owners.json");
  const rules = await loadJson<Rules>("rules.json");
  const processed = await loadJson<{ matchIds: string[] }>("processed.json");

  const processedSet = new Set(processed.matchIds);
  const allMatches = await getMatches(teams);
  const finished = allMatches.length;
  const newMatches = allMatches.filter((m) => !processedSet.has(m.id));

  console.log(`משחקים שהסתיימו: ${finished}, חדשים בריצה זו: ${newMatches.length}`);

  if (newMatches.length === 0) {
    console.log("אין משחקים חדשים — לא כותב כלום.");
    return;
  }

  const ownerIndex = buildOwnerIndex(owners);
  const now = new Date();

  // standings מלא מחושב מחדש מכל המשחקים שהסתיימו (idempotent).
  const { standings } = computeStandings(allMatches, rules, ownerIndex);
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
