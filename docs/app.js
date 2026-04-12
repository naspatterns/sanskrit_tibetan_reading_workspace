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
      if (p.version === 1
          && Array.isArray(p.pinnedDicts)
          && Array.isArray(p.hiddenGroups)) {
        return p;
      }
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Validate CSS color value (hex only) to prevent CSS injection
function safeColor(c) {
  return /^#[0-9a-fA-F]{3,6}$/.test(c) ? c : "#999";
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
        const numTag = r.entry_num != null ? ` <span class="bilex-num">[Mvy ${r.entry_num}]</span>` : "";
        return `${skt} <span class="bilex-arrow">\u2194</span> ${tib}${numTag}`;
      });
      parts.push(`<div class="qa-bilex">${items.join(" \u00b7 ")}</div>`);
    }
  }

  // Summary lines from each dict
  parts.push(`<div class="qa-lines">`);
  for (const [dict, r] of summaryEntries) {
    const meta = window.DictNames.label(dict);
    const shortLabel = meta.label.replace(/\s*\(.*\)$/, "").replace(/Skt\u2192|Eng\u2192/, "");
    const bodyText = (r.body_ko || r.body || "").replace(/\n/g, " ").trim();
    const snippet = bodyText.length > 150 ? bodyText.slice(0, 150) + "\u2026" : bodyText;
    const groupColor = window.DictNames.DISPLAY_GROUPS[window.DictNames.getDisplayGroupIndex(meta)]?.color || "#999";
    parts.push(
      `<div class="qa-line" data-dict="${escapeHtml(dict)}">
         <span class="qa-dict-tag" style="border-color:${safeColor(groupColor)}">${escapeHtml(shortLabel)}</span>
         <span class="qa-snippet">${escapeHtml(snippet)}</span>
       </div>`
    );
  }
  parts.push(`</div>`);

  parts.push(`<div class="qa-stats">${dictFirst.size}\uac1c \uc0ac\uc804\uc5d0\uc11c \ubc1c\uacac</div>`);
  parts.push(`</section>`);
  return parts.join("");
}

// ── Zone B: Multilingual equivalents (multi-source) ─────────────────

function renderZoneB(bilexRows) {
  if (!bilexRows || !bilexRows.length) return "";

  // Group by source for organized display
  const exactRows = bilexRows.filter((r) => r.exact);
  const partialRows = bilexRows.filter((r) => !r.exact);

  const parts = [];
  parts.push(`<section id="bilex-section" class="bilex-block">`);
  parts.push(`<h2 class="bilex-header">\ub300\uc5ed\uc5b4 \u00b7 Equivalents <span class="bilex-count">${bilexRows.length}\uac74</span></h2>`);

  // Exact matches — prominent display
  if (exactRows.length) {
    parts.push(`<div class="bilex-exact-group">`);
    for (const r of exactRows) {
      parts.push(renderEquivEntry(r));
    }
    parts.push(`</div>`);
  }

  // Partial matches — collapsible
  if (partialRows.length) {
    const showInitial = Math.min(partialRows.length, 10);
    parts.push(`<div class="bilex-partial-group">`);
    if (exactRows.length) {
      parts.push(`<div class="bilex-partial-label">\uad00\ub828 \ub300\uc5ed\uc5b4 (${partialRows.length}\uac74)</div>`);
    }
    for (let i = 0; i < partialRows.length; i++) {
      const hiddenCls = i >= showInitial ? " bilex-hidden" : "";
      parts.push(renderEquivEntry(partialRows[i], hiddenCls));
    }
    if (partialRows.length > showInitial) {
      parts.push(`<button class="bilex-more-btn">\ub098\uba38\uc9c0 ${partialRows.length - showInitial}\uac74 \ubcf4\uae30</button>`);
    }
    parts.push(`</div>`);
  }

  parts.push(`</section>`);
  return parts.join("");
}

function renderEquivEntry(r, extraCls) {
  const SOURCE_LABELS = {
    mahavyutpatti: "Mvy", negi: "Negi", "lokesh-chandra": "LCh",
    "84000": "84K", hopkins: "Hop", "yogacarabhumi-idx": "YBh", "nti-reader": "NTI",
  };
  const exactCls = r.exact ? " bilex-exact" : "";
  const cls = `bilex-entry${exactCls}${extraCls || ""}`;
  const parts = [];
  parts.push(`<div class="${cls}">`);

  // Source tag
  const srcLabel = SOURCE_LABELS[r.source] || r.source;
  parts.push(`<span class="bilex-src" title="${escapeHtml(r.source)}">${escapeHtml(srcLabel)}</span>`);

  // Mvy entry number (only for Mahāvyutpatti)
  if (r.entry_num != null) {
    parts.push(`<span class="bilex-num">[${r.entry_num}]</span>`);
  }

  // Sanskrit
  if (r.skt_iast) {
    parts.push(` <a class="bilex-link bilex-skt" data-term="${escapeHtml(r.skt_iast)}">${escapeHtml(r.skt_iast)}</a>`);
  }
  parts.push(` <span class="bilex-arrow">\u2194</span> `);
  // Tibetan
  if (r.tib_wylie) {
    parts.push(`<a class="bilex-link bilex-tib" data-term="${escapeHtml(r.tib_wylie)}">${escapeHtml(r.tib_wylie)}</a>`);
  }
  // Chinese (漢文)
  if (r.zh) {
    parts.push(` · <span class="bilex-zh">${escapeHtml(r.zh)}</span>`);
  }
  // Category
  if (r.category) {
    parts.push(` <span class="bilex-cat">${escapeHtml(r.category)}</span>`);
  }

  parts.push(`</div>`);
  return parts.join("");
}

// ── Zone C: Exact match full entries by display group ────────────────

function renderBody(s, maxLen) {
  const text = maxLen && s.length > maxLen ? s.slice(0, maxLen) + " \u2026" : s;
  return escapeHtml(text).replace(/\n/g, "<br>");
}

// Group dicts within a display group by family, returning ordered render items
function buildFamilyGroups(dicts) {
  const familyMap = new Map(); // family -> [{dict, data}]
  const familyEmitted = new Set();
  const SOURCE_PRIO = { xdxf: 0, apple: 1, sandic: 2, gretil: 3 };

  for (const [dict, data] of dicts) {
    const family = data.meta.family;
    if (family) {
      if (!familyMap.has(family)) familyMap.set(family, []);
      familyMap.get(family).push({ dict, data });
    }
  }

  // Sort within each family: lowest tier first, then source priority
  for (const [, members] of familyMap) {
    members.sort((a, b) => {
      if (a.data.meta.tier !== b.data.meta.tier) return a.data.meta.tier - b.data.meta.tier;
      const sa = SOURCE_PRIO[a.data.meta.source] ?? 9;
      const sb = SOURCE_PRIO[b.data.meta.source] ?? 9;
      return sa - sb;
    });
  }

  // Build: iterate in original order, emit family group at first encounter
  const result = [];
  for (const [dict, data] of dicts) {
    const family = data.meta.family;
    if (family) {
      if (!familyEmitted.has(family)) {
        familyEmitted.add(family);
        const members = familyMap.get(family);
        if (members.length === 1) {
          result.push({ type: "single", dict: members[0].dict, data: members[0].data });
        } else {
          result.push({ type: "family", family, members });
        }
      }
    } else {
      result.push({ type: "single", dict, data });
    }
  }
  return result;
}

function renderFamilyBlock(family, members, groupColor) {
  const primary = members[0];
  const alternates = members.slice(1);
  const totalAltItems = alternates.reduce((s, m) => s + m.data.items.length, 0);

  const parts = [];
  parts.push(renderDictBlock(primary.dict, primary.data, groupColor));

  if (alternates.length) {
    const familyId = cssId(family);
    parts.push(`<div class="family-alt-toggle" data-family="${familyId}">`);
    parts.push(`<button class="family-alt-btn">▸ 다른 소스 ${alternates.length}개 (${totalAltItems}건)</button>`);
    parts.push(`</div>`);
    parts.push(`<div class="family-alt-content" data-family="${familyId}" style="display:none">`);
    for (const alt of alternates) {
      parts.push(renderDictBlock(alt.dict, alt.data, groupColor));
    }
    parts.push(`</div>`);
  }

  return parts.join("");
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
    const tier12 = [];
    const tier3 = [];
    for (const [dict, data] of g.dicts) {
      if (data.meta.tier <= 2 || isPinned(dict)) tier12.push([dict, data]);
      else tier3.push([dict, data]);
    }

    const hidden = isGroupHidden(g.id);

    parts.push(`<div class="display-group${hidden ? " dg-hidden" : ""}" data-group-id="${g.id}">`);
    parts.push(`<h2 class="dg-header" style="border-left-color:${safeColor(g.color)}">${g.name}</h2>`);

    // Tier 1-2 dicts with family grouping
    const renderItems = buildFamilyGroups(tier12);
    for (const item of renderItems) {
      if (item.type === "family") {
        parts.push(renderFamilyBlock(item.family, item.members, g.color));
      } else {
        parts.push(renderDictBlock(item.dict, item.data, g.color));
      }
    }

    // Tier 3 dicts behind "show more"
    if (tier3.length) {
      const tier3Count = tier3.reduce((s, [, d]) => s + d.items.length, 0);
      parts.push(`<div class="tier3-toggle" data-group="${g.id}">`);
      parts.push(`<button class="tier3-btn">${tier3.length}개 사전 더 보기 (${tier3Count}건)</button>`);
      parts.push(`</div>`);
      parts.push(`<div class="tier3-content" data-group="${g.id}" style="display:none">`);
      const tier3Items = buildFamilyGroups(tier3);
      for (const item of tier3Items) {
        if (item.type === "family") {
          parts.push(renderFamilyBlock(item.family, item.members, g.color));
        } else {
          parts.push(renderDictBlock(item.dict, item.data, g.color));
        }
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
  const borderStyle = meta.tier <= 2 ? `border-left: ${meta.tier === 1 ? 3 : 1}px solid ${safeColor(groupColor)}` : "";

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
      const koLine = it.body_ko
        ? `<div class="body-ko">${renderBody(it.body_ko)}</div>` : "";
      const bodyHtml = it.body_ko
        ? `<details class="body-orig-toggle"><summary>원문 보기</summary><div class="body">${renderBody(it.body)}</div></details>`
        : `<div class="body">${renderBody(it.body)}</div>`;
      parts.push(
        `<div class="entry exact">
           <div class="head">${escapeHtml(it.headword)}</div>
           ${koLine}${bodyHtml}
         </div>`
      );
    }
    parts.push(`</div>`);
  }

  parts.push(`</section>`);
  return parts.join("");
}

// ── Zone D: Partial match headword list ──────────────────────────────

let zdAllItems = [];
const ZD_PAGE_SIZE = 100;

function renderZoneD(partialHeadwords) {
  if (!partialHeadwords.length) return "";
  zdAllItems = partialHeadwords;
  const total = partialHeadwords.length;
  const show = Math.min(ZD_PAGE_SIZE, total);

  const parts = [];
  parts.push(`<section class="zone-d">`);
  parts.push(`<h2 class="zd-header">\uad00\ub828 \ud45c\uc81c\uc5b4 <span class="zd-count">(${total}\uac74)</span></h2>`);
  parts.push(`<div class="zd-list">`);

  for (let i = 0; i < show; i++) {
    const hw = partialHeadwords[i];
    const dictCount = hw.dicts.size;
    parts.push(
      `<a class="zd-word" data-term="${escapeHtml(hw.headword)}">${escapeHtml(hw.headword)}<sup class="zd-n">${dictCount}</sup></a>`
    );
  }

  parts.push(`</div>`);

  if (total > show) {
    parts.push(`<button class="zd-more" data-offset="${show}">\ub098\uba38\uc9c0 ${total - show}\uac1c \ub354 \ubcf4\uae30</button>`);
  }

  parts.push(`</section>`);
  return parts.join("");
}

function zdLoadMore(btn) {
  const offset = parseInt(btn.dataset.offset, 10) || 0;
  const total = zdAllItems.length;
  const end = Math.min(offset + ZD_PAGE_SIZE, total);
  const list = btn.previousElementSibling;

  const frag = document.createDocumentFragment();
  for (let i = offset; i < end; i++) {
    const hw = zdAllItems[i];
    const a = document.createElement("a");
    a.className = "zd-word";
    a.dataset.term = hw.headword;
    a.innerHTML = `${escapeHtml(hw.headword)}<sup class="zd-n">${hw.dicts.size}</sup>`;
    frag.appendChild(a);
  }
  list.appendChild(frag);

  if (end >= total) {
    btn.remove();
  } else {
    btn.dataset.offset = end;
    btn.textContent = `\ub098\uba38\uc9c0 ${total - end}\uac1c \ub354 \ubcf4\uae30`;
  }
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
      `<button class="filter-pill${active ? " active" : ""}" data-group-id="${g.id}" style="--pill-color:${safeColor(g.color)}">${g.name}</button>`
    );
  }
  parts.push(`</div>`);

  // Stats
  parts.push(`<div class="side-total">\ucd1d ${totalRows}\uac74</div>`);

  // Bilex link
  if (bilexRows && bilexRows.length) {
    const exactCount = bilexRows.filter((r) => r.exact).length;
    parts.push(`<div class="side-group-title">\ub300\uc5ed\uc5b4</div>`);
    parts.push(
      `<a class="side-link" href="#bilex-section">
         <span class="side-name">Skt \u2194 Tib${exactCount ? ` (\uc815\ud655 ${exactCount})` : ""}</span>
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
    parts.push(`<div class="side-group-title" style="border-left: 2px solid ${safeColor(g.color)}; padding-left: 6px">${g.name}</div>`);
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
    `<div id="zone-d-anchor"></div>`,
    renderZoneD(partialHeadwords),
    renderZoneC(displayGroups),
  ].join("");

  results.innerHTML = html;
  renderSidebar(displayGroups, rows.length, bilexRows, partialHeadwords.length);

  // Wire events
  wireCollapse();
  wireBilexLinks();
  wireBilexMore();
  wirePinButtons();
  wireTier3Toggles();
  wireFamilyToggles();
  wireZoneDLinks();
  wireZoneALinks();
  wireFilterPills();
}

// ── Event delegation (single listener per container) ─────────────────

// Results panel — handles collapse, pins, tier3, family toggles, Zone D links, Zone A links
results.addEventListener("click", (e) => {
  const target = e.target;

  // Pin button
  const pinBtn = target.closest(".pin-btn");
  if (pinBtn) {
    e.stopPropagation();
    togglePin(pinBtn.dataset.dict);
    lastRenderFn();
    return;
  }

  // Dict header collapse — toggle in-place without full re-render
  const dictHead = target.closest(".dict-head");
  if (dictHead) {
    const block = dictHead.closest(".dict-block");
    const entries = block.querySelector(".dict-entries");
    const arrow = dictHead.querySelector(".arrow");
    if (entries) {
      // Currently open → close
      entries.style.display = entries.style.display === "none" ? "" : "none";
      if (arrow) arrow.textContent = entries.style.display === "none" ? "\u25b8" : "\u25be";
    }
    return;
  }

  // Bilex link
  const bilexLink = target.closest(".bilex-link");
  if (bilexLink) {
    e.preventDefault();
    const term = bilexLink.dataset.term;
    if (term) { q.value = term; search(); }
    return;
  }

  // Bilex more button
  const bilexMore = target.closest(".bilex-more-btn");
  if (bilexMore) {
    const group = bilexMore.closest(".bilex-partial-group");
    if (group) {
      group.querySelectorAll(".bilex-hidden").forEach((el) => el.classList.remove("bilex-hidden"));
      bilexMore.style.display = "none";
    }
    return;
  }

  // Tier 3 toggle
  const tier3Btn = target.closest(".tier3-btn");
  if (tier3Btn) {
    const wrapper = tier3Btn.closest(".tier3-toggle");
    const content = wrapper.nextElementSibling;
    if (content && content.classList.contains("tier3-content")) {
      const visible = content.style.display !== "none";
      content.style.display = visible ? "none" : "block";
      tier3Btn.textContent = visible
        ? tier3Btn.textContent.replace("\uc811\uae30", "\ub354 \ubcf4\uae30").replace("\u25b4", "")
        : tier3Btn.textContent.replace("\ub354 \ubcf4\uae30", "\uc811\uae30");
    }
    return;
  }

  // Family alt toggle
  const familyBtn = target.closest(".family-alt-btn");
  if (familyBtn) {
    const wrapper = familyBtn.closest(".family-alt-toggle");
    const content = wrapper.nextElementSibling;
    if (content && content.classList.contains("family-alt-content")) {
      const visible = content.style.display !== "none";
      content.style.display = visible ? "none" : "block";
      familyBtn.textContent = familyBtn.textContent.replace(visible ? "\u25be" : "\u25b8", visible ? "\u25b8" : "\u25be");
    }
    return;
  }

  // Zone D word link
  const zdWord = target.closest(".zd-word");
  if (zdWord) {
    e.preventDefault();
    const term = zdWord.dataset.term;
    if (term) { q.value = term; search(); }
    return;
  }

  // Zone D "show more" — paginated append
  const zdMore = target.closest(".zd-more");
  if (zdMore) {
    zdLoadMore(zdMore);
    return;
  }

  // Zone A line → scroll to dict
  const qaLine = target.closest(".qa-line");
  if (qaLine) {
    const dict = qaLine.dataset.dict;
    const el = document.getElementById("dict-" + cssId(dict));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
});

// Sidebar — filter pills
sidebar.addEventListener("click", (e) => {
  const pill = e.target.closest(".filter-pill");
  if (pill) {
    const groupId = pill.dataset.groupId;
    toggleGroupFilter(groupId);
    const dg = document.querySelector(`.display-group[data-group-id="${groupId}"]`);
    if (dg) dg.classList.toggle("dg-hidden");
    pill.classList.toggle("active");
  }
});

// Legacy wiring stubs — kept for renderAll() compatibility (no-ops now)
function wireCollapse() {}
function wireBilexLinks() {}
function wireBilexMore() {}
function wirePinButtons() {}
function wireTier3Toggles() {}
function wireFamilyToggles() {}
function wireZoneDLinks() {}
function wireZoneALinks() {}
function wireFilterPills() {}

// ── Bilex merge helper ───────────────────────────────────────────────

function mergeBilexResults(...arrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of arrays) {
    for (const r of arr) {
      const key = `${(r.skt_iast || "").toLowerCase()}|${(r.tib_wylie || "").toLowerCase()}|${r.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }
  merged.sort((a, b) => (b.exact || 0) - (a.exact || 0));
  return merged;
}

// ── Search ───────────────────────────────────────────────────────────

async function search() {
  const term = q.value.trim();
  if (!term) return;
  closeAutocomplete();
  setStatus("\uac80\uc0c9 \uc911...");
  const t0 = performance.now();
  try {
    const isCJK = /[\u4e00-\u9fff]/.test(term);

    // ── Phase 1: Fast headword search (search.sqlite) + bilex ──
    const [rows, bilexTib, bilexSkt, bilexZh] = await Promise.all([
      window.Lookup.search(term, { limit: 500 }),
      window.Bilex ? window.Bilex.lookupTib(term) : [],
      window.Bilex ? window.Bilex.lookupSkt(term) : [],
      (window.Bilex && isCJK) ? window.Bilex.lookupZh(term) : [],
    ]);
    const bilexRows = mergeBilexResults(bilexTib, bilexSkt, bilexZh);

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
    const partialHeadwords = deduplicatePartial(partial);
    const displayGroups = groupExactByDisplayGroup(exact);

    // Render Zone B + Zone D immediately (no body needed)
    results.innerHTML = [
      `<div id="zone-a-container"></div>`,
      renderZoneB(bilexRows),
      `<div id="zone-d-anchor"></div>`,
      renderZoneD(partialHeadwords),
      `<div id="zone-c-container">${exact.length ? '<p class="hint">\uc0ac\uc804 \ubcf8\ubb38 \ub85c\ub529 \uc911...</p>' : ''}</div>`,
    ].join("");
    renderSidebar(displayGroups, rows.length, bilexRows, partialHeadwords.length);

    // ── Phase 2: Lazy body loading (dict.sqlite) for exact matches ──
    if (exact.length) {
      const exactIds = exact.map((r) => r.id);
      const bodies = await window.Lookup.fetchBodies(exactIds);
      const bodyMap = new Map(bodies.map((b) => [b.id, b]));
      for (const r of exact) {
        const b = bodyMap.get(r.id);
        if (b) { r.body = b.body; r.body_ko = b.body_ko; }
      }
      // Fill Zone A + Zone C with body data
      const zaEl = document.getElementById("zone-a-container");
      const zcEl = document.getElementById("zone-c-container");
      if (zaEl) zaEl.innerHTML = renderZoneA(exact, bilexRows, term);
      if (zcEl) zcEl.innerHTML = renderZoneC(displayGroups);
    }

    lastRenderFn = () => renderAll(rows, bilexRows, term);
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

  // Mobile lookup button: show only in reader mode
  const mLookupBtn = document.querySelector(".mobile-lookup-btn");
  if (mLookupBtn) mLookupBtn.style.display = (mode === "reader") ? "" : "none";

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

// ── Mobile lookup panel toggle ──────────────────────────────────────
(function () {
  const mBtn = document.querySelector(".mobile-lookup-btn");
  const mClose = document.querySelector(".mobile-lookup-close");
  const panel = document.getElementById("lookup-panel");
  if (!mBtn || !panel) return;

  mBtn.addEventListener("click", () => {
    panel.classList.add("mobile-open");
    mBtn.style.display = "none";
  });
  if (mClose) {
    mClose.addEventListener("click", () => {
      panel.classList.remove("mobile-open");
      mBtn.style.display = "";
    });
  }
})();

// ── Reader mode: lookup panel — delegated events ──────────────────

lookupResults.addEventListener("click", (e) => {
  const target = e.target;

  // Vocab save button
  const vocabBtn = target.closest(".vocab-save-btn");
  if (vocabBtn) {
    handleVocabSave(vocabBtn);
    return;
  }

  // Pin button
  const pinBtn = target.closest(".pin-btn");
  if (pinBtn) {
    e.stopPropagation();
    togglePin(pinBtn.dataset.dict);
    if (lastReaderTerm) readerSearch(lastReaderTerm);
    return;
  }

  // Dict header collapse — in-place toggle
  const dictHead = target.closest(".dict-head");
  if (dictHead) {
    const block = dictHead.closest(".dict-block");
    const entries = block.querySelector(".dict-entries");
    const arrow = dictHead.querySelector(".arrow");
    if (entries) {
      entries.style.display = entries.style.display === "none" ? "" : "none";
      if (arrow) arrow.textContent = entries.style.display === "none" ? "\u25b8" : "\u25be";
    }
    return;
  }

  // Bilex link
  const bilexLink = target.closest(".bilex-link");
  if (bilexLink) {
    e.preventDefault();
    const t = bilexLink.dataset.term;
    if (t) readerSearch(t);
    return;
  }

  // Tier 3 toggle
  const tier3Btn = target.closest(".tier3-btn");
  if (tier3Btn) {
    const wrapper = tier3Btn.closest(".tier3-toggle");
    const content = wrapper.nextElementSibling;
    if (content && content.classList.contains("tier3-content")) {
      const visible = content.style.display !== "none";
      content.style.display = visible ? "none" : "block";
    }
    return;
  }

  // Family alt toggle
  const familyBtn = target.closest(".family-alt-btn");
  if (familyBtn) {
    const wrapper = familyBtn.closest(".family-alt-toggle");
    const content = wrapper.nextElementSibling;
    if (content && content.classList.contains("family-alt-content")) {
      const visible = content.style.display !== "none";
      content.style.display = visible ? "none" : "block";
      familyBtn.textContent = familyBtn.textContent.replace(visible ? "\u25be" : "\u25b8", visible ? "\u25b8" : "\u25be");
    }
    return;
  }

  // Zone A line → scroll to dict
  const qaLine = target.closest(".qa-line");
  if (qaLine) {
    const dict = qaLine.dataset.dict;
    const el = lookupResults.querySelector("#dict-" + cssId(dict));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
});

// ── Reader mode: lookup in side panel ───────────────────────────────

async function readerSearch(term) {
  if (!term) return;
  lastReaderTerm = term;
  q.value = term;
  lookupResults.innerHTML = `<p class="hint">\uac80\uc0c9 \uc911...</p>`;

  try {
    const isCJK2 = /[\u4e00-\u9fff]/.test(term);
    const [rows, bilexTib, bilexSkt, bilexZh2] = await Promise.all([
      window.Lookup.search(term, { limit: 500 }),
      window.Bilex ? window.Bilex.lookupTib(term) : [],
      window.Bilex ? window.Bilex.lookupSkt(term) : [],
      (window.Bilex && isCJK2) ? window.Bilex.lookupZh(term) : [],
    ]);
    const bilexRows = mergeBilexResults(bilexTib, bilexSkt, bilexZh2);

    if (!rows.length && !bilexRows.length) {
      lookupResults.innerHTML = `<p class="hint"><b>${escapeHtml(term)}</b> \u2014 \uacb0\uacfc \uc5c6\uc74c.</p>`;
      return;
    }

    const { exact, partial } = classifyRows(rows);
    const displayGroups = groupExactByDisplayGroup(exact);

    // Phase 1: render with placeholder for body-dependent zones
    lookupResults.innerHTML = [
      renderVocabSaveBtn(term, ""),
      `<div id="reader-za-container"></div>`,
      renderZoneB(bilexRows),
      `<div id="reader-zc-container">${exact.length ? '<p class="hint">\ubcf8\ubb38 \ub85c\ub529 \uc911...</p>' : ''}</div>`,
    ].join("");

    // Phase 2: fetch bodies for exact matches
    if (exact.length) {
      const exactIds = exact.map((r) => r.id);
      const bodies = await window.Lookup.fetchBodies(exactIds);
      const bodyMap = new Map(bodies.map((b) => [b.id, b]));
      for (const r of exact) {
        const b = bodyMap.get(r.id);
        if (b) { r.body = b.body; r.body_ko = b.body_ko; }
      }

      // Update vocab save button with meaning from body
      const meaningSnippets = [];
      for (const r of exact.slice(0, 3)) {
        const body = (r.body_ko || r.body || "").replace(/\n/g, " ").trim();
        if (body) meaningSnippets.push(body.length > 80 ? body.slice(0, 80) + "\u2026" : body);
      }
      const vocabBtn = lookupResults.querySelector(".vocab-save-btn");
      if (vocabBtn) vocabBtn.dataset.meaning = meaningSnippets.join(" / ");

      const zaEl = lookupResults.querySelector("#reader-za-container");
      const zcEl = lookupResults.querySelector("#reader-zc-container");
      if (zaEl) zaEl.innerHTML = renderZoneA(exact, bilexRows, term);
      if (zcEl) zcEl.innerHTML = renderZoneC(displayGroups);
    }
  } catch (e) {
    console.error(e);
    lookupResults.innerHTML = `<p class="hint error">\uc624\ub958: ${escapeHtml(String(e))}</p>`;
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
      // Auto-open lookup panel on mobile
      const panel = document.getElementById("lookup-panel");
      const mBtn = document.querySelector(".mobile-lookup-btn");
      if (panel && mBtn && window.innerWidth <= 700) {
        panel.classList.add("mobile-open");
        mBtn.style.display = "none";
      }
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

async function handleVocabSave(btn) {
  const term = btn.dataset.term;
  const meaning = btn.dataset.meaning;
  const path = window.Reader ? window.Reader.getCurrentPath() : "";
  const lang = path ? window.Reader.detectLang(path) : "sa";

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
}

// Vocab list — delegated events (H6 + M9)
(function wireVocabListDelegation() {
  const vocabList = document.getElementById("vocab-list");
  if (!vocabList) return;

  const STATUS_LABELS = { new: "새 단어", learning: "학습 중", known: "완료" };

  vocabList.addEventListener("click", async (e) => {
    const target = e.target;

    // Delete
    const delBtn = target.closest(".vocab-delete-btn");
    if (delBtn) {
      if (!confirm("이 카드를 삭제하시겠습니까?")) return;
      const id = parseInt(delBtn.dataset.id, 10);
      await window.Vocab.remove(id);
      const card = delBtn.closest(".vocab-card");
      if (card) card.remove();
      return;
    }

    // Search in dict
    const searchBtn = target.closest(".vocab-search-btn");
    if (searchBtn) {
      const term = searchBtn.dataset.term;
      q.value = term;
      switchMode("search");
      search();
      return;
    }

    // Edit note — update in-place
    const noteBtn = target.closest(".vocab-note-btn");
    if (noteBtn) {
      const id = parseInt(noteBtn.dataset.id, 10);
      const card = noteBtn.closest(".vocab-card");
      const existingNote = card.querySelector(".vocab-card-note")?.textContent || "";
      const newNote = prompt("메모:", existingNote);
      if (newNote === null) return;
      await window.Vocab.update(id, { note: newNote });
      let noteEl = card.querySelector(".vocab-card-note");
      if (newNote) {
        if (!noteEl) {
          noteEl = document.createElement("div");
          noteEl.className = "vocab-card-note";
          card.querySelector(".vocab-card-actions").before(noteEl);
        }
        noteEl.textContent = newNote;
      } else if (noteEl) {
        noteEl.remove();
      }
      return;
    }
  });

  // Status change (select) — update badge in-place
  vocabList.addEventListener("change", async (e) => {
    const sel = e.target.closest(".vocab-status-select");
    if (!sel) return;
    const id = parseInt(sel.dataset.id, 10);
    const newStatus = sel.value;
    await window.Vocab.update(id, { status: newStatus });
    const card = sel.closest(".vocab-card");
    const badge = card.querySelector(".vocab-status");
    if (badge) {
      badge.className = "vocab-status vocab-status-" + newStatus;
      badge.textContent = STATUS_LABELS[newStatus] || newStatus;
    }
  });
})();

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
        const raw = JSON.parse(text);
        if (!Array.isArray(raw)) throw new Error("JSON 배열이 아닙니다");
        const MAX_CARDS = 10000;
        const MAX_FIELD = 10000;
        if (raw.length > MAX_CARDS) throw new Error(`카드 수 초과 (최대 ${MAX_CARDS}개)`);
        const clamp = (s, max) => String(s || "").slice(0, max);
        const cards = raw.map(c => ({
          headword: clamp(c.headword, MAX_FIELD),
          meaning: clamp(c.meaning, MAX_FIELD),
          lang: clamp(c.lang || "sa", 10),
          source: clamp(c.source, 200),
          lineNum: c.lineNum || null,
          context: clamp(c.context, MAX_FIELD),
          note: clamp(c.note, MAX_FIELD),
          status: ["new","learning","known"].includes(c.status) ? c.status : "new",
          ts: typeof c.ts === "number" ? c.ts : Date.now(),
        }));
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

// Timeout wrapper — DB 로딩이 30초 이상 걸리면 실패 처리
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 로딩 시간 초과 (${ms / 1000}초)`)), ms)
    ),
  ]);
}

const DB_TIMEOUT = 60000;

Promise.all([
  withTimeout(window.Lookup.init(), DB_TIMEOUT, "\uac80\uc0c9 \uc778\ub371\uc2a4 DB"),
  window.Bilex ? withTimeout(window.Bilex.init(), DB_TIMEOUT, "\ub300\uc5ed\uc5b4 DB") : Promise.resolve(),
  window.Reader ? window.Reader.init() : Promise.resolve(),
  window.Vocab ? window.Vocab.init() : Promise.resolve(),
]).then(() => {
  const n = Object.keys(window.Lookup.dicts()).length;
  setStatus(`${n}\uac1c \uc0ac\uc804 + \ub300\uc5ed\uc5b4 DB \uc900\ube44 \uc644\ub8cc`);

  // Render file tree
  if (window.Reader) {
    renderFileTree();
  }

  // Handle URL hash for deep linking
  // NOTE: 독해/어휘 모드는 v2에서 활성화 예정. hash 딥링크도 비활성화.
  // const hash = window.location.hash;
  // if (hash.startsWith("#reader")) {
  //   switchMode("reader");
  //   const rawPath = hash.replace("#reader/", "").replace("#reader", "");
  //   const path = decodeURIComponent(rawPath);
  //   if (path && !path.includes("..") && !path.startsWith("/")) openTextFile(path);
  // } else if (hash === "#vocab") {
  //   switchMode("vocab");
  // }
}).catch((e) => {
  console.error("초기화 실패:", e);
  const msg = e.message || String(e);
  if (msg.includes("시간 초과")) {
    setStatus("DB 로딩 실패 — 서버에서 데이터베이스 파일을 찾을 수 없습니다.");
    results.innerHTML = `
      <div class="init-error">
        <h3>데이터베이스 로딩 실패</h3>
        <p>사전 DB 파일(dict.sqlite, bilex.sqlite)을 서버에서 불러올 수 없습니다.</p>
        <p><strong>로컬 실행 시:</strong> <code>python3 scripts/serve.py 8000</code> 으로 서버를 시작하세요.</p>
        <p><strong>온라인 배포 시:</strong> DB 파일이 올바른 경로에 호스팅되어 있는지 확인하세요.</p>
      </div>`;
  } else {
    setStatus("\ucd08\uae30\ud654 \uc2e4\ud328: " + msg);
  }
});

// ── Autocomplete ────────────────────────────────────────────────────

let acIndex = null; // sorted array of unique headword_norm strings
let acHighlight = -1;

// Load autocomplete index (runs in parallel with DB init)
fetch("headwords.json")
  .then((r) => { if (r.ok) return r.json(); throw new Error(r.status); })
  .then((arr) => { acIndex = arr; })
  .catch((e) => console.warn("Autocomplete index not loaded:", e));

function acNormalize(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

// Binary search: find first index where acIndex[i] >= prefix
function acLowerBound(prefix) {
  let lo = 0, hi = acIndex.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (acIndex[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function acSearch(prefix, limit) {
  if (!acIndex || !prefix) return [];
  limit = limit || 10;
  const norm = acNormalize(prefix);
  if (!norm) return [];
  const start = acLowerBound(norm);
  const results = [];
  for (let i = start; i < acIndex.length && results.length < limit; i++) {
    if (acIndex[i].startsWith(norm)) results.push(acIndex[i]);
    else break;
  }
  return results;
}

function getAcList() {
  return document.getElementById("autocomplete-list");
}

function closeAutocomplete() {
  const list = getAcList();
  if (list) list.style.display = "none";
  acHighlight = -1;
}

function renderAutocomplete(matches) {
  const list = getAcList();
  if (!list || !matches.length) { closeAutocomplete(); return; }
  const input = acNormalize(q.value);
  list.innerHTML = matches.map((m, i) => {
    // Highlight the matching prefix portion
    const matchLen = input.length;
    const bold = escapeHtml(m.slice(0, matchLen));
    const rest = escapeHtml(m.slice(matchLen));
    return `<li class="ac-item${i === acHighlight ? " ac-active" : ""}" data-term="${escapeHtml(m)}"><b>${bold}</b>${rest}</li>`;
  }).join("");
  list.style.display = "block";
}

// Autocomplete on input
let acTimer = null;
q.addEventListener("input", () => {
  clearTimeout(acTimer);
  acTimer = setTimeout(() => {
    const val = q.value.trim();
    if (val.length < 2) { closeAutocomplete(); return; }
    const matches = acSearch(val, 10);
    acHighlight = -1;
    renderAutocomplete(matches);
  }, 150);
});

// Keyboard navigation
q.addEventListener("keydown", (e) => {
  const list = getAcList();
  if (!list || list.style.display === "none") return;
  const items = list.querySelectorAll(".ac-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    acHighlight = Math.min(acHighlight + 1, items.length - 1);
    items.forEach((li, i) => li.classList.toggle("ac-active", i === acHighlight));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    acHighlight = Math.max(acHighlight - 1, 0);
    items.forEach((li, i) => li.classList.toggle("ac-active", i === acHighlight));
  } else if (e.key === "Enter" && acHighlight >= 0) {
    e.preventDefault();
    q.value = items[acHighlight].dataset.term;
    closeAutocomplete();
    search();
  } else if (e.key === "Escape") {
    closeAutocomplete();
  }
});

// Click on autocomplete item
document.addEventListener("click", (e) => {
  const item = e.target.closest(".ac-item");
  if (item) {
    q.value = item.dataset.term;
    closeAutocomplete();
    search();
    return;
  }
  // Close on outside click
  if (!e.target.closest("#search-section")) closeAutocomplete();
});
