"""Build the ЦЕНТРЕАЛЪ lockup SVGs (C+R mark + outlined wordmark).

    python scripts/brand/build_wordmark.py --font <Golos Text variable font>

Writes frontend/public/brand/logo-header.svg (primary) and
logo-footer-reversed.svg (white). Requirements: fonttools, brotli (only for a
.woff2 font), uharfbuzz (shaping, so the font's own kerning is applied).

Font: Golos Text (SIL OFL 1.1), the site's UI face, variable wght 400–900, with
the Cyrillic subset. The exact file the site loads is what next/font
self-hosts: frontend/.next/static/media/<hash>-s.p.woff2, the one whose cmap
contains U+0426 (Ц). The font is not committed; outlined glyphs are not Font
Software under the OFL.

Metrics were fitted to the previous "Centreal" wordmark (Golos 600 at 50 units,
cap height 35, ink from x=110, cap band centred on the mark's centre y=44).
The all-caps word keeps the weight, the start x and the centring, with a
smaller cap height (27 of the mark's 88 units) and positive tracking.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WORD = "ЦЕНТРЕАЛЪ"
TITLE = "ЦЕНТРЕАЛЪ"
WEIGHT = 600
CAP_HEIGHT = 27.0  # SVG units; the mark is 88 tall
TRACKING_EM = 0.04
INK_START_X = 110.0
CENTRE_Y = 44.0
HEIGHT = 88

NAVY = "#0B1B3D"
WHITE = "#FFFFFF"
MARK_BLUE = "#2563EB"
MARK_RED = "#E23A2E"
# The C+R mark, byte-identical to the previous lockups and centreal-mark-*.svg.
MARK_CR = (
    "M29 2.64A44 44 0 0 0 29 85.36L29 62.73A24 24 0 0 1 29 25.27ZM37 0.56A44 44 0 0 1 "
    "57.6 2.15A23 23 0 0 1 72.76 29.78L65.37 33.07A24 24 0 0 0 46 20.08L46 67.92A24 24 "
    "0 0 0 60.12 61.78L74.02 76.17A44 44 0 0 1 37 87.44Z"
)
MARK_WEDGE = "M86.45 32.44A44 44 0 0 1 79.36 70.19L56 46L86.45 32.44Z"

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "frontend" / "public" / "brand"


def _fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def build_word_path(font_path: Path) -> tuple[str, float]:
    font = TTFont(str(font_path))
    if ord("Ц") not in font.getBestCmap():
        raise SystemExit(f"{font_path} has no Cyrillic (U+0426 missing) - wrong subset file")
    inst = instantiateVariableFont(font, {"wght": WEIGHT})
    upem = inst["head"].unitsPerEm
    scale = CAP_HEIGHT / inst["OS/2"].sCapHeight
    baseline = CENTRE_Y + CAP_HEIGHT / 2

    # Shape the static instance with HarfBuzz so GPOS kerning applies.
    inst.flavor = None
    buf = io.BytesIO()
    inst.save(buf)
    hb_font = hb.Font(hb.Face(buf.getvalue()))
    hb_buf = hb.Buffer()
    hb_buf.add_str(WORD)
    hb_buf.guess_segment_properties()
    hb.shape(hb_font, hb_buf, {"kern": True, "liga": False})

    glyph_order = inst.getGlyphOrder()
    gs = inst.getGlyphSet()
    tracking = TRACKING_EM * upem
    placed = []  # (glyph name, x in font units)
    x = 0.0
    for info, pos in zip(hb_buf.glyph_infos, hb_buf.glyph_positions):
        placed.append((glyph_order[info.codepoint], x + pos.x_offset))
        x += pos.x_advance + tracking

    # Ink bounds in font units, to put the first ink at INK_START_X.
    xmin, xmax = float("inf"), float("-inf")
    for name, gx in placed:
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        if bp.bounds:
            xmin = min(xmin, gx + bp.bounds[0])
            xmax = max(xmax, gx + bp.bounds[2])
    dx = INK_START_X - xmin * scale

    pen = SVGPathPen(gs, ntos=_fmt)
    for name, gx in placed:
        # Font y is up, SVG y is down: flip around the baseline.
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, dx + gx * scale, baseline)))
    return pen.getCommands(), dx + xmax * scale


def svg(width: float, paths: list[tuple[str, str]]) -> str:
    w = _fmt(width)
    body = "".join(f'<path fill="{fill}" d="{d}"></path>' for fill, d in paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {HEIGHT}" '
        f'width="{w}" height="{HEIGHT}"><title>{TITLE}</title>{body}</svg>\n'
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Build the ЦЕНТРЕАЛЪ lockup SVGs.")
    ap.add_argument("--font", type=Path, required=True)
    args = ap.parse_args()

    word, ink_right = build_word_path(args.font)
    # The viewBox ends at the ink, like the previous files.
    width = float(_fmt(ink_right))
    primary = svg(width, [(MARK_BLUE, MARK_CR), (MARK_RED, MARK_WEDGE), (NAVY, word)])
    reversed_ = svg(width, [(WHITE, MARK_CR + MARK_WEDGE), (WHITE, word)])
    (OUT_DIR / "logo-header.svg").write_text(primary, encoding="utf-8", newline="\n")
    (OUT_DIR / "logo-footer-reversed.svg").write_text(reversed_, encoding="utf-8", newline="\n")
    print(f"viewBox 0 0 {_fmt(width)} {HEIGHT}; wordmark ink x {INK_START_X}..{_fmt(ink_right)}")


if __name__ == "__main__":
    main()
