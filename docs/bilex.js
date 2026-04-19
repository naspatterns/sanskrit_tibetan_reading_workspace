// bilex.js — Trilingual lexicon lookup (Skt↔Tib↔Zh) via in-memory JSON index.
// Exposes window.Bilex = { init(), lookupTib(wylie), lookupSkt(iast), lookupZh(zh) }.
//
// Loads bilex_index.json at startup (~25MB raw, ~6MB gzipped).
// All lookups are instant:
//   - exact match: O(1) hash-map lookup
//   - prefix match: O(log N + K) binary search on pre-sorted keys
// Source priority is derived from indexData.s array order (set at build time),
// so new sources get a deterministic position without code changes.
//
// Index format:
//   s: source names array (order = priority)
//   e: entries array — each [skt_iast, tib_wylie, src_idx, category?, zh?, entry_num?]
//   k: skt_norm → [entry_indices]
//   t: tib_norm → [entry_indices]
//   z: zh_norm → [entry_indices]

(function () {
  let indexData = null; // loaded JSON index
  let initPromise = null;
  // Pre-sorted key arrays for binary-search prefix scanning
  let sortedKeys = null; // { k: [], t: [], z: [] }

  // Full normalization: detect script → IAST → NFD + strip + lowercase.
  // Matches Python transliterate.normalize_headword() so user input in any
  // of IAST/HK/Devanagari resolves to the same index key.
  function normalize(s) {
    if (!s) return "";
    if (window.Translit) return window.Translit.normalizeHeadword(s);
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = fetch("bilex_index.json")
      .then((r) => {
        if (!r.ok) throw new Error("bilex_index.json: " + r.status);
        return r.json();
      })
      .then((data) => {
        indexData = data;
        // Pre-sort keys once — subsequent prefix scans are O(log N + K)
        sortedKeys = {
          k: Object.keys(data.k).sort(),
          t: Object.keys(data.t).sort(),
          z: Object.keys(data.z).sort(),
        };
      });
    return initPromise;
  }

  // Convert raw entry array to display object
  function toEntry(e, source, exact) {
    return {
      skt_iast: e[0] || "",
      tib_wylie: e[1] || "",
      source: source,
      category: e[3] || "",
      zh: e[4] || "",
      entry_num: e.length > 5 ? e[5] : null,
      exact: exact ? 1 : 0,
    };
  }

  // Binary search: first index where sortedArr[i] >= target
  function lowerBound(sortedArr, target) {
    let lo = 0, hi = sortedArr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedArr[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Lookup by index key type.
   * @param {'k'|'t'|'z'} keyType - k=skt_norm, t=tib_norm, z=zh_norm
   * @param {string} term - Raw user input (gets normalized).
   * @param {number} limit - Max results. Clamped to [1, 1000].
   * @returns {object[]} Merged results with source priority applied.
   */
  function lookup(keyType, term, limit) {
    if (!indexData || !term) return [];
    limit = Math.max(1, Math.min(limit || 100, 1000));
    const norm = normalize(term);
    if (!norm) return [];

    const indexMap = indexData[keyType];
    const sortedArr = sortedKeys[keyType];
    const sources = indexData.s;
    const entries = indexData.e;
    const results = [];
    const seen = new Set();

    function makeKey(e) {
      return `${(e[0] || "").toLowerCase()}|${(e[1] || "").toLowerCase()}|${e[2]}`;
    }

    // Exact match — O(1) hash lookup
    const exactIndices = indexMap[norm];
    if (exactIndices) {
      for (const i of exactIndices) {
        if (results.length >= limit) break;
        const e = entries[i];
        const key = makeKey(e);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(toEntry(e, sources[e[2]], true));
        }
      }
    }

    // Prefix matches — O(log N) seek + linear walk while startsWith
    if (results.length < limit) {
      const start = lowerBound(sortedArr, norm);
      for (let i = start; i < sortedArr.length && results.length < limit; i++) {
        const k = sortedArr[i];
        if (!k.startsWith(norm)) break;
        if (k === norm) continue; // already handled as exact
        for (const ei of indexMap[k]) {
          if (results.length >= limit) break;
          const e = entries[ei];
          const key = makeKey(e);
          if (!seen.has(key)) {
            seen.add(key);
            results.push(toEntry(e, sources[e[2]], false));
          }
        }
      }
    }

    // Sort: exact first, then by source priority (indexData.s array order).
    // Unknown sources get +Infinity priority so they sort last but stably.
    const priority = (src) => {
      const idx = sources.indexOf(src);
      return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
    };
    results.sort((a, b) => {
      if (b.exact !== a.exact) return b.exact - a.exact;
      return priority(a.source) - priority(b.source);
    });

    return results;
  }

  async function lookupSkt(iast, opts = {}) {
    await init();
    return lookup("k", iast, opts.limit || 100);
  }

  async function lookupTib(wylie, opts = {}) {
    await init();
    return lookup("t", wylie, opts.limit || 100);
  }

  async function lookupZh(zh, opts = {}) {
    await init();
    return lookup("z", zh, opts.limit || 100);
  }

  window.Bilex = { init, lookupTib, lookupSkt, lookupZh, normalize };
})();
