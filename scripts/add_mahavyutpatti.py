#!/usr/bin/env python3
"""
Add Mahāvyutpatti (Skt↔Tib bilingual) entries to build/dict.sqlite.

Source: ../Sanskrit_Tibetan_Reading_Tools/Mahavyutpatti/번역명의대집.xls
Column layout (header-less):
  [0] int id, [1] "[id]", [2] 【Chinese category】, [3] Tibetan (Wylie),
  [4] Sanskrit (Harvard-Kyoto / SLP1-ish), [5..] unused.

Each row is inserted TWICE — once keyed by Tibetan headword, once by
Sanskrit — so searching either side hits the entry. The body text carries
both sides plus the Chinese category.

Run after build_dict_db.py; appends into the existing dict.sqlite.
"""
from __future__ import annotations

import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("pandas required: pip install pandas xlrd")

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "build" / "dict.sqlite"
XLS_PATH = (
    ROOT.parent
    / "Sanskrit_Tibetan_Reading_Tools"
    / "Mahavyutpatti"
    / "번역명의대집.xls"
)
DICT_NAME = "mahavyutpatti"


# --- Sanskrit SLP1/HK → IAST-ish folding for indexing ----------------------

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
    """NFD + strip combining + lowercase (matches build_dict_db.normalize)."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def clean_cell(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).strip()


def main() -> int:
    if not DB_PATH.exists():
        sys.exit(f"dict.sqlite not found at {DB_PATH}; run build_dict_db.py first")
    if not XLS_PATH.exists():
        sys.exit(f"Mahāvyutpatti xls not found at {XLS_PATH}")

    print(f"Reading {XLS_PATH.name} ...")
    df = pd.read_excel(XLS_PATH, sheet_name=0, header=None)

    rows = []
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
        rows.append((mvy_id, category, tib, skt_slp1, skt_iast))

    print(f"  {len(rows)} usable entries")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("DELETE FROM entries WHERE dict_id IN (SELECT id FROM dictionaries WHERE name = ?)", (DICT_NAME,))
    cur.execute("DELETE FROM dictionaries WHERE name = ?", (DICT_NAME,))
    cur.execute("INSERT INTO dictionaries(name, lang) VALUES (?, ?)", (DICT_NAME, "sa-bo"))
    dict_id = cur.lastrowid

    inserted = 0
    for mvy_id, category, tib, skt_slp1, skt_iast in rows:
        body_lines = [f"[Mvy {mvy_id}]"]
        if category:
            body_lines.append(category)
        if skt_iast:
            body_lines.append(f"Skt: {skt_iast}")
        if skt_slp1 and skt_slp1 != skt_iast:
            body_lines.append(f"Skt (raw): {skt_slp1}")
        if tib:
            body_lines.append(f"Tib: {tib}")
        body = "\n".join(body_lines)

        if tib:
            cur.execute(
                "INSERT INTO entries(dict_id, headword, headword_norm, body) VALUES (?, ?, ?, ?)",
                (dict_id, tib, normalize(tib), body),
            )
            inserted += 1
        if skt_iast:
            cur.execute(
                "INSERT INTO entries(dict_id, headword, headword_norm, body) VALUES (?, ?, ?, ?)",
                (dict_id, skt_iast, normalize(skt_iast), body),
            )
            inserted += 1

    print("Rebuilding FTS index ...")
    cur.execute("DROP TABLE IF EXISTS entries_fts")
    cur.execute(
        "CREATE VIRTUAL TABLE entries_fts USING fts5("
        "headword_norm, body, content='entries', content_rowid='id')"
    )
    cur.execute(
        "INSERT INTO entries_fts(rowid, headword_norm, body) "
        "SELECT id, headword_norm, body FROM entries"
    )

    conn.commit()
    conn.close()
    print(f"Inserted {inserted} Mahāvyutpatti rows (as dict '{DICT_NAME}').")
    return 0


if __name__ == "__main__":
    sys.exit(main())
