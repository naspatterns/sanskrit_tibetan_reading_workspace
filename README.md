# Sanskrit–Tibetan Reading Workspace

**v0.9.0-rc** — 검색 모드 공개 버전 (독해/어휘 모드는 v2에서 활성화 예정)

산스크리트·티벳·한문 다중 사전 검색 웹 워크스페이스.
정적 HTML/JS/CSS + [sql.js-httpvfs](https://github.com/niccokunzmann/sql.js-httpvfs) (브라우저 내 SQLite, HTTP Range 요청).

- **135개 사전**, **3,811,344 엔트리** — 영/독/불/라/한국어 풀이
- **207,095 대역어 쌍** (Skt↔Tib↔Zh), 한문 포함 104,250건
- 8개 대역어 소스: Mahāvyutpatti, Negi, Lokesh Chandra, 84000, Hopkins, DILA, NTI Reader, Yogācārabhūmi
- DB 호스팅: [HuggingFace Datasets](https://huggingface.co/datasets/naspatterns/sanskrit-tibetan-dict) (dict.sqlite 2.3GB + bilex.sqlite 51MB)

---

## 데모

GitHub Pages: *배포 후 URL 추가 예정*

---

## 주요 기능 (v0.9.0)

### 검색 모드
- 단어 입력 → **4-Zone 결과** 표시
  - **Zone A**: 종합 요약 (tier 1-2 사전 첫 150자)
  - **Zone B**: 대역어 (Skt↔Tib↔Zh, 8소스, 소스 배지)
  - **Zone C**: 정확 매치 전문 (6그룹: 영어/독어/불어·라틴/대역/원어/보조)
  - **Zone D**: 관련 표제어 리스트 (클릭 → 새 검색)
- IAST, Wylie, 한문(CJK) 입력 지원
- 사이드바: 6개 그룹 필터, 즐겨찾기, 사전별 네비게이션
- DE/FR/LA 사전 본문 한국어 번역 + "원문 보기" 토글

### v2 예정 기능
- **독해 모드**: 3-패널 (파일트리 | 텍스트 | 사전조회), 토큰 클릭 → 즉시 검색
- **어휘 모드**: IndexedDB 기반 단어 카드 (new/learning/known 상태)

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | 순수 HTML/JS/CSS (프레임워크 없음) |
| DB 엔진 | sql.js-httpvfs v0.8.12 (브라우저 내 SQLite) |
| DB 호스팅 | HuggingFace Datasets CDN (HTTP Range 요청) |
| 웹 호스팅 | GitHub Pages (정적) |
| 빌드 | Python 3 스크립트 (lxml, pandas) |

---

## 로컬 개발

```bash
# 환경
python3 -m venv .venv && source .venv/bin/activate
pip install lxml pandas xlrd

# 개발 서버 (Range 요청 지원 필수)
python3 scripts/serve.py 8000
# → http://localhost:8000/web/
```

> `python3 -m http.server`는 Range 요청 미지원 → sql.js-httpvfs 작동 불가. 반드시 `serve.py` 사용.

---

## 디렉터리 구조

```
├── web/                     ← GitHub Pages 루트
│   ├── index.html           ← 검색 UI (독해/어휘 탭 비활성)
│   ├── app.js               ← UI 오케스트레이터
│   ├── lookup.js            ← dict.sqlite FTS5 쿼리 래퍼
│   ├── bilex.js             ← Skt↔Tib↔Zh 대역어 조회
│   ├── reader.js            ← 독해 모드 (v2)
│   ├── vocab.js             ← 어휘 카드 (v2)
│   ├── dictnames.js         ← 135개 사전 메타데이터
│   └── vendor/              ← sql.js-httpvfs v0.8.12
├── scripts/                 ← Python 빌드 파이프라인 (22개)
├── build/                   ← dict.sqlite (2.3GB) + bilex.sqlite (51MB) — .gitignore
├── data-source/             ← 원시 데이터 — .gitignore 일부
├── texts/                   ← 내장 원문 (Hrdaya, Vajracchedika)
├── BUILD_STATUS.md          ← 상세 빌드 문서 + 해결 기록
├── CLAUDE.md                ← Claude Code 프로젝트 컨텍스트
└── LICENSES.md              ← 소스별 라이선스 상세
```

---

## 보안

- CSP (Content-Security-Policy) 메타 태그 적용
- SRI (Subresource Integrity) 해시 — vendor/index.js
- CSS 인젝션 방지 (safeColor hex 검증)
- XSS 방지 (escapeHtml 따옴표 포함)
- localStorage/IndexedDB 입력 검증
- Import 제한 (카드 10,000개, 필드 10,000자)
- 서버 보안 헤더 (X-Content-Type-Options, X-Frame-Options 등)

---

## 성능 최적화 (v0.9.0)

- 검색 결과 제한 (500건) + 입력 디바운싱 (300ms)
- 이벤트 위임 패턴 (results, lookupResults, vocabList)
- in-place DOM 토글 (전체 재렌더링 제거)
- Zone D 페이지네이션 (100개씩 lazy append)
- bilex 중복 DB 쿼리 제거 (enrichZh 삭제)
- WASM preload (`<link rel="preload">`)

---

## 라이선스

- **소스 코드** (scripts/, web/): [MIT License](LICENSE)
- **사전 데이터**: 다양한 학술·오픈소스 프로젝트에서 수집. 소스별 상세는 [LICENSES.md](LICENSES.md) 참조.
  - CC0 (Public Domain): Steinert 티벳 사전 64종, DILA, Yogācārabhūmi Index
  - CC-BY-SA 3.0: NTI Reader Buddhist Dictionary
  - Historical: 19세기 산스크리트 사전류 (Monier-Williams, Apte, Böhtlingk-Roth 등)
  - Unverified: 일부 Apple Dictionary 및 SANDIC 출처 — 확인 진행 중

### 저작권 관련 문의

이 프로젝트에 포함된 자료의 저작권에 문제가 있는 경우, **naspatterns@gmail.com**으로 연락해 주세요.
확인 즉시 해당 데이터 제거 등 **즉각 조치**하겠습니다.

---

## 버전 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v0.9.0-rc | 2026-04-12 | 검색 모드 공개 버전. 보안 감사 11건 완료, 성능 최적화 11건 완료. 독해/어휘 모드 v2로 연기. |
