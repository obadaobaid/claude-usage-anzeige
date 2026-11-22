// Usage Meter for Claude – shows the 5-hour and weekly limit on claude.ai,
// plus a rough size estimate of the chat that is currently open.
// Language follows the browser/system language (chrome.i18n), English as fallback.
(() => {
  if (window.__claudeUsageLoaded) return;
  window.__claudeUsageLoaded = true;

  const REFRESH_MS = 60 * 1000;
  let orgId = null;
  let state = { hidden: false, pos: null, chatCollapsed: false };

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
  const fmtNum = (n) => {
    try { return Math.round(n).toLocaleString(uiLang); } catch (e) { return String(Math.round(n)); }
  };

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
      <div id="cu-chat" style="display:none">
        <div id="cu-chat-head" title="${esc(t("toggleSection"))}">
          <span>${esc(t("chatTitle"))}</span><span id="cu-chat-tog">▾</span>
        </div>
        <div id="cu-chat-body" title="${esc(t("chatHint"))}"></div>
      </div>
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
    .cu-warn { color: #d69a2d; font-size: 10.5px; margin-top: 2px; }
    .cu-bar { height: 5px; background: #444; border-radius: 3px; overflow: hidden; margin: 3px 0 1px; }
    .cu-fill { height: 100%; border-radius: 3px; transition: width .4s; }
    #cu-chat { border-top: 1px solid #444; margin-top: 8px; padding-top: 6px; }
    #cu-chat-head { display: flex; justify-content: space-between; align-items: center;
      font-weight: 600; cursor: pointer; }
    #cu-chat-tog { color: #aaa; font-size: 11px; }
    #cu-chat-body { margin-top: 4px; }
    #cu-chat.cu-collapsed #cu-chat-body { display: none; }
    #cu-chat.cu-collapsed #cu-chat-tog { transform: rotate(-90deg); display: inline-block; }
    .cu-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-inline-end: 4px; }
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
    $("#cu-chat").classList.toggle("cu-collapsed", !!state.chatCollapsed);
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
  $("#cu-refresh").onclick = () => { load(); chatSync(true); };
  $("#cu-chat-head").onclick = () => { state.chatCollapsed = !state.chatCollapsed; applyState(); save(); };

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

  // ---------- Usage limits ----------
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

  async function ensureOrg() {
    if (!orgId) orgId = await findOrg();
    return orgId;
  }

  async function load() {
    try {
      await ensureOrg();
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

  // ---------- This chat: rough size estimate ----------
  // Counted only after something changed in the chat (i.e. after a reply),
  // results are stored per chat in chrome.storage.local, and only new or
  // changed messages are counted again.
  const LEVEL_MID = 40000;      // from here: "large"
  const LEVEL_HIGH = 120000;    // from here: "very large – new chat recommended"
  const BAR_MAX = 150000;
  const LONG_PAUSE_MIN = 60;
  const MIN_FETCH_GAP_MS = 8000;
  const MAX_FETCH_GAP_MS = 5 * 60 * 1000; // if nothing changes, wait longer and longer
  const QUIET_MS = 2500;
  const MAX_STORED_CHATS = 200;
  const KEY_PREFIX = "cuChat:";

  let chatId = null;
  let chatData = null;          // { total, files, lastAt, msgs: {uuid: [updatedAt, text, files]}, updated }
  let chatStatus = "idle";      // idle | counting | error
  let lastFetch = 0;
  let fetching = false;
  let quietTimer = null;
  let fetchGap = MIN_FETCH_GAP_MS;

  function currentChatId() {
    const m = location.pathname.match(/\/chat\/([0-9a-f-]{36})/i);
    return m ? m[1].toLowerCase() : null;
  }

  // Rough token estimate from characters (Claude's tokenizer is not public).
  function estimateTextTokens(s) {
    if (!s) return 0;
    let latin = 0, other = 0, cjk = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x9fff) ||
          (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff)) cjk++;
      else if (c > 0x024f) other++;
      else latin++;
    }
    return Math.ceil(latin / 3.5 + other / 2.5 + cjk * 1.2);
  }

  function blockText(b) {
    if (!b || typeof b !== "object") return "";
    switch (b.type) {
      case "text": return b.text || "";
      case "thinking":
      case "redacted_thinking":
        return ""; // earlier thinking is normally not sent again
      case "tool_use":
        return (b.name || "") + " " + JSON.stringify(b.input || {});
      case "tool_result": {
        const c = b.content;
        if (typeof c === "string") return c;
        if (Array.isArray(c)) return c.map((x) => (x && typeof x.text === "string") ? x.text : (x && x.type === "image" ? "" : JSON.stringify(x))).join("\n");
        return c ? JSON.stringify(c) : "";
      }
      default:
        return typeof b.text === "string" ? b.text : "";
    }
  }

  // Images: Anthropic's rule of thumb is width × height / 750 tokens after
  // downscaling (long edge ≤ 1568 px, ≈ 1.15 megapixels). PDFs: ~1500–3000 per page.
  function fileTokens(f) {
    if (!f || typeof f !== "object") return 0;
    const kind = String(f.file_kind || f.kind || "");
    const mime = String(f.mime_type || f.file_type || "");
    const asset = f.preview_asset || f.image_asset || f.thumbnail_asset || {};
    const w = Number(asset.image_width || f.image_width || f.width) || 0;
    const h = Number(asset.image_height || f.image_height || f.height) || 0;
    if (kind === "image" || /^image\//.test(mime)) {
      if (w > 0 && h > 0) {
        const s = Math.min(1, 1568 / Math.max(w, h), Math.sqrt(1150000 / (w * h)));
        return Math.ceil((w * s) * (h * s) / 750);
      }
      return 1600;
    }
    const pages = Number((f.document_asset && f.document_asset.page_count) || f.page_count) || 0;
    if (pages > 0) return pages * 2000;
    return 0;
  }

  function messageTokens(m) {
    let text = 0, files = 0;
    const content = Array.isArray(m.content) ? m.content : [];
    if (content.length) {
      for (const b of content) text += estimateTextTokens(blockText(b));
    } else if (typeof m.text === "string") {
      text += estimateTextTokens(m.text);
    }
    for (const a of (Array.isArray(m.attachments) ? m.attachments : [])) {
      if (a && typeof a.extracted_content === "string") files += estimateTextTokens(a.extracted_content);
    }
    for (const f of (Array.isArray(m.files) ? m.files : [])) files += fileTokens(f);
    for (const f of (Array.isArray(m.files_v2) ? m.files_v2 : [])) files += fileTokens(f);
    return [text, files];
  }

  // Only the messages on the branch that is currently shown count.
  function currentBranch(conv) {
    const msgs = Array.isArray(conv.chat_messages) ? conv.chat_messages : [];
    const byId = new Map(msgs.map((m) => [m.uuid, m]));
    const leaf = conv.current_leaf_message_uuid;
    if (leaf && byId.has(leaf)) {
      const out = [];
      const seen = new Set();
      let cur = byId.get(leaf);
      while (cur && !seen.has(cur.uuid)) {
        seen.add(cur.uuid);
        out.push(cur);
        cur = byId.get(cur.parent_message_uuid);
      }
      return out.reverse();
    }
    return msgs.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try { chrome.storage.local.get(key, (r) => resolve(r ? r[key] : undefined)); } catch (e) { resolve(undefined); }
    });
  }
  function storageSet(obj) {
    try { chrome.storage.local.set(obj); } catch (e) {}
  }
  function pruneStoredChats() {
    try {
      chrome.storage.local.get(null, (all) => {
        if (!all) return;
        const chats = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX))
          .map((k) => [k, (all[k] && all[k].updated) || 0])
          .sort((a, b) => b[1] - a[1]);
        const remove = chats.slice(MAX_STORED_CHATS).map((x) => x[0]);
        if (remove.length) chrome.storage.local.remove(remove);
      });
    } catch (e) {}
  }

  async function chatSync(force) {
    const id = currentChatId();
    if (!id || fetching) return;
    if (!force && Date.now() - lastFetch < fetchGap) {
      scheduleChatSync(); // try again once the gap is over
      return;
    }
    fetching = true;
    lastFetch = Date.now();
    if (!chatData) { chatStatus = "counting"; renderChat(); }
    try {
      await ensureOrg();
      const conv = await getJSON(`/api/organizations/${orgId}/chat_conversations/${id}?tree=True&rendering_mode=messages&render_all_tools=true`);
      if (currentChatId() !== id) return; // user switched chats meanwhile
      const old = (chatData && chatData.msgs) || {};
      const msgs = {};
      let total = 0, files = 0, lastAt = null;
      for (const m of currentBranch(conv)) {
        const stamp = m.updated_at || m.created_at || "";
        let entry = old[m.uuid];
        if (!entry || entry[0] !== stamp) {
          const [tx, fl] = messageTokens(m);
          entry = [stamp, tx, fl];
        }
        msgs[m.uuid] = entry;
        total += entry[1] + entry[2];
        files += entry[2];
        if (m.created_at) lastAt = m.created_at;
      }
      const sig = (d) => d ? Object.keys(d.msgs || {}).length + "|" + d.total + "|" + d.lastAt : "";
      const before = sig(chatData);
      chatData = { total, files, lastAt, msgs, updated: Date.now() };
      // nothing new? then back off; something new? check promptly again
      fetchGap = before === sig(chatData) ? Math.min(MAX_FETCH_GAP_MS, fetchGap * 2) : MIN_FETCH_GAP_MS;
      chatStatus = "idle";
      storageSet({ [KEY_PREFIX + id]: chatData });
      pruneStoredChats();
    } catch (e) {
      if (currentChatId() === id) chatStatus = "error";
    } finally {
      fetching = false;
      renderChat();
    }
  }

  let pendingSince = 0;
  const MAX_WAIT_MS = 20000; // if the page never gets quiet, sync anyway after this
  function scheduleChatSync() {
    const now = Date.now();
    if (!pendingSince) pendingSince = now;
    if (quietTimer && now - pendingSince > MAX_WAIT_MS) return; // let the pending timer fire
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      quietTimer = null;
      pendingSince = 0;
      if (document.visibilityState === "visible") chatSync(false);
    }, Math.max(QUIET_MS, fetchGap - (now - lastFetch)));
  }

  function agoText(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d;
    if (!iso || isNaN(diff)) return "";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("lastAgoNow");
    if (mins < 60) return t("lastAgoM", [String(mins)]);
    return t("lastAgoHM", [String(Math.floor(mins / 60)), String(mins % 60)]);
  }

  function renderChat() {
    const section = $("#cu-chat");
    const body = $("#cu-chat-body");
    if (!chatId) { section.style.display = "none"; return; }
    section.style.display = "";
    if (!chatData) {
      body.innerHTML = `<span class="cu-sub">${esc(t(chatStatus === "error" ? "chatError" : "chatCounting"))}</span>`;
      return;
    }
    const tok = chatData.total;
    const level = tok >= LEVEL_HIGH ? "levelHigh" : tok >= LEVEL_MID ? "levelMid" : "levelLow";
    const col = tok >= LEVEL_HIGH ? "#e5534b" : tok >= LEVEL_MID ? "#d69a2d" : "#57ab5a";
    const pct = Math.max(2, Math.min(100, (tok / BAR_MAX) * 100));
    const mins = chatData.lastAt ? (Date.now() - new Date(chatData.lastAt)) / 60000 : 0;
    body.innerHTML = `
      <div>${esc(t("chatTokens", [fmtNum(tok)]))}</div>
      <div class="cu-bar"><div class="cu-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="cu-sub"><span class="cu-dot" style="background:${col}"></span>${esc(t(level))}</div>
      ${chatData.files > 0 ? `<div class="cu-sub">${esc(t("chatFiles", [fmtNum(chatData.files)]))}</div>` : ""}
      ${chatData.lastAt ? `<div class="cu-sub">${esc(agoText(chatData.lastAt))}</div>` : ""}
      ${mins >= LONG_PAUSE_MIN ? `<div class="cu-warn">${esc(t("longPause"))}</div>` : ""}
      ${chatStatus === "error" ? `<div class="cu-sub">${esc(t("chatError"))}</div>` : ""}
    `;
  }

  async function onChatChange() {
    const id = currentChatId();
    if (id === chatId) return;
    chatId = id;
    chatData = null;
    chatStatus = "idle";
    fetchGap = MIN_FETCH_GAP_MS;
    clearTimeout(quietTimer);
    if (!id) { renderChat(); return; }
    // show the stored result immediately, then sync once
    const stored = await storageGet(KEY_PREFIX + id);
    if (currentChatId() !== id) return;
    if (stored && typeof stored.total === "number") chatData = stored;
    renderChat();
    chatSync(true);
  }

  // Detect replies: wait until the page has been quiet for a moment after
  // changes in the conversation (ignoring our own box and the input field).
  const observer = new MutationObserver((records) => {
    if (!chatId) return;
    for (const r of records) {
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!n) continue;
      if (box.contains(n)) continue;
      if (n.closest && n.closest('[contenteditable="true"], textarea, input')) continue;
      scheduleChatSync();
      return;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // when the user sends a message, a reply is coming: check promptly again
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target && e.target.closest &&
        e.target.closest('[contenteditable="true"], textarea')) fetchGap = MIN_FETCH_GAP_MS;
  }, true);
  document.addEventListener("click", (e) => {
    const b = e.target && e.target.closest && e.target.closest("button");
    if (b && !box.contains(b)) fetchGap = MIN_FETCH_GAP_MS;
  }, true);

  // claude.ai is a single-page app: watch for chat switches (cheap string compare)
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; onChatChange(); }
  }, 1000);
  window.addEventListener("popstate", onChatChange);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && chatId) scheduleChatSync();
  });
  // refresh the "last message x min ago" text without counting again
  setInterval(() => { if (chatData) renderChat(); }, 30 * 1000);

  load();
  setInterval(load, REFRESH_MS);
  onChatChange();
})();
