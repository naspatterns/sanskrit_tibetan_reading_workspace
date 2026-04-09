#!/usr/bin/env python3
"""
Ingest Apple dictionary JSONL exports into dict.sqlite.

Input: data-source/apple-converted/<name>.jsonl  (from convert_apple_dict.py)
Each line: {"headword": "...", "body": "..."}

Headwords are stored as-is (Tibetan Unicode, Devanagari, etc.).
For Tibetan Unicode headwords, a Wylie transliteration is generated as
headword_norm for FTS search compatibility.

Run after build_dict_db.py (and optionally add_mahavyutpatti/add_tibdict);
appends into existing dict.sqlite and rebuilds FTS.
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "build" / "dict.sqlite"
CONVERTED_DIR = ROOT / "data-source" / "apple-converted"

# Tibetan Unicode range
TIBETAN_RE = re.compile(r"[\u0F00-\u0FFF]")


def normalize(s: str) -> str:
    """NFD + strip combining + lowercase (matches build_dict_db.normalize)."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def tibetan_to_approx_wylie(s: str) -> str:
    """Tibetan Unicode → approximate Wylie transliteration.

    Simple linear approach: output each consonant/subjoined as its base
    letter (no implicit vowel), output vowel signs as-is, then if a
    syllable had no explicit vowel, insert 'a' after the consonant stack.
    """
    # Consonant base (no implicit vowel)
    CONS = {
        0x0F40: "k", 0x0F41: "kh", 0x0F42: "g", 0x0F43: "g",
        0x0F44: "ng",
        0x0F45: "c", 0x0F46: "ch", 0x0F47: "j", 0x0F49: "ny",
        0x0F4F: "t", 0x0F50: "th", 0x0F51: "d", 0x0F52: "d",
        0x0F53: "n",
        0x0F54: "p", 0x0F55: "ph", 0x0F56: "b", 0x0F57: "b",
        0x0F58: "m",
        0x0F59: "ts", 0x0F5A: "tsh", 0x0F5B: "dz", 0x0F5C: "dz",
        0x0F5D: "w", 0x0F5E: "zh", 0x0F5F: "z",
        0x0F60: "'", 0x0F61: "y", 0x0F62: "r", 0x0F63: "l",
        0x0F64: "sh", 0x0F65: "sh", 0x0F66: "s", 0x0F67: "h",
        0x0F68: "",  # a-chung
    }
    VOWEL = {0x0F72: "i", 0x0F74: "u", 0x0F7A: "e", 0x0F7C: "o"}
    SUB_OFFSET = 0x50

    # Valid suffix consonants in Tibetan
    SUFFIX_CPS = {0x0F42, 0x0F44, 0x0F51, 0x0F53, 0x0F56, 0x0F58,
                  0x0F60, 0x0F62, 0x0F63, 0x0F66}  # g ng d n b m ' r l s
    # Valid post-suffix: ས(s) after certain suffixes, ད(d) after certain
    POST_SUFFIX_CPS = {0x0F66, 0x0F51}  # s, d

    def _syllable(cps: list[int]) -> str:
        # Classify each codepoint
        items = []  # (type, cp, wylie)
        for cp in cps:
            if cp in CONS:
                items.append(("c", cp, CONS[cp]))
            elif 0x0F90 <= cp <= 0x0FBC and (cp - SUB_OFFSET) in CONS:
                items.append(("s", cp, CONS[cp - SUB_OFFSET]))
            elif cp in VOWEL:
                items.append(("v", cp, VOWEL[cp]))
            elif cp == 0x0F84:
                items.append(("h", cp, ""))

        if not items:
            return ""

        has_vowel = any(t == "v" for t, _, _ in items)
        has_sub = any(t == "s" for t, _, _ in items)
        has_halanta = any(t == "h" for t, _, _ in items)

        # Simple case: explicit vowel present — just output in order
        if has_vowel or has_halanta:
            return "".join(w for _, _, w in items)

        # No explicit vowel: need to insert implicit 'a' at the right place.
        # If subjoined consonants exist, 'a' goes after the last subjoined.
        if has_sub:
            parts = [w for _, _, w in items]
            # Find position after last subjoined
            last_sub = max(i for i, (t, _, _) in enumerate(items) if t == "s")
            parts.insert(last_sub + 1, "a")
            return "".join(parts)

        # All root consonants, no vowel, no subjoined.
        # Use suffix stripping to find where 'a' goes.
        cons = [(i, cp, w) for i, (t, cp, w) in enumerate(items) if t == "c"]
        if len(cons) <= 1:
            # Single consonant → add 'a'
            return "".join(w for _, _, w in items) + "a" if cons else ""

        # Try to strip post-suffix and suffix from the end
        n_suffix = 0
        remaining_cps = [cp for _, cp, _ in cons]

        # Check post-suffix (last consonant)
        if len(remaining_cps) >= 3 and remaining_cps[-1] in POST_SUFFIX_CPS:
            # Check if second-to-last is a valid suffix
            if remaining_cps[-2] in SUFFIX_CPS:
                n_suffix = 2
            else:
                n_suffix = 1 if remaining_cps[-1] in SUFFIX_CPS else 0
        elif len(remaining_cps) >= 2 and remaining_cps[-1] in SUFFIX_CPS:
            n_suffix = 1

        # The root stack = everything except the suffix consonants
        stack_len = len(cons) - n_suffix
        if stack_len < 1:
            stack_len = 1  # at least one root consonant

        # Build output: stack + 'a' + suffixes
        parts = []
        for idx, (_, _, w) in enumerate(cons):
            parts.append(w)
            if idx == stack_len - 1:
                parts.append("a")
        return "".join(parts)

    # Split at tsheg / shad
    syllables = []
    current: list[int] = []
    for ch in s:
        cp = ord(ch)
        if cp in (0x0F0B, 0x0F0D):
            if current:
                syllables.append(_syllable(current))
                current = []
        elif 0x0F00 <= cp <= 0x0FFF:
            current.append(cp)
        elif ch.isascii() and not ch.isspace():
            current.append(cp)
        elif ch.isspace() and current:
            syllables.append(_syllable(current))
            current = []
    if current:
        syllables.append(_syllable(current))

    return " ".join(s for s in syllables if s)


def is_tibetan(s: str) -> bool:
    return bool(TIBETAN_RE.search(s))


# Dict name mapping for known Apple dictionaries
DICT_NAMES = {
    "Tibetan Great Dictionary": ("apple_bod_rgya_tshig_mdzod", "tib"),
}


def main() -> int:
    if not DB_PATH.exists():
        sys.exit(f"dict.sqlite not found at {DB_PATH}; run build_dict_db.py first")

    jsonl_files = sorted(CONVERTED_DIR.glob("*.jsonl"))
    if not jsonl_files:
        sys.exit(f"No .jsonl files in {CONVERTED_DIR}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total_inserted = 0
    for jf in jsonl_files:
        stem = jf.stem
        dict_name, lang = DICT_NAMES.get(stem, (f"apple_{stem.lower().replace(' ', '_')}", "unk"))

        print(f"Processing: {jf.name} → dict '{dict_name}'")

        # Remove old entries if re-running
        cur.execute("DELETE FROM entries WHERE dict_id IN (SELECT id FROM dictionaries WHERE name = ?)", (dict_name,))
        cur.execute("DELETE FROM dictionaries WHERE name = ?", (dict_name,))
        cur.execute("INSERT INTO dictionaries(name, lang) VALUES (?, ?)", (dict_name, lang))
        dict_id = cur.lastrowid

        entries = []
        with open(jf, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)
                hw = obj["headword"]
                body = obj["body"]
                if not hw or not body:
                    continue
                # Generate searchable norm
                if is_tibetan(hw):
                    hw_norm = normalize(tibetan_to_approx_wylie(hw))
                else:
                    hw_norm = normalize(hw)
                entries.append((dict_id, hw, hw_norm, body))

        # Batch insert
        batch_size = 5000
        for i in range(0, len(entries), batch_size):
            cur.executemany(
                "INSERT INTO entries(dict_id, headword, headword_norm, body) VALUES (?, ?, ?, ?)",
                entries[i : i + batch_size],
            )
            if (i // batch_size) % 5 == 0:
                print(f"  inserted {min(i + batch_size, len(entries))}/{len(entries)} ...", flush=True)

        total_inserted += len(entries)
        print(f"  → {len(entries)} entries as '{dict_name}'")

    # Rebuild FTS
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

    total = cur.execute("SELECT count(*) FROM entries").fetchone()[0]
    ndicts = cur.execute("SELECT count(*) FROM dictionaries").fetchone()[0]
    conn.close()
    print(f"Done. Added {total_inserted} entries. DB now has {total} entries / {ndicts} dicts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
