#!/usr/bin/env python3
"""migrate_normalize_headwords.py — Re-normalize all headword_norm values in dict.sqlite.

Some build scripts (build_dict_db, add_mahavyutpatti, add_apple_dict) did not
route through transliterate.normalize_headword(), so HK-encoded (e.g. 'ajJa')
and Devanagari ('अनु') headwords got normalized incorrectly or not at all.

This migration:
  1. Scans every entry's `headword` field
  2. Re-computes headword_norm via transliterate.normalize_headword()
  3. UPDATEs rows where the value changes
  4. Rebuilds entries_fts index
  5. Prints summary statistics (e.g. 'zanti' → 'santi' merge)

Usage:
    python3 scripts/migrate_normalize_headwords.py              # dry run, reports only
    python3 scripts/migrate_normalize_headwords.py --apply      # actually UPDATE
    python3 scripts/migrate_normalize_headwords.py --apply --no-fts  # skip FTS5 rebuild
"""
from __future__ import annotations

import argparse
import shutil
import sqlite3
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
from transliterate import normalize_headword  # noqa: E402

BUILD_DIR = SCRIPTS_DIR.parent / "build"
DICT_DB = BUILD_DIR / "dict.sqlite"
BACKUP_DB = BUILD_DIR / "dict.sqlite.bak"


def backup() -> None:
    if BACKUP_DB.exists():
        print(f"  backup already exists: {BACKUP_DB}")
        return
    print(f"  backing up {DICT_DB} → {BACKUP_DB} (may take a moment for 2.3GB)...")
    t0 = time.time()
    shutil.copy2(DICT_DB, BACKUP_DB)
    print(f"  backup done in {time.time() - t0:.1f}s")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Actually UPDATE the DB (default: dry run)")
    ap.add_argument("--no-fts", action="store_true", help="Skip FTS5 rebuild")
    ap.add_argument("--batch", type=int, default=50000, help="Rows per commit")
    args = ap.parse_args()

    if not DICT_DB.exists():
        print(f"ERROR: {DICT_DB} not found")
        return 1

    if args.apply:
        print("== Applying normalization migration ==")
        backup()
    else:
        print("== Dry run (no changes will be made) ==")

    conn = sqlite3.connect(str(DICT_DB))
    conn.execute("PRAGMA journal_mode = WAL")

    total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    print(f"  total entries: {total:,}")

    # Count changes and apply in batches
    print("\n  scanning entries...")
    t0 = time.time()
    cursor = conn.execute("SELECT id, headword, headword_norm FROM entries")
    changes: list[tuple[str, int]] = []  # (new_hw_norm, id)
    scanned = 0
    would_change = 0
    samples: list[tuple[str, str, str]] = []  # (hw, old, new) — first 10

    for row_id, hw, hw_old in cursor:
        scanned += 1
        if not hw:
            continue
        hw_new = normalize_headword(hw)
        if hw_new != (hw_old or ""):
            would_change += 1
            if len(samples) < 10:
                samples.append((hw, hw_old or "", hw_new))
            if args.apply:
                changes.append((hw_new, row_id))
                if len(changes) >= args.batch:
                    conn.executemany(
                        "UPDATE entries SET headword_norm = ? WHERE id = ?",
                        changes,
                    )
                    conn.commit()
                    changes.clear()
        if scanned % 500000 == 0:
            print(f"    scanned {scanned:,}/{total:,} — {would_change:,} would change "
                  f"({time.time() - t0:.0f}s)")

    # Flush remaining
    if args.apply and changes:
        conn.executemany(
            "UPDATE entries SET headword_norm = ? WHERE id = ?",
            changes,
        )
        conn.commit()

    print(f"\n  scan complete: {scanned:,} scanned, {would_change:,} need re-normalize "
          f"({100*would_change/total:.2f}%)")
    print(f"  elapsed: {time.time() - t0:.1f}s")

    print("\n  sample changes:")
    for hw, old, new in samples:
        print(f"    hw={hw!r:40s}  old={old!r:25s}  new={new!r}")

    # FTS5 rebuild
    if args.apply and not args.no_fts:
        print("\n  rebuilding entries_fts (may take a few minutes)...")
        t1 = time.time()
        conn.execute("DROP TABLE IF EXISTS entries_fts")
        conn.execute(
            "CREATE VIRTUAL TABLE entries_fts USING fts5("
            "headword_norm, body, body_ko, content='entries', content_rowid='id')"
        )
        conn.execute(
            "INSERT INTO entries_fts(rowid, headword_norm, body, body_ko) "
            "SELECT id, headword_norm, body, body_ko FROM entries"
        )
        conn.commit()
        print(f"  FTS5 rebuild done in {time.time() - t1:.1f}s")

    # Stats after (if applied)
    if args.apply:
        print("\n  post-migration stats:")
        for probe in ("zanti", "santi", "ajja", "ajna", "dharma"):
            n = conn.execute(
                "SELECT COUNT(*) FROM entries WHERE headword_norm = ?", (probe,)
            ).fetchone()[0]
            print(f"    headword_norm={probe!r:15s}: {n}")

    conn.close()

    if not args.apply:
        print("\n  re-run with --apply to UPDATE the DB.")
    else:
        print(f"\n  DONE. Backup at: {BACKUP_DB}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
