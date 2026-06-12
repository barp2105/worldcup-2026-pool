import type { Duration, MatchResult, Outcome, Stage, TeamsMap } from "./types.js";
import { buildMatcher } from "./teamMatcher.js";

const API_URL = "https://api.football-data.org/v4/competitions/WC/matches";

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "GROUP",
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
interface RawMatch {
  id: number | string;
  status: string;
  stage: string;
  utcDate: string;
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  score?: { winner?: string | null; duration?: string };
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
    const outcome: Outcome =
      winner === "HOME_TEAM" ? "HOME" : winner === "AWAY_TEAM" ? "AWAY" : "DRAW";
    const duration = (m.score?.duration ?? "REGULAR") as Duration;

    const homeName = m.homeTeam?.name ?? m.homeTeam?.shortName ?? "";
    const awayName = m.awayTeam?.name ?? m.awayTeam?.shortName ?? "";

    out.push({
      id: String(m.id),
      stage,
      utcDate: m.utcDate,
      homeCode: matchTeam(homeName),
      awayCode: matchTeam(awayName),
      outcome,
      duration,
    });
  }

  return out;
}
