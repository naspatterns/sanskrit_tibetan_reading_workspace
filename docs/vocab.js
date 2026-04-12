// vocab.js — Vocabulary card system using IndexedDB.
// Exposes window.Vocab = { init, add, remove, getAll, search, update, count }.

(function () {
  const DB_NAME = "skt_vocab_cards";
  const DB_VERSION = 1;
  const STORE = "cards";
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const store = d.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("headword", "headword", { unique: false });
          store.createIndex("lang", "lang", { unique: false });
          store.createIndex("ts", "ts", { unique: false });
          store.createIndex("status", "status", { unique: false });
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function init() {
    if (!db) await open();
    return db;
  }

  // Add a new vocab card
  function add(card) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const entry = {
        headword: card.headword || "",
        meaning: card.meaning || "",
        lang: card.lang || "sa",        // "sa" | "bo"
        source: card.source || "",       // file path
        lineNum: card.lineNum ?? null,
        context: card.context || "",     // surrounding text
        note: card.note || "",
        status: card.status || "new",    // "new" | "learning" | "known"
        ts: Date.now(),
      };
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result); // returns id
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Remove a card by id
  function remove(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Update a card (partial update)
  function update(id, fields) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) { reject(new Error("Card not found: " + id)); return; }
        Object.assign(existing, fields);
        const putReq = store.put(existing);
        putReq.onsuccess = () => resolve(existing);
        putReq.onerror = (e) => reject(e.target.error);
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  }

  // Get all cards, newest first
  function getAll() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const cards = req.result;
        cards.sort((a, b) => b.ts - a.ts);
        resolve(cards);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Search cards by headword substring
  function search(query) {
    return new Promise((resolve, reject) => {
      if (!query) { getAll().then(resolve).catch(reject); return; }
      const q = query.toLowerCase();
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const cards = req.result.filter((c) =>
          c.headword.toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q) ||
          c.note.toLowerCase().includes(q)
        );
        cards.sort((a, b) => b.ts - a.ts);
        resolve(cards);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Count cards
  function count() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // Export all cards as JSON
  function exportAll() {
    return getAll();
  }

  // Import cards from JSON array
  function importCards(cards) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(cards)) { reject(new Error("Invalid cards")); return; }
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let count = 0;
      for (const card of cards) {
        const safe = {
          headword: String(card.headword || ""),
          meaning: String(card.meaning || ""),
          lang: String(card.lang || "sa"),
          source: String(card.source || ""),
          lineNum: card.lineNum || null,
          context: String(card.context || ""),
          note: String(card.note || ""),
          status: ["new","learning","known"].includes(card.status) ? card.status : "new",
          ts: typeof card.ts === "number" ? card.ts : Date.now(),
        };
        store.add(safe);
        count++;
      }
      tx.oncomplete = () => resolve(count);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  window.Vocab = {
    init,
    add,
    remove,
    update,
    getAll,
    search,
    count,
    exportAll,
    importCards,
  };
})();
