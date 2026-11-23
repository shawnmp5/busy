"""Generate the Chronos logo set as SVG.

The mark: a glowing blue clock. Its dial carries ancient Greek numerals (Αʹ to ΙΒʹ),
a Greek key bezel and the three Greek words for time (ΧΡΟΝΟΣ, ΚΑΙΡΟΣ, ΑΙΩΝ), with
spear-tipped hands at 10:10. Two orbits cross around it to form a Χ (chi), the first
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
INK = '#8fdcff'      # arcane rings
DEEP = '#3d8bff'
HAZE = '#1e6bff'     # glow
STAR = '#eafcff'
NAVY = '#040a1c'
NAVY_2 = '#0d2763'
LIGHT_INK = '#0e2a6e'
LIGHT_DEEP = '#2456d6'


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


BAND = '#06173a'


def defs(p, light=False):
    """Gradients and filters; ids are prefixed with p so several SVGs can share one page."""
    g = []
    if light:
        g.append(f'<linearGradient id="{p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8dff"/><stop offset=".5" stop-color="#2456d6"/><stop offset="1" stop-color="#0e2a6e"/></linearGradient>')
        g.append(f'<radialGradient id="{p}glass" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2456d6" stop-opacity=".03"/><stop offset=".85" stop-color="#2456d6" stop-opacity=".08"/><stop offset="1" stop-color="#2456d6" stop-opacity=".18"/></radialGradient>')
    else:
        g.append(f'<linearGradient id="{p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fcff"/><stop offset=".3" stop-color="#9fe6ff"/><stop offset=".65" stop-color="#3f9bff"/><stop offset="1" stop-color="#1a4fd0"/></linearGradient>')
        g.append(f'<radialGradient id="{p}glass" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6fd3ff" stop-opacity=".05"/><stop offset=".7" stop-color="#3d8bff" stop-opacity=".1"/><stop offset=".93" stop-color="#6fd3ff" stop-opacity=".22"/><stop offset="1" stop-color="#bff0ff" stop-opacity=".45"/></radialGradient>')
    g.append(f'<linearGradient id="{p}shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>')
    g.append(f'<radialGradient id="{p}orb" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#8fe6ff"/><stop offset="1" stop-color="#1f5eff"/></radialGradient>')
    g.append(f'<radialGradient id="{p}core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2a7dff" stop-opacity=".45"/><stop offset=".6" stop-color="#1e6bff" stop-opacity=".14"/><stop offset="1" stop-color="#1e6bff" stop-opacity="0"/></radialGradient>')
    g.append(f'<radialGradient id="{p}tile" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="{NAVY_2}"/><stop offset=".6" stop-color="#071433"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>')
    g.append(f'<linearGradient id="{p}word" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c4ecff"/><stop offset="1" stop-color="#62b6ff"/></linearGradient>')
    g.append(glow_filter(f'{p}glow', 7, 1.4, HAZE, 0.85))
    g.append(glow_filter(f'{p}hot', 10, 2.2, '#3aa0ff', 1))
    g.append(glow_filter(f'{p}soft', 9, 1, HAZE, 0.7))
    g.append(f'<filter id="{p}warm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="a"/>'
             f'<feFlood flood-color="#2a8cff" flood-opacity=".7"/><feComposite in2="a" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')
    return '<defs>' + ''.join(g) + '</defs>'


# ---------------- the clock ----------------
def gear(cx, cy, r, teeth, depth, spokes, sw, stroke, fill='none'):
    """Antikythera-style gear in line art: toothed rim, cut-out spokes, hub."""
    step = 360 / teeth
    root = r - depth
    pts = []
    for i in range(teeth):
        a = i * step
        for frac, rr in ((0, root), (0.12, r), (0.42, r), (0.54, root)):
            pts.append(polar(a + frac * step, rr, cx, cy))
    d = 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z'
    rim = root - max(5, r * 0.09)
    hub = max(6, r * 0.16)
    out = [f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{f(sw)}" stroke-linejoin="round"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(rim)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}"/>',
           f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(hub)}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}"/>']
    for k in range(spokes):
        a = k * 360 / spokes
        x1, y1 = polar(a, hub, cx, cy)
        x2, y2 = polar(a, rim, cx, cy)
        out.append(f'<path d="M{f(x1)} {f(y1)} L{f(x2)} {f(y2)}" stroke="{stroke}" stroke-width="{f(sw * 2.2)}" stroke-linecap="round"/>')
    return ''.join(out)


def hand(length, ring_at, ring_r, width, tail, fill, stroke_w=0):
    """Breguet-style hand pointing up from (0,0): shaft, open ring, spear tip, short tail."""
    w = width / 2
    tip0 = ring_at - ring_r - 2
    d = (f'M{f(-w)} {f(tail)} L{f(-w * .8)} {f(-(ring_at - ring_r))} L{f(w * .8)} {f(-(ring_at - ring_r))} L{f(w)} {f(tail)} Z '
         f'M0 {f(-length)} C{f(w * 2.6)} {f(-(length - 14))} {f(w * 2.4)} {f(-(tip0 + 6))} {f(w * .9)} {f(-tip0)} '
         f'L{f(-w * .9)} {f(-tip0)} C{f(-w * 2.4)} {f(-(tip0 + 6))} {f(-w * 2.6)} {f(-(length - 14))} 0 {f(-length)} Z')
    ring = f'<circle cx="0" cy="{f(-ring_at)}" r="{f(ring_r)}" fill="none" stroke="{fill}" stroke-width="{f(max(2.4, width * .6))}"/>'
    return f'<path d="{d}" fill="{fill}"/>' + ring


def clock(p, cx, cy, s=1.0, light=False, animated=False, detail=True, hand_ids=False):
    """The glass clock, drawn for radius 246 and scaled by s about (cx, cy)."""
    gold = f'url(#{p}gold)'
    cyan = LIGHT_DEEP if light else '#6fd3ff'
    num_fill = '#ffffff' if light else '#bff0ff'
    gearc = LIGHT_INK if light else '#5fc8ff'
    fx = (lambda n: '') if light else (lambda n: f' filter="url(#{p}{n})"')
    cls = lambda c: f' class="{c}"' if animated else ''
    o = [f'<g transform="translate({f(cx)} {f(cy)}) scale({f(s)}) translate(-256 -256)">']
    C = 256
    o.append(f'<clipPath id="{p}face"><circle cx="{C}" cy="{C}" r="198"/></clipPath>')
    # glass face
    o.append(f'<circle cx="{C}" cy="{C}" r="198" fill="url(#{p}glass)"/>')
    # gears seen through the glass
    if detail:
        r1, r2, r3 = 112, 60, 44
        c2 = polar(132, r1 + r2 - 5, C, C)
        c3 = polar(292, r1 + r3 - 5, C, C)
        gears = [
            (f'<g{cls("g1")}>' + gear(C, C, r1, 60, 7, 0, 1.4, gearc) + f'<circle cx="{C}" cy="{C}" r="{r1 * .55}" fill="none" stroke="{gearc}" stroke-width="1.2" stroke-dasharray="3 5"/>' + '</g>'),
            (f'<g{cls("g2")} style="transform-origin:{f(c2[0])}px {f(c2[1])}px">' + gear(c2[0], c2[1], r2, 32, 6, 4, 1.4, gearc) + '</g>'),
            (f'<g{cls("g3")} style="transform-origin:{f(c3[0])}px {f(c3[1])}px">' + gear(c3[0], c3[1], r3, 24, 5, 4, 1.4, gearc) + '</g>'),
        ]
        o.append(f'<g clip-path="url(#{p}face)" opacity="{".4" if light else ".55"}"{fx("glow")}>' + ''.join(gears) + '</g>')
        # inscription inside the glass rim
        words = ''.join(word_on_circle(DIDOT, w, a, 182, 9.5, 3.2, C, C, flip=90 < a % 360 < 270)
                        for w, a in (('ΧΡΟΝΟΣ', 0), ('ΚΑΙΡΟΣ', 120), ('ΑΙΩΝ', 240)))
        dots = ''.join(sparkle(*polar(a, 182, C, C), 3.6, cyan) for a in (60, 180, 300))
        o.append(f'<g fill="{cyan}"{fx("glow")}>{words}{dots}</g>')
    # minute ticks on the glass edge
    ticks = []
    for m in range(60):
        big = m % 5 == 0
        x1, y1 = polar(m * 6, 196 - (14 if big else 6), C, C)
        x2, y2 = polar(m * 6, 196, C, C)
        ticks.append(f'<path d="M{f(x1)} {f(y1)} L{f(x2)} {f(y2)}" stroke-width="{3.2 if big else 1.2}"/>')
    o.append(f'<g stroke="{cyan}" stroke-linecap="round"{fx("glow")}>' + ''.join(ticks) + '</g>')
    # rune band: dark ring of glowing Greek numerals between two gold rings
    o.append(f'<circle cx="{C}" cy="{C}" r="219" fill="none" stroke="{BAND if not light else LIGHT_INK}" stroke-width="30"/>')
    if detail:
        nums = []
        for i, n in enumerate(['ΙΒ', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ϛ', 'Ζ', 'Η', 'Θ', 'Ι', 'ΙΑ']):
            nums.append(word_on_circle(DIDOT, n + 'ʹ', i * 30, 219, 15, 0.6, C, C, flip=90 < (i * 30) % 360 < 270))
        o.append(f'<g fill="{num_fill}"{fx("hot")}>' + ''.join(nums) + '</g>')
        mdots = ''.join(f'<circle cx="{f(polar(a, 219, C, C)[0])}" cy="{f(polar(a, 219, C, C)[1])}" r="1.6"/>' for a in range(0, 360, 6) if a % 30 and a % 30 not in (6, 24))
        o.append(f'<g fill="{cyan}" opacity=".8">{mdots}</g>')
    # gold rings
    o.append(f'<g{fx("warm")}><circle cx="{C}" cy="{C}" r="240" fill="none" stroke="{gold}" stroke-width="10"/>'
             f'<circle cx="{C}" cy="{C}" r="201" fill="none" stroke="{gold}" stroke-width="6"/></g>')
    if detail:
        o.append(f'<g opacity=".55">{meander_ring(236.2, 241.8, 90, .9, '#0a2a66', C, C)}</g>')
    # crown at 12, like a pocket watch
    o.append(f'<g{fx("warm")}><rect x="{C - 9}" y="{C - 262}" width="18" height="14" rx="3" fill="{gold}"/>'
             f'<rect x="{C - 13}" y="{C - 270}" width="26" height="9" rx="4" fill="{gold}"/></g>')
    # glass shine
    if not light:
        o.append(f'<path d="M{C - 176} {C - 30} A178 178 0 0 1 {C - 30} {C - 176} L{C - 36} {C - 160} A162 162 0 0 0 {C - 160} {C - 36} Z" fill="url(#{p}shine)"/>')
        o.append(f'<path d="M{C + 120} {C + 140} A182 182 0 0 0 {C + 150} {C + 104}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>')
    # hands at 10:10, second hand at 35 s
    hid = lambda n: f' id="brand-{n}"' if hand_ids else ''
    hand_fill = gold
    o.append(f'<g{fx("warm")}>'
             f'<g transform="rotate(305 {C} {C})"{hid("hour")}><g transform="translate({C} {C})">{hand(112, 72, 9, 7, 22, hand_fill)}</g></g>'
             f'<g transform="rotate(60 {C} {C})"{hid("min")}><g transform="translate({C} {C})">{hand(166, 124, 7, 5, 28, hand_fill)}</g></g>'
             '</g>')
    if detail:
        o.append(f'<g{cls("sec")} transform="rotate(210 {C} {C})"{fx("hot")}><path d="M{C} {C + 40} L{C} {C - 178}" stroke="{cyan}" stroke-width="1.8" stroke-linecap="round"/>'
                 f'<circle cx="{C}" cy="{C + 32}" r="5" fill="{cyan}"/></g>')
    o.append(f'<circle cx="{C}" cy="{C}" r="13" fill="{gold}"/>')
    o.append(f'<g{fx("hot")}><circle cx="{C}" cy="{C}" r="8" fill="{LIGHT_DEEP if light else f"url(#{p}orb)"}"/></g>')
    o.append('</g>')
    return ''.join(o)


ORBIT_TILT = (-18, 18)


def orbits(p, cx, cy, half, light=False, animated=False, rx=250, ry=56, sw=1.6, orb=7, hide=None):
    """Two tilted rings that cross in a Χ. 'back' draws the far half, 'front' the near half plus orbs."""
    stroke = LIGHT_DEEP if light else '#5aa8ff'
    fx = '' if light else f' filter="url(#{p}glow)"'
    sweep = 1 if half == 'back' else 0
    out = []
    for i, tilt in enumerate(ORBIT_TILT):
        cls = f' class="orbit-{"ab"[i]}"' if animated else ''
        arc = f'M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 0 {sweep} {f(cx + rx)} {f(cy)}'
        g = f'<path d="{arc}" fill="none" stroke="{stroke}" stroke-width="{f(sw)}" opacity="{".5" if half == "back" else ".95"}"/>'
        if half == 'front' and orb:
            t = math.radians(118 if i == 0 else 62)
            g += f'<circle cx="{f(cx + rx * math.cos(t))}" cy="{f(cy + ry * math.sin(t))}" r="{f(orb)}" fill="{LIGHT_DEEP if light else f"url(#{p}orb)"}"/>'
        out.append(f'<g transform="rotate({tilt} {cx} {cy})"><g{cls}>{g}</g></g>')
    mask = ''
    if half == 'back' and hide:
        hx, hy, hr = hide
        mid = f'{p}hide{half}'
        mask = (f'<mask id="{mid}"><rect x="-50" y="-50" width="612" height="612" fill="#fff"/>'
                f'<circle cx="{f(hx)}" cy="{f(hy)}" r="{f(hr)}" fill="#000"/></mask>')
        return mask + f'<g mask="url(#{mid})"><g{fx}>' + ''.join(out) + '</g></g>'
    return f'<g{fx}>' + ''.join(out) + '</g>'


def backdrop(p, cx, cy, light=False, animated=False):
    if light:
        return ''
    rnd = random.Random(3)
    stars = ''.join(f'<circle cx="{f(polar(rnd.uniform(0, 360), rnd.uniform(200, 250), cx, cy)[0])}" cy="{f(polar(rnd.uniform(0, 360), rnd.uniform(200, 250), cx, cy)[1])}" '
                    f'r="{f(rnd.uniform(.6, 1.5))}" fill="{STAR}" opacity="{f(rnd.uniform(.35, .9))}"/>' for _ in range(22))
    sp = ''.join(sparkle(*polar(a, r, cx, cy), sz, STAR) for a, r, sz in ((38, 254, 5), (232, 250, 4), (150, 252, 3.5)))
    tw = ' class="twinkle"' if animated else ''
    return f'<circle cx="{cx}" cy="{cy}" r="250" fill="url(#{p}core)"/><g{tw}>{stars}{sp}</g>'


def mark(p, light=False, animated=False):
    return (backdrop(p, 256, 256, light, animated) + orbits(p, 256, 256, 'back', light, animated, hide=(256, 264, 246 * 0.8))
            + clock(p, 256, 264, 0.8, light, animated) + orbits(p, 256, 256, 'front', light, animated))


ANIM_CSS = ('<style>'
            '.g1,.orbit-a,.orbit-b,.sec{transform-box:view-box;transform-origin:256px 256px}'
            '.g2,.g3{transform-box:view-box}'
            '.g1{animation:spin 60s linear infinite}'
            '.g2{animation:spin 32s linear infinite reverse}'
            '.g3{animation:spin 24s linear infinite reverse}'
            '.sec{animation:tick 60s steps(60) infinite}'
            '.orbit-a{animation:wob 7s ease-in-out infinite alternate}'
            '.orbit-b{animation:wob 9s ease-in-out infinite alternate-reverse}'
            '.twinkle{animation:tw 3.5s ease-in-out infinite alternate}'
            '@keyframes spin{to{transform:rotate(360deg)}}'
            '@keyframes tick{to{transform:rotate(360deg)}}'
            '@keyframes wob{to{transform:rotate(6deg)}}'
            '@keyframes tw{to{opacity:.45}}'
            '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
            '</style>')


def svg(w, h, body, vb=None, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}" role="img" aria-label="Chronos"{extra}>'
            f'<title>Chronos</title>{body}</svg>\n')


def write(name, content):
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(content)
    print(f'{name}: {len(content) / 1024:.1f} KB')


write('chronos-mark.svg', svg(512, 512, defs('m') + mark('m')))
write('chronos-mark-animated.svg', svg(512, 512, ANIM_CSS + defs('a') + mark('a', animated=True)))
write('chronos-mark-light.svg', svg(512, 512, defs('l', light=True) + mark('l', light=True)))

rnd = random.Random(11)
tile_stars = ''.join(f'<circle cx="{f(rnd.uniform(30, 482))}" cy="{f(rnd.uniform(30, 482))}" r="{f(rnd.uniform(.7, 1.8))}" fill="{STAR}" opacity="{f(rnd.uniform(.3, .85))}"/>' for _ in range(40))
icon = (defs('i') + '<rect width="512" height="512" rx="116" fill="url(#itile)"/>' + tile_stars
        + '<circle cx="256" cy="256" r="236" fill="url(#icore)"/>'
        + orbits('i', 256, 256, 'back', rx=232, ry=60, sw=3.2, orb=0, hide=(256, 266, 246 * 0.72))
        + clock('i', 256, 266, 0.72, detail=True)
        + orbits('i', 256, 256, 'front', rx=232, ry=60, sw=3.2, orb=11)
        + '<rect x="2" y="2" width="508" height="508" rx="114" fill="none" stroke="#8fdcff" stroke-opacity=".2" stroke-width="2"/>')
write('chronos-icon.svg', svg(512, 512, icon))


def favicon(p, hand_ids=False):
    return (defs(p) + f'<rect width="512" height="512" rx="116" fill="url(#{p}tile)"/>'
            + f'<circle cx="256" cy="256" r="236" fill="url(#{p}core)"/>'
            + clock(p, 256, 270, 0.9, detail=False, hand_ids=hand_ids))


write('chronos-favicon.svg', svg(64, 64, favicon('f'), '0 0 512 512'))
# Header logo for the site: same as the favicon, with hand ids so the page can show the real time
write('chronos-brand.svg', svg(36, 36, favicon('b', hand_ids=True), '0 0 512 512', ' class="brand-tile"'))


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
        accent = LIGHT_DEEP
    else:
        body += text_line(CINZEL, 'CHRONOS', gx, 200, word_size, 18, f'url(#{p}word)', f' filter="url(#{p}soft)"')
        accent = '#7fd8ff'
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
