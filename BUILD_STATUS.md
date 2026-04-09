# Build Status — Sanskrit–Tibetan Reading Workspace

> 최종 갱신: 2026-04-10  
> 이 파일은 프로젝트를 처음부터 복원하거나 다른 환경에서 재구축할 때 참조합니다.

---

## 1. 프로젝트 개요

- **목적**: 산스크리트·티벳 문헌 독해를 위한 다중 사전 검색 웹 워크스페이스
- **기술 스택**: 정적 웹 (HTML/JS/CSS) + `sql.js-httpvfs` (브라우저 내 SQLite, HTTP Range 요청)
- **호스팅**: GitHub Pages 또는 로컬 Range 지원 서버 (`scripts/serve.py`)
- **설계 문서**: `~/.claude/plans/adaptive-questing-squid.md`

---

## 2. 현재 상태 (Phase 2.5 완료 — 검색 UI 개편)

| 항목 | 값 |
|---|---|
| 총 사전 수 | **85개** (산스크리트 19 XDXF + Mahāvyutpatti 1 + 티벳 64 Steinert + Apple 1) |
| 총 엔트리 수 | **1,994,513건** (dict.sqlite) |
| dict.sqlite 크기 | **~700 MB** |
| bilex.sqlite 크기 | **2.5 MB** (Mahāvyutpatti 9,568 대역어) |
| Apple 사전 | Bod rgya tshig mdzod chen mo (53,466항목, Tibetan Unicode) |
| FTS5 인덱스 | `entries_fts` (dict), `bilex_fts` (bilex) |
| 웹 UI | **4존 구조** + 6그룹 분류 + tier 기반 접기/펼치기 + 즐겨찾기 |

### Phase 2.5 검색 UI 개편 상세

**4존(Zone) 결과 구조:**
- **Zone A (종합 요약)**: 정확 매치를 전 사전에서 수집, 각 사전 첫 150자를 태그 형태로 요약. Tier 1~2 사전 우선 표시.
- **Zone B (대역어)**: Mahāvyutpatti 기반 Skt↔Tib 대역어 (기존 bilex 유지)
- **Zone C (정확 매치 전문)**: 6개 표시 그룹(영어/독일어/불어·라틴/대역/원어/보조)으로 재분류. Tier 1 자동 펼침, Tier 3 "더 보기" 뒤에 숨김.
- **Zone D (관련 표제어)**: 비정확 매치는 본문 없이 headword 리스트만 표시 (중복 제거), 클릭 시 새 검색.

**사전 메타데이터 (dictnames.js):**
- `tier`: 1(주요 12개), 2(전문 ~30개), 3(보조 ~43개)
- `defLang`: en, de, fr, la, bo, sa, equiv, mixed
- `subgroup`: core, grammar, scan, subcollection, domain, native, reverse, equiv

**사이드바:**
- 6개 그룹 필터 pill (토글로 그룹 전체 표시/숨김)
- ★ 즐겨찾기 (localStorage 저장, 새로고침 후에도 유지)
- 그룹별 사전 네비게이션

**효과**: `chos` 검색 시 기존 800건 전문 표시 → 정확 67건 전문 + 465건 headword 리스트. 스크롤 90%+ 감소.

---

## 3. 디렉터리 구조

```
sanskrit_tibetan_reading_workspace/
├── BUILD_STATUS.md          ← 이 파일
├── README.md
├── .gitignore
├── build/
│   ├── dict.sqlite          ← 사전 DB (638 MB, gitignore됨)
│   └── bilex.sqlite         ← 대역어 DB (2.5 MB, gitignore됨)
├── data-source/
│   ├── xdxf/                ← 19개 XDXF 심볼릭 링크 (gitignore됨)
│   ├── tibdict/             ← 64개 CSV (Steinert tibetan-dictionary)
│   ├── apple-converted/     ← (미사용, 향후 Phase 2)
│   └── bilex/               ← (미사용, 향후 Phase 2)
├── scripts/
│   ├── build_dict_db.py     ← Step 1: XDXF → dict.sqlite
│   ├── add_mahavyutpatti.py ← Step 2: Mahāvyutpatti → dict.sqlite 추가
│   ├── add_tibdict.py       ← Step 3: 티벳 사전 64종 → dict.sqlite 추가
│   ├── build_bilex_db.py    ← Step 4: Mahāvyutpatti → bilex.sqlite (독립)
│   ├── convert_apple_dict.py ← Apple .dictionary → JSONL 변환
│   ├── add_apple_dict.py    ← Step 5: JSONL → dict.sqlite 추가
│   ├── serve.py             ← Range 지원 로컬 서버
│   └── requirements.txt     ← Python 의존성 (lxml)
├── web/
│   ├── index.html
│   ├── app.js               ← UI 로직
│   ├── lookup.js            ← sql.js-httpvfs 래퍼
│   ├── dictnames.js         ← 사전 표시 이름 매핑
│   ├── style.css
│   ├── dict.sqlite          ← ../build/dict.sqlite 심볼릭 링크
│   ├── bilex.sqlite         ← ../build/bilex.sqlite 심볼릭 링크
│   ├── bilex.js             ← 대역어 조회 (FTS + LIKE prefix fallback)
│   ├── sql-wasm.wasm        ← vendor 복사본 (worker fallback)
│   └── vendor/
│       ├── index.js         ← sql.js-httpvfs v0.8.12
│       ├── sqlite.worker.js
│       └── sql-wasm.wasm
├── texts/                   ← (향후 원문 저장소)
└── notes/                   ← (향후 노트 저장소)
```

---

## 4. 데이터 원본 위치

### 4-1. XDXF 산스크리트 사전 19종
- **원본 위치**: `../../Sanskrit_Tibetan_Reading_Tools/sanskrit_dictionaries_xml/`
- **연결 방법**: `data-source/xdxf/` 안에 심볼릭 링크 19개
  ```bash
  cd data-source/xdxf
  for f in ../../../Sanskrit_Tibetan_Reading_Tools/sanskrit_dictionaries_xml/*.xdxf; do
    ln -s "$f" .
  done
  ```
- **사전 목록**: aptees, aptese, benfse, boppsl, cappen, cappse, gstse, macda, mwse, mwsea, pwse, pwgse, stchse, vacaspe, wilen, wilse, yatese, lanmse, meden

### 4-2. Mahāvyutpatti
- **원본 위치**: `../../Sanskrit_Tibetan_Reading_Tools/Mahavyutpatti/번역명의대집.xls`
- **형식**: Excel (xls), 헤더 없음
  - 컬럼: [0] ID, [1] "[ID]", [2] 【漢文 분류】, [3] 티벳어 (Wylie), [4] 산스크리트 (SLP1)
- **추가 의존성**: `pandas`, `openpyxl` 또는 `xlrd`
- **엔트리 수**: ~19,069 (양방향 삽입: 티벳 키 + 산스크리트 키)

### 4-3. 티벳 사전 64종 (Steinert)
- **원본**: https://github.com/christiansteinert/tibetan-dictionary (`data/` 폴더)
- **로컬 위치**: `data-source/tibdict/` (64개 CSV 파일 직접 복사)
- **형식**: 각 행 `wylie|definition`, `\n` 리터럴은 줄바꿈, `#`은 주석
- **엔트리 수**: 992,953
- **주요 사전**: Hopkins 2015, Rangjung Yeshe, Ives Waldo, Tshig mdzod chen mo, Negi Skt, Jaeschke Scan, 84000 Dict, Bod yig tshig gter

---

## 5. 빌드 절차 (dict.sqlite 재구축)

### 5-0. 환경 준비
```bash
cd sanskrit_tibetan_reading_workspace
python3 -m venv .venv
source .venv/bin/activate
pip install lxml pandas xlrd
```

### 5-1. Step 1 — XDXF → dict.sqlite (산스크리트 19종)
```bash
python3 scripts/build_dict_db.py
```
- **입력**: `data-source/xdxf/*.xdxf` (심볼릭 링크 19개)
- **출력**: `build/dict.sqlite` (새로 생성)
- **예상 결과**: 929,025 entries / 19 dictionaries
- **소요 시간**: ~수 분

### 5-2. Step 2 — Mahāvyutpatti 추가
```bash
python3 scripts/add_mahavyutpatti.py
```
- **입력**: `../../Sanskrit_Tibetan_Reading_Tools/Mahavyutpatti/번역명의대집.xls`
- **출력**: `build/dict.sqlite`에 append (FTS 재구축)
- **예상 결과**: +19,069 entries → 합계 948,094

### 5-3. Step 3 — 티벳 사전 64종 추가
```bash
python3 scripts/add_tibdict.py
```
- **입력**: `data-source/tibdict/` (64개 CSV)
- **출력**: `build/dict.sqlite`에 append (FTS 재구축)
- **예상 결과**: +992,953 entries → 합계 ~1,941,047
- **소요 시간**: ~수 분 (대량 INSERT)

### 5-4. Step 4 — bilex.sqlite 빌드 (대역어 전용)
```bash
python3 scripts/build_bilex_db.py
```
- **입력**: `../../Sanskrit_Tibetan_Reading_Tools/Mahavyutpatti/번역명의대집.xls`
- **출력**: `build/bilex.sqlite` (새로 생성, dict.sqlite와 독립)
- **예상 결과**: 9,568 bilex entries
- **심볼릭 링크**: `cd web && ln -sf ../build/bilex.sqlite bilex.sqlite`

### 5-5. Step 5 — Apple .dictionary 변환 및 추가
```bash
# 1) Body.data에서 JSONL 추출
python3 scripts/convert_apple_dict.py "../Sanskrit_Tibetan_Reading_Tools/Dictionaries/Tibetan Great Dictionary.dictionary"
# → data-source/apple-converted/Tibetan Great Dictionary.jsonl (53,466 entries)

# 2) dict.sqlite에 추가 (FTS 재구축)
python3 scripts/add_apple_dict.py
```
- **입력**: `data-source/apple-converted/*.jsonl`
- **출력**: `build/dict.sqlite`에 append
- **Wylie 변환**: Tibetan Unicode → approximate Wylie (접미 자음 인식 포함)
- **추가 의존성**: `pyglossary` (불필요 — 자체 zlib 파서 사용)
- **예상 결과**: +53,466 entries → 합계 ~1,994,513

### 5-6. 빌드 검증
```bash
sqlite3 build/dict.sqlite "SELECT count(*) FROM entries"
# → 1994513

sqlite3 build/dict.sqlite "SELECT count(*) FROM dictionaries"
# → 85

sqlite3 build/dict.sqlite "PRAGMA integrity_check"
# → ok

sqlite3 build/bilex.sqlite "SELECT count(*) FROM bilex"
# → 9568

sqlite3 build/bilex.sqlite "PRAGMA integrity_check"
# → ok
```

---

## 6. 웹 실행 방법

### 6-1. 심볼릭 링크 확인
```bash
ls -la web/dict.sqlite
# → ../build/dict.sqlite
```
없으면:
```bash
cd web && ln -s ../build/dict.sqlite dict.sqlite
```

### 6-2. Range 지원 서버 시작
```bash
python3 scripts/serve.py 8000
```
- 표준 `python3 -m http.server`는 Range 요청 미지원 → sql.js-httpvfs 작동 불가
- `scripts/serve.py`는 HTTP 206 Partial Content를 지원하는 커스텀 서버

### 6-3. 브라우저 접속
```
http://localhost:8000
```
- 검색창에 IAST (예: `dharma`, `ātman`) 또는 Wylie (예: `chos`, `sangs rgyas`) 입력
- 첫 로드 시 ~수 초 초기화 (wasm + DB 메타데이터 fetch)

---

## 7. sql.js-httpvfs 설정

### vendor 파일 (v0.8.12)
- `web/vendor/index.js` — 메인 라이브러리 (CDN: sql.js-httpvfs@0.8.12)
- `web/vendor/sqlite.worker.js` — Web Worker
- `web/vendor/sql-wasm.wasm` — SQLite WASM 바이너리
- `web/sql-wasm.wasm` — 루트 복사본 (Worker가 상대 경로로 찾는 fallback)

### lookup.js 핵심 설정
```javascript
window.createDbWorker(
  [{
    from: "inline",
    config: {
      serverMode: "full",
      url: "../dict.sqlite?v=" + Date.now(),
      requestChunkSize: 4096,
    },
  }],
  "vendor/sqlite.worker.js",
  "sql-wasm.wasm"
  // 4번째 인자 (maxBytesToRead) 생략 → Infinity (중요!)
);
```

**주의**: 4번째 인자 `maxBytesToRead`를 설정하면 안 됨. 638MB DB에서 80MB 등으로 제한하면 "disk I/O error" 발생.

---

## 8. DB 스키마

```sql
CREATE TABLE dictionaries (
  id   INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  lang TEXT NOT NULL  -- 'san', 'tib', 'bi' 등
);

CREATE TABLE entries (
  id            INTEGER PRIMARY KEY,
  dict_id       INTEGER NOT NULL REFERENCES dictionaries(id),
  headword      TEXT NOT NULL,
  headword_norm TEXT NOT NULL,
  body          TEXT NOT NULL
);

CREATE VIRTUAL TABLE entries_fts USING fts5(
  headword_norm,
  content=entries,
  content_rowid=id
);
```

- `headword_norm`: NFD + combining mark 제거 + lowercase
- FTS5는 `content-sync` 모드 (entries 테이블 참조)
- **주의**: FTS 테이블에 `DELETE FROM entries_fts` 사용 금지 → 데이터 손상. 반드시 `DROP TABLE IF EXISTS entries_fts` + 재생성.

---

## 9. 해결된 문제 기록

| 문제 | 원인 | 해결 |
|---|---|---|
| 검색 결과 없음 (wasm 404) | Worker가 `vendor/vendor/sql-wasm.wasm` 경로 요청 | wasmUrl을 `"sql-wasm.wasm"`으로 변경 + 루트 복사본 배치 |
| dict.sqlite 404 | DB URL이 Worker 기준 상대경로로 해석 | URL을 `"../dict.sqlite"`로 변경 |
| Range 요청 미지원 | Python SimpleHTTPServer는 206 미지원 | `scripts/serve.py` 커스텀 핸들러 구현 |
| Mahāvyutpatti 임포트 시 DB 손상 | `DELETE FROM entries_fts` (content-sync FTS5) | `DROP TABLE` + 재생성 방식으로 변경 |
| "disk I/O error" | `maxBytesToRead` 80MB < DB 638MB | 4번째 인자 제거 (Infinity) — **2026-04-10 검증 완료** |
| 정보 과부하 (`chos` 800건 전문) | 85개 사전 결과를 동등 비중으로 표시 | Phase 2.5: 4존 구조 + tier 분류 + 비정확 매치 headword 리스트화 |

---

## 10. 향후 계획

- **Phase 2 (완료)**: bilex.sqlite ✓ / Apple Tibetan Great Dictionary 변환 ✓
- **Phase 2.5 (완료)**: 검색 UI 개편 — 4존 구조, tier 분류, 6그룹, 즐겨찾기, 필터 pill ✓
- **Phase 3**: 원문 리더 (texts/ 트리 + 토큰 클릭 → 사전 연동)
- **Phase 4**: 노트/어휘카드 (IndexedDB + Gist 동기화), 외부 사이트 URL 빌더
- **GitHub 저장소**: UI 안정화 후 생성 예정 (dict.sqlite는 Release 첨부)

---

## 11. 의존성 요약

| 구분 | 패키지 | 용도 |
|---|---|---|
| Python (빌드) | `lxml` | XDXF XML 파싱 |
| Python (빌드) | `pandas`, `xlrd` | Mahāvyutpatti xls 읽기 |
| Python (서버) | 표준 라이브러리만 | `http.server` 기반 Range 서버 |
| JS (런타임) | `sql.js-httpvfs` v0.8.12 | 브라우저 내 SQLite |
