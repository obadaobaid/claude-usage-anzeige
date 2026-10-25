// Claude Usage Anzeige – zeigt 5h- und Wochenlimit auf claude.ai
(() => {
  if (window.__claudeUsageLoaded) return;
  window.__claudeUsageLoaded = true;

  const REFRESH_MS = 60 * 1000;
  let orgId = null;
  let state = { hidden: false, pos: null };

  // ---------- UI ----------
  const box = document.createElement("div");
  box.id = "cu-box";
  box.innerHTML = `
    <div id="cu-full">
      <div id="cu-head">
        <span>Usage</span>
        <span>
          <button id="cu-refresh" title="Aktualisieren">↻</button>
          <button id="cu-hide" title="Ausblenden">–</button>
        </span>
      </div>
      <div id="cu-rows">Lade…</div>
    </div>
    <div id="cu-mini" title="Usage einblenden">%</div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #cu-box { position: fixed; right: 20px; bottom: 110px; z-index: 2147483647;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, sans-serif; color: #eee;
      user-select: none; }
    #cu-full { background: rgba(30,30,30,.92); border: 1px solid #444; border-radius: 10px;
      padding: 8px 10px; width: 190px; box-shadow: 0 4px 16px rgba(0,0,0,.35);
      backdrop-filter: blur(6px); }
    #cu-head { display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; margin-bottom: 6px; cursor: move; }
    #cu-head button { background: none; border: none; color: #aaa; cursor: pointer;
      font-size: 14px; padding: 0 3px; }
    #cu-head button:hover { color: #fff; }
    .cu-row { margin-bottom: 6px; }
    .cu-row:last-child { margin-bottom: 0; }
    .cu-label { display: flex; justify-content: space-between; }
    .cu-sub { color: #999; font-size: 10.5px; }
    .cu-bar { height: 5px; background: #444; border-radius: 3px; overflow: hidden; margin: 3px 0 1px; }
    .cu-fill { height: 100%; border-radius: 3px; transition: width .4s; }
    #cu-mini { display: none; width: 30px; height: 30px; border-radius: 50%;
      background: rgba(30,30,30,.92); border: 1px solid #444; color: #ddd;
      align-items: center; justify-content: center; cursor: pointer; font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,.35); }
    #cu-box.cu-hidden #cu-full { display: none; }
    #cu-box.cu-hidden #cu-mini { display: flex; }
  `;

  document.documentElement.appendChild(style);
  document.body.appendChild(box);

  const $ = (s) => box.querySelector(s);

  // ---------- Zustand speichern ----------
  function save() { try { chrome.storage.local.set({ cuState: state }); } catch (e) {} }
  function applyState() {
    box.classList.toggle("cu-hidden", !!state.hidden);
    if (state.pos) {
      box.style.left = state.pos.x + "px";
      box.style.top = state.pos.y + "px";
      box.style.right = "auto";
      box.style.bottom = "auto";
    }
  }
  try {
    chrome.storage.local.get("cuState", (r) => {
      if (r && r.cuState) state = { ...state, ...r.cuState };
      applyState();
    });
  } catch (e) {}

  $("#cu-hide").onclick = () => { state.hidden = true; applyState(); save(); };
  $("#cu-mini").onclick = () => { state.hidden = false; applyState(); save(); };
  $("#cu-refresh").onclick = () => load();

  // Tastenkürzel: Alt+U zum Ein-/Ausblenden
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.code === "KeyU") {
      state.hidden = !state.hidden; applyState(); save();
    }
  });

  // ---------- Verschieben ----------
  let drag = null;
  $("#cu-head").addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const r = box.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const x = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - drag.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy));
    state.pos = { x, y };
    applyState();
  });
  document.addEventListener("mouseup", () => { if (drag) { drag = null; save(); } });

  // ---------- Daten ----------
  function color(p) {
    if (p >= 90) return "#e5534b";
    if (p >= 70) return "#d69a2d";
    return "#57ab5a";
  }

  function resetText(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = d - new Date();
    if (isNaN(diff)) return "";
    if (diff <= 0) return "Reset jetzt";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) {
      return "Reset " + d.toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }
    return `Reset in ${h > 0 ? h + " Std " : ""}${m} Min`;
  }

  function row(label, obj) {
    if (!obj || obj.utilization == null) return "";
    const p = Math.round(Number(obj.utilization));
    return `
      <div class="cu-row">
        <div class="cu-label"><span>${label}</span><b>${p}%</b></div>
        <div class="cu-bar"><div class="cu-fill" style="width:${Math.min(p, 100)}%;background:${color(p)}"></div></div>
        <div class="cu-sub">${resetText(obj.resets_at)}</div>
      </div>`;
  }

  async function getJSON(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  async function findOrg() {
    const orgs = await getJSON("/api/organizations");
    for (const o of orgs) {
      try {
        await getJSON(`/api/organizations/${o.uuid}/usage`);
        return o.uuid;
      } catch (e) {}
    }
    throw new Error("Keine Organisation gefunden");
  }

  async function load() {
    try {
      if (!orgId) orgId = await findOrg();
      const u = await getJSON(`/api/organizations/${orgId}/usage`);
      const p5 = u.five_hour ? Math.round(u.five_hour.utilization) : null;
      const html =
        row("5-Stunden", u.five_hour) +
        row("Woche (alle)", u.seven_day) +
        row("Woche (Opus)", u.seven_day_opus) +
        row("Woche (Sonnet)", u.seven_day_sonnet);
      $("#cu-rows").innerHTML = html || "Keine Daten";
      $("#cu-mini").textContent = p5 != null ? p5 : "%";
      $("#cu-mini").style.color = p5 != null ? color(p5) : "#ddd";
    } catch (e) {
      orgId = null;
      $("#cu-rows").innerHTML = `<span class="cu-sub">Konnte Usage nicht laden. Bist du eingeloggt?</span>`;
    }
  }

  load();
  setInterval(load, REFRESH_MS);
})();
