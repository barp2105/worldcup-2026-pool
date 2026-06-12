# אפיון: מערכת ניקוד למונדיאל 2026 — דראפט נבחרות בין חברים

> תאריך: 2026-06-12 · מצב: מאושר לבנייה
> מטרה: מערכת **חינמית לגמרי** (בלי שרת בתשלום) שמושכת תוצאות משחקי מונדיאל 2026, מחשבת ניקוד למשתתפים לפי התקנון, ומציגה טבלה מתעדכנת בדף ווב עם אפשרות לשתף כתמונה לוואטסאפ.

---

## 1. מודל המשחק (מהתקנון)

8 משתתפים ב**שתי קבוצות עצמאיות של 4**. בכל קבוצה נערך דראפט ("נחש") ובסופו כל משתתף מחזיק ב‑**12 נבחרות**. שתי הקבוצות בוחרות **מאותו מאגר של 48 נבחרות** באופן בלתי תלוי — לכן **כל נבחרת שייכת ל‑2 משתתפים** (אחד מכל קבוצה).

- קבוצה 1: **בר, עומרי, אריאל, עומר**
- קבוצה 2: **בנימין, פרטוש, יניב, ניב**

הניקוד של משתתף = סכום הנקודות שצברו **12 הנבחרות שלו** לאורך הטורניר. כשנבחרת מנצחת/מתקדמת — **שני** הבעלים שלה מקבלים את הנקודות.

זה אינו משחק ניחוש תוצאות. אין ניחושי סקור.

---

## 2. חוקי הניקוד (מקור: התקנון)

| שלב | ניצחון | תיקו | מפסידה (הוכרע ב‑90/120') | מפסידה (הארכה/פנדלים) |
|------|:---:|:---:|:---:|:---:|
| שלב הבתים | 2 | 1 | 0 | — (אין נוקאאוט) |
| שלב 32 | 2 | — | 0 | 1 |
| שמינית גמר | 3 | — | 0 | 1 |
| רבע גמר | 3 | — | 0 | 1 |
| חצי גמר | 4 | — | 0 | 1 |
| גמר | 6 | — | 0 | 2 |
| משחק מקום 3 | 2 (למנצחת) | — | 0 | 0 |

הבהרות:
- בשלב הבתים בלבד יש תיקו (נקודה לכל צד).
- בנוקאאוט: אם המשחק הוכרע בזמן רגיל — המפסידה מקבלת **0**. אם הוכרע **בהארכה או בפנדלים** — המפסידה מקבלת ניקוד ניחומים (1 בשמינית/רבע/חצי, 2 בגמר). המנצחת תמיד מקבלת את ניקוד הניצחון המלא של השלב.
- משחק על המקום השלישי: 2 נקודות למנצחת בלבד, ללא ניקוד למפסידה גם בהארכה.

**כל הערכים האלה יושבים ב‑`data/rules.json` ונקראים משם — אין ערכי ניקוד מקודדים בקוד.**

---

## 3. ארכיטקטורה

```
GitHub Actions (cron כל ~3 שעות, 12.6–19.7.2026 + workflow_dispatch)
        │
        ▼
  fetchResults  ──►  football-data.org v4 (חינם, X-Auth-Token)
        │                GET /v4/competitions/WC/matches
        ▼
  scoring engine  ◄── data/owners.json   (בעלות: משתתף → 12 נבחרות)
        │           ◄── data/teams.json    (מיפוי שם עברי ↔ שם/קוד API)
        │           ◄── data/rules.json    (טבלת הניקוד)
        ▼
  כתיבה: standings.json + lastUpdate.json + history.json + processed.json
        │
        ▼  git commit & push
  GitHub Pages / Vercel  ──►  web/ קורא JSON  ──►  כפתור "שתף כתמונה" → וואטסאפ
```

עקרונות: בלי שרת רץ 24/7, בלי טלגרם, בלי Puppeteer. יצירת התמונה לוואטסאפ נעשית **בצד הלקוח** (html2canvas) ושיתוף דרך Web Share API של הנייד (fallback: הורדת PNG).

---

## 4. מבנה ה‑repo

```
/
├── data/
│   ├── owners.json        # בעלות: שתי קבוצות, משתתף → 12 נבחרות (קלט קבוע)
│   ├── teams.json         # מיפוי לכל נבחרת: he / fdName / fifaCode / group (קלט קבוע)
│   ├── rules.json         # טבלת הניקוד (קלט קבוע)
│   ├── standings.json     # פלט מחושב
│   ├── lastUpdate.json    # פלט: העדכון האחרון (משחקים + דלתא נקודות)
│   ├── history.json       # פלט: צילום מצב אחרי כל עדכון
│   └── processed.json     # state: מזהי משחקים שכבר נספרו
├── src/
│   ├── types.ts           # טיפוסים משותפים
│   ├── fetchResults.ts    # משיכה מ-football-data (מאחורי interface)
│   ├── teamMatcher.ts     # התאמת שם API → נבחרת קנונית (לפי teams.json)
│   ├── scoring.ts         # מנוע ניקוד טהור (פונקציה דטרמיניסטית)
│   ├── standings.ts       # צבירה לכלל המשתתפים + דירוג + ספירת משחקים
│   ├── buildUpdate.ts     # בניית lastUpdate.json (דלתא + טקסט)
│   └── run.ts             # אורקסטרציה: fetch→score→write
├── web/
│   ├── index.html         # דף RTL סטטי
│   ├── style.css
│   └── app.js             # קריאת JSON, רינדור טבלה, כפתור שיתוף
├── test/
│   └── scoring.test.ts    # בדיקות יחידה לכל חוקי הניקוד
├── .github/workflows/
│   └── update.yml
├── package.json / tsconfig.json
└── README.md
```

---

## 5. מקור הנתונים — football-data.org (חינם)

- Endpoint: `GET https://api.football-data.org/v4/competitions/WC/matches`
- Header: `X-Auth-Token: <FOOTBALL_DATA_TOKEN>` (GitHub Secret).
- ה‑tier החינמי מכסה את מונדיאל 2026 (קוד `WC`/2000), 10 קריאות/דקה, תוצאות מעט מושהות — מספיק לריצת cron.
- שדות רלוונטיים מכל match: `id`, `stage`, `status`, `homeTeam`, `awayTeam`, `score.winner`, `score.duration`, `score.fullTime`.
  - `stage` ∈ { `GROUP_STAGE`, `LAST_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `THIRD_PLACE`, `FINAL` }.
  - `score.duration` ∈ { `REGULAR`, `EXTRA_TIME`, `PENALTY_SHOOTOUT` }.
  - `score.winner` ∈ { `HOME_TEAM`, `AWAY_TEAM`, `DRAW` }.
- מסננים `status === "FINISHED"` בלבד לחישוב.

interface פנימי (מנתק את שאר הקוד מהספק):

```ts
type Stage = "GROUP" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";
type Duration = "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
type Outcome = "HOME" | "AWAY" | "DRAW";

interface MatchResult {
  id: string;
  stage: Stage;
  utcDate: string;
  homeTeam: string;   // שם קנוני (אחרי teamMatcher)
  awayTeam: string;
  outcome: Outcome;
  duration: Duration;
}
```

**fallback ידני:** אם ה‑API נופל, `run.ts` יכול לקרוא `data/results.manual.json` באותו מבנה — רשת ביטחון לחודש שבו יש כסף על הפרק. אופציונלי.

---

## 6. קבצי קלט

### 6.1 `owners.json`
```json
{
  "groups": {
    "1": { "בר": ["ARG","ENG", "..."], "עומרי": ["..."], "אריאל": ["..."], "עומר": ["..."] },
    "2": { "בנימין": ["..."], "פרטוש": ["..."], "יניב": ["..."], "ניב": ["..."] }
  }
}
```
מפתחות הנבחרות = קודי FIFA קנוניים (3 אותיות) המוגדרים ב‑`teams.json`.

### 6.2 `teams.json`
מיפוי לכל אחת מ‑48 הנבחרות:
```json
{
  "ARG": { "he": "ארגנטינה", "fdName": "Argentina", "aliases": [], "group": "J" }
}
```
- `he` — שם לתצוגה (עברית).
- `fdName` + `aliases` — שמות אפשריים שמגיעים מ‑football-data, לצורך התאמה.
- `group` — בית במונדיאל (מהדף ששלח המשתמש; לתצוגה/אימות בלבד — מקור האמת לתוצאות הוא ה‑API).
- נבחרות שדורשות תשומת לב במיפוי: קונגו (**ברירת מחדל: DR Congo**), כף ורדה (Cape Verde), קוראסאו (Curaçao), חוף השנהב (Côte d'Ivoire), דרום קוריאה (South Korea), ארה״ב (United States/USA).

### 6.3 `rules.json`
```json
{
  "GROUP": { "win": 2, "draw": 1, "loss": 0 },
  "R16":   { "win": 3, "lossRegular": 0, "lossExtra": 1 },
  "QF":    { "win": 3, "lossRegular": 0, "lossExtra": 1 },
  "SF":    { "win": 4, "lossRegular": 0, "lossExtra": 1 },
  "FINAL": { "win": 6, "lossRegular": 0, "lossExtra": 2 },
  "THIRD": { "win": 2, "lossRegular": 0, "lossExtra": 0 }
}
```

---

## 7. מנוע הניקוד וההתאמה

- `teamMatcher.ts` — מקבל שם נבחרת מה‑API ומחזיר קוד קנוני לפי `teams.json` (`fdName`/`aliases`, נורמליזציה של רישיות/דיאקריטיקה). **שם לא מזוהה → זריקת שגיאה רועשת** (לא שתיקה), כדי שנתקן את המיפוי.
- `scoring.ts` — פונקציה טהורה: `pointsForMatch(match, rules) → { home: number, away: number }`. דטרמיניסטית, ללא תופעות לוואי, מכוסה בבדיקות.
- `standings.ts` — לכל משחק שהסתיים: נקודות לנבחרת → זיכוי שני בעליה. צובר:
  - `points` לכל משתתף.
  - `matchesPlayed` לכל משתתף = **סכום הופעות הנבחרות שלו** (משחק בין שתי נבחרות של אותו משתתף נספר כ‑2).
  - `rank` — דירוג תחרותי סטנדרטי ("1224"): נקודות שוות → מקום שווה; הבא בתור מדלג (3 ראשונים → הרביעי הוא מקום 4).

---

## 8. פלט: standings.json

```json
{
  "updatedAt": "2026-06-14T20:05:00Z",
  "standings": [
    { "rank": 1, "name": "בר", "points": 14, "matchesPlayed": 9 }
  ]
}
```

## 9. פלט: lastUpdate.json

מתאר רק את המשחקים ש**עובדו בריצה האחרונה** (חדשים שהסתיימו):
```json
{
  "updatedAt": "2026-06-14T20:05:00Z",
  "matches": [
    { "id": "...", "stage": "GROUP", "home": "אנגליה", "away": "קרואטיה",
      "homeOwners": ["בר","בנימין"], "awayOwners": ["בר","יניב"],
      "homePoints": 2, "awayPoints": 0 }
  ],
  "deltas": [ { "name": "בר", "points": 2 }, { "name": "יניב", "points": 0 } ],
  "text": "בעדכון האחרון: בר +5 (אנגליה ניצחה +2, מקסיקו תיקו +1, צ'כיה ניצחה +2)..."
}
```
טקסט העדכון = סכום פר‑משתתף **+ פירוט נבחרות**.

---

## 10. דף הווב

- סטטי, RTL, מותאם לנייד. קורא `data/standings.json` ו‑`data/lastUpdate.json`.
- טבלה: **דירוג | משתתף | נקודות | משחקים**. הדגשת 3 ראשונים (זהב/כסף/ארד) והבלטת המקום האחרון (פרס 100 ₪ בתקנון).
- מתחת לטבלה: טקסט העדכון האחרון.
- כפתור **"שתף כתמונה"**: `html2canvas` מרנדר את כרטיס הטבלה ל‑PNG, ואז `navigator.share({ files: [...] })` לשיתוף ישיר לוואטסאפ בנייד; אם לא נתמך — הורדת PNG.
- אופציונלי (nice‑to‑have): גרף נקודות לאורך זמן מ‑`history.json` (Chart.js מ‑CDN).

---

## 11. GitHub Actions (`update.yml`)

- `on`: `schedule` (cron כל ~3 שעות) + `workflow_dispatch`.
- צעדים: checkout → setup‑node → `npm ci` → `npm run update` → אם השתנו קבצי data → commit & push (עם `permissions: contents: write`).
- לוגיקה ב‑`run.ts`:
  1. משיכת תוצאות.
  2. סינון משחקים `FINISHED` שעדיין לא ב‑`processed.json`.
  3. אם אין חדשים → יציאה בלי לכתוב.
  4. אם יש → חישוב מחדש של standings מלא, כתיבת `lastUpdate` רק לדלתא, עדכון `history` ו‑`processed`, commit.
- Secret: `FOOTBALL_DATA_TOKEN`.

הערה: החישוב הוא **idempotent** — standings נגזר תמיד מכלל המשחקים שהסתיימו; `processed.json` משמש רק לקביעת מה ה"דלתא" של העדכון האחרון, כדי שלא נדווח פעמיים על אותו משחק.

---

## 12. פריסה ואחסון

- `web/` נפרס ל‑**Vercel** (סטטי, חינם). ה‑data JSON נמשך מאותו repo (raw GitHub) או מועתק ל‑build.
- כל ריצת Action שמעדכנת JSON → הדף מציג נתונים טריים.

---

## 13. Definition of Done

- [ ] ריצה (ידנית/cron) מושכת תוצאות, מחשבת ניקוד לפי `rules.json`, וכותבת standings.
- [ ] הניקוד **כולו** נגזר מ‑`rules.json` (אפס ערכים מקודדים), כולל חוקי הארכה/פנדלים.
- [ ] כל נבחרת מזכה את **שני** בעליה.
- [ ] משחק שכבר נספר לא מדווח שוב ב‑lastUpdate.
- [ ] דף הווב מציג: דירוג, משתתף, נקודות, משחקים + טקסט עדכון אחרון.
- [ ] כפתור "שתף כתמונה" מפיק PNG וניתן לשיתוף לוואטסאפ בנייד.
- [ ] בדיקות יחידה עוברות לכל שורות טבלת הניקוד (כולל הארכה/פנדלים, תיקו, מקום 3).
- [ ] אפס רכיבים בתשלום.

---

## 14. הכרעות שננקטו (ברירות מחדל, ניתנות לתיקון)

1. **ספירת משחקים** — לפי נבחרת (משחק בין שתי נבחרות של אותו משתתף = 2).
2. **טקסט עדכון** — סכום פר‑משתתף + פירוט נבחרות.
3. **קונגו** — DR Congo (ניתן לתיקון בשורה ב‑`teams.json`).
4. **cron** — כל ~3 שעות עד 19.7.2026.
5. **דירוג** — ללא שובר שוויון; שוויון נקודות = מקום שווה, הבא בתור מדלג.

## 15. תלוי במשתמש

- `FOOTBALL_DATA_TOKEN` — הרשמה חינמית ב‑football-data.org.
- אישור התחברות ל‑Vercel בעת הפריסה.
