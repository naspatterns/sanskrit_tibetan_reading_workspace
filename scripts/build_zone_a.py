#!/usr/bin/env python3
"""Build zone_a.json — pre-computed Zone A snippets for instant rendering.

Extracts 50-char body snippets from core tier-1 dictionaries so Zone A
can render immediately from memory without HTTP Range requests.

Output format:
{
  "d": ["mwse.dict", "macdse.dict", "tib_02-RangjungYeshe"],
  "i": {
    "dharma": [[0, "m. that which is established..."], [1, "m. established order..."]],
    ...
  }
}

Usage:
    python3 scripts/build_zone_a.py
"""
from __future__ import annotations

import gzip
import json
import sqlite3
import sys
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent.parent / "build"
DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
DICT_DB = BUILD_DIR / "dict.sqlite"

# Core dictionaries for Zone A (covers Sanskrit + Tibetan)
CORE_DICTS = ["mwse.dict", "macdse.dict", "tib_02-RangjungYeshe"]
SNIPPET_LEN = 50


def main() -> int:
    if not DICT_DB.exists():
        print(f"ERROR: {DICT_DB} not found.")
        return 1

    conn = sqlite3.connect(str(DICT_DB))

    dict_ids: dict[int, str] = {}
    for r in conn.execute("SELECT id, name FROM dictionaries"):
        if r[1] in CORE_DICTS:
            dict_ids[r[0]] = r[1]

    if not dict_ids:
        print("ERROR: No matching dictionaries found.")
        return 1

    dname_idx = {n: i for i, n in enumerate(CORE_DICTS)}
    phs = ",".join(str(k) for k in dict_ids.keys())

    print(f"Core dicts: {len(dict_ids)} — {', '.join(CORE_DICTS)}")
    print(f"Snippet length: {SNIPPET_LEN} chars")
    print("Building index...")

    index: dict[str, list] = {}
    count = 0
    for r in conn.execute(
        f"SELECT headword_norm, d.name, "
        f"       SUBSTR(COALESCE(body_ko, body, ''), 1, {SNIPPET_LEN}) as snippet "
        f"FROM entries e JOIN dictionaries d ON d.id = e.dict_id "
        f"WHERE e.dict_id IN ({phs}) AND headword_norm != '' "
        f"ORDER BY headword_norm"
    ):
        hn, dname, snippet = r
        if not snippet:
            continue
        snippet = snippet.replace("\n", " ").strip()
        if not snippet:
            continue
        di = dname_idx.get(dname)
        if di is None:
            continue
        if hn not in index:
            index[hn] = []
        # One entry per dict
        if not any(e[0] == di for e in index[hn]):
            index[hn].append([di, snippet])
            count += 1

    conn.close()

    print(f"  {len(index):,} headwords, {count:,} snippets")

    data = {"d": CORE_DICTS, "i": index}
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    out_json = DOCS_DIR / "zone_a.json"
    with open(out_json, "w", encoding="utf-8") as f:
        f.write(raw)
    raw_mb = out_json.stat().st_size / (1024 * 1024)
    print(f"  {out_json} — {raw_mb:.1f} MB")

    out_gz = DOCS_DIR / "zone_a.json.gz"
    with gzip.open(out_gz, "wb", compresslevel=9) as f:
        f.write(raw.encode("utf-8"))
    gz_mb = out_gz.stat().st_size / (1024 * 1024)
    print(f"  {out_gz} — {gz_mb:.1f} MB")

    print(f"\nDone! {count:,} snippets for instant Zone A.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
