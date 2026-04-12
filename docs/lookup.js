// lookup.js — Two-worker architecture for fast search + lazy body loading.
//
// Worker 1 (search): search.sqlite (~300MB) — headword + FTS5(headword_norm only)
// Worker 2 (content): dict.sqlite (2.3GB) — full body/body_ko, loaded on demand
//
// Exposes window.Lookup = { init(), search(term), fetchBodies(ids), dicts(), normalize() }.

(function () {
  let searchWorkerPromise = null;
  let contentWorkerPromise = null;
  let dictMeta = null; // {name -> {id, lang}}

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

  // ── Worker 1: Search index (lightweight, loaded at startup) ──
  async function init() {
    if (searchWorkerPromise) return searchWorkerPromise;
    searchWorkerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: getSearchUrl(),
            requestChunkSize: 262144, // 256KB — prefetch nearby pages
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

  // Escape any FTS5 syntax characters by quoting the token.
  function ftsQuote(s) {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  // ── Phase 1: Fast search (headword + dict only, no body) ──
  async function search(term, opts = {}) {
    const limit = opts.limit || 800;
    const worker = await init();
    const norm = normalize(term);
    if (!norm) return [];

    // FTS5 on search.sqlite — indexes headword_norm only (single column)
    const sql = `
      SELECT e.id, e.headword, e.headword_norm, d.name AS dict,
             (e.headword_norm = ?) AS exact
        FROM entries_fts f
        JOIN entries e ON e.id = f.rowid
        JOIN dictionaries d ON d.id = e.dict_id
       WHERE entries_fts MATCH ?
       ORDER BY exact DESC, length(e.headword_norm) ASC
       LIMIT ?
    `;
    return worker.db.query(sql, [norm, ftsQuote(norm), limit]);
  }

  // ── Phase 2: Lazy body loading from dict.sqlite ──
  async function fetchBodies(ids) {
    if (!ids || ids.length === 0) return [];
    const worker = await initContent();
    // Batch fetch by rowid — efficient indexed lookup
    const placeholders = ids.map(() => "?").join(",");
    const sql = `SELECT id, body, body_ko FROM entries WHERE id IN (${placeholders})`;
    return worker.db.query(sql, ids);
  }

  function dicts() {
    return dictMeta || {};
  }

  window.Lookup = { init, search, fetchBodies, normalize, dicts };
})();
