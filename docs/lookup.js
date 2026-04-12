// lookup.js — Hybrid search: in-memory index + lazy DB body loading.
//
// Phase 0 (instant): headwords.json in-memory → partial matches for Zone D
// Phase 1 (fast):    search.sqlite B-tree → exact match entries (id, dict)
// Phase 2 (lazy):    dict.sqlite → full body/body_ko on demand
//
// Exposes window.Lookup = { init(), searchExact(term), searchPartial(prefix, limit),
//   fetchBodies(ids), dicts(), normalize() }.

(function () {
  let searchWorkerPromise = null;
  let contentWorkerPromise = null;
  let dictMeta = null; // {name -> {id, lang}}
  let acIndex = null; // sorted headword_norm array (loaded from headwords.json)

  // DB URLs: local symlinks for dev, HuggingFace CDN for production
  const HF_BASE =
    "https://huggingface.co/datasets/naspatterns/sanskrit-tibetan-dict/resolve/main/";

  function isLocal() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  function getSearchUrl() {
    return isLocal()
      ? "../search.sqlite?v=" + Date.now()
      : HF_BASE + "search.sqlite";
  }

  function getDictUrl() {
    return isLocal()
      ? "../dict.sqlite?v=" + Date.now()
      : HF_BASE + "dict.sqlite";
  }

  // ── In-memory index (headwords.json) ──
  function loadHeadwords() {
    return fetch("headwords.json")
      .then((r) => { if (r.ok) return r.json(); throw new Error(r.status); })
      .then((arr) => { acIndex = arr; })
      .catch((e) => console.warn("Headword index not loaded:", e));
  }

  // Binary search: first index where acIndex[i] >= prefix
  function lowerBound(prefix) {
    let lo = 0, hi = acIndex.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (acIndex[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // In-memory prefix search — instant, no DB needed
  function searchPartial(prefix, limit) {
    if (!acIndex || !prefix) return [];
    limit = limit || 200;
    const norm = normalize(prefix);
    if (!norm) return [];
    const start = lowerBound(norm);
    const results = [];
    for (let i = start; i < acIndex.length && results.length < limit; i++) {
      if (acIndex[i].startsWith(norm)) {
        // Skip exact match — that comes from DB with full metadata
        if (acIndex[i] !== norm) results.push(acIndex[i]);
      } else break;
    }
    return results;
  }

  // Check if exact headword exists in memory index
  function hasExact(term) {
    if (!acIndex) return false;
    const norm = normalize(term);
    const idx = lowerBound(norm);
    return idx < acIndex.length && acIndex[idx] === norm;
  }

  // ── Worker 1: Search index (loaded on first search) ──
  async function init() {
    // Start headword loading immediately (non-blocking)
    loadHeadwords();
    if (searchWorkerPromise) return searchWorkerPromise;
    searchWorkerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: getSearchUrl(),
            requestChunkSize: 262144, // 256KB
          },
        },
      ],
      "vendor/sqlite.worker.js",
      "sql-wasm.wasm"
    );
    const w = await searchWorkerPromise;
    const rows = await w.db.query("SELECT id, name, lang FROM dictionaries");
    dictMeta = {};
    for (const r of rows) dictMeta[r.name] = { id: r.id, lang: r.lang };
    // Pre-warm B-tree index
    w.db.query("SELECT 1 FROM entries WHERE headword_norm = 'a' LIMIT 1");
    return w;
  }

  // ── Worker 2: Content DB (lazy, only when body needed) ──
  async function initContent() {
    if (contentWorkerPromise) return contentWorkerPromise;
    contentWorkerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: getDictUrl(),
            requestChunkSize: 1048576, // 1MB chunks for large DB
          },
        },
      ],
      "vendor/sqlite.worker.js",
      "sql-wasm.wasm"
    );
    return contentWorkerPromise;
  }

  // NFD + strip combining + lowercase. Matches build_dict_db.normalize.
  function normalize(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  }

  // ── Phase 1: Exact match search from search.sqlite ──
  // Only fetches rows where headword_norm exactly matches — minimal HTTP requests.
  async function searchExact(term, opts = {}) {
    const limit = opts.limit || 500;
    const worker = await init();
    const norm = normalize(term);
    if (!norm) return [];

    // Single equality lookup on B-tree index: ~3-4 HTTP Range requests
    const sql = `
      SELECT e.id, e.headword, e.headword_norm, d.name AS dict, 1 AS exact
        FROM entries e
        JOIN dictionaries d ON d.id = e.dict_id
       WHERE e.headword_norm = ?
       LIMIT ?
    `;
    return worker.db.query(sql, [norm, limit]);
  }

  // ── Phase 2: Lazy body loading from dict.sqlite ──
  async function fetchBodies(ids) {
    if (!ids || ids.length === 0) return [];
    const worker = await initContent();
    const placeholders = ids.map(() => "?").join(",");
    const sql = `SELECT id, body, body_ko FROM entries WHERE id IN (${placeholders})`;
    return worker.db.query(sql, ids);
  }

  function dicts() {
    return dictMeta || {};
  }

  window.Lookup = {
    init, searchExact, searchPartial, hasExact,
    fetchBodies, normalize, dicts,
  };
})();
