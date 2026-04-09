#!/usr/bin/env python3
"""
Ingest Christian Steinert's tibetan-dictionary public CSVs into dict.sqlite.

Source: data-source/tibdict/<NN-name>
Format: each line is `wylie|definition` where '\\n' literal denotes a line break.
        Lines starting with '#' are comments. Empty lines are skipped.

Each input file becomes one dictionary in `dictionaries`. Headwords are
stored as Wylie; the definition body is stored as plain text with `\\n`
unescaped to real newlines.

Run after build_dict_db.py + add_mahavyutpatti.py; appends and rebuilds FTS.

License: dictionary content belongs to original authors. See
data-source/tibdict/LICENSE and the Steinert repo
(https://github.com/christiansteinert/tibetan-dictionary) for details.
"""
from __future__ import annotations

import sqlite3
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "data-source" / "tibdict"
DB_PATH = ROOT / "build" / "dict.sqlite"
PREFIX = "tib_"  # dict_id name prefix to keep entries grouped


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def iter_entries(path: Path):
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if not line or line.lstrip().startswith("#"):
                continue
            if "|" not in line:
                continue
            head, _, body = line.partition("|")
            head = head.strip()
            if not head:
                continue
            body = body.replace("\\n", "\n").strip()
            yield head, body


def main() -> int:
    if not DB_PATH.exists():
        sys.exit(f"dict.sqlite not found at {DB_PATH}; run build_dict_db.py first")
    if not SRC_DIR.exists():
        sys.exit(f"source dir not found: {SRC_DIR}")

    files = sorted(p for p in SRC_DIR.iterdir() if p.is_file() and p.name != "LICENSE")
    if not files:
        sys.exit(f"no input files in {SRC_DIR}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Wipe any previous tib_* entries before re-ingest.
    cur.execute(
        "DELETE FROM entries WHERE dict_id IN "
        "(SELECT id FROM dictionaries WHERE name LIKE ?)",
        (f"{PREFIX}%",),
    )
    cur.execute("DELETE FROM dictionaries WHERE name LIKE ?", (f"{PREFIX}%",))

    total = 0
    for fp in files:
        name = PREFIX + fp.name
        cur.execute("INSERT INTO dictionaries(name, lang) VALUES (?, ?)", (name, "bo"))
        dict_id = cur.lastrowid
        count = 0
        batch = []
        for head, body in iter_entries(fp):
            batch.append((dict_id, head, normalize(head), body))
            count += 1
            if len(batch) >= 5000:
                cur.executemany(
                    "INSERT INTO entries(dict_id, headword, headword_norm, body) "
                    "VALUES (?, ?, ?, ?)",
                    batch,
                )
                batch.clear()
        if batch:
            cur.executemany(
                "INSERT INTO entries(dict_id, headword, headword_norm, body) "
                "VALUES (?, ?, ?, ?)",
                batch,
            )
        print(f"  {fp.name:50s} {count:>7d}")
        total += count
        conn.commit()

    print(f"Total Tibetan entries: {total}")
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
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
