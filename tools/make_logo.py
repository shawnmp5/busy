"""Generate the Chronos logo set as SVG.

The mark: a glass hourglass of glowing blue sand, framed like a small Greek temple
(gold plates with a Greek key frieze and Ionic volutes, held by two fluted columns),
set inside an arcane ring. Two orbits cross behind it to form a Χ (chi), the first
letter of Χρόνος.

Usage: python3 tools/make_logo.py FONT_DIR
FONT_DIR must contain Cinzel-600.ttf and GFSDidot.ttf (SIL Open Font License, from
Google Fonts). All lettering is converted to outlines, so the SVGs need no fonts.
"""
import math
import os
import random
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

FONT_DIR = sys.argv[1] if len(sys.argv) > 1 else 'fonts'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo')
os.makedirs(OUT, exist_ok=True)
CINZEL = TTFont(os.path.join(FONT_DIR, 'Cinzel-600.ttf'))
DIDOT = TTFont(os.path.join(FONT_DIR, 'GFSDidot.ttf'))

# Palette
ICE = '#bff0ff'      # glass and line work
INK = '#8fdcff'      # arcane rings
DEEP = '#3d8bff'
HAZE = '#1e6bff'     # glow
STAR = '#eafcff'
NAVY = '#040a1c'
NAVY_2 = '#0d2763'
LIGHT_INK = '#0e2a6e'
LIGHT_DEEP = '#2456d6'
BRONZE_DARK = '#6b4212'


def f(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def polar(theta_deg, r, cx, cy):
    t = math.radians(theta_deg)
    return cx + r * math.sin(t), cy - r * math.cos(t)


# ---------------- lettering ----------------
def glyph(font, ch):
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    pen = SVGPathPen(gs)
    gs[name].draw(pen)
    return pen.getCommands(), gs[name].width


def cap_height(font):
    return getattr(font['OS/2'], 'sCapHeight', 0) or font['head'].unitsPerEm * 0.7


def text_width(font, text, size, tracking=0.0):
    upm = font['head'].unitsPerEm
    return sum(glyph(font, ch)[1] for ch in text) * size / upm + tracking * (len(text) - 1)


def text_line(font, text, x, baseline, size, tracking, fill, extra=''):
    s = size / font['head'].unitsPerEm
    out, cur = [], x
    for ch in text:
        d, w = glyph(font, ch)
        out.append(f'<path transform="translate({f(cur)} {f(baseline)}) scale({f(s)} {f(-s)})" d="{d}"/>')
        cur += w * s + tracking
    return f'<g fill="{fill}"{extra}>' + ''.join(out) + '</g>'


def word_on_circle(font, word, theta, r, size, tracking, cx, cy, flip=False):
    s = size / font['head'].unitsPerEm
    widths = [glyph(font, ch)[1] * s for ch in word]
    total = sum(widths) + tracking * (len(word) - 1)
    circ = 2 * math.pi * r
    half = cap_height(font) * s / 2
    pos, out = -total / 2, []
    for ch, w in zip(word, widths):
        d, _ = glyph(font, ch)
        off = (pos + w / 2) / circ * 360
        if flip:  # bottom of the ring: read left to right, right side up
            out.append(f'<path transform="translate({f(cx)} {f(cy)}) rotate({f(theta - off + 180)}) translate({f(-w / 2)} {f(r + half)}) scale({f(s)} {f(-s)})" d="{d}"/>')
        else:
            out.append(f'<path transform="translate({f(cx)} {f(cy)}) rotate({f(theta + off)}) translate({f(-w / 2)} {f(-(r - half))}) scale({f(s)} {f(-s)})" d="{d}"/>')
        pos += w + tracking
    return ''.join(out)


# ---------------- ornament ----------------
HOOK = [(1, 0), (1, 3), (5, 3), (5, 1), (3, 1), (3, 2)]  # one Greek key unit on a 6 x 4 grid


def meander_ring(r_in, r_out, units, sw, stroke, cx, cy):
    per = 360 / units
    vr = lambda v: r_in + (r_out - r_in) * v / 4
    d = []
    for i in range(units):
        th = lambda u: i * per + u / 6 * per
        x, y = polar(th(HOOK[0][0]), vr(HOOK[0][1]), cx, cy)
        d.append(f'M{f(x)} {f(y)}')
        for (u1, v1), (u2, v2) in zip(HOOK, HOOK[1:]):
            x, y = polar(th(u2), vr(v2), cx, cy)
            if v1 == v2:
                d.append(f'A{f(vr(v1))} {f(vr(v1))} 0 0 {1 if u2 > u1 else 0} {f(x)} {f(y)}')
            else:
                d.append(f'L{f(x)} {f(y)}')
    rim = r_out + (r_out - r_in) / 4
    return (f'<path d="{" ".join(d)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}" stroke-linecap="square"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r_in)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(rim)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}"/>')


def meander_strip(x0, x1, y_top, height, sw, stroke):
    """Straight Greek key frieze between x0 and x1."""
    v = height / 4
    u = v * 0.85
    unit = 6 * u
    n = int((x1 - x0) // unit)
    start = x0 + ((x1 - x0) - n * unit) / 2
    d = []
    for i in range(n):
        ox = start + i * unit
        pts = [(ox + a * u, y_top + height - b * v) for a, b in HOOK]
        d.append('M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts))
    d.append(f'M{f(start)} {f(y_top + height)} L{f(start + n * unit)} {f(y_top + height)}')
    return f'<path d="{" ".join(d)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}" stroke-linecap="square"/>'


def sparkle(x, y, r, fill):
    k = r * 0.22
    return (f'<path d="M{f(x)} {f(y - r)} Q{f(x + k)} {f(y - k)} {f(x + r)} {f(y)} Q{f(x + k)} {f(y + k)} {f(x)} {f(y + r)} '
            f'Q{f(x - k)} {f(y + k)} {f(x - r)} {f(y)} Q{f(x - k)} {f(y - k)} {f(x)} {f(y - r)} Z" fill="{fill}"/>')


# ---------------- gradients & filters ----------------
def glow_filter(fid, blur, soft, haze, opacity):
    return (f'<filter id="{fid}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">'
            f'<feGaussianBlur in="SourceAlpha" stdDeviation="{blur}" result="a"/>'
            f'<feFlood flood-color="{haze}" flood-opacity="{opacity}"/><feComposite in2="a" operator="in" result="h"/>'
            f'<feGaussianBlur in="SourceGraphic" stdDeviation="{soft}" result="s"/>'
            f'<feMerge><feMergeNode in="h"/><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')


def defs(p, light=False):
    """Gradients and filters, ids prefixed with p so several SVGs can share one page."""
    if light:
        return (f'<defs><linearGradient id="{p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c99a45"/><stop offset="1" stop-color="#7a4c15"/></linearGradient>'
                f'<linearGradient id="{p}col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4c15"/><stop offset=".45" stop-color="#d2a453"/><stop offset="1" stop-color="#6b4212"/></linearGradient>'
                f'<linearGradient id="{p}sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8dff"/><stop offset="1" stop-color="#1d3fb8"/></linearGradient>'
                f'<linearGradient id="{p}glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2456d6" stop-opacity=".12"/><stop offset=".5" stop-color="#2456d6" stop-opacity=".03"/><stop offset="1" stop-color="#2456d6" stop-opacity=".12"/></linearGradient>'
                f'<radialGradient id="{p}neb" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#4f8dff" stop-opacity=".25"/><stop offset="1" stop-color="#4f8dff" stop-opacity="0"/></radialGradient>'
                f'<radialGradient id="{p}core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>')
    return ('<defs>'
            f'<linearGradient id="{p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c8"/><stop offset=".35" stop-color="#f1c76c"/><stop offset=".7" stop-color="#c08a35"/><stop offset="1" stop-color="#7a4c15"/></linearGradient>'
            f'<linearGradient id="{p}col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4212"/><stop offset=".38" stop-color="#ffe7a6"/><stop offset=".62" stop-color="#d09a43"/><stop offset="1" stop-color="#5e3a0f"/></linearGradient>'
            f'<linearGradient id="{p}sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3fbff"/><stop offset=".35" stop-color="#6fd8ff"/><stop offset="1" stop-color="#2560ff"/></linearGradient>'
            f'<linearGradient id="{p}glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fe4ff" stop-opacity=".22"/><stop offset=".5" stop-color="#9fe4ff" stop-opacity=".04"/><stop offset="1" stop-color="#9fe4ff" stop-opacity=".16"/></linearGradient>'
            f'<radialGradient id="{p}neb" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5fc8ff" stop-opacity=".75"/><stop offset=".5" stop-color="#2a6dff" stop-opacity=".3"/><stop offset="1" stop-color="#2a6dff" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="{p}core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2a7dff" stop-opacity=".42"/><stop offset=".55" stop-color="#1e6bff" stop-opacity=".12"/><stop offset="1" stop-color="#1e6bff" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="{p}tile" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="{NAVY_2}"/><stop offset=".6" stop-color="#071433"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>'
            f'<radialGradient id="{p}orb" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#8fe6ff"/><stop offset="1" stop-color="#1f5eff"/></radialGradient>'
            f'<linearGradient id="{p}word" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c4ecff"/><stop offset="1" stop-color="#62b6ff"/></linearGradient>'
            + glow_filter(f'{p}glow', 7, 1.4, HAZE, 0.85)
            + glow_filter(f'{p}hot', 11, 2.6, '#3aa0ff', 1)
            + glow_filter(f'{p}soft', 9, 1, HAZE, 0.7)
            + f'<filter id="{p}warm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="a"/><feFlood flood-color="#ffb84d" flood-opacity=".35"/><feComposite in2="a" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            + '</defs>')


# ---------------- the hourglass ----------------
def hourglass(p, cx, cy, s, detail=True, light=False, boost=1.0, animated=False):
    """Hourglass drawn in a local frame (height ±190) scaled by s about (cx, cy)."""
    glass_stroke = LIGHT_INK if light else ICE
    fx = (lambda name: '') if light else (lambda name: f' filter="url(#{p}{name})"')
    b = boost
    out = [f'<g transform="translate({f(cx)} {f(cy)}) scale({f(s)})">']
    glass = 'M-74 -154 C-74 -60 -9 -34 -7 0 C-9 34 -74 60 -74 154 L74 154 C74 60 9 34 7 0 C9 -34 74 -60 74 -154 Z'
    out.append(f'<clipPath id="{p}clip"><path d="{glass}"/></clipPath>')
    # glass body
    out.append(f'<path d="{glass}" fill="url(#{p}glass)"/>')
    # sand
    sand = [
        f'<circle cx="0" cy="118" r="78" fill="url(#{p}neb)"/>',
        f'<path d="M-90 -72 Q0 -46 90 -72 L90 4 L-90 4 Z" fill="url(#{p}sand)" opacity=".92"/>',
        f'<path d="M-90 156 L-90 142 Q-42 132 -18 110 Q0 94 18 110 Q42 132 90 142 L90 156 Z" fill="url(#{p}sand)"/>',
    ]
    if detail and not light:
        rnd = random.Random(7)
        for _ in range(16):
            x, y = rnd.uniform(-60, 60), rnd.uniform(40, 128)
            if abs(x) < 62 - (128 - y) * 0.35:
                sand.append(sparkle(x, y, rnd.uniform(1.6, 3.6), STAR))
        for _ in range(9):
            x, y = rnd.uniform(-50, 50), rnd.uniform(-60, -20)
            sand.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(.8, 1.6))}" fill="{STAR}" opacity=".9"/>')
    out.append(f'<g clip-path="url(#{p}clip)"{fx("hot")}>' + ''.join(sand)
               + f'<path class="sand" d="M0 0 L0 100" stroke="{"#2456d6" if light else STAR}" stroke-width="{f(3 * b)}" stroke-dasharray="3 5" stroke-linecap="round"/></g>')
    # glass outline and highlights
    out.append(f'<path d="{glass}" fill="none" stroke="{glass_stroke}" stroke-width="{f(2.6 * b)}"{fx("glow")}/>')
    if not light and detail:
        out.append('<path d="M-60 -140 C-60 -92 -42 -62 -22 -40" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3.2" stroke-linecap="round"/>')
        out.append('<path d="M-61 140 C-61 112 -50 92 -37 78" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round"/>')
    # columns
    if detail:
        for sx in (-1, 1):
            x = sx * 93
            out.append(f'<rect x="{f(x - 6.5)}" y="-150" width="13" height="300" fill="url(#{p}col)"/>')
            for fl in (-2.6, 0, 2.6):
                out.append(f'<path d="M{f(x + fl)} -144 L{f(x + fl)} 144" stroke="{BRONZE_DARK}" stroke-opacity=".45" stroke-width=".9"/>')
            for yy, hh in ((-156, 7), (149, 7)):
                out.append(f'<rect x="{f(x - 11)}" y="{yy}" width="22" height="{hh}" rx="1.5" fill="url(#{p}gold)"/>')
    # plates (entablature above, plinth below)
    gold = f'url(#{p}gold)'
    plates = []
    for sgn in (-1, 1):
        y_outer = -190 if sgn < 0 else 166
        y_step = -166 if sgn < 0 else 156
        plates.append(f'<rect x="-112" y="{y_outer}" width="224" height="24" rx="5" fill="{gold}"/>')
        plates.append(f'<rect x="-98" y="{y_step}" width="196" height="10" rx="2" fill="{gold}"/>')
        if detail:
            plates.append(meander_strip(-98, 98, y_outer + 5, 14, 1.6, BRONZE_DARK))
        yv = y_outer + 12
        for vx in (-1, 1):
            X = vx * 112
            plates.append(f'<circle cx="{X}" cy="{yv}" r="{f(12 if detail else 13)}" fill="{gold}"/>')
            if detail:
                plates.append(f'<path d="M{X} {yv - 8} A8 8 0 1 {1 if vx > 0 else 0} {X + vx * .01} {yv - 8} M{X} {yv - 4.5} A4.5 4.5 0 1 {1 if vx > 0 else 0} {X + vx * .01} {yv - 4.5}" '
                              f'fill="none" stroke="{BRONZE_DARK}" stroke-opacity=".55" stroke-width="1.3"/>')
                plates.append(f'<circle cx="{X}" cy="{yv}" r="2" fill="{BRONZE_DARK}" fill-opacity=".6"/>')
    if detail:
        plates.append('<path d="M-84 -190 L0 -216 L84 -190 Z" fill="' + gold + '"/>')
        plates.append(f'<path d="M-66 -193 L0 -211 L66 -193 Z" fill="none" stroke="{BRONZE_DARK}" stroke-opacity=".5" stroke-width="1.3"/>')
    out.append(f'<g{fx("warm")}>' + ''.join(plates) + '</g>')
    if detail:
        gem = f'url(#{p}orb)' if not light else LIGHT_DEEP
        out.append(f'<g{fx("hot")}><path d="M0 -209 L7 -200 L0 -191 L-7 -200 Z" fill="{gem}"/></g>')
    out.append('</g>')
    return ''.join(out)


def arcane(p, cx, cy, light=False, animated=False):
    """Ring behind the hourglass: Greek key band, the three Greek words for time, crossed orbits forming Χ."""
    ink = LIGHT_DEEP if light else INK
    deep = LIGHT_DEEP if light else DEEP
    cls = lambda c: f' class="{c}"' if animated else ''
    fx = '' if light else f' filter="url(#{p}glow)"'
    o = []
    if not light:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="200" fill="url(#{p}core)"/>')
        rnd = random.Random(3)
        stars = []
        for _ in range(26):
            a, r = rnd.uniform(0, 360), rnd.uniform(120, 200)
            x, y = polar(a, r, cx, cy)
            stars.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(.6, 1.5))}" fill="{STAR}" opacity="{f(rnd.uniform(.4, .95))}"/>')
        o.append(f'<g{cls("twinkle")}>' + ''.join(stars) + '</g>')
    o.append(f'<g{fx}>')
    o.append(orbits(p, cx, cy, 'back', light, animated))
    o.append(f'<g{cls("spin-slow")}>' + f'<circle cx="{cx}" cy="{cy}" r="246" fill="none" stroke="{ink}" stroke-width="1.2" opacity=".6"/>'
             + meander_ring(220, 234, 60, 1.7, ink, cx, cy) + '</g>')
    words = ''.join(word_on_circle(DIDOT, w, a, 205, 10, 3.4, cx, cy, flip=90 < a % 360 < 270) for w, a in (('ΧΡΟΝΟΣ', -60), ('ΚΑΙΡΟΣ', 60), ('ΑΙΩΝ', 180)))
    dots = ''
    for a in (120, 240):
        x, y = polar(a, 205, cx, cy)
        dots += sparkle(x, y, 4, ink)
    o.append(f'<g{cls("spin-rev")} fill="{ink}">' + words + dots + '</g>')
    o.append(f'<circle cx="{cx}" cy="{cy}" r="190" fill="none" stroke="{ink}" stroke-width="1" opacity=".55"/>')
    o.append('</g>')
    return ''.join(o)


ORBIT_TILT = (-21, 21)


def orbits(p, cx, cy, half, light=False, animated=False, rx=238, ry=60, sw=1.6, orb=6.5):
    """Two tilted rings that cross in a Χ. 'back' draws the far half, 'front' the near half plus orbs."""
    stroke = LIGHT_DEEP if light else '#5aa8ff'
    fx = '' if light else f' filter="url(#{p}glow)"'
    sweep = 1 if half == 'back' else 0
    out = []
    for i, tilt in enumerate(ORBIT_TILT):
        cls = f' class="orbit-{"ab"[i]}"' if animated else ''
        arc = f'M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 0 {sweep} {f(cx + rx)} {f(cy)}'
        g = f'<path d="{arc}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}" opacity="{".55" if half == "back" else ".95"}"/>'
        if half == 'front' and orb:
            t = math.radians(118 if i == 0 else 62)
            ox, oy = cx + rx * math.cos(t), cy + ry * math.sin(t)
            fill = LIGHT_DEEP if light else f'url(#{p}orb)'
            g += f'<circle cx="{f(ox)}" cy="{f(oy)}" r="{f(orb)}" fill="{fill}"/>'
        out.append(f'<g transform="rotate({tilt} {cx} {cy})"><g{cls}>{g}</g></g>')
    return f'<g{fx}>' + ''.join(out) + '</g>'


def mark(p, light=False, animated=False):
    return (arcane(p, 256, 256, light, animated) + hourglass(p, 256, 256, 1, True, light, animated=animated)
            + orbits(p, 256, 256, 'front', light, animated))


ANIM_CSS = ('<style>'
            '.spin-slow,.spin-rev,.orbit-a,.orbit-b{transform-box:view-box;transform-origin:256px 256px}'
            '.spin-slow{animation:spin 140s linear infinite}'
            '.spin-rev{animation:spin 100s linear infinite reverse}'
            '.orbit-a{animation:wob 7s ease-in-out infinite alternate}'
            '.orbit-b{animation:wob 9s ease-in-out infinite alternate-reverse}'
            '.sand{animation:fall 1s linear infinite}'
            '.twinkle{animation:tw 3.5s ease-in-out infinite alternate}'
            '@keyframes spin{to{transform:rotate(360deg)}}'
            '@keyframes wob{to{transform:rotate(6deg)}}'
            '@keyframes fall{to{stroke-dashoffset:-16}}'
            '@keyframes tw{to{opacity:.45}}'
            '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
            '</style>')


def svg(w, h, body, vb=None):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}" role="img" aria-label="Chronos">'
            f'<title>Chronos</title>{body}</svg>\n')


def write(name, content):
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(content)
    print(f'{name}: {len(content) / 1024:.1f} KB')


write('chronos-mark.svg', svg(512, 512, defs('m') + mark('m')))
write('chronos-mark-animated.svg', svg(512, 512, ANIM_CSS + defs('a') + mark('a', animated=True)))
write('chronos-mark-light.svg', svg(512, 512, defs('l', light=True) + mark('l', light=True)))

# App icon: night-blue tile, crossed orbits, large hourglass
rnd = random.Random(11)
tile_stars = ''.join(f'<circle cx="{f(rnd.uniform(30, 482))}" cy="{f(rnd.uniform(30, 482))}" r="{f(rnd.uniform(.7, 1.8))}" fill="{STAR}" opacity="{f(rnd.uniform(.3, .85))}"/>' for _ in range(40))
icon = (defs('i') + '<rect width="512" height="512" rx="116" fill="url(#itile)"/>' + tile_stars
        + '<circle cx="256" cy="256" r="230" fill="url(#icore)"/>'
        + orbits('i', 256, 256, 'back', rx=226, ry=62, sw=3.2, orb=0)
        + hourglass('i', 256, 262, 1.0, True, boost=1.4)
        + orbits('i', 256, 256, 'front', rx=226, ry=62, sw=3.2, orb=10)
        + '<rect x="2" y="2" width="508" height="508" rx="114" fill="none" stroke="#8fdcff" stroke-opacity=".2" stroke-width="2"/>')
write('chronos-icon.svg', svg(512, 512, icon))

# Favicon: same idea, stripped to what reads at 16–32 px
fav = (defs('f') + '<rect width="512" height="512" rx="116" fill="url(#ftile)"/>'
       + '<circle cx="256" cy="256" r="230" fill="url(#fcore)"/>'
       + hourglass('f', 256, 256, 1.16, False, boost=3.2))
write('chronos-favicon.svg', svg(64, 64, fav, '0 0 512 512'))


def lockup(light=False):
    p = 'L' if light else 'D'
    W, H = 1240, 360
    ms = 320 / 512
    word_size = 118
    word_w = text_width(CINZEL, 'CHRONOS', word_size, 18)
    gx = 382
    body = defs(p, light)
    body += f'<g transform="translate(20 20) scale({f(ms)})">{mark(p, light)}</g>'
    if light:
        body += text_line(CINZEL, 'CHRONOS', gx, 200, word_size, 18, LIGHT_INK)
        accent = '#9a6a22'
    else:
        body += text_line(CINZEL, 'CHRONOS', gx, 200, word_size, 18, f'url(#{p}word)', f' filter="url(#{p}soft)"')
        accent = '#e9c472'
    g_size, gy = 30, 262
    g_w = text_width(DIDOT, 'ΧΡΟΝΟΣ', g_size, 14)
    mid = gx + word_w / 2
    body += text_line(DIDOT, 'ΧΡΟΝΟΣ', mid - g_w / 2, gy, g_size, 14, accent)
    for sgn in (-1, 1):
        x1 = mid + sgn * (g_w / 2 + 22)
        x2 = gx + 6 if sgn < 0 else gx + word_w - 6
        body += f'<path d="M{f(x1)} {gy - 10} L{f(x2)} {gy - 10}" stroke="{accent}" stroke-width="1.6" opacity=".75"/>'
        body += f'<path d="M{f(x2)} {gy - 16} L{f(x2 + sgn * 6)} {gy - 10} L{f(x2)} {gy - 4} L{f(x2 - sgn * 6)} {gy - 10} Z" fill="{accent}"/>'
    return svg(W, H, body)


write('chronos-logo.svg', lockup())
write('chronos-logo-light.svg', lockup(light=True))
