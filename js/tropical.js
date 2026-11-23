/* Chronos — "Tropical" scene.

   A wall of jungle foliage, painted entirely in code, in three depths:
   - far: a soft, out-of-focus mass of leaves with a little mist in front of it,
   - middle: leaves slightly out of focus, swaying gently,
   - near: big sharp leaves reaching in from the edges, swaying in the wind and in gusts.
   The leaves are monstera (with their splits and holes), arching palm fronds and ferns, with hibiscus flowers and buds tucked between them.
   By day, sunlight falls through in shafts and dapples drift across the leaves, and butterflies flutter past.
   By night it turns moonlit blue-green, with fireflies blinking in the dark.

   Every leaf is painted once into a sprite; each frame only rotates them around their stems, so it stays light.
   It pauses in background tabs and draws one still frame for reduced motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEFAULTS = { mode: 'day', wind: 40, brightness: 100, flowers: true, critters: true, light: true, orb: true, parallax: true };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(lerp(v, hexRgb(b)[i], t)).toString(16).padStart(2, '0')).join('');
  const canFilter = (() => { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();

  /* ============================================================
     Palettes
     ============================================================ */
  const PAL = {
    day: {
      bg: ['#06200f', '#020c06'], shade: '#020c06', mist: '60,110,60', mistA: .03,
      monstera: { dark: '#0a3a1e', mid: '#1b6e34', light: '#58b456', vein: '#a6e08e', stem: '#2f7a36' },
      palm: { dark: '#1a5a22', mid: '#3a8f2e', light: '#90d14f', vein: '#c7ee8a', stem: '#5c8a2e' },
      fern: { dark: '#1d5a1e', mid: '#3d8d2a', light: '#86c84a', vein: '#b8e27a', stem: '#4a7a26' },
      heart: { dark: '#052a17', mid: '#0f4e2c', light: '#3a9658', vein: '#8fd2a0', stem: '#2a6a3e' },
      ray: '255,250,214', flowerTint: null, tintAmt: 0,
    },
    night: {
      bg: ['#03110f', '#010807'], shade: '#010807', mist: '60,110,120', mistA: .14,
      monstera: { dark: '#04201a', mid: '#0d3d30', light: '#2a6e5a', vein: '#5aa08c', stem: '#134a3a' },
      palm: { dark: '#06241a', mid: '#124432', light: '#3a7a58', vein: '#64a888', stem: '#1c4a34' },
      fern: { dark: '#062418', mid: '#11402c', light: '#347450', vein: '#5c9c7a', stem: '#1a4430' },
      heart: { dark: '#031a14', mid: '#0a3428', light: '#24604e', vein: '#4e9080', stem: '#123e32' },
      ray: '170,210,255', flowerTint: '#1a2a44', tintAmt: .42,
    },
  };
  const FLOWERS = [
    { petal: '#e6243a', edge: '#ff5c62', eye: '#6c0820', pollen: '#ffd23f', stigma: '#560716' }, /* red */
    { petal: '#ff8d69', edge: '#ffc3a0', eye: '#c42853', pollen: '#ffe27a', stigma: '#a8123c' }, /* coral */
    { petal: '#ff5b97', edge: '#ffadcf', eye: '#990e46', pollen: '#ffe066', stigma: '#780a34' }, /* pink */
    { petal: '#ffcd3c', edge: '#fff0a4', eye: '#c6184e', pollen: '#fff3b0', stigma: '#a0123e' }, /* yellow */
  ];

  /* ============================================================
     Leaf sprites. Each is drawn pointing up (−y) from its stem at the origin, in units where the leaf is 1 long.
     ============================================================ */
  const BOUNDS = { monstera: [-.46, -1.04, .92, 1.08], palm: [-.6, -1.18, 1.5, 1.26], fern: [-.46, -1.14, 1.12, 1.2] };
  function sheet(type, k) {
    const [x0, y0, w, h] = BOUNDS[type], c = makeCanvas(w * k, h * k), g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    return { c, g, ox: -x0 * k, oy: -y0 * k, k };
  }
  /* An ovate leaf with a notched (heart-shaped) base: the stem joins at (0, attach) and the tip is `len` above it */
  function bladePoints(attach, len, wmax, R, wobble) {
    const hw = f => wmax * Math.pow(Math.sin(Math.PI * (f * .8 + .2)), .85) * (1 + wobble * Math.sin(f * 11 + R) * .5);
    const right = [], N = 60;
    for (let i = 0; i <= N; i++) { const f = i / N; right.push([hw(f), attach - len * f]); }
    const lobe = [], b = hw(0);
    for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI; lobe.push([b * (.55 + .45 * Math.cos(a)), attach + Math.sin(a) * len * .1]); }
    lobe.push([b * .06, attach + len * .015]);
    const half = [...lobe.slice().reverse(), ...right];          /* notch → lobe → base → up the right edge to the tip */
    return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];
  }
  const inPoly = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const polyPath = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
  function bladeShading(g, path, C, top, bottom, wide) {
    const grd = g.createLinearGradient(-wide, 0, wide, 0);
    grd.addColorStop(0, C.dark); grd.addColorStop(.45, C.mid); grd.addColorStop(.55, mix(C.mid, C.light, .25)); grd.addColorStop(1, C.dark);
    g.fillStyle = grd; g.fill(path);
    g.save(); g.clip(path);
    const cy = lerp(top, bottom, .45), rad = g.createRadialGradient(-wide * .25, cy, 0, 0, cy, (bottom - top) * .75);
    rad.addColorStop(0, `rgba(${hexRgb(C.mid).join(',')},0)`); rad.addColorStop(1, `rgba(${hexRgb(C.dark).join(',')},.45)`);
    g.fillStyle = rad; g.fillRect(-wide * 1.2, top - .05, wide * 2.4, bottom - top + .1);
    g.restore();
  }
  function gloss(g, x, y, rx, ry, rot, a) {
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
    const s = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    s.addColorStop(0, `rgba(255,255,255,${a})`); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
  }
  function monsteraSprite(C, k, seed) {
    const S = sheet('monstera', k), g = S.g, R = rng(seed), attach = -.3, len = .7, wmax = .4;
    const pts = bladePoints(attach, len, wmax, R() * 9, .03), path = polyPath(pts);
    g.strokeStyle = C.stem; g.lineCap = 'round'; g.lineWidth = .034;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(.02, -.16, 0, attach); g.stroke();
    bladeShading(g, path, C, attach - len, attach + .08, wmax);
    /* deep splits from the edge toward the midrib, and a few holes near the midrib */
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    const veins = [];
    for (const side of [-1, 1]) {
      const n = 5 + (R() < .5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const f = .1 + i * (.68 / (n - 1)) + (R() - .5) * .03, beta = .3 + .45 * f;
        const dx = side * Math.cos(beta), dy = -Math.sin(beta), x0 = 0, y0 = attach - len * f;
        let d = 0; while (d < 1 && inPoly(pts, x0 + dx * d, y0 + dy * d)) d += .005;
        veins.push([x0, y0 - .045, dx, dy, d]);
        const din = d * (.2 + R() * .16), wo = .03 + R() * .018, wi = .007;
        const nx = -dy, ny = dx, ax = x0 + dx * din, ay = y0 + dy * din, bx = x0 + dx * (d + .08), by = y0 + dy * (d + .08);
        g.beginPath();
        g.moveTo(ax + nx * wi, ay + ny * wi); g.lineTo(bx + nx * wo, by + ny * wo); g.lineTo(bx - nx * wo, by - ny * wo); g.lineTo(ax - nx * wi, ay - ny * wi);
        g.arc(ax, ay, wi, Math.atan2(-ny, -nx), Math.atan2(ny, nx)); g.closePath(); g.fill();
        if (R() < .4) {
          const hd = din * .5, hx = x0 + dx * hd, hy = y0 + dy * hd - .05;
          g.save(); g.translate(hx, hy); g.rotate(Math.atan2(dy, dx)); g.beginPath(); g.ellipse(0, 0, .022 + R() * .015, .01 + R() * .006, 0, 0, TAU); g.fill(); g.restore();
        }
      }
    }
    g.globalCompositeOperation = 'source-atop';
    g.strokeStyle = `rgba(${hexRgb(C.vein).join(',')},.35)`; g.lineWidth = .006;
    for (const [x0, y0, dx, dy, d] of veins) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + dx * d, y0 + dy * d); g.stroke(); }
    g.strokeStyle = C.vein; g.globalAlpha = .6; g.lineWidth = .014;
    g.beginPath(); g.moveTo(0, attach + .02); g.quadraticCurveTo(.015, attach - len * .5, 0, attach - len); g.stroke(); g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return S;
  }
  /* A frond: a curving stem with leaflets down both sides. Palms have long smooth leaflets, ferns short toothed ones */
  function frondSprite(type, C, k, seed) {
    const S = sheet(type, k), g = S.g, R = rng(seed), palm = type === 'palm';
    const bend = (palm ? .32 : .16) * (R() < .5 ? -1 : 1), end = [bend, -1], ctrl = [bend * .15, -.55];
    const at = t => { const it = 1 - t; return [2 * it * t * ctrl[0] + t * t * end[0], 2 * it * t * ctrl[1] + t * t * end[1]]; };
    const tan = t => { const it = 1 - t; const dx = 2 * it * ctrl[0] + 2 * t * (end[0] - ctrl[0]), dy = 2 * it * ctrl[1] + 2 * t * (end[1] - ctrl[1]); const l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
    const n = palm ? 22 : 30, shades = [C.dark, C.mid, mix(C.mid, C.light, .5), C.light];
    const leaflets = [];
    for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
      const t = .1 + i / n * .88 + (R() - .5) * .012, [x, y] = at(t), [tx, ty] = tan(t);
      const len = (palm ? .4 : .27) * Math.pow(Math.sin(Math.PI * (t * .88 + .08)), palm ? .7 : .9) * (.88 + R() * .2);
      const ang = Math.atan2(ty, tx) + side * (palm ? .62 : 1.05) + (R() - .5) * .12;
      leaflets.push({ x, y, len, ang, side, t, sh: (side * bend > 0 ? 1 : 0) + (R() < .5 ? 1 : 0) + (R() < .2 ? 1 : 0) });
    }
    leaflets.sort((a, b) => a.sh - b.sh);
    for (const L of leaflets) {
      const c = Math.cos(L.ang), s = Math.sin(L.ang), droop = L.side * (palm ? .5 : .25);
      const ex = L.x + Math.cos(L.ang + droop) * L.len, ey = L.y + Math.sin(L.ang + droop) * L.len;
      const mx = L.x + c * L.len * .55, my = L.y + s * L.len * .55;
      g.fillStyle = shades[Math.min(3, L.sh)];
      if (palm) {
        const w = L.len * .085, nx = -s * w, ny = c * w;
        g.beginPath(); g.moveTo(L.x, L.y);
        g.quadraticCurveTo(mx + nx, my + ny, ex, ey); g.quadraticCurveTo(mx - nx * .6, my - ny * .6, L.x, L.y); g.fill();
        g.strokeStyle = `rgba(${hexRgb(C.vein).join(',')},.4)`; g.lineWidth = .004;
        g.beginPath(); g.moveTo(L.x, L.y); g.quadraticCurveTo(mx + nx * .2, my + ny * .2, ex, ey); g.stroke();
      } else {
        /* a toothed pinna: alternate wide and narrow points down both edges */
        const M = 10, w0 = L.len * .16, ax = Math.cos(L.ang + droop * .5), ay = Math.sin(L.ang + droop * .5), px = -ay, py = ax;
        g.beginPath(); g.moveTo(L.x, L.y);
        for (let j = 1; j <= M; j++) { const u = j / M, w = w0 * Math.pow(1 - u, .7) * (j % 2 ? 1 : .5); g.lineTo(L.x + ax * L.len * u + px * w, L.y + ay * L.len * u + py * w); }
        for (let j = M - 1; j >= 1; j--) { const u = j / M, w = w0 * Math.pow(1 - u, .7) * (j % 2 ? 1 : .5); g.lineTo(L.x + ax * L.len * u - px * w, L.y + ay * L.len * u - py * w); }
        g.closePath(); g.fill();
      }
    }
    g.strokeStyle = C.stem; g.lineCap = 'round';
    g.lineWidth = palm ? .016 : .011;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]); g.stroke();
    g.strokeStyle = `rgba(${hexRgb(C.vein).join(',')},.5)`; g.lineWidth = palm ? .006 : .004;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]); g.stroke();
    return S;
  }
  function leafSheet(type, C, k, seed) {
    return type === 'monstera' ? monsteraSprite(C, k, seed) : frondSprite(type, C, k, seed);
  }
  function blurSheet(S, px) {
    if (!canFilter || px < .5) return S;
    const c = makeCanvas(S.c.width, S.c.height), g = c.getContext('2d');
    g.filter = `blur(${px.toFixed(1)}px)`; g.drawImage(S.c, 0, 0);
    return { ...S, c };
  }

  function hibiscusSprite(c, size, seed) {
    const cv = makeCanvas(size, size), g = cv.getContext('2d'), r = size * .44, R = rng(seed);
    g.translate(size / 2, size / 2);
    /* soft shadow under the flower */
    if (canFilter) { g.filter = `blur(${Math.round(size * .025)}px)`; g.fillStyle = 'rgba(0,30,10,.28)'; g.beginPath(); g.arc(size * .02, size * .035, r * .92, 0, TAU); g.fill(); g.filter = 'none'; }
    const off = R() * TAU, eye = hexRgb(c.eye).join(',');
    for (let k = 0; k < 5; k++) {
      const a = off + k * TAU / 5, spread = TAU / 5 * 1.22, p = new Path2D();
      p.moveTo(0, 0);
      const ph = R() * 9, ph2 = R() * 9;
      for (let i = 0; i <= 44; i++) {
        const s = i / 44, ang = a - spread / 2 + spread * s;
        const prof = Math.pow(Math.sin(Math.PI * s), .32);
        const ruffle = 1 + .045 * Math.sin(s * Math.PI * 7 + ph) + .025 * Math.sin(s * Math.PI * 15 + ph2);
        const rad = r * (.58 + .42 * prof) * ruffle;
        p.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      p.closePath();
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.02);
      grd.addColorStop(0, c.eye); grd.addColorStop(.16, c.eye); grd.addColorStop(.32, mix(c.eye, c.petal, .55));
      grd.addColorStop(.5, c.petal); grd.addColorStop(.84, mix(c.petal, c.edge, .55)); grd.addColorStop(1, c.edge);
      g.fillStyle = grd; g.fill(p);
      g.save(); g.clip(p);
      /* veins fanning out from the throat */
      g.strokeStyle = `rgba(${eye},.2)`; g.lineWidth = size * .004;
      for (let v = 0; v < 16; v++) {
        const va = a - spread * .44 + spread * .88 * v / 15, bend = (R() - .5) * .12;
        g.beginPath(); g.moveTo(Math.cos(va) * r * .1, Math.sin(va) * r * .1);
        g.quadraticCurveTo(Math.cos(va + bend) * r * .5, Math.sin(va + bend) * r * .5, Math.cos(va) * r * .92, Math.sin(va) * r * .92); g.stroke();
      }
      /* the petal curls up toward the light on one side and falls into shade on the other */
      const sx = Math.cos(a - spread * .32) * r * .6, sy = Math.sin(a - spread * .32) * r * .6;
      const sheen = g.createRadialGradient(sx, sy, 0, sx, sy, r * .55);
      sheen.addColorStop(0, 'rgba(255,255,255,.2)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen; g.fillRect(-r, -r, r * 2, r * 2);
      const dx = Math.cos(a + spread * .4) * r * .7, dy = Math.sin(a + spread * .4) * r * .7;
      const shade = g.createRadialGradient(dx, dy, 0, dx, dy, r * .5);
      shade.addColorStop(0, 'rgba(60,0,20,.16)'); shade.addColorStop(1, 'rgba(60,0,20,0)');
      g.fillStyle = shade; g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
      g.strokeStyle = 'rgba(80,0,20,.14)'; g.lineWidth = size * .005; g.stroke(p);
    }
    /* the long staminal column with its pollen and red stigma */
    const ca = off + TAU / 10 + (R() - .5) * .6, len = r * .66, bx = Math.cos(ca + .35) * len * .5, by = Math.sin(ca + .35) * len * .5;
    const tx = Math.cos(ca) * len, ty = Math.sin(ca) * len;
    g.lineCap = 'round';
    g.strokeStyle = mix(c.eye, '#ffffff', .25); g.lineWidth = size * .028;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(bx, by, tx * .7, ty * .7); g.stroke();
    g.strokeStyle = mix(c.petal, '#ffffff', .35); g.lineWidth = size * .018;
    g.beginPath(); g.moveTo(tx * .2, ty * .2); g.quadraticCurveTo(bx, by, tx, ty); g.stroke();
    for (let i = 0; i < 30; i++) {
      const t = .45 + R() * .5, it = 1 - t;
      const px = 2 * it * t * bx + t * t * tx + (R() - .5) * size * .06, py = 2 * it * t * by + t * t * ty + (R() - .5) * size * .06;
      g.fillStyle = 'rgba(120,70,0,.5)'; g.beginPath(); g.arc(px + size * .003, py + size * .004, size * .012, 0, TAU); g.fill();
      g.fillStyle = c.pollen; g.beginPath(); g.arc(px, py, size * .011, 0, TAU); g.fill();
    }
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU, px = tx + Math.cos(a) * size * .025 + Math.cos(ca) * size * .02, py = ty + Math.sin(a) * size * .025 + Math.sin(ca) * size * .02;
      g.fillStyle = c.stigma; g.beginPath(); g.arc(px, py, size * .016, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(px - size * .005, py - size * .005, size * .005, 0, TAU); g.fill();
    }
    return cv;
  }
  function leafSprite(dark, light, w, h, seed) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), R = rng(seed), cy = h / 2;
    const half = s => h * .45 * Math.pow(Math.sin(Math.PI * Math.pow(s, .72)), 1.1);
    const p = new Path2D(); p.moveTo(4, cy);
    const N = 40;
    for (let i = 1; i <= N; i++) { const s = i / N, x = 4 + s * (w - 8), ser = (i % 2 ? 1.6 : 0) * (s > .2 && s < .95 ? 1 : 0); p.lineTo(x, cy - half(s) - ser); }
    for (let i = N; i >= 0; i--) { const s = i / N, x = 4 + s * (w - 8), ser = (i % 2 ? 1.6 : 0) * (s > .2 && s < .95 ? 1 : 0); p.lineTo(x, cy + half(s) + ser); }
    p.closePath();
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, light); grd.addColorStop(.5, mix(light, dark, .45)); grd.addColorStop(1, dark);
    g.fillStyle = grd; g.fill(p);
    g.save(); g.clip(p);
    const sheen = g.createLinearGradient(0, cy - h * .3, w, cy + h * .1);
    sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(.45, 'rgba(255,255,255,.16)'); sheen.addColorStop(.6, 'rgba(255,255,255,0)');
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(220,255,200,.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(4, cy); g.quadraticCurveTo(w * .5, cy - 2, w - 6, cy); g.stroke();
    g.lineWidth = .9; g.strokeStyle = 'rgba(220,255,200,.22)';
    for (let i = 1; i < 7; i++) {
      const x = 4 + i / 7 * (w - 8) * .9;
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x, cy); g.quadraticCurveTo(x + w * .06, cy + sd * h * .18, x + w * .1 + R() * 4, cy + sd * half(i / 7) * .85); g.stroke(); }
    }
    g.restore();
    return c;
  }
  function budSprite(c, w, h) {
    const cv = makeCanvas(w, h), g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, mix(c.petal, '#000000', .2)); grd.addColorStop(.5, c.petal); grd.addColorStop(1, mix(c.petal, c.edge, .5));
    g.fillStyle = grd; g.beginPath(); g.moveTo(w / 2, 2);
    g.bezierCurveTo(w * .95, h * .3, w * .85, h * .75, w / 2, h * .8); g.bezierCurveTo(w * .15, h * .75, w * .05, h * .3, w / 2, 2); g.fill();
    g.strokeStyle = 'rgba(80,0,20,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(w / 2, 4); g.quadraticCurveTo(w * .62, h * .4, w * .45, h * .78); g.stroke();
    g.fillStyle = '#3f7d2e';
    for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(w / 2 + s * w * .3, h * .62); g.lineTo(w / 2 + s * w * .12, h); g.lineTo(w / 2 + s * w * .02, h * .62); g.fill(); }
    return cv;
  }

  /* One soft shaft of light, stretched and rotated when drawn */
  function raySprite(col) {
    const c = makeCanvas(64, 512), g = c.getContext('2d');
    const across = g.createLinearGradient(0, 0, 64, 0);
    across.addColorStop(0, `rgba(${col},0)`); across.addColorStop(.5, `rgba(${col},1)`); across.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = across; g.fillRect(0, 0, 64, 512);
    g.globalCompositeOperation = 'destination-in';
    const along = g.createLinearGradient(0, 0, 0, 512);
    along.addColorStop(0, 'rgba(0,0,0,1)'); along.addColorStop(.6, 'rgba(0,0,0,.45)'); along.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = along; g.fillRect(0, 0, 64, 512);
    return c;
  }

  /* ============================================================
     Engine
     ============================================================ */
  const TYPES = ['monstera', 'palm', 'fern'];
  let canvas = null, ctx = null, active = false, opts = { ...DEFAULTS };
  let raf = 0, last = 0, clock = rand(0, 50), W = 0, H = 0, q = 1, resizeT = 0;
  let S = null, builtKey = '', gust = 0, gustHold = 0, nextGust = 6, pointerX = 0, pointerY = 0;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = () => opts.mode === 'night';
  const pick = (R, weights) => { let r = R() * weights.reduce((a, b) => a + b, 0); for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i; return 0; };

  function buildGeometry() {
    q = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * q); canvas.height = Math.round(H * q);
    builtKey = '';
    S = { px: 0, py: 0, flies: [], butterflies: [] };
  }
  function buildLook() {
    const mode = opts.mode, P = PAL[mode], u = Math.min(W, H * 1.6) / 1440, R = rng(7), area = Math.sqrt(W * H / (1440 * 900));
    S.P = P; S.u = u;
    const shadeC = (C, t) => t ? Object.fromEntries(Object.entries(C).map(([k, v]) => [k, mix(v, P.shade, t)])) : C;
    const kNear = Math.min(H * .36 * q, 440), kMid = Math.min(H * .25 * q, 280), kFar = Math.min(H * .19 * q, 170);
    S.near = {}; S.mid = {};
    TYPES.forEach((t, ti) => {
      S.near[t] = [0, 1].map(v => leafSheet(t, shadeC(P[t], v ? .34 : 0), kNear, 100 + ti * 10 + v));
      S.mid[t] = [0, 1].map(v => blurSheet(leafSheet(t, shadeC(P[t], v ? .55 : .4), kMid, 200 + ti * 10 + v), 1.3 * q));
    });
    /* flowers, tinted for night */
    const tint = c => P.flowerTint ? mix(c, P.flowerTint, P.tintAmt) : c;
    const fl = c => ({ petal: tint(c.petal), edge: tint(c.edge), eye: tint(c.eye), pollen: tint(c.pollen), stigma: tint(c.stigma) });
    S.flowerSpr = FLOWERS.map((c, i) => hibiscusSprite(fl(c), Math.round(Math.min(H * .2 * q, 300)), 50 + i));
    S.flowerMid = S.flowerSpr.map(c => { if (!canFilter) return c; const o = makeCanvas(c.width, c.height), og = o.getContext('2d'); og.filter = `blur(${(1.2 * q).toFixed(1)}px)`; og.globalAlpha = .82; og.drawImage(c, 0, 0); return o; });
    S.budSpr = FLOWERS.map(c => budSprite(fl(c), Math.round(40 * q * u), Math.round(96 * q * u)));
    S.hibLeaf = leafSprite(tint(mix(P.heart.dark, '#000000', .1)), tint(P.heart.light), Math.round(200 * q * u), Math.round(110 * q * u), 9);

    /* the far wall: many leaves, then blurred into one soft backdrop */
    const raw = makeCanvas(W * q, H * q), rg = raw.getContext('2d');
    const bg = rg.createLinearGradient(0, 0, 0, raw.height);
    bg.addColorStop(0, P.bg[0]); bg.addColorStop(1, P.bg[1]);
    rg.fillStyle = bg; rg.fillRect(0, 0, raw.width, raw.height);
    const farSheets = TYPES.map((t, ti) => leafSheet(t, shadeC(P[t], .66), kFar, 300 + ti));
    const nFar = Math.round(200 * area);
    for (let i = 0; i < nFar; i++) {
      const ti = pick(R, [3, 3, 2]), sh = farSheets[ti], L = H * (.12 + R() * .1);
      const x = R() * W * 1.1 - W * .05, y = R() * H * 1.15 - H * .05, a = R() * TAU, sc = L / sh.k;
      rg.setTransform(q, 0, 0, q, 0, 0); rg.translate(x, y); rg.rotate(a);
      rg.drawImage(sh.c, -sh.ox * sc, -sh.oy * sc, sh.c.width * sc, sh.c.height * sc);
    }
    S.far = makeCanvas(W * q, H * q);
    const fg = S.far.getContext('2d');
    if (canFilter) fg.filter = `blur(${Math.round(7 * u * q)}px)`;
    fg.drawImage(raw, 0, 0); fg.filter = 'none';
    /* depth haze in front of the far wall */
    fg.setTransform(q, 0, 0, q, 0, 0);
    const mist = fg.createRadialGradient(W * .5, H * .55, 0, W * .5, H * .55, Math.max(W, H) * .7);
    mist.addColorStop(0, `rgba(${P.mist},${P.mistA * 1.6})`); mist.addColorStop(1, `rgba(${P.mist},${P.mistA * .4})`);
    fg.fillStyle = mist; fg.fillRect(0, 0, W, H);
    if (!opts.orb) { /* no sun or moon glow */ } else if (mode === 'night') { /* moonlight from the top right */
      const moon = fg.createRadialGradient(W * .82, -H * .1, 0, W * .82, -H * .1, H * 1.1);
      moon.addColorStop(0, 'rgba(150,200,255,.16)'); moon.addColorStop(1, 'rgba(150,200,255,0)');
      fg.fillStyle = moon; fg.fillRect(0, 0, W, H);
    } else {
      const sun = fg.createRadialGradient(W * .15, -H * .1, 0, W * .15, -H * .1, H * 1.2);
      sun.addColorStop(0, 'rgba(255,250,210,.12)'); sun.addColorStop(1, 'rgba(255,250,210,0)');
      fg.fillStyle = sun; fg.fillRect(0, 0, W, H);
    }

    /* the middle layer: leaves growing up from below, and some hanging down from above */
    const mk = (layer, type, x, y, ang, L, R2) => ({ layer, type, v: (R2() * 2) | 0, x, y, ang, L, amp: (layer === 'near' ? .028 : .022) * (.7 + R2() * .6), f: .5 + R2() * .7, ph: R2() * TAU, ph2: R2() * TAU, dir: R2() < .5 ? 1 : -1 });
    S.midItems = [];
    const nMid = Math.round(80 * area);
    for (let i = 0; i < nMid; i++) {
      const t = TYPES[pick(R, [3, 4, 3])], hang = R() < .32;
      const x = R() * W * 1.1 - W * .05, y = hang ? H * (-.08 + R() * .22) : H * (.25 + R() * .9);
      const ang = hang ? Math.PI / 2 + (R() - .5) * 1.8 : -Math.PI / 2 + (R() - .5) * 2.4;
      S.midItems.push(mk('mid', t, x, y, ang, H * (.16 + R() * .1) * (t === 'heart' ? .75 : 1), R));
    }
    for (const [fx, fy, k] of [[.36, .78, 2], [.62, .3, 0], [.7, .74, 3], [.27, .36, 1]]) S.midItems.push({ layer: 'mid', flower: k, x: W * fx, y: H * fy, s: H * .06, rot: R() * TAU, ph: R() * TAU, f: .5 + R() * .5, dim: true });
    S.midItems.sort(() => R() - .5);

    /* the near layer: big leaves reaching in from every edge, with hibiscus tucked between them */
    S.nearItems = [];
    const nNear = Math.round(44 * Math.min(1.3, area));
    for (let i = 0; i < nNear; i++) {
      const per = (i + R() * .7) / nNear * 2 * (W + H);
      let x, y;
      if (per < W) { x = per; y = -H * .04; } else if (per < W + H) { x = W * 1.04; y = per - W; } else if (per < 2 * W + H) { x = 2 * W + H - per; y = H * 1.04; } else { x = -W * .04; y = 2 * (W + H) - per; }
      const toC = Math.atan2(H * .5 - y, W * .5 - x) + (R() - .5) * 1.5;
      const t = TYPES[pick(R, [5, 4, 2])];
      S.nearItems.push(mk('near', t, x + (W * .5 - x) * R() * .25, y + (H * .5 - y) * R() * .25, toC, H * (.22 + R() * .13) * (t === 'heart' ? .75 : 1), R));
    }
    if (opts.flowers) {
      const spots = [[.07, .8, 0], [.19, .93, 1], [.92, .22, 2], [.95, .64, 0], [.55, .96, 3], [.79, .9, 1], [.04, .33, 2], [.3, .05, 3], [.66, .06, 0]];
      for (const [fx, fy, k] of spots) {
        const x = W * fx, y = H * fy, s = H * (.09 + R() * .04);
        for (let j = 0; j < 3; j++) S.nearItems.push({ layer: 'near', hibLeaf: true, x, y, rot: R() * TAU, s: s * 1.2, ph: R() * TAU, f: .5 + R() * .5, z: R() * .3 });
        if (R() < .7) S.nearItems.push({ layer: 'near', bud: k, x: x + (R() - .5) * s, y: y + (R() - .5) * s, rot: (R() - .5) * 1.6, s: u * 1.2, ph: R() * TAU, f: .6 + R() * .5, z: .35 });
        S.nearItems.push({ layer: 'near', flower: k, x, y, s, rot: R() * TAU, ph: R() * TAU, f: .5 + R() * .5, z: .4 + R() * .6 });
      }
    }
    S.nearItems.forEach(it => { if (it.z === undefined) it.z = R(); });
    S.nearItems.sort((a, b) => a.z - b.z);

    S.ray = raySprite(P.ray);
    S.dapples = Array.from({ length: 9 }, () => ({ x: R() * W, y: R() * H, r: H * (.12 + R() * .18), vx: (R() - .5) * 10, vy: (R() - .5) * 6, ph: R() * TAU }));
    S.butterflies = night() ? [] : [['#3a8bff', '#0a1c66'], ['#ff8a1a', '#3a1404'], ['#ffd84a', '#5a3a06']].map(([c, e], i) => ({ c, e, x: R() * W, y: H * (.2 + R() * .6), h: R() * TAU, sp: 55 + R() * 30, s: (16 + R() * 8) * u, f: 11 + R() * 5, ph: R() * TAU, tx: R() * W, ty: R() * H, retarget: 2 + R() * 4, depth: i === 0 ? 'mid' : 'near' }));
    S.flies = night() ? Array.from({ length: Math.round(40 * area) }, () => ({ x: R() * W, y: R() * H, a: R() * TAU, sp: 8 + R() * 18, turn: 0, blink: .5 + R() * .8, ph: R() * TAU, size: (10 + R() * 18) * u, near: R() < .4 })) : [];
    S.glow = (() => { const c = makeCanvas(64, 64), g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(240,255,170,1)'); grd.addColorStop(.12, 'rgba(220,255,130,.85)'); grd.addColorStop(.45, 'rgba(190,255,110,.18)'); grd.addColorStop(1, 'rgba(190,255,110,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return c; })();
    builtKey = `${W}x${H}:${mode}:${opts.flowers}:${opts.orb}`;
  }

  function step(dt, t) {
    const w = clamp(opts.wind, 0, 100) / 100;
    S.px += ((opts.parallax ? pointerX : 0) - S.px) * Math.min(1, dt * 2.5);
    S.py += ((opts.parallax ? pointerY : 0) - S.py) * Math.min(1, dt * 2.5);
    if (w > 0) { nextGust -= dt; if (nextGust <= 0) { gustHold = rand(.8, 2); nextGust = rand(6, 14) / (.4 + w); } }
    if (gustHold > 0) { gustHold -= dt; gust += (1 - gust) * Math.min(1, dt * 1.6); } else gust += (0 - gust) * Math.min(1, dt * .5);
    for (const d of S.dapples) { d.x += d.vx * dt * (.5 + w); d.y += d.vy * dt; if (d.x < -d.r) d.x = W + d.r; if (d.x > W + d.r) d.x = -d.r; if (d.y < -d.r) d.y = H + d.r; if (d.y > H + d.r) d.y = -d.r; }
    if (!opts.critters) return;
    for (const b of S.butterflies) {
      b.retarget -= dt;
      if (b.retarget <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 40) { b.tx = rand(W * .05, W * .95); b.ty = rand(H * .1, H * .9); b.retarget = rand(3, 7); }
      const want = Math.atan2(b.ty - b.y, b.tx - b.x), da = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h));
      b.h += da * dt * 1.6 + Math.sin(t * 2.7 + b.ph) * dt * 2.2;
      const flap = Math.sin(t * b.f + b.ph);
      b.x += Math.cos(b.h) * b.sp * dt + gust * w * 30 * dt; b.y += Math.sin(b.h) * b.sp * dt - flap * 12 * dt;
    }
    for (const f of S.flies) {
      f.turn += rand(-1, 1) * dt * 2; f.turn = clamp(f.turn, -1.2, 1.2);
      f.a += f.turn * dt; f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt * .7;
      if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
      if (f.y < -20) f.y = H + 20; else if (f.y > H + 20) f.y = -20;
    }
  }

  function drawItem(g, it, t, windK, ox, oy) {
    const sw = (windK * 1.4 + .3) * (it.amp || .02) * (Math.sin(t * it.f + it.ph) + .35 * Math.sin(t * it.f * 2.3 + (it.ph2 || 0))) + gust * windK * (it.amp || .02) * 2.2 * (it.dir || 1);
    g.setTransform(q, 0, 0, q, (it.x + ox) * q, (it.y + oy) * q);
    if (it.flower !== undefined) {
      g.rotate(it.rot + sw * .8);
      g.drawImage((it.dim ? S.flowerMid : S.flowerSpr)[it.flower], -it.s / 2, -it.s / 2, it.s, it.s);
    } else if (it.hibLeaf) {
      g.rotate(it.rot + sw); const lw = it.s * 1.1, lh = lw * .55; g.drawImage(S.hibLeaf, 0, -lh / 2, lw, lh);
    } else if (it.bud !== undefined) {
      g.rotate(it.rot + sw); const bw = 40 * it.s, bh = 96 * it.s; g.drawImage(S.budSpr[it.bud], -bw / 2, -bh, bw, bh);
    } else {
      const sh = (it.layer === 'near' ? S.near : S.mid)[it.type][it.v], sc = it.L / sh.k;
      g.rotate(it.ang + Math.PI / 2 + sw);
      g.drawImage(sh.c, -sh.ox * sc, -sh.oy * sc, sh.c.width * sc, sh.c.height * sc);
    }
  }
  function drawButterfly(g, b, t, ox, oy) {
    const o = .2 + .8 * Math.abs(Math.sin(t * b.f + b.ph)), s = b.s;
    g.setTransform(q, 0, 0, q, (b.x + ox) * q, (b.y + oy) * q); g.rotate(b.h + Math.PI / 2);
    for (const side of [-1, 1]) {
      for (const [cx, cy, rx, ry, rot] of [[.52, -.18, .55, .36, -.45], [.38, .22, .4, .28, .5]]) {
        g.save(); g.translate(side * cx * o * s, cy * s); g.rotate(side * rot); g.scale(o, 1);
        const grd = g.createRadialGradient(-side * rx * s * .4, 0, 0, 0, 0, Math.max(rx, ry) * s);
        grd.addColorStop(0, b.c); grd.addColorStop(.7, mix(b.c, b.e, .3)); grd.addColorStop(1, b.e);
        g.fillStyle = grd; g.beginPath(); g.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(side * rx * s * .55, -ry * s * .3, s * .04, 0, TAU); g.fill();
        g.restore();
      }
    }
    g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(0, 0, s * .07, s * .42, 0, 0, TAU); g.fill();
    g.strokeStyle = '#1a1210'; g.lineWidth = Math.max(.6, s * .025);
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(0, -s * .38); g.quadraticCurveTo(side * s * .1, -s * .6, side * s * .2, -s * .72); g.stroke(); }
  }
  function drawFlies(g, t, near, ox, oy) {
    g.setTransform(q, 0, 0, q, 0, 0); g.globalCompositeOperation = 'lighter';
    for (const f of S.flies) {
      if (f.near !== near) continue;
      const p = Math.max(0, Math.sin(t * f.blink + f.ph)), a = p * p; if (a < .02) continue;
      const k = f.size * (.7 + .3 * a); g.globalAlpha = a;
      g.drawImage(S.glow, f.x + ox - k / 2, f.y + oy - k / 2, k, k);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  function frameDraw(t) {
    const g = ctx, P = S.P, n = night(), windK = clamp(opts.wind, 0, 100) / 100;
    const off = d => [-S.px * d * 26, -S.py * d * 16];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
    const [fx, fy] = off(.15), drift = Math.sin(t * .05) * 6;
    g.drawImage(S.far, (fx - 12 + drift) * q, (fy - 10) * q, (W + 24) * q, (H + 20) * q);
    /* shafts of light behind the near leaves */
    if (opts.light) {
      g.globalCompositeOperation = n ? 'screen' : 'lighter';
      const rays = n ? [[.86, -.05, -.42, .07], [.7, -.08, -.36, .05]] : [[.14, -.06, .5, .12], [.3, -.08, .44, .09], [.5, -.05, .38, .07], [.04, -.06, .58, .06]];
      for (const [rx, ry, ang, a] of rays) {
        g.setTransform(q, 0, 0, q, (rx * W + fx * 2) * q, ry * H * q); g.rotate(ang);
        g.globalAlpha = a * (.65 + .35 * Math.sin(t * .23 + rx * 9));
        g.drawImage(S.ray, -W * .07, 0, W * .14, H * 1.3);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    const [mx, my] = off(.45);
    for (const it of S.midItems) { if (it.flower !== undefined && !opts.flowers) continue; drawItem(g, it, t, windK, mx, my); }
    if (opts.critters) { for (const b of S.butterflies) if (b.depth === 'mid') drawButterfly(g, b, t, mx, my); drawFlies(g, t, false, mx, my); }
    const [nx, ny] = off(1);
    for (const it of S.nearItems) drawItem(g, it, t, windK, nx, ny);
    if (opts.critters) { for (const b of S.butterflies) if (b.depth === 'near') drawButterfly(g, b, t, nx, ny); drawFlies(g, t, true, nx, ny); }
    g.setTransform(q, 0, 0, q, 0, 0);
    /* a soft vignette pulls the eye into the middle */
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,8,4,${n ? .55 : .42})`);
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const b = clamp(opts.brightness, 20, 180) / 100;
    if (b < 1) { g.fillStyle = `rgba(0,0,0,${(1 - b).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    else if (b > 1) { g.globalCompositeOperation = 'screen'; g.fillStyle = `rgba(255,255,255,${((b - 1) * .35).toFixed(3)})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; clock += dt;
    step(dt, clock); frameDraw(clock);
    raf = requestAnimationFrame(frame);
  }
  function once() { frameDraw(clock); }
  function start() {
    stop();
    if (reduce()) { once(); return; }
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'scene-tropical'; canvas.className = 'scene-canvas'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => {
      if (!active) return;
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { buildGeometry(); buildLook(); if (!raf) once(); }, 150);
    });
    window.addEventListener('pointermove', e => { pointerX = e.clientX / W * 2 - 1; pointerY = e.clientY / H * 2 - 1; }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (active) start(); });
  }

  window.ChronosTropical = {
    /* on: show or hide the scene. o: any of DEFAULTS' keys (mode is 'day' or 'night') */
    set(on, o = {}) {
      for (const key in DEFAULTS) if (o[key] !== undefined && o[key] !== null) opts[key] = o[key];
      if (!on) { if (active) { stop(); active = false; canvas.hidden = true; } return; }
      if (!active) {
        ensureCanvas(); canvas.hidden = false; active = true;
        buildGeometry(); buildLook(); start();
        return;
      }
      if (builtKey !== `${W}x${H}:${opts.mode}:${opts.flowers}:${opts.orb}`) buildLook();
      if (!raf) once();
    },
  };
})();
