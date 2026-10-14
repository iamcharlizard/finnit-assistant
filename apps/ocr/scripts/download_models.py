#!/usr/bin/env python3
"""Download the OCR models listed in models.json and verify their sha256.

Usage: python scripts/download_models.py <models.json> <target dir>

Runs at image build time so the container works offline and starts fast.
Fails (non-zero exit) if a download fails or a checksum does not match.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

ATTEMPTS = 3


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as response, tmp.open("wb") as out:
                while chunk := response.read(1 << 20):
                    out.write(chunk)
            tmp.rename(dest)
            return
        except OSError as error:
            print(f"  attempt {attempt} failed: {error}", file=sys.stderr)
            tmp.unlink(missing_ok=True)
            if attempt == ATTEMPTS:
                raise
            time.sleep(2 * attempt)


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    manifest = json.loads(Path(sys.argv[1]).read_text())
    target = Path(sys.argv[2])
    target.mkdir(parents=True, exist_ok=True)

    for role, model in manifest["models"].items():
        dest = target / model["file"]
        if dest.exists() and sha256_of(dest) == model["sha256"]:
            print(f"{role}: {dest.name} already present")
            continue
        print(f"{role}: downloading {model['url']}")
        download(model["url"], dest)
        actual = sha256_of(dest)
        if actual != model["sha256"]:
            dest.unlink()
            print(f"{role}: sha256 mismatch (expected {model['sha256']}, got {actual})", file=sys.stderr)
            return 1
        print(f"{role}: {dest.name} ok ({dest.stat().st_size // 1024} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
