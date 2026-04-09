// lookup.js — sql.js-httpvfs wrapper for multi-dictionary search.
// Exposes window.Lookup = { init(), search(term, {limit}), dicts() }.

(function () {
  let workerPromise = null;
  let dictMeta = null; // {name -> {id, lang}}

  async function init() {
    if (workerPromise) return workerPromise;
    workerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: "../dict.sqlite?v=" + Date.now(),
            requestChunkSize: 4096,
          },
        },
      ],
      "vendor/sqlite.worker.js",
      "sql-wasm.wasm"
      // 4th arg is maxBytesToRead — leaving undefined = Infinity.
    );
    const w = await workerPromise;
    const rows = await w.db.query("SELECT id, name, lang FROM dictionaries");
    dictMeta = {};
    for (const r of rows) dictMeta[r.name] = { id: r.id, lang: r.lang };
    return w;
  }

  // NFD + strip combining + lowercase. Matches build_dict_db.normalize.
  function normalize(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  }

  // Escape any FTS5 syntax characters by quoting the token.
  function ftsQuote(s) {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  async function search(term, opts = {}) {
    const limit = opts.limit || 800;
    const worker = await init();
    const norm = normalize(term);
    if (!norm) return [];

    // FTS5 token match against headword_norm. Catches both single-word
    // exact matches and multi-word headwords containing the token. Sort
    // exact matches to the top so dharma → dharma comes before dharmakāya.
    const sql = `
      SELECT e.headword, e.body, d.name AS dict,
             (e.headword_norm = ?) AS exact
        FROM entries_fts f
        JOIN entries e ON e.id = f.rowid
        JOIN dictionaries d ON d.id = e.dict_id
       WHERE entries_fts MATCH 'headword_norm:' || ?
       ORDER BY exact DESC, length(e.headword_norm) ASC
       LIMIT ?
    `;
    return worker.db.query(sql, [norm, ftsQuote(norm), limit]);
  }

  function dicts() {
    return dictMeta || {};
  }

  window.Lookup = { init, search, normalize, dicts };
})();
