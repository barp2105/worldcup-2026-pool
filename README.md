# 🏆 מונדיאל 2026 — טבלת ההימורים

מערכת **חינמית לגמרי** שמושכת את תוצאות משחקי מונדיאל 2026, מחשבת ניקוד למשתתפים לפי תקנון הדראפט, ומציגה טבלה מתעדכנת בדף ווב עם כפתור **שיתוף כתמונה לוואטסאפ**.

- בלי שרת בתשלום: הכל רץ על **GitHub Actions** (cron) + אחסון סטטי.
- 8 משתתפים, 2 קבוצות של 4, כל אחד מחזיק 12 נבחרות. כל נבחרת שייכת ל‑2 משתתפים — וכשהיא צוברת נקודות, **שניהם** מקבלים.

📄 אפיון מלא: [`docs/superpowers/specs/2026-06-12-worldcup-pool-design.md`](docs/superpowers/specs/2026-06-12-worldcup-pool-design.md)

---

## איך הניקוד עובד

| שלב | ניצחון | תיקו | מפסידה (90/120') | מפסידה (הארכה/פנדלים) |
|------|:---:|:---:|:---:|:---:|
| בתים | 2 | 1 | 0 | — |
| שמינית + רבע | 3 | — | 0 | 1 |
| חצי גמר | 4 | — | 0 | 1 |
| גמר | 6 | — | 0 | 2 |
| מקום 3 | 2 | — | 0 | 0 |

כל ערכי הניקוד נמצאים ב‑[`data/rules.json`](data/rules.json) — אפשר לשנות בלי לגעת בקוד.

---

## הקמה (חד‑פעמי)

1. **מפתח football-data.org** — הירשם חינם ב‑https://www.football-data.org/client/register וקבל API token.
2. **הוסף Secret ב‑GitHub** — בהגדרות ה‑repo:
   `Settings → Secrets and variables → Actions → New repository secret`
   - שם: `FOOTBALL_DATA_TOKEN`
   - ערך: המפתח שקיבלת.
3. **הפעל את ה‑Action** — לשונית `Actions` → אשר הרצת workflows → ניתן להריץ ידנית עם `Run workflow` (workflow_dispatch).
4. **פריסת דף הווב** — פרוס את תיקיית `web/` ל‑Vercel (Root Directory = `web`). הדף מושך את הנתונים ישירות מה‑repo, כך שאין צורך לפרוס מחדש על כל עדכון.

> דף הווב קורא את הנתונים מ‑`raw.githubusercontent.com` של ה‑repo. ה‑repo צריך להיות **ציבורי** (או להתאים את מקור הנתונים).

---

## עריכת הנתונים

- [`data/owners.json`](data/owners.json) — מי מחזיק באילו נבחרות (קודי FIFA).
- [`data/teams.json`](data/teams.json) — מיפוי קוד → שם עברי + שם ב‑API + aliases + בית.
- [`data/rules.json`](data/rules.json) — טבלת הניקוד.

קבצים שנוצרים אוטומטית (אל תערוך ידנית): `standings.json`, `lastUpdate.json`, `history.json`, `processed.json`.

---

## הרצה מקומית

```bash
npm install
npm test                      # בדיקות מנוע הניקוד
FOOTBALL_DATA_TOKEN=xxx npm run update   # ריצת עדכון מלאה
```

ללא טוקן: המערכת תנסה לקרוא `data/results.manual.json` (אותו מבנה כמו ה‑API) כרשת ביטחון.

תצוגה מקומית של הדף:
```bash
npx serve .
# ופתח http://localhost:3000/web/
```

---

## איך זה רץ

```
GitHub Actions (cron כל ~3 שעות) → fetchResults → scoring → כתיבת JSON → commit
                                                                    ↓
                          Vercel (web/) ← raw GitHub ← הדף קורא standings.json
```

החישוב **idempotent**: ה‑standings מחושב תמיד מכל המשחקים שהסתיימו; `processed.json` משמש רק כדי לדעת אילו משחקים חדשים להציג ב"עדכון האחרון".
