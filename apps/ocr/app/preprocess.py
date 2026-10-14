"""Image decoding and preprocessing for receipt photos.

Steps (see docs/document-ocr.md, "Pipeline"):
1. Detect the type from the bytes (never from the file name) and decode it,
   applying the EXIF orientation.
2. Optionally crop and straighten the receipt when its outline is detected
   reliably; otherwise keep the full image.
3. Resize so the longest side is about 1600 px.
4. Grayscale + local contrast (CLAHE). No hard binarization: the PP-OCRv5
   models are trained on natural images and lose accuracy on thresholded ones.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps

try:  # HEIC/HEIF support (iPhone photos).
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIF_AVAILABLE = True
except ImportError:  # pragma: no cover - always installed in the image
    HEIF_AVAILABLE = False

TARGET_LONG_SIDE = 1600
# Cap for the "original" image kept for barcode decoding and cropping: large
# enough for the CFDI QR code, small enough to bound memory and time (a 12 MP
# photo would take ~36 MB per copy).
MAX_DECODE_LONG_SIDE = 2000
# Decompression-bomb guard: refuse images above 60 megapixels.
MAX_PIXELS = 60_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

HEIF_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"}


class ImageDecodeError(Exception):
    """The bytes look like a supported type but cannot be decoded."""


class ImageTooLargeError(Exception):
    """The image has more pixels than MAX_PIXELS."""


def detect_image_type(data: bytes) -> str | None:
    """Returns jpeg, png, webp or heic based on magic bytes, or None."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[4:8] == b"ftyp":
        brands = {data[8:12]}
        box_size = int.from_bytes(data[0:4], "big")
        # Compatible brands follow the major brand and minor version.
        for offset in range(16, min(box_size, 64), 4):
            brands.add(data[offset : offset + 4])
        if brands & HEIF_BRANDS:
            return "heic"
    return None


def is_pdf(data: bytes) -> bool:
    return b"%PDF-" in data[:1024]


def decode_image(data: bytes) -> np.ndarray:
    """Decodes to a BGR uint8 array, upright per EXIF, longest side capped."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.width * img.height > MAX_PIXELS:
                raise ImageTooLargeError()
            if img.format == "JPEG":
                # Let libjpeg decode at 1/2, 1/4 or 1/8 scale when the photo is
                # much larger than needed: faster and far less memory.
                factor = 1
                while factor < 8 and max(img.size) / (factor * 2) >= MAX_DECODE_LONG_SIDE:
                    factor *= 2
                if factor > 1:
                    img.draft("RGB", (img.width // factor, img.height // factor))
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            if max(img.size) > MAX_DECODE_LONG_SIDE:
                img.thumbnail((MAX_DECODE_LONG_SIDE, MAX_DECODE_LONG_SIDE), Image.Resampling.LANCZOS)
            rgb = np.asarray(img)
    except (ImageTooLargeError, Image.DecompressionBombError) as error:
        raise ImageTooLargeError() from error
    except Exception as error:  # Pillow raises many types for corrupt files.
        raise ImageDecodeError(str(error)) from error
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


@dataclass
class Preprocessed:
    image: np.ndarray  # BGR, what the OCR engine sees
    cropped: bool


def _order_corners(points: np.ndarray) -> np.ndarray:
    """Orders 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = points.reshape(4, 2).astype(np.float32)
    total = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    return np.array(
        [pts[np.argmin(total)], pts[np.argmin(diff)], pts[np.argmax(total)], pts[np.argmax(diff)]],
        dtype=np.float32,
    )


def find_receipt_quad(image: np.ndarray) -> np.ndarray | None:
    """Finds the receipt outline as 4 corners in image coordinates, or None.

    Conservative on purpose: a wrong crop loses text, a missed crop only costs
    a little accuracy. The quad must be convex, cover 25–95 % of the photo,
    have sane angles, and the paper inside must be brighter than the outside.
    """
    height, width = image.shape[:2]
    scale = 800.0 / max(height, width)
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    scale = min(scale, 1.0)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Paper is brighter than the background: Otsu + closing joins the text
    # into one white blob shaped like the receipt.
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    small_area = small.shape[0] * small.shape[1]
    area_ratio = cv2.contourArea(contour) / small_area
    if not 0.25 <= area_ratio <= 0.95:
        return None
    hull = cv2.convexHull(contour)
    approx = cv2.approxPolyDP(hull, 0.02 * cv2.arcLength(hull, True), True)
    if len(approx) != 4 or not cv2.isContourConvex(approx):
        return None
    quad = _order_corners(approx)
    # Interior angles between 60° and 120°.
    for i in range(4):
        a, b, c = quad[i - 1], quad[i], quad[(i + 1) % 4]
        v1, v2 = a - b, c - b
        cos = float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6))
        if abs(cos) > 0.5:
            return None
    # The receipt must contrast with what is outside of it.
    inside = np.zeros_like(gray)
    cv2.fillConvexPoly(inside, quad.astype(np.int32), 255)
    mean_in = cv2.mean(gray, mask=inside)[0]
    mean_out = cv2.mean(gray, mask=cv2.bitwise_not(inside))[0]
    if mean_in - mean_out < 25:
        return None
    return quad / scale


def warp_quad(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    tl, tr, br, bl = quad
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    target = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(quad.astype(np.float32), target)
    return cv2.warpPerspective(image, matrix, (width, height), flags=cv2.INTER_CUBIC)


def resize_long_side(image: np.ndarray, target: int = TARGET_LONG_SIDE) -> np.ndarray:
    """Downscales to `target`; small images are upscaled at most 2x."""
    long_side = max(image.shape[:2])
    if long_side > target:
        factor = target / long_side
        interpolation = cv2.INTER_AREA
    elif long_side < target / 2:
        factor = 2.0
        interpolation = cv2.INTER_CUBIC
    else:
        return image
    return cv2.resize(image, None, fx=factor, fy=factor, interpolation=interpolation)


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """Grayscale + CLAHE, returned as 3-channel BGR (what the models expect)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return cv2.cvtColor(clahe.apply(gray), cv2.COLOR_GRAY2BGR)


def preprocess_receipt(image: np.ndarray, crop: bool = True) -> Preprocessed:
    cropped = False
    if crop:
        try:
            quad = find_receipt_quad(image)
        except cv2.error:
            quad = None
        if quad is not None:
            warped = warp_quad(image, quad)
            if min(warped.shape[:2]) >= 200:
                image, cropped = warped, True
    image = resize_long_side(image)
    return Preprocessed(image=enhance_contrast(image), cropped=cropped)
