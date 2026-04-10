// reader.js — Text reader: file tree, tokenized display, click → search.
// Includes user-uploaded texts stored in localStorage.
// Exposes window.Reader = { init, loadFile, getTree, ... }.

(function () {
  const BASE = "texts";
  const UPLOADS_KEY = "skt_tib_uploads";
  let treeData = null; // { sanskrit: [...], tibetan: [...] }
  let currentPath = null;

  // ── User uploads (localStorage) ────────────────────────────────────

  function getUploads() {
    try {
      const raw = localStorage.getItem(UPLOADS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {}; // { "upload/sa/myfile.txt": { name, lang, text, ts } }
  }

  function saveUploads(uploads) {
    try { localStorage.setItem(UPLOADS_KEY, JSON.stringify(uploads)); } catch (_) {}
  }

  function addUpload(name, lang, text) {
    const uploads = getUploads();
    const key = "upload/" + lang + "/" + name;
    uploads[key] = { name, lang, text, ts: Date.now() };
    saveUploads(uploads);
    return key;
  }

  function removeUpload(key) {
    const uploads = getUploads();
    delete uploads[key];
    saveUploads(uploads);
  }

  function getUploadedText(key) {
    const uploads = getUploads();
    return uploads[key]?.text || null;
  }

  // ── File tree discovery ──────────────────────────────────────────

  async function fetchManifest() {
    try {
      const res = await fetch(BASE + "/manifest.json?v=" + Date.now());
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  }

  async function probeTree() {
    const tree = { sanskrit: [], tibetan: [] };
    const knownFiles = [
      "sanskrit/vajracchedika/ch1.txt",
      "sanskrit/hrdaya/hrdaya.txt",
      "tibetan/hrdaya/hrdaya.txt",
    ];
    for (const f of knownFiles) {
      try {
        const res = await fetch(BASE + "/" + f, { method: "HEAD" });
        if (res.ok) {
          const lang = f.startsWith("tibetan") ? "tibetan" : "sanskrit";
          tree[lang].push(f);
        }
      } catch (_) {}
    }
    return tree;
  }

  async function init() {
    treeData = (await fetchManifest()) || (await probeTree());
    return treeData;
  }

  function getTree() {
    return treeData;
  }

  // ── File loading ─────────────────────────────────────────────────

  async function loadFile(path) {
    // Check if it's an uploaded file
    if (path.startsWith("upload/")) {
      const text = getUploadedText(path);
      if (!text) throw new Error("업로드된 파일을 찾을 수 없습니다: " + path);
      currentPath = path;
      return text;
    }
    const res = await fetch(BASE + "/" + path + "?v=" + Date.now());
    if (!res.ok) throw new Error("Failed to load: " + path);
    const text = await res.text();
    currentPath = path;
    return text;
  }

  function getCurrentPath() {
    return currentPath;
  }

  // ── Tokenization ─────────────────────────────────────────────────

  function detectLang(path) {
    if (path.startsWith("tibetan") || path.startsWith("upload/bo")) return "bo";
    return "sa";
  }

  function tokenize(text, lang) {
    const lines = text.split("\n");
    return lines.map((line, lineIdx) => {
      if (!line.trim()) return { lineIdx, tokens: [], empty: true };
      const tokens = [];
      const parts = line.split(/(\s+)/);
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          tokens.push({ type: "space", text: part });
        } else if (part) {
          const searchTerm = part.replace(/^[|.,()\[\]{}—–:;!?"""''«»]+|[|.,()\[\]{}—–:;!?"""''«»]+$/g, "");
          tokens.push({ type: "word", text: part, search: searchTerm || part });
        }
      }
      return { lineIdx, tokens, empty: false };
    });
  }

  // ── Rendering ────────────────────────────────────────────────────

  function renderTree(container, onFileClick, onDeleteUpload) {
    const parts = [];

    // Built-in texts
    if (treeData) {
      for (const lang of ["sanskrit", "tibetan"]) {
        const files = treeData[lang];
        if (!files || !files.length) continue;

        const langLabel = lang === "sanskrit" ? "Sanskrit" : "Tibetan";
        parts.push(`<div class="tree-lang">`);
        parts.push(`<div class="tree-lang-head">${langLabel}</div>`);

        const works = new Map();
        for (const f of files) {
          const segs = f.split("/");
          const work = segs.length > 2 ? segs[1] : "(root)";
          if (!works.has(work)) works.set(work, []);
          works.get(work).push(f);
        }

        for (const [work, wFiles] of works) {
          parts.push(`<div class="tree-work">`);
          parts.push(`<div class="tree-work-head">${escapeHtml(work)}</div>`);
          for (const f of wFiles) {
            const fname = f.split("/").pop();
            const activeCls = f === currentPath ? " tree-active" : "";
            parts.push(
              `<a class="tree-file${activeCls}" data-path="${escapeHtml(f)}">${escapeHtml(fname)}</a>`
            );
          }
          parts.push(`</div>`);
        }
        parts.push(`</div>`);
      }
    }

    // User uploads
    const uploads = getUploads();
    const uploadKeys = Object.keys(uploads);
    if (uploadKeys.length) {
      parts.push(`<div class="tree-lang tree-uploads">`);
      parts.push(`<div class="tree-lang-head">내 텍스트</div>`);

      // Group by lang
      const byLang = { sa: [], bo: [] };
      for (const key of uploadKeys) {
        const u = uploads[key];
        const l = u.lang === "bo" ? "bo" : "sa";
        byLang[l].push({ key, ...u });
      }

      for (const [lang, files] of Object.entries(byLang)) {
        if (!files.length) continue;
        const langTag = lang === "bo" ? "Tib" : "Skt";
        for (const f of files) {
          const activeCls = f.key === currentPath ? " tree-active" : "";
          parts.push(
            `<div class="tree-upload-item">
               <a class="tree-file${activeCls}" data-path="${escapeHtml(f.key)}">
                 <span class="upload-lang-tag">${langTag}</span>${escapeHtml(f.name)}
               </a>
               <button class="tree-delete" data-key="${escapeHtml(f.key)}" title="삭제">×</button>
             </div>`
          );
        }
      }
      parts.push(`</div>`);
    }

    // Upload button
    parts.push(`<div class="tree-upload-area">`);
    parts.push(`<button class="upload-btn" id="upload-btn-trigger">+ 텍스트 업로드</button>`);
    parts.push(`</div>`);

    if (!parts.length) {
      container.innerHTML = '<p class="tree-empty">텍스트 없음</p>';
      return;
    }

    container.innerHTML = parts.join("");

    // Wire file clicks
    container.querySelectorAll(".tree-file").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        onFileClick(el.dataset.path);
      });
    });

    // Wire delete buttons
    container.querySelectorAll(".tree-delete").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onDeleteUpload) onDeleteUpload(el.dataset.key);
      });
    });
  }

  function renderText(container, text, path, onTokenClick) {
    const lang = detectLang(path);
    const lines = tokenize(text, lang);
    const langClass = lang === "bo" ? "text-tibetan" : "text-sanskrit";

    const parts = [];
    parts.push(`<div class="reader-text ${langClass}">`);

    for (const line of lines) {
      if (line.empty) {
        parts.push(`<div class="text-line text-empty">&nbsp;</div>`);
        continue;
      }

      parts.push(`<div class="text-line" data-line="${line.lineIdx}">`);
      parts.push(`<span class="line-num">${line.lineIdx + 1}</span>`);

      for (const tok of line.tokens) {
        if (tok.type === "space") {
          parts.push(tok.text);
        } else {
          parts.push(
            `<span class="token" data-search="${escapeHtml(tok.search)}">${escapeHtml(tok.text)}</span>`
          );
        }
      }
      parts.push(`</div>`);
    }

    parts.push(`</div>`);
    container.innerHTML = parts.join("");

    container.querySelectorAll(".token").forEach((el) => {
      el.addEventListener("click", () => {
        container.querySelectorAll(".token-active").forEach((t) => t.classList.remove("token-active"));
        el.classList.add("token-active");
        onTokenClick(el.dataset.search);
      });
    });
  }

  // ── Upload dialog ────────────────────────────────────────────────

  function showUploadDialog(onComplete) {
    // Remove existing dialog if any
    const existing = document.getElementById("upload-dialog");
    if (existing) existing.remove();

    const dialog = document.createElement("div");
    dialog.id = "upload-dialog";
    dialog.className = "upload-dialog-overlay";
    dialog.innerHTML = `
      <div class="upload-dialog">
        <h3>텍스트 업로드</h3>
        <div class="upload-field">
          <label>파일 선택 (.txt)</label>
          <input type="file" id="upload-file-input" accept=".txt,text/plain">
        </div>
        <div class="upload-field">
          <label>또는 직접 붙여넣기</label>
          <textarea id="upload-paste" rows="6" placeholder="텍스트를 여기에 붙여넣으세요..."></textarea>
        </div>
        <div class="upload-field">
          <label>파일 이름</label>
          <input type="text" id="upload-name" placeholder="예: madhyamaka_ch1.txt">
        </div>
        <div class="upload-field">
          <label>언어</label>
          <div class="upload-lang-btns">
            <button class="upload-lang-opt active" data-lang="sa">Sanskrit (IAST)</button>
            <button class="upload-lang-opt" data-lang="bo">Tibetan (Wylie)</button>
          </div>
        </div>
        <div class="upload-actions">
          <button class="upload-cancel">취소</button>
          <button class="upload-confirm">업로드</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    let selectedLang = "sa";
    let fileText = "";

    // Lang toggle
    dialog.querySelectorAll(".upload-lang-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        dialog.querySelectorAll(".upload-lang-opt").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedLang = btn.dataset.lang;
      });
    });

    // File input
    const fileInput = dialog.querySelector("#upload-file-input");
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const nameInput = dialog.querySelector("#upload-name");
      if (!nameInput.value) nameInput.value = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        fileText = reader.result;
        dialog.querySelector("#upload-paste").value = fileText;
      };
      reader.readAsText(file);
    });

    // Cancel
    dialog.querySelector(".upload-cancel").addEventListener("click", () => dialog.remove());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });

    // Confirm
    dialog.querySelector(".upload-confirm").addEventListener("click", () => {
      const text = dialog.querySelector("#upload-paste").value || fileText;
      let name = dialog.querySelector("#upload-name").value.trim();
      if (!text) { alert("텍스트를 입력하거나 파일을 선택하세요."); return; }
      if (!name) name = "untitled_" + Date.now() + ".txt";
      if (!name.endsWith(".txt")) name += ".txt";

      const key = addUpload(name, selectedLang, text);
      dialog.remove();
      if (onComplete) onComplete(key);
    });
  }

  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.Reader = {
    init,
    getTree,
    loadFile,
    getCurrentPath,
    detectLang,
    tokenize,
    renderTree,
    renderText,
    showUploadDialog,
    addUpload,
    removeUpload,
    getUploads,
  };
})();
