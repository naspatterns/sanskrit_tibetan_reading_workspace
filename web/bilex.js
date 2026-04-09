// bilex.js — Tibetan↔Sanskrit bilingual lexicon lookup via sql.js-httpvfs.
// Exposes window.Bilex = { init(), lookupTib(wylie), lookupSkt(iast) }.
//
// Strategy: FTS5 token match first (works for Tibetan multi-word like "chos kyi sku").
// Sanskrit compounds are single tokens in FTS, so we fall back to LIKE prefix
// when FTS yields nothing.

(function () {
  let workerPromise = null;

  async function init() {
    if (workerPromise) return workerPromise;
    workerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: "../bilex.sqlite?v=" + Date.now(),
            requestChunkSize: 4096,
          },
        },
      ],
      "vendor/sqlite.worker.js",
      "sql-wasm.wasm"
    );
    return workerPromise;
  }

  function normalize(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  }

  function ftsQuote(s) {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  // Tibetan Wylie → find Sanskrit equivalents
  async function lookupTib(wylie, opts = {}) {
    const limit = opts.limit || 100;
    const worker = await init();
    const norm = normalize(wylie);
    if (!norm) return [];

    // FTS token match (works well for Tibetan space-separated syllables)
    const ftsSql = `
      SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
             b.category_zh, s.name AS source,
             (b.tib_norm = ?) AS exact
        FROM bilex_fts f
        JOIN bilex b ON b.id = f.rowid
        JOIN sources s ON s.id = b.source_id
       WHERE bilex_fts MATCH 'tib_norm:' || ?
       ORDER BY exact DESC, length(b.tib_norm) ASC
       LIMIT ?
    `;
    let rows = await worker.db.query(ftsSql, [norm, ftsQuote(norm), limit]);

    // Fallback: LIKE prefix for single-token terms missed by FTS
    if (!rows.length) {
      const likeSql = `
        SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
               b.category_zh, s.name AS source,
               (b.tib_norm = ?) AS exact
          FROM bilex b
          JOIN sources s ON s.id = b.source_id
         WHERE b.tib_norm LIKE ? || '%'
         ORDER BY exact DESC, length(b.tib_norm) ASC
         LIMIT ?
      `;
      rows = await worker.db.query(likeSql, [norm, norm, limit]);
    }
    return rows;
  }

  // Sanskrit IAST → find Tibetan equivalents
  async function lookupSkt(iast, opts = {}) {
    const limit = opts.limit || 100;
    const worker = await init();
    const norm = normalize(iast);
    if (!norm) return [];

    // FTS token match first
    const ftsSql = `
      SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
             b.category_zh, s.name AS source,
             (b.skt_norm = ?) AS exact
        FROM bilex_fts f
        JOIN bilex b ON b.id = f.rowid
        JOIN sources s ON s.id = b.source_id
       WHERE bilex_fts MATCH 'skt_norm:' || ?
       ORDER BY exact DESC, length(b.skt_norm) ASC
       LIMIT ?
    `;
    let rows = await worker.db.query(ftsSql, [norm, ftsQuote(norm), limit]);

    // Fallback: LIKE prefix (Sanskrit compounds are single FTS tokens)
    if (!rows.length) {
      const likeSql = `
        SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
               b.category_zh, s.name AS source,
               (b.skt_norm = ?) AS exact
          FROM bilex b
          JOIN sources s ON s.id = b.source_id
         WHERE b.skt_norm LIKE ? || '%'
         ORDER BY exact DESC, length(b.skt_norm) ASC
         LIMIT ?
      `;
      rows = await worker.db.query(likeSql, [norm, norm, limit]);
    }
    return rows;
  }

  window.Bilex = { init, lookupTib, lookupSkt, normalize };
})();
