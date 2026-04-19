// translit.js — Sanskrit script detection and conversion to IAST.
// JS port of scripts/transliterate.py — MUST stay in sync.
//
// Supported input: Devanagari, Harvard-Kyoto (HK), IAST (passthrough).
// Used by lookup.js / bilex.js normalize() so the user can type any script
// and match dict entries regardless of how the dict stored them.
//
// Exposes window.Translit = { toIAST, normalizeHeadword, detectScript }.

(function () {
  // ═══ Harvard-Kyoto → IAST ═══

  // Multi-char replacements applied first (order matters).
  const HK_MULTI = [
    ["lRR", "\u1E39"],   // ḹ
    ["lR", "\u1E37"],    // ḷ
    ["RR", "\u1E5D"],    // ṝ
    ["Th", "\u1E6D" + "h"],  // ṭh
    ["Dh", "\u1E0D" + "h"],  // ḍh
    ["~n", "\u00F1"],    // ñ
  ];

  // Single-char (must NOT match chars already replaced above)
  const HK_SINGLE = {
    "A": "\u0101",  // ā
    "I": "\u012B",  // ī
    "U": "\u016B",  // ū
    "R": "\u1E5B",  // ṛ
    "M": "\u1E43",  // ṃ
    "H": "\u1E25",  // ḥ
    "G": "\u1E45",  // ṅ
    "J": "\u00F1",  // ñ
    "T": "\u1E6D",  // ṭ
    "D": "\u1E0D",  // ḍ
    "N": "\u1E47",  // ṇ
    "z": "\u015B",  // ś
    "S": "\u1E63",  // ṣ
  };

  function hkToIAST(s) {
    for (const [hk, iast] of HK_MULTI) {
      s = s.split(hk).join(iast);
    }
    let out = "";
    for (const ch of s) {
      out += HK_SINGLE[ch] || ch;
    }
    return out;
  }

  // ═══ Devanagari → IAST ═══

  const DEVA_INDEPENDENT_VOWELS = {
    "\u0905": "a",   "\u0906": "\u0101",     // अ ā
    "\u0907": "i",   "\u0908": "\u012B",     // इ ī
    "\u0909": "u",   "\u090A": "\u016B",     // उ ū
    "\u090B": "\u1E5B", "\u0960": "\u1E5D",  // ऋ ṝ
    "\u090C": "\u1E37", "\u0961": "\u1E39",  // ऌ ḹ
    "\u090F": "e",   "\u0910": "ai",         // ए ऐ
    "\u0913": "o",   "\u0914": "au",         // ओ औ
  };

  const DEVA_CONSONANTS = {
    // Velars
    "\u0915": "k", "\u0916": "kh", "\u0917": "g", "\u0918": "gh", "\u0919": "\u1E45",
    // Palatals
    "\u091A": "c", "\u091B": "ch", "\u091C": "j", "\u091D": "jh", "\u091E": "\u00F1",
    // Retroflexes
    "\u091F": "\u1E6D", "\u0920": "\u1E6D" + "h", "\u0921": "\u1E0D", "\u0922": "\u1E0D" + "h", "\u0923": "\u1E47",
    // Dentals
    "\u0924": "t", "\u0925": "th", "\u0926": "d", "\u0927": "dh", "\u0928": "n",
    // Labials
    "\u092A": "p", "\u092B": "ph", "\u092C": "b", "\u092D": "bh", "\u092E": "m",
    // Semi-vowels
    "\u092F": "y", "\u0930": "r", "\u0932": "l", "\u0935": "v",
    // Sibilants
    "\u0936": "\u015B", "\u0937": "\u1E63", "\u0938": "s",
    // Aspirate
    "\u0939": "h",
  };

  const DEVA_MATRAS = {
    "\u093E": "\u0101",   // ā
    "\u093F": "i",        // i
    "\u0940": "\u012B",   // ī
    "\u0941": "u",        // u
    "\u0942": "\u016B",   // ū
    "\u0943": "\u1E5B",   // ṛ
    "\u0944": "\u1E5D",   // ṝ
    "\u0962": "\u1E37",   // ḷ
    "\u0963": "\u1E39",   // ḹ
    "\u0947": "e",
    "\u0948": "ai",
    "\u094B": "o",
    "\u094C": "au",
  };

  const DEVA_SPECIAL = {
    "\u0902": "\u1E43",   // ṃ anusvāra
    "\u0903": "\u1E25",   // ḥ visarga
    "\u0901": "m\u0310",  // m̐ candrabindu
    "\u093D": "'",        // avagraha
    "\u0964": "|",        // danda
    "\u0965": "||",       // double danda
    "\u0950": "o\u1E43",  // oṃ
  };

  const VIRAMA = "\u094D";

  function devanagariToIAST(s) {
    const result = [];
    let i = 0;
    const n = s.length;
    while (i < n) {
      const ch = s[i];

      if (DEVA_INDEPENDENT_VOWELS[ch]) {
        result.push(DEVA_INDEPENDENT_VOWELS[ch]);
        i++;
        continue;
      }
      if (DEVA_CONSONANTS[ch]) {
        result.push(DEVA_CONSONANTS[ch]);
        i++;
        if (i < n && s[i] === VIRAMA) {
          // Virama suppresses inherent 'a'
          i++;
        } else if (i < n && DEVA_MATRAS[s[i]]) {
          result.push(DEVA_MATRAS[s[i]]);
          i++;
        } else {
          // Inherent 'a'
          result.push("a");
        }
        continue;
      }
      if (DEVA_SPECIAL[ch]) {
        result.push(DEVA_SPECIAL[ch]);
        i++;
        continue;
      }
      // Devanagari digits
      const cc = ch.charCodeAt(0);
      if (cc >= 0x0966 && cc <= 0x096F) {
        result.push(String(cc - 0x0966));
        i++;
        continue;
      }
      // Nukta → skip
      if (ch === "\u093C") { i++; continue; }

      // Non-Devanagari — pass through
      result.push(ch);
      i++;
    }
    return result.join("");
  }

  // ═══ Script detection ═══

  function hasDevanagari(s) {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      if (c >= 0x0900 && c <= 0x097F) return true;
    }
    return false;
  }

  // Heuristic: HK uses uppercase for retroflex/long vowels within lowercase.
  // IAST uses diacritic-marked letters instead. If the string has both
  // HK-signature uppercase letters AND lowercase, and no IAST diacritics,
  // treat it as HK.
  const HK_SIGNATURE_UPPER = new Set(["A", "I", "U", "T", "D", "N", "S", "G", "J", "R", "M", "H"]);
  const IAST_DIACRITIC_CHARS = new Set([
    "\u0101", "\u012B", "\u016B", "\u1E5B", "\u1E5D",
    "\u1E37", "\u1E39", "\u1E43", "\u1E25", "\u1E45",
    "\u00F1", "\u1E6D", "\u1E0D", "\u1E47", "\u015B", "\u1E63",
  ]);

  // IMPORTANT: 'z' alone is NOT used as an HK signature — English words
  // (amaze, azure, analyze) contain 'z' and would get mangled. Require at
  // least one uppercase HK signature char (AIUTDNSGJRMH). Must match
  // scripts/transliterate.py _looks_like_hk exactly.
  function looksLikeHK(s) {
    let hasHKUpper = false;
    let hasLower = false;
    for (const ch of s) {
      if (HK_SIGNATURE_UPPER.has(ch)) hasHKUpper = true;
      if (ch >= "a" && ch <= "z") hasLower = true;
      if (IAST_DIACRITIC_CHARS.has(ch)) return false; // IAST present → not HK
    }
    return hasHKUpper && hasLower;
  }

  function detectScript(s) {
    if (!s) return "empty";
    if (hasDevanagari(s)) return "devanagari";
    if (looksLikeHK(s)) return "hk";
    return "iast"; // Latin + possibly IAST diacritics
  }

  // ═══ Public API ═══

  function toIAST(s, script) {
    if (!s) return "";
    script = script || detectScript(s);
    if (script === "devanagari") return devanagariToIAST(s);
    if (script === "hk") return hkToIAST(s);
    return s;
  }

  // Full pipeline matching Python normalize_headword():
  // detect → convert to IAST → NFD → strip combining marks → lowercase + trim.
  function normalizeHeadword(s) {
    if (!s) return "";
    const iast = toIAST(s);
    return iast.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  }

  window.Translit = { toIAST, normalizeHeadword, detectScript, hkToIAST, devanagariToIAST };
})();
