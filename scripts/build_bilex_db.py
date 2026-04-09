#!/usr/bin/env python3
"""
Build bilex.sqlite — a dedicated bilingual lexicon for Tibetan↔Sanskrit lookup.

Source: ../Sanskrit_Tibetan_Reading_Tools/Mahavyutpatti/번역명의대집.xls
Schema optimized for bidirectional reverse-lookup (Tib→Skt, Skt→Tib).

Separate from dict.sqlite so bilingual relationships are explicit and
reverse-lookup queries are fast without scanning dictionary body text.

Run independently of dict.sqlite build pipeline.
"""
from __future__ import annotations

import sqlite3
import sys
import unicodedata
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas required: pip install pandas xlrd")

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build"
DB_PATH = BUILD_DIR / "bilex.sqlite"
XLS_PATH = (
    ROOT.parent
    / "Sanskrit_Tibetan_Reading_Tools"
    / "Mahavyutpatti"
    / "번역명의대집.xls"
)

# --- SLP1 → IAST conversion --------------------------------------------------

_SLP1_IAST = {
    "A": "ā", "I": "ī", "U": "ū",
    "R": "ṛ", "L": "ḷ",
    "M": "ṃ", "H": "ḥ",
    "G": "ṅ", "J": "ñ",
    "T": "ṭ", "D": "ḍ", "N": "ṇ",
    "S": "ṣ", "z": "ś",
    "~": "ñ",
}


def slp1_to_iast(s: str) -> str:
    return "".join(_SLP1_IAST.get(c, c) for c in s)


def normalize(s: str) -> str:
    """NFD + strip combining + lowercase."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def clean_cell(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).strip()


def create_schema(cur: sqlite3.Cursor) -> None:
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS sources (
            id   INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            desc_text TEXT
        );

        CREATE TABLE IF NOT EXISTS bilex (
            id          INTEGER PRIMARY KEY,
            source_id   INTEGER NOT NULL REFERENCES sources(id),
            entry_num   INTEGER,
            skt_iast    TEXT NOT NULL DEFAULT '',
            skt_slp1    TEXT NOT NULL DEFAULT '',
            skt_norm    TEXT NOT NULL DEFAULT '',
            tib_wylie   TEXT NOT NULL DEFAULT '',
            tib_norm    TEXT NOT NULL DEFAULT '',
            category_zh TEXT NOT NULL DEFAULT '',
            gloss_en    TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_bilex_skt_norm ON bilex(skt_norm);
        CREATE INDEX IF NOT EXISTS idx_bilex_tib_norm ON bilex(tib_norm);
        CREATE INDEX IF NOT EXISTS idx_bilex_source   ON bilex(source_id);
    """)


def main() -> int:
    if not XLS_PATH.exists():
        sys.exit(f"Mahāvyutpatti xls not found at {XLS_PATH}")

    BUILD_DIR.mkdir(exist_ok=True)

    print(f"Reading {XLS_PATH.name} ...")
    df = pd.read_excel(XLS_PATH, sheet_name=0, header=None)

    # Parse rows
    entries = []
    for _, r in df.iterrows():
        raw_id = r[0] if 0 in r.index else None
        if not isinstance(raw_id, (int, float)) or pd.isna(raw_id):
            continue
        try:
            mvy_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        category = clean_cell(r[2])
        tib = clean_cell(r[3])
        skt_slp1 = clean_cell(r[4])
        if not (tib or skt_slp1):
            continue
        skt_iast = slp1_to_iast(skt_slp1) if skt_slp1 else ""
        entries.append((mvy_id, category, tib, skt_slp1, skt_iast))

    print(f"  {len(entries)} usable entries")

    # Build DB
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("PRAGMA page_size = 4096")
    cur.execute("PRAGMA journal_mode = WAL")

    create_schema(cur)

    # Insert source
    cur.execute(
        "INSERT INTO sources(name, desc_text) VALUES (?, ?)",
        ("mahavyutpatti", "Mahāvyutpatti (翻譯名義大集) — ~9,500 Skt↔Tib terms"),
    )
    source_id = cur.lastrowid

    # Insert entries
    for mvy_id, category, tib, skt_slp1, skt_iast in entries:
        cur.execute(
            "INSERT INTO bilex(source_id, entry_num, skt_iast, skt_slp1, skt_norm, "
            "tib_wylie, tib_norm, category_zh) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                source_id,
                mvy_id,
                skt_iast,
                skt_slp1,
                normalize(skt_iast),
                tib,
                normalize(tib),
                category,
            ),
        )

    # FTS for flexible matching
    cur.execute("DROP TABLE IF EXISTS bilex_fts")
    cur.execute(
        "CREATE VIRTUAL TABLE bilex_fts USING fts5("
        "skt_norm, tib_norm, content='bilex', content_rowid='id')"
    )
    cur.execute(
        "INSERT INTO bilex_fts(rowid, skt_norm, tib_norm) "
        "SELECT id, skt_norm, tib_norm FROM bilex"
    )

    conn.commit()

    # Verify
    count = cur.execute("SELECT count(*) FROM bilex").fetchone()[0]
    conn.close()
    print(f"Built {DB_PATH} — {count} bilex entries")
    print(f"  File size: {DB_PATH.stat().st_size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
