// app.js — Phase 2.5 UI: 4-zone results + tier grouping + progressive disclosure.

const q = document.getElementById("q");
const go = document.getElementById("go");
const results = document.getElementById("results");
const sidebar = document.getElementById("sidebar");
const status = document.getElementById("status");

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

// ── Initialize ───────────────────────────────────────────────────────

setStatus("\uc0ac\uc804 DB \ucd08\uae30\ud654 \uc911...");
Promise.all([
  window.Lookup.init(),
  window.Bilex ? window.Bilex.init() : Promise.resolve(),
]).then(() => {
  const n = Object.keys(window.Lookup.dicts()).length;
  setStatus(`${n}\uac1c \uc0ac\uc804 + \ub300\uc5ed\uc5b4 DB \uc900\ube44 \uc644\ub8cc`);
}).catch((e) => {
  console.error(e);
  setStatus("\ucd08\uae30\ud654 \uc2e4\ud328: " + e);
});
