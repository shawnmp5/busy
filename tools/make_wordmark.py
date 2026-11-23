"""Generate the Busy wordmark as SVG.

The site's typeface is Apple's San Francisco, with Inter as its open fallback.
SF can't be redistributed, so the wordmark is set in Inter Display SemiBold
(its closest open match), tightly tracked like Apple's own wordmarks, and the
letters are converted to outlines so the SVGs need no fonts.

Usage: python3 tools/make_wordmark.py [PATH_TO_InterDisplay-SemiBold.otf]
Needs: pip install fonttools
"""
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo')
WORD = 'Busy'
TRACKING = -0.025  # of the em, like Apple's display tracking
PAD = 0.06         # padding around the letters, of the em

font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
hmtx = font['hmtx']

# Outline every letter, flipping y (fonts are y-up, SVG is y-down)
svg_pen = SVGPathPen(gs)
bounds = BoundsPen(gs)
x = 0
for ch in WORD:
    name = cmap[ord(ch)]
    t = (1, 0, 0, -1, x, 0)
    gs[name].draw(TransformPen(svg_pen, t))
    gs[name].draw(TransformPen(bounds, t))
    x += hmtx[name][0] + TRACKING * upm
x0, y0, x1, y1 = bounds.bounds
pad = PAD * upm
vb = f'{x0 - pad:.0f} {y0 - pad:.0f} {x1 - x0 + 2 * pad:.0f} {y1 - y0 + 2 * pad:.0f}'
path = svg_pen.getCommands()

os.makedirs(OUT, exist_ok=True)
for name, fill in [('busy-wordmark.svg', '#111111'), ('busy-wordmark-light.svg', '#f2f2f2')]:
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Busy">'
                f'<path fill="{fill}" d="{path}"/></svg>\n')
    print('wrote', name)
