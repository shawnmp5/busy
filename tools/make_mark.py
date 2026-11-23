"""Generate the Busy mark: a tiny calendar grid, black and white, no background.

Six rounded day tiles: four filled (busy) and two empty outlines (free time). Usage: python3 tools/make_mark.py
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo')
COLS, ROWS = 3, 2
TILE, GAP = 172, 42
FREE = {(1, 0), (2, 1)}  # the empty days
SW = 16               # outline width of the empty day


def svg(fill):
    w = COLS * TILE + (COLS - 1) * GAP
    h = ROWS * TILE + (ROWS - 1) * GAP
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            x, y = c * (TILE + GAP), r * (TILE + GAP)
            rx = TILE * 0.28
            if (c, r) in FREE:
                out.append(f'<rect x="{x + SW/2}" y="{y + SW/2}" width="{TILE - SW}" height="{TILE - SW}" rx="{rx - SW/2}" fill="none" stroke="{fill}" stroke-width="{SW}"/>')
            else:
                out.append(f'<rect x="{x}" y="{y}" width="{TILE}" height="{TILE}" rx="{rx}" fill="{fill}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Busy">{"".join(out)}</svg>\n'


os.makedirs(OUT, exist_ok=True)
for name, fill in [('busy-mark.svg', '#000000'), ('busy-mark-light.svg', '#ffffff')]:
    open(os.path.join(OUT, name), 'w').write(svg(fill))
    print('wrote', name)
