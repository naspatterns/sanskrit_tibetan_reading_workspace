// bilex.js — Trilingual lexicon lookup (Skt↔Tib↔Zh) via sql.js-httpvfs.
// Exposes window.Bilex = { init(), lookupTib(wylie), lookupSkt(iast), lookupZh(zh) }.
//
// Queries TWO tables:
//   1. bilex  — Mahāvyutpatti only (9,500 pairs, with entry_num & category)
//   2. equiv  — Multi-source (112K+ pairs: Mahāvyutpatti + Negi + LCh + 84000 + Hopkins)
//              Now includes zh/zh_norm columns for Chinese equivalents.
//
// Zone A/B uses combined results; equiv provides broader coverage.

(function () {
  const VALID_FIELDS = { tib_norm: true, skt_norm: true, zh_norm: true };
  function assertField(f) { if (!VALID_FIELDS[f]) throw new Error("invalid field: " + f); }

  let workerPromise = null;

  // DB URL: use local path for localhost, HuggingFace CDN for production
  function getBilexUrl() {
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      return "../bilex.sqlite?v=" + Date.now();
    }
    return "https://huggingface.co/datasets/naspatterns/sanskrit-tibetan-dict/resolve/main/bilex.sqlite";
  }

  async function init() {
    if (workerPromise) return workerPromise;
    workerPromise = window.createDbWorker(
      [
        {
          from: "inline",
          config: {
            serverMode: "full",
            url: getBilexUrl(),
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

  // ── Legacy bilex queries (Mahāvyutpatti with entry_num) ────────────

  async function queryBilex(worker, field, norm, limit) {
    assertField(field);
    const otherField = field === "tib_norm" ? "skt_norm" : "tib_norm";
    const ftsSql = `
      SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
             b.category_zh, s.name AS source,
             (b.${field} = ?) AS exact
        FROM bilex_fts f
        JOIN bilex b ON b.id = f.rowid
        JOIN sources s ON s.id = b.source_id
       WHERE bilex_fts MATCH '${field}:' || ?
       ORDER BY exact DESC, length(b.${field}) ASC
       LIMIT ?
    `;
    let rows = await worker.db.query(ftsSql, [norm, ftsQuote(norm), limit]);
    if (!rows.length) {
      const likeSql = `
        SELECT b.entry_num, b.skt_iast, b.skt_slp1, b.tib_wylie,
               b.category_zh, s.name AS source,
               (b.${field} = ?) AS exact
          FROM bilex b
          JOIN sources s ON s.id = b.source_id
         WHERE b.${field} LIKE ? || '%'
         ORDER BY exact DESC, length(b.${field}) ASC
         LIMIT ?
      `;
      rows = await worker.db.query(likeSql, [norm, norm, limit]);
    }
    return rows;
  }

  // ── New equiv queries (multi-source) ───────────────────────────────

  async function queryEquiv(worker, field, norm, limit) {
    assertField(field);
    try {
      const ftsSql = `
        SELECT e.skt_iast, e.tib_wylie, e.zh, e.category, e.note,
               s.name AS source,
               (e.${field} = ?) AS exact
          FROM equiv_fts f
          JOIN equiv e ON e.id = f.rowid
          JOIN equiv_sources s ON s.id = e.source_id
         WHERE equiv_fts MATCH '${field}:' || ?
         ORDER BY exact DESC, length(e.${field}) ASC
         LIMIT ?
      `;
      let rows = await worker.db.query(ftsSql, [norm, ftsQuote(norm), limit]);
      if (!rows.length) {
        const likeSql = `
          SELECT e.skt_iast, e.tib_wylie, e.zh, e.category, e.note,
                 s.name AS source,
                 (e.${field} = ?) AS exact
            FROM equiv e
            JOIN equiv_sources s ON s.id = e.source_id
           WHERE e.${field} LIKE ? || '%'
           ORDER BY exact DESC, length(e.${field}) ASC
           LIMIT ?
        `;
        rows = await worker.db.query(likeSql, [norm, norm, limit]);
      }
      return rows;
    } catch (_) {
      // equiv table may not exist in older builds
      return [];
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  // Tibetan → find Sanskrit equivalents
  async function lookupTib(wylie, opts = {}) {
    const limit = opts.limit || 100;
    const worker = await init();
    const norm = normalize(wylie);
    if (!norm) return [];

    const [bilexRows, equivRows] = await Promise.all([
      queryBilex(worker, "tib_norm", norm, limit),
      queryEquiv(worker, "tib_norm", norm, limit),
    ]);

    return mergeResults(bilexRows, equivRows);
  }

  // Sanskrit → find Tibetan equivalents
  async function lookupSkt(iast, opts = {}) {
    const limit = opts.limit || 100;
    const worker = await init();
    const norm = normalize(iast);
    if (!norm) return [];

    const [bilexRows, equivRows] = await Promise.all([
      queryBilex(worker, "skt_norm", norm, limit),
      queryEquiv(worker, "skt_norm", norm, limit),
    ]);

    return mergeResults(bilexRows, equivRows);
  }

  // Chinese → find Sanskrit/Tibetan equivalents
  async function lookupZh(zh, opts = {}) {
    const limit = opts.limit || 100;
    const worker = await init();
    const norm = zh.trim();
    if (!norm) return [];

    const equivRows = await queryEquiv(worker, "zh_norm", norm, limit);
    return mergeResults([], equivRows);
  }

  // Merge bilex + equiv results, deduplicating
  function mergeResults(bilexRows, equivRows) {
    const seen = new Map(); // key → merged item
    const merged = [];

    function makeKey(skt, tib) {
      return `${normalize(skt || "")}|${normalize(tib || "")}`;
    }

    // Bilex (Mahāvyutpatti) rows first — they have entry_num
    for (const r of bilexRows) {
      const key = makeKey(r.skt_iast, r.tib_wylie);
      if (!seen.has(key)) {
        const item = {
          entry_num: r.entry_num,
          skt_iast: r.skt_iast || "",
          tib_wylie: r.tib_wylie || "",
          zh: "",
          category: r.category_zh || "",
          source: r.source || "mahavyutpatti",
          exact: r.exact,
        };
        seen.set(key, item);
        merged.push(item);
      }
    }

    // Equiv rows — broader coverage, includes zh
    for (const r of equivRows) {
      const key = makeKey(r.skt_iast, r.tib_wylie);
      if (seen.has(key)) {
        if (r.zh) {
          const existing = seen.get(key);
          if (!existing.zh) existing.zh = r.zh;
        }
        continue;
      }
      const item = {
        entry_num: null,
        skt_iast: r.skt_iast || "",
        tib_wylie: r.tib_wylie || "",
        zh: r.zh || "",
        category: r.category || "",
        source: r.source || "",
        exact: r.exact,
      };
      seen.set(key, item);
      merged.push(item);
    }

    // Sort: exact first, then by source priority
    const SOURCE_ORDER = { mahavyutpatti: 0, "84000": 1, negi: 2, hopkins: 3, "lokesh-chandra": 4, "yogacarabhumi-idx": 5, "nti-reader": 6 };
    merged.sort((a, b) => {
      if ((b.exact || 0) !== (a.exact || 0)) return (b.exact || 0) - (a.exact || 0);
      const sa = SOURCE_ORDER[a.source] ?? 9;
      const sb = SOURCE_ORDER[b.source] ?? 9;
      return sa - sb;
    });

    return merged;
  }

  window.Bilex = { init, lookupTib, lookupSkt, lookupZh, normalize };
})();
