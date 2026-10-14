from __future__ import annotations

import math

import numpy as np

from app.ocr import Segment, assemble_lines


def seg(text: str, x: float, y: float, w: float, h: float = 30, angle_deg: float = 0.0) -> Segment:
    corners = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], dtype=np.float32)
    if angle_deg:
        a = math.radians(angle_deg)
        rot = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]], dtype=np.float32)
        corners = corners @ rot.T
    return Segment(text=text, confidence=0.9, box=corners)


def test_groups_rows_and_orders_reading():
    segments = [
        seg("$116.00", 600, 202, 120),
        seg("TOTAL", 50, 200, 100),
        seg("IVA", 50, 150, 60),
        seg("$16.00", 600, 148, 110),
        seg("TIENDA", 50, 20, 200),
    ]
    lines = assemble_lines(segments)
    assert [line["text"] for line in lines] == ["TIENDA", "IVA $16.00", "TOTAL $116.00"]
    total = lines[-1]
    assert total["box"][0] == [50.0, 200.0]
    assert total["box"][2] == [720.0, 232.0]


def test_tilted_rows_still_group():
    # 4° tilt: across 700 px the right column drifts ~49 px, more than a line height.
    segments = []
    for row, (label, amount) in enumerate([("SUBTOTAL", "100.00"), ("IVA", "16.00"), ("TOTAL", "116.00")]):
        y = 100 + row * 60
        segments.append(seg(label, 50, y, 160, angle_deg=4))
        segments.append(seg(amount, 650, y, 120, angle_deg=4))
        segments.append(seg("x" * 8, 300, y, 200, angle_deg=4))
    lines = assemble_lines(segments)
    assert [line["text"].split()[0] for line in lines] == ["SUBTOTAL", "IVA", "TOTAL"]
    assert all(line["text"].endswith(("100.00", "16.00", "116.00")) for line in lines)


def test_empty():
    assert assemble_lines([]) == []
