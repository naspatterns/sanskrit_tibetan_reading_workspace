# Sanskrit–Tibetan Reading Workspace

**v0.9.0-rc** — Search mode public release (Reader & Vocabulary modes coming in v2)

A multi-dictionary search workspace for Sanskrit, Tibetan, and Chinese Buddhist textual studies.
Pure static HTML/JS/CSS powered by [sql.js-httpvfs](https://github.com/niccokunzmann/sql.js-httpvfs) (in-browser SQLite over HTTP Range requests).

- **135 dictionaries**, **3,811,344 entries** — definitions in English, German, French, Latin, Korean, Tibetan, and Sanskrit
- **207,095 bilingual equivalence pairs** (Skt↔Tib↔Zh), including 104,250 with Chinese
- 8 equivalence sources: Mahāvyutpatti, Negi, Lokesh Chandra, 84000, Hopkins, DILA, NTI Reader, Yogācārabhūmi
- Database hosted on [HuggingFace Datasets](https://huggingface.co/datasets/naspatterns/sanskrit-tibetan-dict) (dict.sqlite 2.3 GB + bilex.sqlite 51 MB)

---

## Demo

GitHub Pages: *URL to be added after deployment*

---

## Features (v0.9.0)

### Search Mode
- Enter a word → **4-Zone results**
  - **Zone A**: Summary — first 150 characters from tier 1–2 dictionaries
  - **Zone B**: Bilingual equivalences (Skt↔Tib↔Zh, 8 sources with source badges)
  - **Zone C**: Full entries for exact matches (6 groups: English / German / French·Latin / Equivalence / Native / Auxiliary)
  - **Zone D**: Related headword list (click to search)
- Supports IAST, Wylie, and CJK (Chinese) input
- Sidebar: 6 group filters, favorites, per-dictionary navigation
- Korean translations for DE/FR/LA dictionaries with "Show original" toggle

### Planned for v2
- **Reader Mode**: 3-panel layout (file tree | tokenized text | dictionary lookup), click any word to search instantly
- **Vocabulary Mode**: IndexedDB-based flashcards with new/learning/known status tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/JS/CSS (no frameworks) |
| DB Engine | sql.js-httpvfs v0.8.12 (in-browser SQLite) |
| DB Hosting | HuggingFace Datasets CDN (HTTP Range requests) |
| Web Hosting | GitHub Pages (static) |
| Build | Python 3 scripts (lxml, pandas) |

---

## Local Development

```bash
# Setup
python3 -m venv .venv && source .venv/bin/activate
pip install lxml pandas xlrd

# Dev server (must support HTTP Range requests)
python3 scripts/serve.py 8000
# → http://localhost:8000/web/
```

> **Note**: `python3 -m http.server` does not support Range requests and will not work with sql.js-httpvfs. Always use `serve.py`.

---

## Directory Structure

```
├── web/                     ← GitHub Pages root
│   ├── index.html           ← Search UI (reader/vocab tabs disabled)
│   ├── app.js               ← UI orchestrator
│   ├── lookup.js            ← dict.sqlite FTS5 query wrapper
│   ├── bilex.js             ← Skt↔Tib↔Zh equivalence lookup
│   ├── reader.js            ← Reader mode (v2)
│   ├── vocab.js             ← Vocabulary cards (v2)
│   ├── dictnames.js         ← Metadata for 135 dictionaries
│   └── vendor/              ← sql.js-httpvfs v0.8.12
├── scripts/
│   └── serve.py             ← Range-capable local HTTP server
├── texts/                   ← Built-in source texts (Hrdaya, Vajracchedika)
└── LICENSES.md              ← Per-source license details
```

---

## License

- **Source code** (web/, scripts/): [MIT License](LICENSE)
- **Dictionary data**: Aggregated from multiple scholarly and open-source projects. See [LICENSES.md](LICENSES.md) for per-source details.
  - CC0 (Public Domain): Steinert Tibetan dictionaries (64), DILA, Yogācārabhūmi Index
  - CC-BY-SA 3.0: NTI Reader Buddhist Dictionary
  - Historical: 19th-century Sanskrit dictionaries (Monier-Williams, Apte, Böhtlingk-Roth, etc.)
  - Unverified: Some Apple Dictionary and SANDIC sources — verification in progress

### Copyright Concerns

If you are a rights holder and believe any material in this project infringes your copyright, please contact **naspatterns@gmail.com**. We will take **immediate action**, including removal of the data in question.

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| v0.9.0-rc | 2026-04-12 | Search mode public release. Security audit (11 items) and performance optimization (11 items) completed. Reader/Vocabulary modes deferred to v2. |
