"""PDF rasterization with pypdfium2."""

from __future__ import annotations

from collections.abc import Iterator

import cv2
import numpy as np
import pypdfium2 as pdfium


class PdfError(Exception):
    """The PDF cannot be opened (corrupt or password-protected)."""


# Upper bound for a rendered page side, so a huge page size cannot exhaust memory.
MAX_RENDER_SIDE = 4000


def open_pdf(data: bytes) -> pdfium.PdfDocument:
    try:
        return pdfium.PdfDocument(data)
    except pdfium.PdfiumError as error:
        raise PdfError(str(error)) from error


def render_pages(doc: pdfium.PdfDocument, dpi: int, max_pages: int) -> Iterator[tuple[int, np.ndarray]]:
    """Yields (1-based page number, BGR image) for the first `max_pages` pages."""
    count = min(len(doc), max_pages)
    for index in range(count):
        page = doc[index]
        try:
            width_pt, height_pt = page.get_size()
            scale = dpi / 72.0
            longest = max(width_pt, height_pt) * scale
            if longest > MAX_RENDER_SIDE:
                scale *= MAX_RENDER_SIDE / longest
            bitmap = page.render(scale=scale, grayscale=False)
            try:
                rgb = bitmap.to_numpy()
                # pdfium renders BGR(A) by default (rev_byteorder=False).
                if rgb.shape[2] == 4:
                    image = cv2.cvtColor(rgb, cv2.COLOR_BGRA2BGR)
                else:
                    image = np.ascontiguousarray(rgb[:, :, :3])
            finally:
                bitmap.close()
        finally:
            page.close()
        yield index + 1, image
