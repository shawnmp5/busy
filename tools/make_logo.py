"""Generate the Chronos logo set as SVG.

The mark: a minimal, all-blue clock emblem. A flat ring holds a dark band with the
ancient Greek numerals for 12, 3, 6 and 9 (ΙΒʹ, Γʹ, Ϛʹ, Θʹ) glowing like runes, around
a glowing face with hands at 10:10. One orbit wraps around it with a single orb.

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




# ---------------- the emblem ----------------
NUMERALS = ['ΙΒ', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ϛ', 'Ζ', 'Η', 'Θ', 'Ι', 'ΙΑ']  # 12 at the top, then 1 to 11
OUTLINE = '#040f2b'
RUNE = '#7fe6ff'


def emblem_defs(p, haze=True):
    g = [
        f'<linearGradient id="{p}metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4f1ff"/><stop offset=".3" stop-color="#6fbaff"/><stop offset=".68" stop-color="#2a6dff"/><stop offset="1" stop-color="#173f9e"/></linearGradient>',
        f'<linearGradient id="{p}metalU" gradientUnits="userSpaceOnUse" x1="40" y1="120" x2="470" y2="400"><stop offset="0" stop-color="#d4f1ff"/><stop offset=".35" stop-color="#6fbaff"/><stop offset=".7" stop-color="#2a6dff"/><stop offset="1" stop-color="#173f9e"/></linearGradient>',
        f'<radialGradient id="{p}face" cx="45%" cy="42%" r="62%"><stop offset="0" stop-color="#8ff0ff"/><stop offset=".35" stop-color="#3fa4ff"/><stop offset=".75" stop-color="#1d4fd6"/><stop offset="1" stop-color="#0b2a7a"/></radialGradient>',
        f'<radialGradient id="{p}band" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#03112e"/><stop offset="1" stop-color="#0a2358"/></radialGradient>',
        f'<radialGradient id="{p}orb" cx="35%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#9ff0ff"/><stop offset="1" stop-color="#1f6bff"/></radialGradient>',
        f'<radialGradient id="{p}core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2a7dff" stop-opacity=".5"/><stop offset=".6" stop-color="#1e6bff" stop-opacity=".16"/><stop offset="1" stop-color="#1e6bff" stop-opacity="0"/></radialGradient>',
        f'<radialGradient id="{p}tile" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="{NAVY_2}"/><stop offset=".6" stop-color="#071433"/><stop offset="1" stop-color="{NAVY}"/></radialGradient>',
        f'<linearGradient id="{p}word" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c4ecff"/><stop offset="1" stop-color="#62b6ff"/></linearGradient>',
        glow_filter(f'{p}rune', 4, 1.2, '#2a9dff', 1),
        glow_filter(f'{p}soft', 9, 1, HAZE, 0.7),
        glow_filter(f'{p}gem', 12, 0, '#3aa0ff', .8),
    ]
    return '<defs>' + ''.join(g) + '</defs>'


def disc(r, fill, cx=256, cy=256):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"/>'


def hand(length, width, tail):
    w = width / 2
    neck = length - 24
    d = (f'M{f(-w)} {f(tail)} L{f(-w * .8)} {f(-neck)} C{f(-w * 2.8)} {f(-neck - 4)} {f(-w * 2)} {f(-length + 8)} 0 {f(-length)} '
         f'C{f(w * 2)} {f(-length + 8)} {f(w * 2.8)} {f(-neck - 4)} {f(w * .8)} {f(-neck)} L{f(w)} {f(tail)} Z')
    return f'<path d="{d}" fill="#f2fbff" stroke="{OUTLINE}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>'


def orbit_ring(p, half, rx, ry, tilt, width, hide_r=None, animated=False):
    """Thick outlined orbit band. 'back' is hidden behind the emblem, 'front' crosses over it."""
    sweep = 1 if half == 'back' else 0
    d = f'M{f(256 - rx)} 256 A{f(rx)} {f(ry)} 0 0 {sweep} {f(256 + rx)} 256'
    band = (f'<path d="{d}" fill="none" stroke="{OUTLINE}" stroke-width="{f(width + 8)}" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{FLAT_RING_HI}" stroke-width="{f(width)}" stroke-linecap="round"/>')
    cls = ' class="orbit"' if animated else ''
    body = f'<g transform="rotate({tilt} 256 256)"><g{cls}>{band}</g></g>'
    if half == 'back' and hide_r:
        return (f'<mask id="{p}hide"><rect x="-80" y="-80" width="672" height="672" fill="#fff"/>{disc(hide_r, "#000")}</mask>'
                f'<g mask="url(#{p}hide)">{body}</g>')
    return body


FLAT_RING = '#3d8bff'
FLAT_RING_HI = '#7fc0ff'
FLAT_BAND = '#06173f'
FLAT_FACE = '#2f9bff'


def emblem(p, detail=True, orbit=True, crown=False, animated=False, hand_ids=False, glow=True):
    """Minimal emblem centred at (256, 256): flat ring, dark band with four Greek numerals,
    glowing face, two hands, one orbit and one orb."""
    cls = lambda c: f' class="{c}"' if animated else ''
    hid = lambda n: f' id="brand-{n}"' if hand_ids else ''
    o = []
    if glow:
        o.append(disc(240, f'url(#{p}core)'))
    if orbit:
        o.append(orbit_ring(p, 'back', 230, 56, -38, 9, hide_r=178, animated=animated))
    o.append(disc(178, OUTLINE) + disc(173, FLAT_RING))
    o.append('<path d="M98 214 A162 162 0 0 1 214 98" fill="none" stroke="' + FLAT_RING_HI + '" stroke-width="9" stroke-linecap="round"/>')
    o.append(disc(150, OUTLINE) + disc(146, FLAT_BAND))
    marks = []
    for i in range(12):
        if i % 3 == 0:
            if detail:
                word = NUMERALS[i] + '\u0374'
                x, y = polar(i * 30, 124, 256, 256)
                size = 32
                w = text_width(DIDOT, word, size, 1)
                ch = cap_height(DIDOT) * size / DIDOT['head'].unitsPerEm
                marks.append(text_line(DIDOT, word, x - w / 2 + 2, y + ch / 2, size, 1, RUNE))
            else:
                marks.append(disc(15, RUNE, *polar(i * 30, 126, 256, 256)))
        else:
            marks.append(disc(5.5 if detail else 9, RUNE, *polar(i * 30, 126, 256, 256)))
    o.append(f'<g{cls("runes")} fill="{RUNE}" stroke="{RUNE}" stroke-width="{1.2 if detail else 0}" filter="url(#{p}rune)">' + ''.join(marks) + '</g>')
    o.append(disc(106, OUTLINE) + f'<g filter="url(#{p}gem)">{disc(101, FLAT_FACE)}</g>')
    o.append('<path d="M190 236 A70 70 0 0 1 236 190" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="9" stroke-linecap="round"/>')
    o.append(f'<g transform="rotate(305 256 256)"{hid("hour")}><g{cls("hh")}><g transform="translate(256 256)">{hand(56, 10, 10)}</g></g></g>')
    o.append(f'<g transform="rotate(60 256 256)"{hid("min")}><g{cls("mh")}><g transform="translate(256 256)">{hand(80, 8, 12)}</g></g></g>')
    o.append(disc(12, OUTLINE) + disc(7.5, '#f2fbff'))
    if orbit:
        o.append(orbit_ring(p, 'front', 230, 56, -38, 9, animated=animated))
        o.append(f'<g{cls("bob")}>' + disc(18, OUTLINE, 420, 70) + disc(13.5, '#7fe6ff', 420, 70) + '</g>')
    return ''.join(o)


ANIM_CSS = ('<style>'
            '.orbit,.runes,.mh,.hh{transform-box:view-box;transform-origin:256px 256px}'
            '.orbit{animation:wob 7s ease-in-out infinite alternate}'
            '.runes{animation:spin 120s linear infinite}'
            '.mh{animation:spin 60s linear infinite}'
            '.hh{animation:spin 720s linear infinite}'
            '.bob{animation:bob 3s ease-in-out infinite alternate}'
            
            '@keyframes spin{to{transform:rotate(360deg)}}'
            '@keyframes wob{to{transform:rotate(5deg)}}'
            '@keyframes bob{to{transform:translateY(8px)}}'
            '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
            '</style>')


def svg(w, h, body, vb=None, extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}" role="img" aria-label="Chronos"{extra}>'
            f'<title>Chronos</title>{body}</svg>\n')


def write(name, content):
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(content)
    print(f'{name}: {len(content) / 1024:.1f} KB')


write('chronos-mark.svg', svg(512, 512, emblem_defs('m') + emblem('m')))
write('chronos-mark-animated.svg', svg(512, 512, ANIM_CSS + emblem_defs('a') + emblem('a', animated=True)))
write('chronos-mark-light.svg', svg(512, 512, emblem_defs('l') + emblem('l', glow=False)))

rnd = random.Random(11)
tile_stars = ''.join(f'<circle cx="{f(rnd.uniform(30, 482))}" cy="{f(rnd.uniform(30, 482))}" r="{f(rnd.uniform(.7, 1.8))}" fill="{STAR}" opacity="{f(rnd.uniform(.3, .85))}"/>' for _ in range(36))
icon = (emblem_defs('i') + '<rect width="512" height="512" rx="116" fill="url(#itile)"/>' + tile_stars
        + f'<g transform="translate(256 262) scale(.86) translate(-256 -256)">{emblem("i")}</g>'
        + '<rect x="2" y="2" width="508" height="508" rx="114" fill="none" stroke="#8fdcff" stroke-opacity=".2" stroke-width="2"/>')
write('chronos-icon.svg', svg(512, 512, icon))


def favicon(p, hand_ids=False):
    return (emblem_defs(p) + f'<rect width="512" height="512" rx="116" fill="url(#{p}tile)"/>'
            + f'<g transform="translate(256 256) scale(1.33) translate(-256 -256)">{emblem(p, detail=False, orbit=False, crown=False, hand_ids=hand_ids, glow=False)}</g>')


write('chronos-favicon.svg', svg(64, 64, favicon('f'), '0 0 512 512'))
write('chronos-brand.svg', svg(36, 36, favicon('b', hand_ids=True), '0 0 512 512', ' class="brand-tile"'))


def lockup(light=False):
    """ΧΡΟΝΟΣ in Greek as the headline, CHRONOS small beneath it."""
    p = 'L' if light else 'D'
    W, H = 1240, 360
    ms = 330 / 512
    g_size, g_track = 132, 20
    g_w = text_width(DIDOT, 'ΧΡΟΝΟΣ', g_size, g_track)
    gx = 392
    body = emblem_defs(p)
    body += f'<g transform="translate(14 14) scale({f(ms)})">{emblem(p, glow=not light)}</g>'
    if light:
        body += text_line(DIDOT, 'ΧΡΟΝΟΣ', gx, 206, g_size, g_track, LIGHT_INK)
        accent = LIGHT_DEEP
    else:
        body += text_line(DIDOT, 'ΧΡΟΝΟΣ', gx, 206, g_size, g_track, f'url(#{p}word)', f' filter="url(#{p}soft)"')
        accent = '#7fd8ff'
    l_size, l_track, ly = 26, 16, 262
    l_w = text_width(CINZEL, 'CHRONOS', l_size, l_track)
    mid = gx + g_w / 2
    body += text_line(CINZEL, 'CHRONOS', mid - l_w / 2, ly, l_size, l_track, accent)
    for sgn in (-1, 1):
        x1 = mid + sgn * (l_w / 2 + 22)
        x2 = gx + 6 if sgn < 0 else gx + g_w - 6
        body += f'<path d="M{f(x1)} {ly - 10} L{f(x2)} {ly - 10}" stroke="{accent}" stroke-width="1.6" opacity=".75"/>'
        body += f'<path d="M{f(x2)} {ly - 16} L{f(x2 + sgn * 6)} {ly - 10} L{f(x2)} {ly - 4} L{f(x2 - sgn * 6)} {ly - 10} Z" fill="{accent}"/>'
    return svg(W, H, body)


write('chronos-logo.svg', lockup())
write('chronos-logo-light.svg', lockup(light=True))
