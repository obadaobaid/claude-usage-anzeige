// Usage Meter for Claude – shows the 5-hour and weekly limit on claude.ai
// Language follows the browser/system language (chrome.i18n), English as fallback.
(() => {
  if (window.__claudeUsageLoaded) return;
  window.__claudeUsageLoaded = true;

  const REFRESH_MS = 60 * 1000;
  let orgId = null;
  let state = { hidden: false, pos: null };

  // ---------- i18n ----------
  function t(key, subs) {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch (e) {
      return key;
    }
  }
  let uiLang;
  try { uiLang = chrome.i18n.getUILanguage(); } catch (e) { uiLang = navigator.language; }
  let dir = "ltr";
  try { dir = chrome.i18n.getMessage("@@bidi_dir") || "ltr"; } catch (e) {}

  const isMac = /Mac/i.test(
    (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ""
  );
  const shortcutLabel = isMac ? "⌥U" : "Alt+U";

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- UI ----------
  const box = document.createElement("div");
  box.id = "cu-box";
  box.dir = dir;
  box.innerHTML = `
    <div id="cu-full">
      <div id="cu-head" title="${esc(t("toggleHint", [shortcutLabel]))}">
        <span>${esc(t("title"))}</span>
        <span class="cu-btns">
          <button id="cu-refresh" title="${esc(t("refresh"))}">↻</button>
          <button id="cu-hide" title="${esc(t("hide"))} (${shortcutLabel})">–</button>
        </span>
      </div>
      <div id="cu-rows">${esc(t("loading"))}</div>
    </div>
    <div id="cu-mini" title="${esc(t("show"))} (${shortcutLabel})">%</div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #cu-box { position: fixed; right: 20px; bottom: 110px; z-index: 2147483647;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif;
      color: #eee; user-select: none; }
    #cu-full { background: rgba(30,30,30,.92); border: 1px solid #444; border-radius: 10px;
      padding: 8px 10px; width: 200px; box-sizing: border-box; box-shadow: 0 4px 16px rgba(0,0,0,.35);
      backdrop-filter: blur(6px); }
    #cu-head { display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; margin-bottom: 6px; cursor: move; }
    #cu-head button { background: none; border: none; color: #aaa; cursor: pointer;
      font-size: 14px; padding: 0 3px; font-family: inherit; }
    #cu-head button:hover { color: #fff; }
    .cu-row { margin-bottom: 6px; }
    .cu-row:last-child { margin-bottom: 0; }
    .cu-label { display: flex; justify-content: space-between; gap: 6px; }
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

  // ---------- Saved state ----------
  function save() { try { chrome.storage.local.set({ cuState: state }); } catch (e) {} }
  function applyState() {
    box.classList.toggle("cu-hidden", !!state.hidden);
    if (state.pos) {
      // keep the box on screen if the window got smaller since last time
      const x = Math.max(0, Math.min(window.innerWidth - 60, state.pos.x));
      const y = Math.max(0, Math.min(window.innerHeight - 40, state.pos.y));
      box.style.left = x + "px";
      box.style.top = y + "px";
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

  // Shortcut: Alt+U (Windows/Linux) or Option+U (Mac) toggles the box
  document.addEventListener("keydown", (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyU") {
      e.preventDefault();
      state.hidden = !state.hidden; applyState(); save();
    }
  });

  // ---------- Dragging ----------
  let drag = null;
  $("#cu-head").addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    const r = box.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!drag) return;
    state.pos = { x: e.clientX - drag.dx, y: e.clientY - drag.dy };
    applyState();
  });
  document.addEventListener("mouseup", () => { if (drag) { drag = null; save(); } });
  window.addEventListener("resize", applyState);

  // ---------- Data ----------
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
    if (diff <= 0) return t("resetNow");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) {
      let when;
      try {
        when = d.toLocaleString(uiLang, { weekday: "short", hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        when = d.toLocaleString();
      }
      return t("resetAt", [when]);
    }
    if (h > 0) return t("resetInHM", [String(h), String(m)]);
    return t("resetInM", [String(m)]);
  }

  function row(labelKey, obj) {
    if (!obj || obj.utilization == null) return "";
    const p = Math.round(Number(obj.utilization));
    if (isNaN(p)) return "";
    return `
      <div class="cu-row">
        <div class="cu-label"><span>${esc(t(labelKey))}</span><b dir="ltr">${p}%</b></div>
        <div class="cu-bar"><div class="cu-fill" style="width:${Math.max(0, Math.min(p, 100))}%;background:${color(p)}"></div></div>
        <div class="cu-sub">${esc(resetText(obj.resets_at))}</div>
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
    throw new Error("No organization found");
  }

  async function load() {
    try {
      if (!orgId) orgId = await findOrg();
      const u = await getJSON(`/api/organizations/${orgId}/usage`);
      const p5 = u.five_hour && u.five_hour.utilization != null ? Math.round(u.five_hour.utilization) : null;
      const html =
        row("fiveHour", u.five_hour) +
        row("weekAll", u.seven_day) +
        row("weekOpus", u.seven_day_opus) +
        row("weekSonnet", u.seven_day_sonnet);
      $("#cu-rows").innerHTML = html || esc(t("noData"));
      $("#cu-mini").textContent = p5 != null ? p5 : "%";
      $("#cu-mini").style.color = p5 != null ? color(p5) : "#ddd";
    } catch (e) {
      orgId = null;
      $("#cu-rows").innerHTML = `<span class="cu-sub">${esc(t("loadError"))}</span>`;
    }
  }

  load();
  setInterval(load, REFRESH_MS);
})();
