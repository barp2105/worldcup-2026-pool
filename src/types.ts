// טיפוסים משותפים לכל המערכת.

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
export type Duration = "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
export type Outcome = "HOME" | "AWAY" | "DRAW";

/** תוצאת משחק יחיד, מנותקת מהספק (שמות נבחרות כקודים קנוניים). */
export interface MatchResult {
  id: string;
  stage: Stage;
  utcDate: string;
  homeCode: string;
  awayCode: string;
  outcome: Outcome;
  duration: Duration;
  /** שערים (אם הספק מספק אותם; null כשלא ידוע, למשל ב-fallback ידני). */
  homeGoals?: number | null;
  awayGoals?: number | null;
}

export interface GroupRule {
  win: number;
  draw: number;
  loss: number;
}

export interface KoRule {
  win: number;
  lossRegular: number;
  lossExtra: number;
}

export interface Rules {
  GROUP: GroupRule;
  R32: KoRule;
  R16: KoRule;
  QF: KoRule;
  SF: KoRule;
  FINAL: KoRule;
  THIRD: KoRule;
}

export interface TeamInfo {
  he: string;
  fdName: string;
  aliases: string[];
  group: string;
}

export type TeamsMap = Record<string, TeamInfo>;

export interface Owners {
  groups: Record<string, Record<string, string[]>>;
}

export interface ParticipantStanding {
  rank: number;
  name: string;
  points: number;
  matchesPlayed: number;
}
