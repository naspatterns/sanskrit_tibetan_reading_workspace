// app.js — Phase 3 UI: search mode + reader mode with token click → lookup.

const q = document.getElementById("q");
const go = document.getElementById("go");
const results = document.getElementById("results");
const sidebar = document.getElementById("sidebar");
const status = document.getElementById("status");

// Mode elements
const searchMode = document.getElementById("search-mode");
const readerMode = document.getElementById("reader-mode");
const vocabMode = document.getElementById("vocab-mode");
const treeContent = document.getElementById("tree-content");
const textBody = document.getElementById("text-body");
const textTitle = document.getElementById("text-title");
const lookupResults = document.getElementById("lookup-results");
let currentMode = "search";
let lastReaderTerm = ""; // Track last searched term in reader mode

// ── User preferences (localStorage) ──────────────────────────────────
const PREFS_KEY = "skt_tib_prefs";
let prefs = loadPrefs();

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.version === 1) return p;
    }
  } catch (_) {}
  return { version: 1, pinnedDicts: [], hiddenGroups: [] };
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

function isPinned(dict) { return prefs.pinnedDicts.includes(dict); }

function togglePin(dict) {
  const idx = prefs.pinnedDicts.indexOf(dict);
  if (idx >= 0) prefs.pinnedDicts.splice(idx, 1);
  else prefs.pinnedDicts.push(dict);
  savePrefs();
}

function isGroupHidden(groupId) { return prefs.hiddenGroups.includes(groupId); }

function toggleGroupFilter(groupId) {
  const idx = prefs.hiddenGroups.indexOf(groupId);
  if (idx >= 0) prefs.hiddenGroups.splice(idx, 1);
  else prefs.hiddenGroups.push(groupId);
  savePrefs();
}

// ── Collapse state (session only) ────────────────────────────────────
const collapseOverride = new Map(); // dict -> true/false

function setStatus(msg) {
  if (status) status.textContent = msg;
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cssId(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// ── Classify rows ────────────────────────────────────────────────────

function classifyRows(rows) {
  const exact = [];
  const partial = [];
  for (const r of rows) {
    if (r.exact) exact.push(r);
    else partial.push(r);
  }
  return { exact, partial };
}

// Group exact rows by display group → dict, sorted by tier
function groupExactByDisplayGroup(exactRows) {
  const groups = window.DictNames.DISPLAY_GROUPS.map((g) => ({
    ...g,
    dicts: new Map(), // dict -> { meta, items: [] }
  }));

  for (const r of exactRows) {
    const meta = window.DictNames.label(r.dict);
    const gi = window.DictNames.getDisplayGroupIndex(meta);
    const g = groups[gi];
    if (!g.dicts.has(r.dict)) {
      g.dicts.set(r.dict, { meta, items: [] });
    }
    g.dicts.get(r.dict).items.push(r);
  }

  // Sort dicts within each group: pinned first, then tier ASC, then count DESC
  for (const g of groups) {
    const entries = [...g.dicts.entries()];
    entries.sort((a, b) => {
      const pa = isPinned(a[0]) ? 0 : 1;
      const pb = isPinned(b[0]) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a[1].meta.tier !== b[1].meta.tier) return a[1].meta.tier - b[1].meta.tier;
      return b[1].items.length - a[1].items.length;
    });
    g.dicts = new Map(entries);
  }

  return groups.filter((g) => g.dicts.size > 0);
}

// Deduplicate partial matches by headword, count dict occurrences
function deduplicatePartial(partialRows) {
  const map = new Map(); // headword_norm -> { headword, count, dicts }
  for (const r of partialRows) {
    const key = r.headword.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { headword: r.headword, count: 0, dicts: new Set() });
    }
    const entry = map.get(key);
    entry.count++;
    entry.dicts.add(r.dict);
  }
  // Sort by headword length (shorter = more relevant), then alphabetically
  const arr = [...map.values()];
  arr.sort((a, b) => a.headword.length - b.headword.length || a.headword.localeCompare(b.headword));
  return arr;
}

// ── Zone A: Quick Answer panel ───────────────────────────────────────

function renderZoneA(exactRows, bilexRows, searchTerm) {
  if (!exactRows.length) return "";

  // Collect first exact match per dict, sorted by tier
  const dictFirst = new Map();
  for (const r of exactRows) {
    if (!dictFirst.has(r.dict)) dictFirst.set(r.dict, r);
  }
  const entries = [...dictFirst.entries()];
  entries.sort((a, b) => {
    const ma = window.DictNames.label(a[0]);
    const mb = window.DictNames.label(b[0]);
    return (ma.tier - mb.tier) || (ma.defLang === "en" ? -1 : mb.defLang === "en" ? 1 : 0);
  });

  // Only show tier 1 and tier 2 entries in summary (max ~10)
  const summaryEntries = entries.filter(([, r]) => {
    const m = window.DictNames.label(r.dict);
    return m.tier <= 2;
  }).slice(0, 10);

  const parts = [];
  parts.push(`<section class="zone-a">`);
  parts.push(`<div class="qa-headword">${escapeHtml(searchTerm)}</div>`);

  // Bilex inline
  if (bilexRows && bilexRows.length) {
    const exactBilex = bilexRows.filter((r) => r.exact);
    if (exactBilex.length) {
      const items = exactBilex.slice(0, 3).map((r) => {
        const skt = r.skt_iast ? `<span class="bilex-skt">${escapeHtml(r.skt_iast)}</span>` : "";
        const tib = r.tib_wylie ? `<span class="bilex-tib">${escapeHtml(r.tib_wylie)}</span>` : "";
        return `${skt} <span class="bilex-arrow">\u2194</span> ${tib} <span class="bilex-num">[Mvy ${r.entry_num}]</span>`;
      });
      parts.push(`<div class="qa-bilex">${items.join(" \u00b7 ")}</div>`);
    }
  }

  // Summary lines from each dict
  parts.push(`<div class="qa-lines">`);
  for (const [dict, r] of summaryEntries) {
    const meta = window.DictNames.label(dict);
    const shortLabel = meta.label.replace(/\s*\(.*\)$/, "").replace(/Skt\u2192|Eng\u2192/, "");
    const bodyText = (r.body || "").replace(/\n/g, " ").trim();
    const snippet = bodyText.length > 150 ? bodyText.slice(0, 150) + "\u2026" : bodyText;
    const groupColor = window.DictNames.DISPLAY_GROUPS[window.DictNames.getDisplayGroupIndex(meta)]?.color || "#999";
    parts.push(
      `<div class="qa-line" data-dict="${escapeHtml(dict)}">
         <span class="qa-dict-tag" style="border-color:${groupColor}">${escapeHtml(shortLabel)}</span>
         <span class="qa-snippet">${escapeHtml(snippet)}</span>
       </div>`
    );
  }
  parts.push(`</div>`);

  parts.push(`<div class="qa-stats">${dictFirst.size}\uac1c \uc0ac\uc804\uc5d0\uc11c \ubc1c\uacac</div>`);
  parts.push(`</section>`);
  return parts.join("");
}

// ── Zone B: Bilex section (existing) ─────────────────────────────────

function renderZoneB(bilexRows) {
  if (!bilexRows || !bilexRows.length) return "";
  const parts = [];
  parts.push(`<section id="bilex-section" class="bilex-block">`);
  parts.push(`<h2 class="bilex-header">\ub300\uc5ed\uc5b4 \u00b7 Equivalents <span class="bilex-count">${bilexRows.length}\uac74</span></h2>`);
  parts.push(`<div class="bilex-entries">`);
  for (const r of bilexRows) {
    const exactCls = r.exact ? " bilex-exact" : "";
    parts.push(`<div class="bilex-entry${exactCls}">`);
    parts.push(`<span class="bilex-num">[Mvy ${r.entry_num}]</span>`);
    if (r.skt_iast) {
      parts.push(` <a class="bilex-link bilex-skt" data-term="${escapeHtml(r.skt_iast)}">${escapeHtml(r.skt_iast)}</a>`);
    }
    parts.push(` <span class="bilex-arrow">\u2194</span> `);
    if (r.tib_wylie) {
      parts.push(`<a class="bilex-link bilex-tib" data-term="${escapeHtml(r.tib_wylie)}">${escapeHtml(r.tib_wylie)}</a>`);
    }
    if (r.category_zh) {
      parts.push(` <span class="bilex-cat">${escapeHtml(r.category_zh)}</span>`);
    }
    parts.push(`</div>`);
  }
  parts.push(`</div></section>`);
  return parts.join("");
}

// ── Zone C: Exact match full entries by display group ────────────────

function renderBody(s, maxLen) {
  const text = maxLen && s.length > maxLen ? s.slice(0, maxLen) + " \u2026" : s;
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function renderZoneC(displayGroups) {
  const parts = [];
  let totalExact = 0;
  for (const g of displayGroups) {
    for (const [, d] of g.dicts) totalExact += d.items.length;
  }
  if (totalExact === 0) return "";

  parts.push(`<div class="zone-c">`);

  for (const g of displayGroups) {
    // Count tier 3 dicts to hide
    const tier12 = [];
    const tier3 = [];
    for (const [dict, data] of g.dicts) {
      if (data.meta.tier <= 2 || isPinned(dict)) tier12.push([dict, data]);
      else tier3.push([dict, data]);
    }

    // Skip entirely hidden groups
    const gIdx = window.DictNames.DISPLAY_GROUPS.findIndex((dg) => dg.id === g.id);
    const hidden = isGroupHidden(g.id);

    parts.push(`<div class="display-group${hidden ? " dg-hidden" : ""}" data-group-id="${g.id}">`);
    parts.push(`<h2 class="dg-header" style="border-left-color:${g.color}">${g.name}</h2>`);

    // Tier 1-2 dicts
    for (const [dict, data] of tier12) {
      parts.push(renderDictBlock(dict, data, g.color));
    }

    // Tier 3 dicts behind "show more"
    if (tier3.length) {
      const tier3Count = tier3.reduce((s, [, d]) => s + d.items.length, 0);
      parts.push(`<div class="tier3-toggle" data-group="${g.id}">`);
      parts.push(`<button class="tier3-btn">${tier3.length}\uac1c \uc0ac\uc804 \ub354 \ubcf4\uae30 (${tier3Count}\uac74)</button>`);
      parts.push(`</div>`);
      parts.push(`<div class="tier3-content" data-group="${g.id}" style="display:none">`);
      for (const [dict, data] of tier3) {
        parts.push(renderDictBlock(dict, data, g.color));
      }
      parts.push(`</div>`);
    }

    parts.push(`</div>`);
  }

  parts.push(`</div>`);
  return parts.join("");
}

function renderDictBlock(dict, data, groupColor) {
  const { meta, items } = data;
  const id = cssId(dict);
  const pinned = isPinned(dict);

  // Collapse logic: tier 1 + pinned = open; tier 2 = open if exact; tier 3 = open
  let isOpen;
  if (collapseOverride.has(dict)) {
    isOpen = !collapseOverride.get(dict);
  } else {
    isOpen = pinned || meta.tier === 1 || (meta.tier === 2 && items.length > 0);
  }

  const arrow = isOpen ? "\u25be" : "\u25b8";
  const tierClass = `tier-${meta.tier}`;
  const pinCls = pinned ? " pinned" : "";
  const borderStyle = meta.tier <= 2 ? `border-left: ${meta.tier === 1 ? 3 : 1}px solid ${groupColor}` : "";

  const parts = [];
  parts.push(
    `<section class="dict-block ${tierClass}${pinCls}" id="dict-${id}" style="${borderStyle}">
       <h3 class="dict-head" data-dict="${escapeHtml(dict)}">
         <span class="arrow">${arrow}</span>
         <span class="dict-label">${escapeHtml(meta.label)}</span>
         <span class="dict-count">${items.length}\uac74</span>
         <span class="pin-btn" data-dict="${escapeHtml(dict)}" title="\uc990\uaca8\ucc3e\uae30">${pinned ? "\u2605" : "\u2606"}</span>
       </h3>`
  );

  if (isOpen) {
    parts.push(`<div class="dict-entries">`);
    for (const it of items) {
      parts.push(
        `<div class="entry exact">
           <div class="head">${escapeHtml(it.headword)}</div>
           <div class="body">${renderBody(it.body)}</div>
         </div>`
      );
    }
    parts.push(`</div>`);
  }

  parts.push(`</section>`);
  return parts.join("");
}

// ── Zone D: Partial match headword list ──────────────────────────────

function renderZoneD(partialHeadwords) {
  if (!partialHeadwords.length) return "";
  const INITIAL_SHOW = 50;
  const total = partialHeadwords.length;

  const parts = [];
  parts.push(`<section class="zone-d">`);
  parts.push(`<h2 class="zd-header">\uad00\ub828 \ud45c\uc81c\uc5b4 <span class="zd-count">(${total}\uac74)</span></h2>`);
  parts.push(`<div class="zd-list">`);

  for (let i = 0; i < total; i++) {
    const hw = partialHeadwords[i];
    const hiddenCls = i >= INITIAL_SHOW ? " zd-hidden" : "";
    const dictCount = hw.dicts.size;
    parts.push(
      `<a class="zd-word${hiddenCls}" data-term="${escapeHtml(hw.headword)}">${escapeHtml(hw.headword)}<sup class="zd-n">${dictCount}</sup></a>`
    );
  }

  parts.push(`</div>`);

  if (total > INITIAL_SHOW) {
    parts.push(`<button class="zd-more">\ub098\uba38\uc9c0 ${total - INITIAL_SHOW}\uac1c \ubcf4\uae30</button>`);
  }

  parts.push(`</section>`);
  return parts.join("");
}

// ── Sidebar ──────────────────────────────────────────────────────────

function renderSidebar(displayGroups, totalRows, bilexRows, partialCount) {
  const GROUPS = window.DictNames.DISPLAY_GROUPS;
  const parts = [];

  // Filter pills
  parts.push(`<div class="side-filters">`);
  for (const g of GROUPS) {
    const active = !isGroupHidden(g.id);
    parts.push(
      `<button class="filter-pill${active ? " active" : ""}" data-group-id="${g.id}" style="--pill-color:${g.color}">${g.name}</button>`
    );
  }
  parts.push(`</div>`);

  // Stats
  parts.push(`<div class="side-total">\ucd1d ${totalRows}\uac74</div>`);

  // Bilex link
  if (bilexRows && bilexRows.length) {
    parts.push(`<div class="side-group-title">\ub300\uc5ed\uc5b4</div>`);
    parts.push(
      `<a class="side-link" href="#bilex-section">
         <span class="side-name">Mah\u0101vyutpatti</span>
         <span class="side-count">${bilexRows.length}</span>
       </a>`
    );
  }

  // Pinned dicts
  const pinnedEntries = [];
  for (const g of displayGroups) {
    for (const [dict, data] of g.dicts) {
      if (isPinned(dict)) pinnedEntries.push({ dict, meta: data.meta, count: data.items.length });
    }
  }
  if (pinnedEntries.length) {
    parts.push(`<div class="side-group-title">\u2605 \uc990\uaca8\ucc3e\uae30</div>`);
    for (const p of pinnedEntries) {
      parts.push(renderSideLink(p.dict, p.meta, p.count));
    }
  }

  // By display group
  for (const g of displayGroups) {
    parts.push(`<div class="side-group-title" style="border-left: 2px solid ${g.color}; padding-left: 6px">${g.name}</div>`);
    for (const [dict, data] of g.dicts) {
      parts.push(renderSideLink(dict, data.meta, data.items.length));
    }
  }

  // Partial matches
  if (partialCount > 0) {
    parts.push(`<div class="side-group-title">\uad00\ub828 \ud45c\uc81c\uc5b4</div>`);
    parts.push(
      `<a class="side-link" href="#zone-d-anchor">
         <span class="side-name">\ubd80\ubd84 \ub9e4\uce58</span>
         <span class="side-count">${partialCount}</span>
       </a>`
    );
  }

  sidebar.innerHTML = parts.join("");
}

function renderSideLink(dict, meta, count) {
  const id = cssId(dict);
  return `<a class="side-link" href="#dict-${id}">
    <span class="side-name">${escapeHtml(meta.label)}</span>
    <span class="side-count">${count}</span>
  </a>`;
}

// ── Main render orchestrator ─────────────────────────────────────────

let lastRenderFn = () => {};

function renderAll(rows, bilexRows, searchTerm) {
  const { exact, partial } = classifyRows(rows);
  const displayGroups = groupExactByDisplayGroup(exact);
  const partialHeadwords = deduplicatePartial(partial);

  const html = [
    renderZoneA(exact, bilexRows, searchTerm),
    renderZoneB(bilexRows),
    renderZoneC(displayGroups),
    `<div id="zone-d-anchor"></div>`,
    renderZoneD(partialHeadwords),
  ].join("");

  results.innerHTML = html;
  renderSidebar(displayGroups, rows.length, bilexRows, partialHeadwords.length);

  // Wire events
  wireCollapse();
  wireBilexLinks();
  wirePinButtons();
  wireTier3Toggles();
  wireZoneDLinks();
  wireZoneALinks();
  wireFilterPills();
}

// ── Event wiring ─────────────────────────────────────────────────────

function wireCollapse() {
  results.querySelectorAll(".dict-head").forEach((h) => {
    h.addEventListener("click", (e) => {
      // Don't toggle if pin button was clicked
      if (e.target.closest(".pin-btn")) return;
      const dict = h.dataset.dict;
      const wasOpen = !!h.closest(".dict-block").querySelector(".dict-entries");
      collapseOverride.set(dict, wasOpen);
      lastRenderFn();
    });
  });
}

function wireBilexLinks() {
  document.querySelectorAll(".bilex-link").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const term = el.dataset.term;
      if (term) { q.value = term; search(); }
    });
  });
}

function wirePinButtons() {
  document.querySelectorAll(".pin-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const dict = el.dataset.dict;
      togglePin(dict);
      lastRenderFn();
    });
  });
}

function wireTier3Toggles() {
  document.querySelectorAll(".tier3-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".tier3-toggle");
      const groupId = wrapper.dataset.group;
      const content = wrapper.nextElementSibling;
      if (content && content.classList.contains("tier3-content")) {
        const visible = content.style.display !== "none";
        content.style.display = visible ? "none" : "block";
        btn.textContent = visible
          ? btn.textContent.replace("\uc811\uae30", "\ub354 \ubcf4\uae30").replace("\u25b4", "")
          : btn.textContent.replace("\ub354 \ubcf4\uae30", "\uc811\uae30");
      }
    });
  });
}

function wireZoneDLinks() {
  // Word links → new search
  document.querySelectorAll(".zd-word").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const term = el.dataset.term;
      if (term) { q.value = term; search(); }
    });
  });
  // "Show more" button
  const moreBtn = document.querySelector(".zd-more");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      document.querySelectorAll(".zd-hidden").forEach((el) => el.classList.remove("zd-hidden"));
      moreBtn.style.display = "none";
    });
  }
}

function wireZoneALinks() {
  document.querySelectorAll(".qa-line").forEach((el) => {
    el.addEventListener("click", () => {
      const dict = el.dataset.dict;
      const target = document.getElementById("dict-" + cssId(dict));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function wireFilterPills() {
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const groupId = pill.dataset.groupId;
      toggleGroupFilter(groupId);
      // Toggle visibility of display group in results
      const dg = document.querySelector(`.display-group[data-group-id="${groupId}"]`);
      if (dg) dg.classList.toggle("dg-hidden");
      pill.classList.toggle("active");
    });
  });
}

// ── Search ───────────────────────────────────────────────────────────

async function search() {
  const term = q.value.trim();
  if (!term) return;
  setStatus("\uac80\uc0c9 \uc911...");
  const t0 = performance.now();
  try {
    const [rows, bilexTib, bilexSkt] = await Promise.all([
      window.Lookup.search(term, { limit: 2000 }),
      window.Bilex ? window.Bilex.lookupTib(term) : [],
      window.Bilex ? window.Bilex.lookupSkt(term) : [],
    ]);

    // Merge bilex results (deduplicate by entry_num)
    const bilexSeen = new Set();
    const bilexRows = [];
    for (const r of [...bilexTib, ...bilexSkt]) {
      if (!bilexSeen.has(r.entry_num)) {
        bilexSeen.add(r.entry_num);
        bilexRows.push(r);
      }
    }
    bilexRows.sort((a, b) => (b.exact || 0) - (a.exact || 0) || a.entry_num - b.entry_num);

    const ms = Math.round(performance.now() - t0);
    const { exact, partial } = classifyRows(rows);
    setStatus(`${rows.length}\uac74 (\uc815\ud655 ${exact.length} + \uad00\ub828 ${partial.length}) \u00b7 ${ms}ms`);

    if (!rows.length && !bilexRows.length) {
      results.innerHTML = `<p class="hint"><b>${escapeHtml(term)}</b> \u2014 \uacb0\uacfc \uc5c6\uc74c.</p>`;
      sidebar.innerHTML = "";
      lastRenderFn = () => {};
      return;
    }

    collapseOverride.clear();
    lastRenderFn = () => renderAll(rows, bilexRows, term);
    lastRenderFn();
  } catch (e) {
    console.error(e);
    setStatus("\uc624\ub958");
    results.innerHTML = `<p class="hint error">\uc624\ub958: ${escapeHtml(String(e))}</p>`;
  }
}

go.addEventListener("click", search);
q.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });

// ── Mode switching ──────────────────────────────────────────────────

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  searchMode.style.display = mode === "search" ? "" : "none";
  readerMode.style.display = mode === "reader" ? "" : "none";
  vocabMode.style.display = mode === "vocab" ? "" : "none";

  // Update URL hash
  if (mode === "reader") {
    const path = window.Reader.getCurrentPath();
    if (path) window.location.hash = "reader/" + path;
    else window.location.hash = "reader";
  } else if (mode === "vocab") {
    window.location.hash = "vocab";
    renderVocabList();
  } else {
    if (window.location.hash.startsWith("#reader") || window.location.hash.startsWith("#vocab"))
      window.location.hash = "";
  }
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});

// ── Reader mode: lookup in side panel ───────────────────────────────

async function readerSearch(term) {
  if (!term) return;
  lastReaderTerm = term;
  q.value = term; // sync search box
  lookupResults.innerHTML = `<p class="hint">검색 중...</p>`;

  try {
    const [rows, bilexTib, bilexSkt] = await Promise.all([
      window.Lookup.search(term, { limit: 500 }),
      window.Bilex ? window.Bilex.lookupTib(term) : [],
      window.Bilex ? window.Bilex.lookupSkt(term) : [],
    ]);

    // Merge bilex
    const bilexSeen = new Set();
    const bilexRows = [];
    for (const r of [...bilexTib, ...bilexSkt]) {
      if (!bilexSeen.has(r.entry_num)) {
        bilexSeen.add(r.entry_num);
        bilexRows.push(r);
      }
    }
    bilexRows.sort((a, b) => (b.exact || 0) - (a.exact || 0) || a.entry_num - b.entry_num);

    if (!rows.length && !bilexRows.length) {
      lookupResults.innerHTML = `<p class="hint"><b>${escapeHtml(term)}</b> — 결과 없음.</p>`;
      return;
    }

    const { exact, partial } = classifyRows(rows);
    const displayGroups = groupExactByDisplayGroup(exact);

    // Build meaning summary for vocab card
    const meaningSnippets = [];
    for (const r of exact.slice(0, 3)) {
      const body = (r.body || "").replace(/\n/g, " ").trim();
      if (body) meaningSnippets.push(body.length > 80 ? body.slice(0, 80) + "…" : body);
    }
    const autoMeaning = meaningSnippets.join(" / ");

    // Render compact results for side panel
    const html = [
      renderVocabSaveBtn(term, autoMeaning),
      renderZoneA(exact, bilexRows, term),
      renderZoneB(bilexRows),
      renderZoneC(displayGroups),
    ].join("");

    lookupResults.innerHTML = html;

    // Wire vocab save button
    wireVocabSaveBtn();

    // Wire events within lookup panel
    lookupResults.querySelectorAll(".dict-head").forEach((h) => {
      h.addEventListener("click", (e) => {
        if (e.target.closest(".pin-btn")) return;
        const dict = h.dataset.dict;
        const wasOpen = !!h.closest(".dict-block").querySelector(".dict-entries");
        collapseOverride.set(dict, wasOpen);
        readerSearch(term); // re-render
      });
    });
    lookupResults.querySelectorAll(".pin-btn").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePin(el.dataset.dict);
        readerSearch(term);
      });
    });
    lookupResults.querySelectorAll(".tier3-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrapper = btn.closest(".tier3-toggle");
        const content = wrapper.nextElementSibling;
        if (content && content.classList.contains("tier3-content")) {
          const visible = content.style.display !== "none";
          content.style.display = visible ? "none" : "block";
        }
      });
    });
    lookupResults.querySelectorAll(".bilex-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const t = el.dataset.term;
        if (t) readerSearch(t);
      });
    });
    lookupResults.querySelectorAll(".qa-line").forEach((el) => {
      el.addEventListener("click", () => {
        const dict = el.dataset.dict;
        const target = lookupResults.querySelector("#dict-" + cssId(dict));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  } catch (e) {
    console.error(e);
    lookupResults.innerHTML = `<p class="hint error">오류: ${escapeHtml(String(e))}</p>`;
  }
}

// ── Reader mode: file loading ───────────────────────────────────────

async function openTextFile(path) {
  textTitle.textContent = path;
  textBody.innerHTML = `<p class="hint">로딩 중...</p>`;

  try {
    const text = await window.Reader.loadFile(path);
    window.Reader.renderText(textBody, text, path, (searchTerm) => {
      readerSearch(searchTerm);
    });
    // Update tree highlight + wire upload/delete
    renderFileTree();
    // Update URL hash
    window.location.hash = "reader/" + path;
  } catch (e) {
    textBody.innerHTML = `<p class="hint error">로딩 실패: ${escapeHtml(String(e))}</p>`;
  }
}

function renderFileTree() {
  window.Reader.renderTree(treeContent, openTextFile, (key) => {
    if (!confirm("이 텍스트를 삭제하시겠습니까?")) return;
    window.Reader.removeUpload(key);
    // If currently viewing deleted file, clear text panel
    if (window.Reader.getCurrentPath() === key) {
      textTitle.textContent = "파일을 선택하세요";
      textBody.innerHTML = `<p class="hint">좌측 목록에서 텍스트를 선택하면 여기에 표시됩니다.</p>`;
    }
    renderFileTree();
  });

  // Wire upload button
  const uploadBtn = document.getElementById("upload-btn-trigger");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      window.Reader.showUploadDialog((key) => {
        renderFileTree();
        openTextFile(key);
      });
    });
  }
}

// ── Vocab card: save button in lookup panel ─────────────────────────

function renderVocabSaveBtn(term, autoMeaning) {
  return `<div class="vocab-save-bar">
    <button class="vocab-save-btn" data-term="${escapeHtml(term)}" data-meaning="${escapeHtml(autoMeaning)}">+ 어휘 카드 저장</button>
  </div>`;
}

function wireVocabSaveBtn() {
  lookupResults.querySelectorAll(".vocab-save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const term = btn.dataset.term;
      const meaning = btn.dataset.meaning;
      const path = window.Reader ? window.Reader.getCurrentPath() : "";
      const lang = path ? window.Reader.detectLang(path) : "sa";

      // Get context: find the active token's line
      let context = "";
      let lineNum = null;
      const activeTok = textBody.querySelector(".token-active");
      if (activeTok) {
        const line = activeTok.closest(".text-line");
        if (line) {
          context = line.textContent.trim();
          lineNum = parseInt(line.dataset.line, 10) + 1;
        }
      }

      try {
        await window.Vocab.add({
          headword: term,
          meaning: meaning,
          lang: lang,
          source: path,
          lineNum: lineNum,
          context: context,
          note: "",
          status: "new",
        });
        btn.textContent = "✓ 저장됨";
        btn.disabled = true;
        btn.classList.add("saved");
      } catch (e) {
        console.error("Vocab save error:", e);
        btn.textContent = "저장 실패";
      }
    });
  });
}

// ── Vocab mode: list rendering ──────────────────────────────────────

let vocabFilterStatus = "all";

async function renderVocabList(query) {
  const vocabList = document.getElementById("vocab-list");
  const vocabStats = document.getElementById("vocab-stats");
  if (!vocabList) return;

  let cards;
  if (query) {
    cards = await window.Vocab.search(query);
  } else {
    cards = await window.Vocab.getAll();
  }

  // Apply status filter
  if (vocabFilterStatus !== "all") {
    cards = cards.filter((c) => c.status === vocabFilterStatus);
  }

  // Stats
  const total = await window.Vocab.count();
  const newCount = cards.filter((c) => c.status === "new").length;
  const learningCount = cards.filter((c) => c.status === "learning").length;
  const knownCount = cards.filter((c) => c.status === "known").length;
  vocabStats.innerHTML = `<span>총 ${total}개 카드</span>`;

  if (!cards.length) {
    vocabList.innerHTML = `<p class="hint">
      ${query ? `"${escapeHtml(query)}" 검색 결과 없음.` : "어휘 카드가 없습니다. 독해 모드에서 단어를 검색한 후 저장하세요."}
    </p>`;
    return;
  }

  const parts = [];
  for (const card of cards) {
    const langTag = card.lang === "bo" ? "Tib" : "Skt";
    const statusLabel = { new: "새 단어", learning: "학습 중", known: "완료" }[card.status] || card.status;
    const statusCls = "vocab-status-" + card.status;
    const date = new Date(card.ts).toLocaleDateString("ko-KR");

    parts.push(`<div class="vocab-card" data-id="${card.id}">
      <div class="vocab-card-header">
        <span class="vocab-headword">${escapeHtml(card.headword)}</span>
        <span class="vocab-lang-tag">${langTag}</span>
        <span class="vocab-status ${statusCls}" data-id="${card.id}">${statusLabel}</span>
        <span class="vocab-date">${date}</span>
      </div>
      <div class="vocab-card-meaning">${escapeHtml(card.meaning)}</div>
      ${card.context ? `<div class="vocab-card-context">${escapeHtml(card.context)}</div>` : ""}
      ${card.source ? `<div class="vocab-card-source">${escapeHtml(card.source)}${card.lineNum ? " (행 " + card.lineNum + ")" : ""}</div>` : ""}
      ${card.note ? `<div class="vocab-card-note">${escapeHtml(card.note)}</div>` : ""}
      <div class="vocab-card-actions">
        <select class="vocab-status-select" data-id="${card.id}">
          <option value="new"${card.status === "new" ? " selected" : ""}>새 단어</option>
          <option value="learning"${card.status === "learning" ? " selected" : ""}>학습 중</option>
          <option value="known"${card.status === "known" ? " selected" : ""}>완료</option>
        </select>
        <button class="vocab-note-btn" data-id="${card.id}" title="메모 편집">✏️</button>
        <button class="vocab-search-btn" data-term="${escapeHtml(card.headword)}" title="사전 검색">🔍</button>
        <button class="vocab-delete-btn" data-id="${card.id}" title="삭제">🗑️</button>
      </div>
    </div>`);
  }

  vocabList.innerHTML = parts.join("");
  wireVocabCardEvents();
}

function wireVocabCardEvents() {
  const vocabList = document.getElementById("vocab-list");

  // Status change
  vocabList.querySelectorAll(".vocab-status-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = parseInt(sel.dataset.id, 10);
      await window.Vocab.update(id, { status: sel.value });
      renderVocabList(document.getElementById("vocab-search").value.trim());
    });
  });

  // Delete
  vocabList.querySelectorAll(".vocab-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 카드를 삭제하시겠습니까?")) return;
      const id = parseInt(btn.dataset.id, 10);
      await window.Vocab.remove(id);
      renderVocabList(document.getElementById("vocab-search").value.trim());
    });
  });

  // Search in dict
  vocabList.querySelectorAll(".vocab-search-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const term = btn.dataset.term;
      q.value = term;
      switchMode("search");
      search();
    });
  });

  // Edit note
  vocabList.querySelectorAll(".vocab-note-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = parseInt(btn.dataset.id, 10);
      const card = btn.closest(".vocab-card");
      const existingNote = card.querySelector(".vocab-card-note")?.textContent || "";
      const newNote = prompt("메모:", existingNote);
      if (newNote === null) return; // cancelled
      await window.Vocab.update(id, { note: newNote });
      renderVocabList(document.getElementById("vocab-search").value.trim());
    });
  });
}

// Wire vocab toolbar events
(function wireVocabToolbar() {
  const vocabSearch = document.getElementById("vocab-search");
  if (vocabSearch) {
    let debounce = null;
    vocabSearch.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderVocabList(vocabSearch.value.trim()), 200);
    });
  }

  document.querySelectorAll(".vocab-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".vocab-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      vocabFilterStatus = btn.dataset.status;
      const q = document.getElementById("vocab-search");
      renderVocabList(q ? q.value.trim() : "");
    });
  });

  const exportBtn = document.getElementById("vocab-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      const cards = await window.Vocab.exportAll();
      const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vocab_cards_" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const importBtn = document.getElementById("vocab-import");
  const importFile = document.getElementById("vocab-import-file");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async () => {
      const file = importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const cards = JSON.parse(text);
        if (!Array.isArray(cards)) throw new Error("JSON 배열이 아닙니다");
        const count = await window.Vocab.importCards(cards);
        alert(`${count}개 카드를 가져왔습니다.`);
        renderVocabList();
      } catch (e) {
        alert("가져오기 실패: " + e.message);
      }
      importFile.value = "";
    });
  }
})();

// ── Initialize ───────────────────────────────────────────────────────

setStatus("사전 DB 초기화 중...");
Promise.all([
  window.Lookup.init(),
  window.Bilex ? window.Bilex.init() : Promise.resolve(),
  window.Reader ? window.Reader.init() : Promise.resolve(),
  window.Vocab ? window.Vocab.init() : Promise.resolve(),
]).then(() => {
  const n = Object.keys(window.Lookup.dicts()).length;
  setStatus(`${n}개 사전 + 대역어 DB 준비 완료`);

  // Render file tree
  if (window.Reader) {
    renderFileTree();
  }

  // Handle URL hash for deep linking
  const hash = window.location.hash;
  if (hash.startsWith("#reader")) {
    switchMode("reader");
    const path = hash.replace("#reader/", "").replace("#reader", "");
    if (path) openTextFile(path);
  } else if (hash === "#vocab") {
    switchMode("vocab");
  }
}).catch((e) => {
  console.error(e);
  setStatus("초기화 실패: " + e);
});
