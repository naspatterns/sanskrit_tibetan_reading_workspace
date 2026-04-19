#!/usr/bin/env python3
"""
transliterate.py — Unified transliteration utilities for Sanskrit headwords.

All build scripts import from here to ensure consistent IAST normalization.
Supported input scripts: Devanagari, Harvard-Kyoto (HK), SLP1, IAST passthrough.

Usage:
    from transliterate import normalize, normalize_headword, hk_to_iast, slp1_to_iast
"""
from __future__ import annotations

import re
import unicodedata


# ═══════════════════════════════════════════════════════════════════════
#  Harvard-Kyoto (HK) → IAST
# ═══════════════════════════════════════════════════════════════════════

# Multi-char replacements MUST be applied first (order matters).
_HK_MULTI = [
    ("lRR", "ḹ"),
    ("lR", "ḷ"),
    ("RR", "ṝ"),
    ("Th", "ṭh"),
    ("Dh", "ḍh"),
    ("~n", "ñ"),
]

_HK_SINGLE: dict[str, str] = {
    "A": "ā",
    "I": "ī",
    "U": "ū",
    "R": "ṛ",
    "M": "ṃ",
    "H": "ḥ",
    "G": "ṅ",
    "J": "ñ",
    "T": "ṭ",
    "D": "ḍ",
    "N": "ṇ",
    "z": "ś",
    "S": "ṣ",
}


def hk_to_iast(s: str) -> str:
    """Convert Harvard-Kyoto romanization to IAST."""
    for hk, iast in _HK_MULTI:
        s = s.replace(hk, iast)
    for hk, iast in _HK_SINGLE.items():
        s = s.replace(hk, iast)
    return s


# ═══════════════════════════════════════════════════════════════════════
#  SLP1 → IAST
# ═══════════════════════════════════════════════════════════════════════

# Character-level mapping used by add_mahavyutpatti.py (moved here).
_SLP1_IAST: dict[str, str] = {
    "A": "ā",
    "I": "ī",
    "U": "ū",
    "R": "ṛ",
    "L": "ḷ",
    "M": "ṃ",
    "H": "ḥ",
    "G": "ṅ",
    "J": "ñ",
    "T": "ṭ",
    "D": "ḍ",
    "N": "ṇ",
    "S": "ṣ",
    "z": "ś",
    "~": "ñ",
}


def slp1_to_iast(s: str) -> str:
    """Convert SLP1 encoding to IAST."""
    return "".join(_SLP1_IAST.get(c, c) for c in s)


# ═══════════════════════════════════════════════════════════════════════
#  Devanagari → IAST
# ═══════════════════════════════════════════════════════════════════════

_DEVA_INDEPENDENT_VOWELS: dict[str, str] = {
    "अ": "a", "आ": "ā", "इ": "i", "ई": "ī",
    "उ": "u", "ऊ": "ū", "ऋ": "ṛ", "ॠ": "ṝ",
    "ऌ": "ḷ", "ॡ": "ḹ", "ए": "e", "ऐ": "ai",
    "ओ": "o", "औ": "au",
}

_DEVA_CONSONANTS: dict[str, str] = {
    # Velars
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ṅ",
    # Palatals
    "च": "c", "छ": "ch", "ज": "j", "झ": "jh", "ञ": "ñ",
    # Retroflexes
    "ट": "ṭ", "ठ": "ṭh", "ड": "ḍ", "ढ": "ḍh", "ण": "ṇ",
    # Dentals
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    # Labials
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    # Semi-vowels
    "य": "y", "र": "r", "ल": "l", "व": "v",
    # Sibilants
    "श": "ś", "ष": "ṣ", "स": "s",
    # Aspirate
    "ह": "h",
}

_DEVA_MATRAS: dict[str, str] = {
    "ा": "ā", "ि": "i", "ी": "ī",
    "ु": "u", "ू": "ū", "ृ": "ṛ",
    "ॄ": "ṝ", "ॢ": "ḷ", "ॣ": "ḹ",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
}

_DEVA_SPECIAL: dict[str, str] = {
    "ं": "ṃ",   # anusvāra
    "ः": "ḥ",   # visarga
    "ँ": "m̐",  # candrabindu (nasalization)
    "ऽ": "'",   # avagraha
    "।": "|",   # danda
    "॥": "||",  # double danda
    "ॐ": "oṃ",  # om
}

# Virama (halant) — suppresses inherent 'a'
_VIRAMA = "\u094D"


def devanagari_to_iast(s: str) -> str:
    """Convert Devanagari Unicode string to IAST romanization."""
    result: list[str] = []
    i = 0
    n = len(s)

    while i < n:
        ch = s[i]

        # Independent vowels
        # Check two-char vowels first (आ, ऐ, औ etc.)
        if i + 1 < n and (s[i : i + 2] in _DEVA_INDEPENDENT_VOWELS):
            result.append(_DEVA_INDEPENDENT_VOWELS[s[i : i + 2]])
            i += 2
            continue
        if ch in _DEVA_INDEPENDENT_VOWELS:
            result.append(_DEVA_INDEPENDENT_VOWELS[ch])
            i += 1
            continue

        # Consonants
        if ch in _DEVA_CONSONANTS:
            result.append(_DEVA_CONSONANTS[ch])
            i += 1
            # Check for virama (halant) or matra
            if i < n and s[i] == _VIRAMA:
                # Virama: suppress inherent 'a'
                i += 1
            elif i < n and s[i] in _DEVA_MATRAS:
                # Matra: replace inherent 'a' with vowel sign
                result.append(_DEVA_MATRAS[s[i]])
                i += 1
            else:
                # Inherent 'a'
                result.append("a")
            continue

        # Special characters
        if ch in _DEVA_SPECIAL:
            result.append(_DEVA_SPECIAL[ch])
            i += 1
            continue

        # Devanagari digits
        if "\u0966" <= ch <= "\u096F":
            result.append(str(ord(ch) - 0x0966))
            i += 1
            continue

        # Nukta (combining dot below) — skip
        if ch == "\u093C":
            i += 1
            continue

        # Non-Devanagari character — pass through
        result.append(ch)
        i += 1

    return "".join(result)


# ═══════════════════════════════════════════════════════════════════════
#  Script detection + auto-conversion
# ═══════════════════════════════════════════════════════════════════════

def _has_devanagari(s: str) -> bool:
    return any("\u0900" <= c <= "\u097F" for c in s)


def _looks_like_hk(s: str) -> bool:
    """Heuristic: HK uses uppercase retroflex/long-vowel chars.

    IMPORTANT: 'z' alone is NOT a reliable HK signature because it appears in
    English words (amaze, azure, analyze) that also exist as dictionary entries.
    Require at least one uppercase HK signature char to avoid false positives.
    This means lowercase-only HK-like strings (e.g. 'vrazcana') are missed,
    but that's an acceptable trade-off vs. corrupting English entries.

    Must match docs/translit.js looksLikeHK() exactly.
    """
    hk_upper = set("AIUTDNSGJRMH")
    has_iast_diacritics = any(c in "āīūṛṝḷḹṃḥṅñṭḍṇśṣ" for c in s)
    if has_iast_diacritics:
        return False
    has_hk_upper = any(c in hk_upper for c in s)
    has_lower = any(c.islower() for c in s)
    return has_hk_upper and has_lower


def detect_and_convert_to_iast(s: str) -> str:
    """Auto-detect script and convert to IAST. Preserves IAST input as-is."""
    if not s:
        return s
    if _has_devanagari(s):
        return devanagari_to_iast(s)
    if _looks_like_hk(s):
        return hk_to_iast(s)
    # Already IAST or Latin — return as-is
    return s


# ═══════════════════════════════════════════════════════════════════════
#  Normalization (shared by all build scripts + runtime)
# ═══════════════════════════════════════════════════════════════════════

def normalize(s: str) -> str:
    """NFD + strip combining marks + lowercase.

    This MUST match the normalization in lookup.js (client side).
    """
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower().strip()


def normalize_headword(s: str) -> str:
    """Full pipeline: detect script → convert to IAST → normalize for search key.

    Input can be Devanagari, HK, SLP1, or IAST.
    Output is a lowercase ASCII-ish search key.
    """
    iast = detect_and_convert_to_iast(s)
    return normalize(iast)


# ═══════════════════════════════════════════════════════════════════════
#  CLI test
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    tests = [
        ("Devanagari", "धर्म"),
        ("Devanagari", "बोधिसत्त्व"),
        ("Devanagari", "प्रज्ञापारमिता"),
        ("HK", "dharma"),
        ("HK", "bodhisattva"),
        ("HK", "prajJApAramitA"),
        ("IAST", "dharma"),
        ("IAST", "prajñāpāramitā"),
        ("SLP1 (via slp1_to_iast)", "Darma"),
    ]
    for label, text in tests:
        iast = detect_and_convert_to_iast(text)
        norm = normalize(iast)
        print(f"  {label:30s}  {text:20s} → IAST: {iast:25s} → norm: {norm}")
