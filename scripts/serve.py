#!/usr/bin/env python3
"""Tiny static server that supports HTTP Range requests.

Required by sql.js-httpvfs in web/. Run from repo root:
    python3 scripts/serve.py [port]
"""
from __future__ import annotations

import os
import re
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


class RangeHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()

        rng = self.headers.get("Range")
        if not rng:
            return super().do_GET()

        m = RANGE_RE.match(rng)
        if not m:
            self.send_error(400, "invalid Range header")
            return

        size = os.path.getsize(path)
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "" and end_s == "":
            self.send_error(400, "invalid Range header")
            return
        if start_s == "":
            length = int(end_s)
            start = max(0, size - length)
            end = size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
        if start >= size or end >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return

        length = end - start + 1
        self.send_response(206)
        ctype = self.guess_type(path)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def end_headers(self) -> None:  # noqa: N802
        # sql.js-httpvfs also wants Accept-Ranges on normal responses.
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(WEB_DIR)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), RangeHandler)
    print(f"serving {WEB_DIR} on http://localhost:{port} (Range enabled)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
