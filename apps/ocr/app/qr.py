"""QR and barcode decoding with zxing-cpp.

A printed CFDI carries a QR whose text is the SAT verification URL with the
re/rr/tt/id/fe parameters; we return the raw text and let the API parse it.
"""

from __future__ import annotations

import numpy as np
import zxingcpp


def decode_barcodes(*images: np.ndarray) -> list[dict[str, str]]:
    """Decodes barcodes in each image; returns unique (text, format) pairs in order found."""
    found: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for image in images:
        if image is None or image.size == 0:
            continue
        for barcode in zxingcpp.read_barcodes(image):
            if not barcode.valid or not barcode.text:
                continue
            fmt = barcode.format.name
            key = (barcode.text, fmt)
            if key not in seen:
                seen.add(key)
                found.append({"text": barcode.text, "format": fmt})
    return found
