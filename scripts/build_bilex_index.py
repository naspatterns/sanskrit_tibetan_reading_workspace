#!/usr/bin/env python3
"""Build bilex_index.json — in-memory bilex/equiv index for instant lookups.

Extracts all bilex + equiv data from bilex.sqlite, deduplicates entries,
and creates three lookup maps (skt_norm, tib_norm, zh_norm → entry indices).

Output format:
{
  "s": ["mahavyutpatti", "negi", ...],          // source names
  "e": [[skt_iast, tib_wylie, src_idx, ...], ...],  // all entries (deduplicated)
  "k": {"dharma": [0, 5, 12], ...},            // skt_norm → entry indices
  "t": {"chos": [0, 3, 7], ...},               // tib_norm → entry indices
  "z": {"法": [2, 8], ...}                     // zh_norm → entry indices
}

Entry array format: [skt_iast, tib_wylie, src_idx, category?, zh?, entry_num?]
  - Trailing empty/null fields are stripped for compactness.

Usage:
    python3 scripts/build_bilex_index.py
"""
from __future__ import annotations

import gzip
import json
import sqlite3
import sys
import unicodedata
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent.parent / "build"
DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"
BILEX_DB = BUILD_DIR / "bilex.sqlite"


def js_normalize(s: str) -> str:
    """Mirror JS normalize(): NFD + strip combining marks + lowercase + trim.
    Must match docs/bilex.js and docs/lookup.js normalize() exactly."""
    if not s:
        return ""
    nfd = unicodedata.normalize("NFD", s)
    no_marks = "".join(ch for ch in nfd if not unicodedata.combining(ch))
    return no_marks.lower().strip()


def main() -> int:
    if not BILEX_DB.exists():
        print(f"ERROR: {BILEX_DB} not found.")
        return 1

    conn = sqlite3.connect(str(BILEX_DB))

    # Source names
    sources: list[str] = []
    src_map: dict[int, int] = {}
    for r in conn.execute("SELECT id, name FROM equiv_sources ORDER BY id"):
        src_map[r[0]] = len(sources)
        sources.append(r[1])

    entries: list[list] = []
    skt_idx: dict[str, list[int]] = {}
    tib_idx: dict[str, list[int]] = {}
    zh_idx: dict[str, list[int]] = {}

    def add(skt_norm: str, tib_norm: str, zh_norm: str, entry: list) -> None:
        # Re-normalize keys through JS-equivalent function so the index is
        # guaranteed to match what the browser computes at query time.
        # (Some upstream data has non-normalized values in *_norm columns.)
        skt_key = js_normalize(skt_norm)
        tib_key = js_normalize(tib_norm)
        zh_key = js_normalize(zh_norm)
        i = len(entries)
        entries.append(entry)
        if skt_key:
            skt_idx.setdefault(skt_key, []).append(i)
        if tib_key:
            tib_idx.setdefault(tib_key, []).append(i)
        if zh_key:
            zh_idx.setdefault(zh_key, []).append(i)

    def trim(e: list) -> list:
        """Remove trailing empty/None fields."""
        while e and (e[-1] is None or e[-1] == ""):
            e.pop()
        return e

    # equiv entries
    print("Loading equiv entries...")
    for r in conn.execute(
        "SELECT skt_iast, skt_norm, tib_wylie, tib_norm, "
        "       category, zh, zh_norm, source_id FROM equiv"
    ):
        skt_iast, skt_norm, tib_wylie, tib_norm, cat, zh, zh_norm, sid = r
        e = [skt_iast or "", tib_wylie or "", src_map.get(sid, 0), cat or "", zh or "", None]
        add(skt_norm or "", tib_norm or "", zh_norm or "", trim(e))

    # bilex entries (Mahāvyutpatti with entry_num)
    print("Loading bilex entries...")
    for r in conn.execute(
        "SELECT skt_iast, skt_norm, tib_wylie, tib_norm, "
        "       category_zh, entry_num, source_id FROM bilex"
    ):
        skt_iast, skt_norm, tib_wylie, tib_norm, cat, enum, sid = r
        e = [skt_iast or "", tib_wylie or "", src_map.get(sid, 0), cat or "", "", enum]
        add(skt_norm or "", tib_norm or "", "", trim(e))

    conn.close()

    print(f"  Entries: {len(entries):,}")
    print(f"  SKT keys: {len(skt_idx):,}, TIB keys: {len(tib_idx):,}, ZH keys: {len(zh_idx):,}")

    index = {"s": sources, "e": entries, "k": skt_idx, "t": tib_idx, "z": zh_idx}
    raw = json.dumps(index, ensure_ascii=False, separators=(",", ":"))

    out_json = DOCS_DIR / "bilex_index.json"
    with open(out_json, "w", encoding="utf-8") as f:
        f.write(raw)
    raw_mb = out_json.stat().st_size / (1024 * 1024)
    print(f"  {out_json} — {raw_mb:.1f} MB")

    out_gz = DOCS_DIR / "bilex_index.json.gz"
    with gzip.open(out_gz, "wb", compresslevel=9) as f:
        f.write(raw.encode("utf-8"))
    gz_mb = out_gz.stat().st_size / (1024 * 1024)
    print(f"  {out_gz} — {gz_mb:.1f} MB")

    print(f"\nDone! {len(entries):,} bilex entries indexed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
