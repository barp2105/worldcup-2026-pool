// בסיס הנתונים: קבצי ה-JSON נמשכים ישירות מה-repo ב-GitHub (raw),
// כך שעדכוני ה-Action מופיעים בלי צורך לפרוס מחדש את האתר.
// ה-OWNER/REPO מוחלפים אוטומטית בעת הקמת ה-repo; עד אז נופלים לנתיב מקומי לבדיקה.
const RAW_BASE = "https://raw.githubusercontent.com/__OWNER__/__REPO__/main/data";
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
  body.innerHTML = rows
    .map((s) => {
      const isLast = s.rank === maxRank;
      return `<tr class="${rowClass(s, isLast)}">
        <td><span class="rank-badge">${s.rank}</span></td>
        <td class="cell-name">${escapeHtml(s.name)}</td>
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

async function load() {
  setStatus("טוען נתונים…");
  try {
    const [standings, lastUpdate] = await Promise.all([
      fetchJson("standings.json"),
      fetchJson("lastUpdate.json").catch(() => ({ text: "—" })),
    ]);
    renderStandings(standings);
    renderUpdate(lastUpdate);
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

$("#share-btn").addEventListener("click", shareImage);
$("#refresh-btn").addEventListener("click", load);
load();
