// bilex.js — Trilingual lexicon lookup (Skt↔Tib↔Zh) via in-memory JSON index.
// Exposes window.Bilex = { init(), lookupTib(wylie), lookupSkt(iast), lookupZh(zh) }.
//
// Loads bilex_index.json at startup (~19MB raw, ~6MB gzipped).
// All lookups are instant O(1) hash-map reads — no HTTP Range requests.
//
// Index format:
//   s: source names array
//   e: entries array — each [skt_iast, tib_wylie, src_idx, category?, zh?, entry_num?]
//   k: skt_norm → [entry_indices]
//   t: tib_norm → [entry_indices]
//   z: zh_norm → [entry_indices]

(function () {
  let indexData = null; // loaded JSON index
  let initPromise = null;

  function normalize(s) {
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

  // Lookup by index key (skt_norm, tib_norm, or zh_norm)
  function lookup(indexMap, term, limit) {
    if (!indexData || !term) return [];
    const norm = normalize(term);
    if (!norm) return [];

    const sources = indexData.s;
    const entries = indexData.e;
    const results = [];
    const seen = new Set();

    // Exact match
    const exactIndices = indexMap[norm];
    if (exactIndices) {
      for (const i of exactIndices) {
        if (results.length >= limit) break;
        const e = entries[i];
        const key = `${(e[0] || "").toLowerCase()}|${(e[1] || "").toLowerCase()}|${e[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(toEntry(e, sources[e[2]], true));
        }
      }
    }

    // Prefix matches (scan nearby keys)
    if (results.length < limit) {
      const keys = Object.keys(indexMap);
      for (const k of keys) {
        if (k === norm) continue; // skip exact (already added)
        if (k.startsWith(norm) && results.length < limit) {
          for (const i of indexMap[k]) {
            if (results.length >= limit) break;
            const e = entries[i];
            const key = `${(e[0] || "").toLowerCase()}|${(e[1] || "").toLowerCase()}|${e[2]}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push(toEntry(e, sources[e[2]], false));
            }
          }
        }
      }
    }

    // Sort: exact first, then by source priority
    const SOURCE_ORDER = {
      mahavyutpatti: 0, "84000": 1, negi: 2, hopkins: 3,
      "lokesh-chandra": 4, "yogacarabhumi-idx": 5, "nti-reader": 6,
    };
    results.sort((a, b) => {
      if (b.exact !== a.exact) return b.exact - a.exact;
      const sa = SOURCE_ORDER[a.source] ?? 9;
      const sb = SOURCE_ORDER[b.source] ?? 9;
      return sa - sb;
    });

    return results;
  }

  async function lookupSkt(iast, opts = {}) {
    await init();
    return lookup(indexData.k, iast, opts.limit || 100);
  }

  async function lookupTib(wylie, opts = {}) {
    await init();
    return lookup(indexData.t, wylie, opts.limit || 100);
  }

  async function lookupZh(zh, opts = {}) {
    await init();
    return lookup(indexData.z, zh, opts.limit || 100);
  }

  window.Bilex = { init, lookupTib, lookupSkt, lookupZh, normalize };
})();
