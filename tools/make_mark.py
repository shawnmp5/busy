"""Generate the Busy app mark: a calendar week grid that's nearly full.

Twelve day-tiles on a squircle. Most are filled (a busy schedule), two are
empty outlines (free time) and one is a circle (the important thing). Pure black and white. Usage:
python3 tools/make_mark.py
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo')
S = 1024
COLS, ROWS = 4, 3
TILE, GAP = 172, 42
FREE = {(1, 0), (2, 2)}   # empty days
IMPORTANT = (3, 1)        # the red one

def squircle(s, inset=0):
    # Apple-style continuous-corner rounded square (superellipse approximation)
    r = s * 0.2237
    a, b = inset, s - inset
    k = r * 0.2  # extra smoothing
    return (f'M{a + r},{a} H{b - r} C{b - k},{a} {b},{a + k} {b},{a + r} V{b - r} '
            f'C{b},{b - k} {b - k},{b} {b - r},{b} H{a + r} C{a + k},{b} {a},{b - k} {a},{b - r} '
            f'V{a + r} C{a},{a + k} {a + k},{a} {a + r},{a} Z')

def tiles(fill, empty_stroke):
    w = COLS * TILE + (COLS - 1) * GAP
    h = ROWS * TILE + (ROWS - 1) * GAP
    x0, y0 = (S - w) / 2, (S - h) / 2 + 10
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            x, y = x0 + c * (TILE + GAP), y0 + r * (TILE + GAP)
            rx = TILE * 0.28
            if (c, r) in FREE:
                sw = 14
                out.append(f'<rect x="{x + sw/2}" y="{y + sw/2}" width="{TILE - sw}" height="{TILE - sw}" rx="{rx - sw/2}" fill="none" stroke="{empty_stroke}" stroke-width="{sw}"/>')
            elif (c, r) == IMPORTANT:
                out.append(f'<circle cx="{x + TILE/2}" cy="{y + TILE/2}" r="{TILE/2}" fill="{fill}"/>')
            else:
                out.append(f'<rect x="{x}" y="{y}" width="{TILE}" height="{TILE}" rx="{rx}" fill="{fill}"/>')
    return ''.join(out)

def svg(bg, fill, empty, with_bg=True):
    body = (f'<path d="{squircle(S)}" fill="{bg}"/>' if with_bg else '') + tiles(fill, empty)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" role="img" aria-label="Busy">{body}</svg>\n'

os.makedirs(OUT, exist_ok=True)
for name, content in [
    ('busy-icon.svg', svg('#000000', '#ffffff', '#ffffff')),          # app icon, dark
    ('busy-icon-light.svg', svg('#ffffff', '#000000', '#000000')),    # app icon, light
    ('busy-mark.svg', svg(None, '#000000', '#000000', False)),        # bare mark for light backgrounds
    ('busy-mark-light.svg', svg(None, '#ffffff', '#ffffff', False)),  # bare mark for dark backgrounds
]:
    open(os.path.join(OUT, name), 'w').write(content)
    print('wrote', name)
