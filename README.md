# Sanskrit–Tibetan Reading Workspace (Renewal)

산스크리트·티벳 일차문헌 독해를 위한 통합 작업공간. 기존 `../Sanskrit_Tibetan_Reading_Tools/sanskrit_tibetan_workspace/` 의 리뉴얼 개발 디렉터리.

- 설계 문서: `~/.claude/plans/adaptive-questing-squid.md`
- 선행 설계: `~/.claude/plans/velvet-nibbling-cake.md`

## 목표
- 다중 사전 일괄 조회 (MW / Apte / PW / Negi / Mahāvyutpatti 등)
- 티벳 ↔ 산스크리트 대역어 추적
- 개인 독해 노트 · 어휘카드 축적
- GitHub Pages 정적 호스팅 (sql.js-httpvfs로 Range 요청)

## 디렉터리
```
scripts/       DB 빌드 스크립트
  build_dict_db.py       XDXF → dict.sqlite (FTS5)
  requirements.txt
data-source/
  xdxf/                  원본 XDXF 사전 (상위 폴더에서 심볼릭)
  apple-converted/       Apple .dictionary → JSON (Phase 2)
  bilex/                 Mahāvyutpatti 원본
build/                   CI/로컬 빌드 산출물 (gitignore)
web/                     GitHub Pages 루트
  index.html app.js style.css vendor/
texts/                   독해 대상 원문 (IAST / Wylie plain text)
  sanskrit/  tibetan/
notes/                   저장소 커밋형 노트 백업 (선택)
.github/workflows/       CI 빌드 + Pages 배포
```

## Phase 0 (현재)
부트스트랩. 디렉터리 뼈대, 기본 스크립트, 검색 UI stub 배치.

### 로컬 검증
```bash
# 1) XDXF 사전 심볼릭 링크 (상위 폴더 기준)
ln -s "../../Sanskrit_Tibetan_Reading_Tools/sanskrit_dictionaries_xml"/*.xdxf data-source/xdxf/

# 2) 의존성
python3 -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt

# 3) 사전 DB 빌드
python3 scripts/build_dict_db.py
sqlite3 build/dict.sqlite "SELECT name, COUNT(*) FROM dictionaries d JOIN entries e ON e.dict_id=d.id GROUP BY d.id;"

# 4) 정적 서버
cd web && python3 -m http.server 8000
```

## 다음 단계
- Phase 1: `web/lookup.js` + sql.js-httpvfs 연결 → 실제 다중 사전 검색.
- Phase 2: `build_bilex_db.py` (Mahāvyutpatti) + Apple .dictionary 변환.
- Phase 3+: 원문 리더 · 노트 · 외부 자료 통합.
