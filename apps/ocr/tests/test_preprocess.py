from __future__ import annotations

import numpy as np

from app.preprocess import decode_image, detect_image_type, is_pdf, preprocess_receipt, resize_long_side

from .conftest import encode, render_receipt


def test_detect_image_type():
    image = render_receipt(with_qr=False)
    assert detect_image_type(encode(image, "JPEG")) == "jpeg"
    assert detect_image_type(encode(image, "PNG")) == "png"
    assert detect_image_type(encode(image, "WEBP")) == "webp"
    assert detect_image_type(encode(image, "HEIF")) == "heic"
    assert detect_image_type(b"GIF89a....") is None
    assert detect_image_type(b"") is None
    assert is_pdf(b"%PDF-1.4\n")
    assert not is_pdf(b"\x89PNG")


def test_crops_receipt_on_dark_background():
    photo = render_receipt(with_qr=False, background=50)
    prepared = preprocess_receipt(decode_image(encode(photo, "PNG")))
    assert prepared.cropped
    # The crop removed most of the dark table.
    assert prepared.image.mean() > 200


def test_keeps_full_image_when_no_receipt_outline():
    flat = render_receipt(with_qr=False)  # white edge to edge: nothing to crop
    prepared = preprocess_receipt(decode_image(encode(flat, "PNG")))
    assert not prepared.cropped
    noise = (np.random.default_rng(0).random((800, 600, 3)) * 255).astype(np.uint8)
    assert not preprocess_receipt(noise).cropped


def test_output_is_gray_three_channels_and_resized():
    big = np.full((4000, 1000, 3), 255, dtype=np.uint8)
    prepared = preprocess_receipt(big, crop=False)
    assert prepared.image.shape == (1600, 400, 3)
    assert np.array_equal(prepared.image[..., 0], prepared.image[..., 1])
    assert resize_long_side(np.zeros((1000, 900, 3), np.uint8)).shape == (1000, 900, 3)
