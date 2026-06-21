// בסיס הנתונים: קבצי ה-JSON נמשכים ישירות מה-repo ב-GitHub (raw),
// כך שעדכוני ה-Action מופיעים בלי צורך לפרוס מחדש את האתר.
// ה-OWNER/REPO מוחלפים אוטומטית בעת הקמת ה-repo; עד אז נופלים לנתיב מקומי לבדיקה.
const RAW_BASE = "https://raw.githubusercontent.com/barp2105/worldcup-2026-pool/main/data";
const DATA_BASE = RAW_BASE.includes("__OWNER__") ? "../data" : RAW_BASE;

const $ = (sel) => document.querySelector(sel);

async function fetchJson(name) {
  const res = await fetch(`${DATA_BASE}/${name}?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

function rowClass(s, isLast) {
  const cls = [];
  if (s.rank === 1) cls.push("top-1");
  else if (s.rank === 2) cls.push("top-2");
  else if (s.rank === 3) cls.push("top-3");
  if (isLast) cls.push("is-last");
  return cls.join(" ");
}

function renderStandings(data) {
  const body = $("#standings-body");
  const rows = data.standings ?? [];
  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="loading">אין נתונים עדיין</td></tr>`;
    return;
  }
  const maxRank = Math.max(...rows.map((r) => r.rank));
  // מציגים כפית רק כשיש מקום אחרון יחיד (לא כשכמה תקועים יחד בתחתית).
  const uniqueLast = rows.filter((r) => r.rank === maxRank).length === 1;
  body.innerHTML = rows
    .map((s) => {
      const isLast = uniqueLast && s.rank === maxRank;
      return `<tr class="${rowClass(s, isLast)}">
        <td><span class="rank-badge">${s.rank}</span></td>
        <td class="cell-name">${escapeHtml(s.name)}<button class="teams-btn" type="button" data-name="${escapeHtml(s.name)}" data-html2canvas-ignore="true">נבחרות</button></td>
        <td class="cell-points">${s.points}</td>
        <td class="cell-games">${s.matchesPlayed}</td>
      </tr>`;
    })
    .join("");

  if (data.updatedAt) {
    $("#updated-at").textContent = "עודכן: " + formatDate(data.updatedAt);
  }
}

function renderUpdate(data) {
  $("#update-text").textContent = data.text ?? "—";
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// רשימת הנבחרות של כל משתתף: שמות בעברית לתצוגה + קודים לשיוך משחקים.
let rosters = {};
let rosterCodes = {};

function buildRosters(owners, teams) {
  const names = {};
  const codesMap = {};
  for (const group of Object.values(owners.groups || {})) {
    for (const [name, codes] of Object.entries(group)) {
      names[name] = codes.map((c) => (teams[c] && teams[c].he) || c);
      codesMap[name] = codes;
    }
  }
  return { names, codesMap };
}

// לוג כל המשחקים שהסתיימו + סדר המשתתפים (לפי הטבלה) לפירוט הניקוד.
let matchLog = [];
let participantOrder = [];
let teamsMap = {};

async function load() {
  setStatus("טוען נתונים…");
  try {
    const [standings, lastUpdate, owners, teams, log] = await Promise.all([
      fetchJson("standings.json"),
      fetchJson("lastUpdate.json").catch(() => ({ text: "—" })),
      fetchJson("owners.json").catch(() => null),
      fetchJson("teams.json").catch(() => null),
      fetchJson("matchLog.json").catch(() => ({ matches: [] })),
    ]);
    if (owners && teams) {
      const built = buildRosters(owners, teams);
      rosters = built.names;
      rosterCodes = built.codesMap;
    }
    if (teams) {
      teamsMap = {};
      for (const [code, info] of Object.entries(teams)) {
        if (!code.startsWith("_")) teamsMap[code] = info;
      }
    }
    matchLog = log.matches || [];
    participantOrder = (standings.standings || []).map((s) => s.name);
    renderStandings(standings);
    renderUpdate(lastUpdate);
    renderGroups();
    setStatus("");
  } catch (err) {
    setStatus("שגיאה בטעינת הנתונים. נסה לרענן.");
    console.error(err);
  }
}

function setStatus(msg) {
  $("#status").textContent = msg;
}

// ---- שיתוף כתמונה ----
async function shareImage() {
  setStatus("מכין תמונה…");
  try {
    const card = $("#share-card");
    const canvas = await html2canvas(card, {
      backgroundColor: "#07261d",
      scale: 2,
      useCORS: true,
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("לא נוצרה תמונה");

    const file = new File([blob], "מונדיאל-2026.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "מונדיאל 2026 · טבלת ההימורים" });
      setStatus("");
    } else {
      // נפילה: הורדת התמונה
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "מונדיאל-2026.png";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("התמונה הורדה — אפשר לשתף אותה לוואטסאפ.");
    }
  } catch (err) {
    if (err && err.name === "AbortError") { setStatus(""); return; }
    setStatus("לא הצלחתי לשתף. נסה שוב.");
    console.error(err);
  }
}

// ---- מודאלים (חוקים + נבחרות) ----
function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
}
document.querySelectorAll(".modal").forEach((m) => {
  m.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", () => (m.hidden = true))
  );
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllModals();
});

$("#rules-btn").addEventListener("click", () => ($("#rules-modal").hidden = false));

function openTeams(name) {
  const list = rosters[name] || [];
  $("#teams-modal-title").textContent = "הנבחרות של " + name;
  $("#teams-list").innerHTML = list.length
    ? list.map((t) => `<li>${escapeHtml(t)}</li>`).join("")
    : `<li>אין נתונים</li>`;
  $("#teams-modal").hidden = false;
}

// delegation — השורות נבנות מחדש בכל רענון
$("#standings-body").addEventListener("click", (e) => {
  const btn = e.target.closest(".teams-btn");
  if (btn) openTeams(btn.dataset.name);
});

// ---- פירוט הניקוד פר שחקן ----
const STAGE_HE = {
  GROUP: "שלב הבתים",
  R32: "שלב ה־32",
  R16: "שמינית גמר",
  QF: "רבע גמר",
  SF: "חצי גמר",
  THIRD: "מקום שלישי",
  FINAL: "גמר",
};

let breakdownSelected = null;

function resultLabel(match, side) {
  if (match.outcome === "DRAW") return "תיקו";
  const won =
    (match.outcome === "HOME" && side === "home") ||
    (match.outcome === "AWAY" && side === "away");
  let label = won ? "ניצחון" : "הפסד";
  if (match.duration === "EXTRA_TIME") label += " בהארכה";
  else if (match.duration === "PENALTY_SHOOTOUT") label += " בפנדלים";
  return label;
}

// כותרת המשחק מנקודת המבט של השחקן: הנבחרת שלו מודגשת.
function matchTitle(match, side) {
  const home = side === "home" ? `<b>${escapeHtml(match.home)}</b>` : escapeHtml(match.home);
  const away = side === "away" ? `<b>${escapeHtml(match.away)}</b>` : escapeHtml(match.away);
  if (match.homeGoals != null && match.awayGoals != null) {
    // הכותרת בכיוון RTL: הנבחרת הביתית מימין והאורחת משמאל. מספרים מוצגים תמיד
    // משמאל לימין, ולכן כדי שכל נבחרת תופיע ליד השער שלה רושמים awayGoals–homeGoals.
    return `${home} <span class="bd-score">${match.awayGoals}–${match.homeGoals}</span> ${away}`;
  }
  return `${home} נגד ${away}`;
}

function renderBreakdown(name) {
  breakdownSelected = name;
  document.querySelectorAll(".bd-player").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.name === name)
  );

  const codes = new Set(rosterCodes[name] || []);
  const rows = [];
  for (const m of matchLog) {
    if (codes.has(m.homeCode)) rows.push({ match: m, side: "home", points: m.homePoints });
    if (codes.has(m.awayCode)) rows.push({ match: m, side: "away", points: m.awayPoints });
  }
  rows.reverse(); // הלוג ממוין מהישן לחדש — מציגים את החדש למעלה

  const total = rows.reduce((sum, r) => sum + r.points, 0);
  $("#breakdown-summary").innerHTML = rows.length
    ? `סה״כ <b>${total}</b> נקודות מ־<b>${rows.length}</b> משחקים`
    : "";

  $("#breakdown-list").innerHTML = rows.length
    ? rows
        .map(
          (r) => `<li class="bd-row">
            <span class="bd-pts ${r.points > 0 ? "bd-pts--plus" : "bd-pts--zero"}">${r.points > 0 ? "+" + r.points : "0"}</span>
            <div class="bd-info">
              <div class="bd-title">${matchTitle(r.match, r.side)}</div>
              <div class="bd-meta">${STAGE_HE[r.match.stage] || r.match.stage} · ${resultLabel(r.match, r.side)}</div>
            </div>
          </li>`
        )
        .join("")
    : `<li class="bd-empty">עוד לא היו משחקים לנבחרות של ${escapeHtml(name)}</li>`;
}

function openBreakdown() {
  const names = participantOrder.length ? participantOrder : Object.keys(rosters);
  if (names.length === 0) return;
  $("#breakdown-players").innerHTML = names
    .map(
      (n) =>
        `<button class="bd-player" type="button" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`
    )
    .join("");
  renderBreakdown(names.includes(breakdownSelected) ? breakdownSelected : names[0]);
  $("#breakdown-modal").hidden = false;
}

$("#breakdown-players").addEventListener("click", (e) => {
  const btn = e.target.closest(".bd-player");
  if (btn) renderBreakdown(btn.dataset.name);
});

$("#breakdown-btn").addEventListener("click", openBreakdown);

// ---- טאב הבתים ----
// טבלאות הבתים מחושבות בצד הלקוח: הרכב הבתים מ-teams.json,
// והתוצאות (נק' ליגה אמיתיות 3/1/0, הפרש שערים) ממשחקי שלב הבתים ב-matchLog.
function renderGroups() {
  const grid = $("#groups-grid");
  const codes = Object.keys(teamsMap);
  if (codes.length === 0) {
    grid.innerHTML = `<p class="loading">אין נתונים עדיין</p>`;
    return;
  }

  const stats = {};
  for (const c of codes) stats[c] = { played: 0, gf: 0, ga: 0, pts: 0 };
  for (const m of matchLog) {
    if (m.stage !== "GROUP") continue;
    const h = stats[m.homeCode];
    const a = stats[m.awayCode];
    if (!h || !a) continue;
    h.played += 1;
    a.played += 1;
    h.gf += m.homeGoals ?? 0;
    h.ga += m.awayGoals ?? 0;
    a.gf += m.awayGoals ?? 0;
    a.ga += m.homeGoals ?? 0;
    if (m.outcome === "DRAW") {
      h.pts += 1;
      a.pts += 1;
    } else if (m.outcome === "HOME") {
      h.pts += 3;
    } else {
      a.pts += 3;
    }
  }

  const byGroup = {};
  for (const c of codes) {
    const g = teamsMap[c].group || "?";
    (byGroup[g] = byGroup[g] || []).push(c);
  }

  grid.innerHTML = Object.keys(byGroup)
    .sort()
    .map((g) => {
      const rows = byGroup[g]
        .map((c) => ({ he: teamsMap[c].he, ...stats[c] }))
        .sort(
          (x, y) =>
            y.pts - x.pts ||
            y.gf - y.ga - (x.gf - x.ga) ||
            y.gf - x.gf ||
            x.he.localeCompare(y.he, "he")
        );
      return `<div class="group">
        <h3 class="group__title">בית ${g}</h3>
        <table class="group-table">
          <thead><tr><th class="gt-name">נבחרת</th><th>מש׳</th><th>הפרש</th><th>נק׳</th></tr></thead>
          <tbody>${rows
            .map((r, i) => {
              const gd = r.gf - r.ga;
              return `<tr class="${i < 2 ? "gt-qualify" : ""}">
                <td class="gt-name">${escapeHtml(r.he)}</td>
                <td>${r.played}</td>
                <td class="gt-gd">${gd > 0 ? "+" + gd : gd}</td>
                <td class="gt-pts">${r.pts}</td>
              </tr>`;
            })
            .join("")}</tbody>
        </table>
      </div>`;
    })
    .join("");
}

// ---- בורר הטאבים ----
document.querySelectorAll(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    $("#panel-standings").hidden = btn.dataset.tab !== "standings";
    $("#panel-groups").hidden = btn.dataset.tab !== "groups";
  })
);

$("#share-btn").addEventListener("click", shareImage);
$("#refresh-btn").addEventListener("click", load);
load();
