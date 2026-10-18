"""Render frontend/public/og-image.png (1200×630) with the ЦЕНТРЕАЛЪ lockup.

    python scripts/brand/build_og.py --font <Golos Text variable font>

Run build_wordmark.py first: the lockup is read from
frontend/public/brand/logo-footer-reversed.svg. The tagline is outlined from the
same font (see build_wordmark.py for which file), so the SVG needs no font at
render time. Also writes scripts/brand/og-image.svg, the vector source.
Requirements: fonttools, brotli, uharfbuzz, resvg-py.

Geometry was measured from the previous og-image.png: background #2563EB;
the mark at 7.385× in #1E55D8, bleeding off the right and both edges;
the lockup 118px tall at (96, 213.5); the tagline in Golos 400 at 40px,
baseline 424, pen x 96. The background mark moved right by 67px (575 → 642)
so the wider ЦЕНТРЕАЛЪ keeps the old 67px gap to it.
"""

from __future__ import annotations

import argparse
import io
import re
from pathlib import Path

import resvg_py
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

from build_wordmark import MARK_CR, MARK_WEDGE, _fmt

W, H = 1200, 630
BG = "#2563EB"
BIG_MARK = "#1E55D8"
BIG_MARK_X, BIG_MARK_Y, BIG_MARK_SCALE = 642.0, -11.0, 7.385
LOCKUP_X, LOCKUP_Y, LOCKUP_H = 96.0, 213.5, 118.0
TAGLINE = "Недвижимость Краснодара и Геленджика"
TAGLINE_WEIGHT, TAGLINE_SIZE, TAGLINE_X, TAGLINE_BASELINE = 400, 40.0, 96.0, 424.0
TAGLINE_TRACKING_EM = -0.0065  # the old image's tagline ink was 812px wide (100..911)

REPO = Path(__file__).resolve().parents[2]
LOCKUP_SVG = REPO / "frontend" / "public" / "brand" / "logo-footer-reversed.svg"
OUT_PNG = REPO / "frontend" / "public" / "og-image.png"
OUT_SVG = Path(__file__).resolve().parent / "og-image.svg"


def tagline_path(font_path: Path) -> str:
    inst = instantiateVariableFont(TTFont(str(font_path)), {"wght": TAGLINE_WEIGHT})
    inst.flavor = None
    buf = io.BytesIO()
    inst.save(buf)
    hb_buf = hb.Buffer()
    hb_buf.add_str(TAGLINE)
    hb_buf.guess_segment_properties()
    hb.shape(hb.Font(hb.Face(buf.getvalue())), hb_buf, {"kern": True})

    scale = TAGLINE_SIZE / inst["head"].unitsPerEm
    order, gs = inst.getGlyphOrder(), inst.getGlyphSet()
    pen = SVGPathPen(gs, ntos=_fmt)
    x = 0.0
    for info, pos in zip(hb_buf.glyph_infos, hb_buf.glyph_positions):
        tx = TAGLINE_X + (x + pos.x_offset) * scale
        gs[order[info.codepoint]].draw(TransformPen(pen, (scale, 0, 0, -scale, tx, TAGLINE_BASELINE)))
        x += pos.x_advance + TAGLINE_TRACKING_EM * inst["head"].unitsPerEm
    return pen.getCommands()


def main() -> None:
    ap = argparse.ArgumentParser(description="Render og-image.png.")
    ap.add_argument("--font", type=Path, required=True)
    args = ap.parse_args()

    lockup = LOCKUP_SVG.read_text(encoding="utf-8")
    vb_w = float(re.search(r'viewBox="0 0 ([\d.]+) 88"', lockup).group(1))
    lockup_paths = "".join(re.findall(r"<path [^>]*></path>", lockup))
    s = LOCKUP_H / 88
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
        f'<rect width="{W}" height="{H}" fill="{BG}"/>'
        f'<path fill="{BIG_MARK}" transform="translate({_fmt(BIG_MARK_X)} {_fmt(BIG_MARK_Y)}) '
        f'scale({BIG_MARK_SCALE})" d="{MARK_CR}{MARK_WEDGE}"/>'
        f'<g transform="translate({_fmt(LOCKUP_X)} {_fmt(LOCKUP_Y)}) scale({s:.6f})">{lockup_paths}</g>'
        f'<path fill="#FFFFFF" d="{tagline_path(args.font)}"/>'
        "</svg>\n"
    )
    OUT_SVG.write_text(svg, encoding="utf-8", newline="\n")
    png = bytes(resvg_py.svg_to_bytes(svg_string=svg, width=W, height=H))
    OUT_PNG.write_bytes(png)
    right = LOCKUP_X + vb_w * s
    print(f"{OUT_PNG.name}: {len(png)} B; lockup x {LOCKUP_X}..{right:.1f}, "
          f"background mark from x {BIG_MARK_X}")


if __name__ == "__main__":
    main()
