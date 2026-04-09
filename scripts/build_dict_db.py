#!/usr/bin/env python3
"""
Build a unified SQLite FTS5 dictionary index from XDXF files.

Input:  data-source/xdxf/*.xdxf
Output: build/dict.sqlite

Phase-1 builder. Headword normalization is intentionally simple
(NFD + strip combining marks + lowercase). Refine in later phases.
"""
from __future__ import annotations

import os
import sqlite3
import sys
import unicodedata
from pathlib import Path

try:
    from lxml import etree
except ImportError:
    sys.exit("lxml required: pip install -r scripts/requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
XDXF_DIR = ROOT / "data-source" / "xdxf"
BUILD_DIR = ROOT / "build"
DB_PATH = BUILD_DIR / "dict.sqlite"


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def init_db(conn: sqlite3.Connection) -> None:
    c = conn.cursor()
    c.executescript(
        """
        DROP TABLE IF EXISTS dictionaries;
        DROP TABLE IF EXISTS entries;
        DROP TABLE IF EXISTS entries_fts;

        CREATE TABLE dictionaries (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE,
            lang TEXT
        );
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY,
            dict_id INTEGER REFERENCES dictionaries(id),
            headword TEXT,
            headword_norm TEXT,
            body TEXT
        );
        CREATE INDEX idx_entries_norm ON entries(headword_norm);
        CREATE VIRTUAL TABLE entries_fts USING fts5(
            headword_norm, body, content='entries', content_rowid='id'
        );
        """
    )
    conn.commit()


def parse_xdxf(path: Path):
    """Yield (headword, body_text) from an XDXF file."""
    try:
        ctx = etree.iterparse(str(path), events=("end",), tag="ar", recover=True)
    except Exception as e:
        print(f"  ! parse error: {e}", file=sys.stderr)
        return
    for _, ar in ctx:
        k_el = ar.find("k")
        if k_el is None or not (k_el.text or "").strip():
            ar.clear()
            continue
        headword = "".join(k_el.itertext()).strip()
        body = etree.tostring(ar, encoding="unicode", method="text").strip()
        yield headword, body
        ar.clear()


def main() -> int:
    BUILD_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    cur = conn.cursor()

    xdxf_files = sorted(XDXF_DIR.glob("*.xdxf"))
    if not xdxf_files:
        print(f"No XDXF files in {XDXF_DIR}")
        print("Place .xdxf files there (or symlink the source dir) and re-run.")
        conn.close()
        return 0

    total = 0
    for xf in xdxf_files:
        name = xf.stem
        print(f"Indexing {name} ...")
        cur.execute(
            "INSERT INTO dictionaries(name, lang) VALUES (?, ?)", (name, "sa")
        )
        dict_id = cur.lastrowid
        count = 0
        for headword, body in parse_xdxf(xf):
            cur.execute(
                "INSERT INTO entries(dict_id, headword, headword_norm, body) "
                "VALUES (?, ?, ?, ?)",
                (dict_id, headword, normalize(headword), body),
            )
            count += 1
        print(f"  {count} entries")
        total += count
        conn.commit()

    print("Building FTS index ...")
    cur.execute(
        "INSERT INTO entries_fts(rowid, headword_norm, body) "
        "SELECT id, headword_norm, body FROM entries"
    )
    conn.commit()
    conn.close()

    size_mb = os.path.getsize(DB_PATH) / 1e6
    print(f"Done. {total} entries → {DB_PATH} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
