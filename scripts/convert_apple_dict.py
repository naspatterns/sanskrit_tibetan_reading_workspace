#!/usr/bin/env python3
"""
Extract entries from Apple .dictionary Body.data files.

Apple's Body.data format: 64-byte null header, then a sequence of chunks.
Each chunk has a 16-byte header followed by zlib-compressed XML data.
The XML is Apple's DictionaryService <d:entry> format.

Outputs a JSON lines file (one JSON object per line) for easy ingestion.
"""
from __future__ import annotations

import html
import json
import re
import struct
import sys
import zlib
from pathlib import Path
from xml.etree import ElementTree as ET

# Namespace for Apple dictionary XML
NS = {"d": "http://www.apple.com/DTDs/DictionaryService-1.0.rng"}


def iter_entries(body_path: Path):
    """Yield (title, body_text) tuples from Body.data."""
    data = body_path.read_bytes()
    pos = 64  # skip null header
    size = len(data)
    found = 0
    errors = 0

    while pos < size - 4:
        # Scan for zlib magic: 0x78 followed by valid flag byte
        if data[pos] != 0x78 or data[pos + 1] not in (0x01, 0x5E, 0x9C, 0xDA):
            pos += 1
            continue

        # Try decompressing
        try:
            dec = zlib.decompress(data[pos : pos + min(65536, size - pos)])
        except zlib.error:
            pos += 1
            continue

        # Parse the XML
        try:
            xml_str = dec.decode("utf-8", errors="replace")
            # Wrap in root if multiple entries
            if xml_str.count("<d:entry") > 1:
                xml_str = f"<root {_ns_decl()}>{xml_str}</root>"
            else:
                xml_str = _ensure_ns(xml_str)
            root = ET.fromstring(xml_str)
            for entry in (
                root.findall(".//d:entry", NS)
                if root.tag != "{http://www.apple.com/DTDs/DictionaryService-1.0.rng}entry"
                else [root]
            ):
                title = entry.get("{http://www.apple.com/DTDs/DictionaryService-1.0.rng}title", "")
                if not title:
                    title = entry.get("d:title", "")
                body_text = _extract_text(entry)
                if title and body_text:
                    yield title.strip(), body_text.strip()
                    found += 1
        except ET.ParseError:
            errors += 1

        # Advance past the compressed data (find next zlib or chunk header)
        # Use compressobj to determine consumed bytes
        try:
            dobj = zlib.decompressobj()
            dobj.decompress(data[pos:pos + min(65536, size - pos)])
            consumed = min(65536, size - pos) - len(dobj.unused_data)
            pos += max(consumed, 1)
        except:
            pos += len(dec) // 3 + 1  # rough estimate

    print(f"  Extracted {found} entries ({errors} parse errors)", file=sys.stderr)


def _ns_decl():
    return 'xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng"'


def _ensure_ns(s: str) -> str:
    """Make sure the d: namespace is declared."""
    if "xmlns:d" not in s:
        s = s.replace("<d:entry", f"<d:entry {_ns_decl()}", 1)
    return s


def _extract_text(elem) -> str:
    """Recursively extract visible text from an XML element."""
    parts = []
    if elem.text:
        parts.append(elem.text)
    for child in elem:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        # Skip index-only elements
        if tag in ("index",):
            if child.tail:
                parts.append(child.tail)
            continue
        parts.append(_extract_text(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def convert(dict_path: Path, output_path: Path) -> int:
    body = dict_path / "Contents" / "Body.data"
    if not body.exists():
        print(f"Body.data not found in {dict_path}", file=sys.stderr)
        return 1

    print(f"Processing: {dict_path.name}")
    entries = list(iter_entries(body))
    print(f"  Total: {len(entries)} entries")

    with open(output_path, "w", encoding="utf-8") as f:
        for title, body_text in entries:
            json.dump({"headword": title, "body": body_text}, f, ensure_ascii=False)
            f.write("\n")

    print(f"  Written to: {output_path}")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: convert_apple_dict.py <path/to/X.dictionary> [output.jsonl]")
        return 1

    dict_path = Path(sys.argv[1])
    if len(sys.argv) > 2:
        out = Path(sys.argv[2])
    else:
        out = Path("data-source/apple-converted") / (dict_path.stem + ".jsonl")
        out.parent.mkdir(parents=True, exist_ok=True)

    return convert(dict_path, out)


if __name__ == "__main__":
    sys.exit(main())
