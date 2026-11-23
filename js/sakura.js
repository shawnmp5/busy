/* Chronos — "Cherry blossom" scene.

   Mount Fuji across a lake in spring, framed by cherry trees. Everything is painted in code:
   - a sky with drifting clouds, a summit cloud and mist along the foot of the mountain,
   - the mountain itself: concave slopes, a ragged snow cap and gullies running down from the crater,
   - a lakeside town and a lake that ripples and reflects the mountain,
   - cherry trees made of thousands of five-petal flowers, whose branches sway in the wind and in gusts,
   - petals that tumble and flip as they fall, and burst off the trees when a gust comes through.
   A night version swaps in a moon, stars, moonlight glitter on the water, town lights and paper lanterns.

   Static layers (sky, mountain, shore, every branch) are painted once into offscreen canvases; each frame only
   moves them around, so it stays light. It pauses in background tabs and draws one still frame for reduced motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEFAULTS = { mode: 'day', petals: 55, wind: 40, brightness: 100, clouds: true, sway: true, lanterns: true };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  /* Seeded randomness, so the trees and the mountain come out the same in day and night */
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function noise1(seed) {
    const R = rng(seed), v = Float32Array.from({ length: 256 }, () => R());
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(v[i & 255], v[(i + 1) & 255], u); };
  }
  const angleDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(lerp(v, hexRgb(b)[i], t)).toString(16).padStart(2, '0')).join('');
  const canFilter = (() => { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();

  /* ============================================================
     Palettes
     ============================================================ */
  const PAL = {
    day: {
      sky: [[0, '#2a5db4'], [.32, '#5f92d8'], [.58, '#a9c4ec'], [.8, '#dcdcef'], [1, '#f3e1e8']],
      mtnTop: '#7d86ab', mtnBase: '#a7b5d0', mtnLit: 'rgba(255,255,255,.16)', mtnShade: 'rgba(28,36,80,.30)', light: -1,
      haze: '224,231,246', hazeA: .62, snow: '#ffffff', snowShade: '#bfcae6', gully: '74,88,140',
      hills: ['#8396b8', '#5f7790', '#3f5848'], shoreBloom: '#f4c5d5', town: '#ece6ea', roof: '#8d7f8c',
      water: [[0, '#9cbbe0'], [.4, '#5e8cc4'], [1, '#2f5d98']], reflA: .55, ripple: '255,255,255', glint: '255,250,235',
      cloudLit: '255,255,255', cloudShade: '200,205,232', cloudPink: '250,222,232', mist: '236,240,250',
      bark: '#4a3335', barkHi: 'rgba(255,226,232,.30)', backShade: '#a5678a', bud: '#e5779e',
      flowers: [['#fff6f9', '#f8c5d5', '#e2789e'], ['#ffeef4', '#f3aec6', '#d6648e'], ['#fffbfc', '#fbd8e4', '#ea8bad'], ['#fde3ec', '#ee9cb9', '#c94f7d'], ['#ffffff', '#f6cfdc', '#df7aa1']],
      stamen: '#f2cf72', petals: [['#fff3f7', '#f4b4c9'], ['#ffeaf1', '#ef9fbb'], ['#fffafb', '#f8cddb'], ['#fde0ea', '#e98cae']],
    },
    night: {
      sky: [[0, '#02040d'], [.4, '#0a1230'], [.7, '#1c2149'], [.88, '#33294f'], [1, '#43304f']],
      mtnTop: '#2b3456', mtnBase: '#1b2240', mtnLit: 'rgba(170,185,240,.16)', mtnShade: 'rgba(0,0,10,.40)', light: 1,
      haze: '40,44,80', hazeA: .55, snow: '#e4eaf8', snowShade: '#7584ad', gully: '20,24,50',
      hills: ['#1c2440', '#121a30', '#0a1020'], shoreBloom: '#5e4a6e', town: '#1a2034', roof: '#10141f',
      water: [[0, '#1d2a50'], [.4, '#0f1834'], [1, '#060b1c']], reflA: .62, ripple: '170,185,235', glint: '235,238,255',
      cloudLit: '150,162,205', cloudShade: '38,44,78', cloudPink: '90,80,120', mist: '70,80,120',
      bark: '#170f18', barkHi: 'rgba(170,180,235,.16)', backShade: '#2b2140', bud: '#a35a8e',
      flowers: [['#f7e6f0', '#d7a3c4', '#a2427e'], ['#fbeef5', '#e2b2cf', '#b2508c'], ['#eedcea', '#c493b8', '#8c3a72'], ['#fff4f9', '#e9c3da', '#bd5f99']],
      stamen: '#cdb56c', petals: [['#f6e5ef', '#cf9fbf'], ['#eedbe8', '#bd8ab0'], ['#fbf0f6', '#dfb5cf']],
    },
  };

  /* ============================================================
     Layout + the mountain's silhouette
     ============================================================ */
  function layout(W, H) {
    const horizon = H * .735;
    return { W, H, horizon, waterY: horizon + H * .012, peakX: W * .4, peakY: H * .255, crater: W * .03, spanL: W * .56, spanR: W * .64, moonX: W * .73, moonY: H * .15 };
  }
  function makeProfile(L) {
    const n = noise1(11), n2 = noise1(29), h = L.horizon + 8 - L.peakY;
    return x => {
      const dx = x - L.peakX, ax = Math.abs(dx);
      if (ax <= L.crater) return L.peakY + (n(x * .08) - .5) * 5 * Math.sin(Math.PI * (dx + L.crater) / (2 * L.crater));
      const span = dx < 0 ? L.spanL : L.spanR, d = Math.min(1.25, (ax - L.crater) / span);
      let y = L.peakY + h * (1 - Math.pow(Math.max(0, 1 - d), 1.8));
      y += ((n(x * .012) - .5) * 10 + (n2(x * .06) - .5) * 3) * Math.min(1, d);
      if (dx > 0) y -= 14 * Math.exp(-Math.pow((d - .52) / .07, 2)); /* the shoulder on the right flank */
      return y;
    };
  }

  /* ============================================================
     Static paintings (done once per size and per day/night)
     ============================================================ */
  function paintSky(L, P, q, night) {
    const { W, H } = L, c = makeCanvas(W * q, H * q), g = c.getContext('2d'); g.scale(q, q);
    const grd = g.createLinearGradient(0, 0, 0, L.waterY);
    for (const [s, col] of P.sky) grd.addColorStop(s, col);
    g.fillStyle = grd; g.fillRect(0, 0, W, L.waterY + 2);
    if (!night) {
      const sun = g.createRadialGradient(W * .06, -H * .06, 0, W * .06, -H * .06, W * .65);
      sun.addColorStop(0, 'rgba(255,246,228,.42)'); sun.addColorStop(1, 'rgba(255,246,228,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, H);
      const pink = g.createLinearGradient(0, L.horizon - H * .28, 0, L.horizon);
      pink.addColorStop(0, 'rgba(250,220,232,0)'); pink.addColorStop(1, 'rgba(250,220,232,.38)');
      g.fillStyle = pink; g.fillRect(0, 0, W, L.waterY);
    } else {
      const halo = g.createRadialGradient(L.moonX, L.moonY, 0, L.moonX, L.moonY, H * .55);
      halo.addColorStop(0, 'rgba(185,198,255,.26)'); halo.addColorStop(.25, 'rgba(150,165,240,.10)'); halo.addColorStop(1, 'rgba(150,165,240,0)');
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      const mr = Math.min(W, H) * .042;
      g.shadowColor = 'rgba(230,235,255,.9)'; g.shadowBlur = mr * 1.2;
      const disc = g.createRadialGradient(L.moonX - mr * .3, L.moonY - mr * .3, 0, L.moonX, L.moonY, mr);
      disc.addColorStop(0, '#fffef6'); disc.addColorStop(.8, '#f1efe2'); disc.addColorStop(1, '#dcdacc');
      g.fillStyle = disc; g.beginPath(); g.arc(L.moonX, L.moonY, mr, 0, TAU); g.fill();
      g.shadowBlur = 0;
      const R = rng(9);
      for (let i = 0; i < 7; i++) { /* the moon's darker seas */
        const a = R() * TAU, d = R() * mr * .6, r = mr * (.12 + R() * .22);
        g.fillStyle = 'rgba(150,150,140,.16)'; g.beginPath(); g.arc(L.moonX + Math.cos(a) * d, L.moonY + Math.sin(a) * d, r, 0, TAU); g.fill();
      }
      const glow = g.createLinearGradient(0, L.horizon - H * .2, 0, L.horizon);
      glow.addColorStop(0, 'rgba(120,80,130,0)'); glow.addColorStop(1, 'rgba(140,90,130,.3)');
      g.fillStyle = glow; g.fillRect(0, 0, W, L.waterY);
    }
    return c;
  }

  function paintMountain(L, P, q, profile) {
    const { W, H } = L, c = makeCanvas(W * q, H * q), g = c.getContext('2d'); g.scale(q, q);
    const h = L.horizon - L.peakY, path = new Path2D();
    path.moveTo(-60, L.horizon + 40);
    for (let x = -60; x <= W + 60; x += 2) path.lineTo(x, profile(x));
    path.lineTo(W + 60, L.horizon + 40); path.closePath();
    const body = g.createLinearGradient(0, L.peakY, 0, L.horizon);
    body.addColorStop(0, P.mtnTop); body.addColorStop(1, P.mtnBase);
    g.fillStyle = body; g.fill(path);
    g.save(); g.clip(path);
    /* light falls on one flank, the other is in shadow */
    const side = g.createLinearGradient(L.peakX - W * .35, 0, L.peakX + W * .35, 0);
    const [a, b] = P.light < 0 ? [P.mtnLit, P.mtnShade] : [P.mtnShade, P.mtnLit];
    side.addColorStop(0, a); side.addColorStop(.48, 'rgba(0,0,0,0)'); side.addColorStop(1, b);
    g.fillStyle = side; g.fillRect(0, 0, W, H);
    /* gullies fanning down from the crater */
    const R = rng(5), spanAvg = (L.spanL + L.spanR) / 2;
    if (canFilter) g.filter = 'blur(1.2px)';
    for (let i = 0; i < 170; i++) {
      const u = R() * 2 - 1, start = .08 + R() * .35;
      const ex = L.peakX + u * spanAvg * .95, ey = L.horizon - R() * (L.horizon - profile(ex)) * .6;
      const sx = lerp(L.peakX + u * L.crater, ex, start), sy = lerp(profile(L.peakX + u * L.crater), ey, start) + 2;
      const lit = R() < .45;
      g.strokeStyle = lit ? `rgba(255,255,255,${(.015 + R() * .045).toFixed(3)})` : `rgba(${P.gully},${(.03 + R() * .07).toFixed(3)})`;
      g.lineWidth = 1 + R() * 3.5;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(lerp(sx, ex, .55), lerp(sy, ey, .3), ex, ey); g.stroke();
    }
    g.filter = 'none';
    /* atmospheric haze thickens toward the foot */
    const haze = g.createLinearGradient(0, lerp(L.peakY, L.horizon, .4), 0, L.horizon);
    haze.addColorStop(0, `rgba(${P.haze},0)`); haze.addColorStop(1, `rgba(${P.haze},${P.hazeA})`);
    g.fillStyle = haze; g.fillRect(0, 0, W, H);
    g.restore();

    /* snow cap with ragged fingers running down the gullies */
    const ns = noise1(41), nf = noise1(73), nf2 = noise1(97);
    const snowBottom = x => L.peakY + h * (.24 + .08 * ns(x * .008)) + Math.pow(nf(x * .1), 2.6) * h * .17 + Math.pow(nf2(x * .27), 3) * h * .08 + Math.abs(x - L.peakX) * .03;
    let xl = L.peakX, xr = L.peakX;
    while (xl > -60 && profile(xl) < snowBottom(xl)) xl -= 2;
    while (xr < W + 60 && profile(xr) < snowBottom(xr)) xr += 2;
    const snow = new Path2D();
    snow.moveTo(xl, profile(xl));
    for (let x = xl; x <= xr; x += 2) snow.lineTo(x, profile(x));
    for (let x = xr; x >= xl; x -= 2) snow.lineTo(x, Math.max(profile(x), snowBottom(x)));
    snow.closePath();
    const sg = g.createLinearGradient(L.peakX - W * .2, 0, L.peakX + W * .2, 0);
    const [s0, s1] = P.light < 0 ? [P.snow, P.snowShade] : [P.snowShade, P.snow];
    sg.addColorStop(0, s0); sg.addColorStop(.47, mix(s0, s1, .35)); sg.addColorStop(.53, mix(s0, s1, .7)); sg.addColorStop(1, s1);
    g.save(); g.shadowColor = P.snow; g.shadowBlur = 2; g.fillStyle = sg; g.fill(snow); g.restore();
    g.save(); g.clip(snow);
    if (canFilter) g.filter = 'blur(.8px)';
    for (let i = 0; i < 110; i++) {
      const u = R() * 2 - 1, ex = L.peakX + u * (xr - xl) * .55, ey = snowBottom(ex) + 20, start = .1 + R() * .3;
      const sx = lerp(L.peakX + u * L.crater, ex, start), sy = lerp(profile(L.peakX + u * L.crater), ey, start);
      g.strokeStyle = R() < .65 ? `rgba(${P.gully},${(.05 + R() * .1).toFixed(3)})` : `rgba(255,255,255,${(.12 + R() * .2).toFixed(3)})`;
      g.lineWidth = .8 + R() * 2.4;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(lerp(sx, ex, .5), lerp(sy, ey, .25), ex, ey); g.stroke();
    }
    g.filter = 'none';
    const sb = g.createLinearGradient(0, L.peakY, 0, L.peakY + h * .5);
    sb.addColorStop(0, 'rgba(255,255,255,0)'); sb.addColorStop(1, `rgba(${P.haze},.35)`);
    g.fillStyle = sb; g.fillRect(0, 0, W, H);
    g.restore();
    return c;
  }

  function paintShore(L, P, q, night) {
    const { W, H } = L, c = makeCanvas(W * q, H * q), g = c.getContext('2d'); g.scale(q, q);
    const R = rng(77), n = noise1(55), n2 = noise1(61);
    /* low hills on either side of the lake */
    g.fillStyle = P.hills[0]; g.beginPath(); g.moveTo(0, L.waterY);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, L.horizon - H * .085 * Math.pow(Math.min(1, Math.abs(x / W - .42) / .58), 1.7) * (.45 + .55 * n(x * .006)));
    g.lineTo(W, L.waterY); g.closePath(); g.fill();
    g.fillStyle = P.hills[1]; g.beginPath(); g.moveTo(0, L.waterY);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, L.horizon + 2 - H * .045 * Math.pow(Math.min(1, Math.abs(x / W - .5) / .5), 2.2) * (.4 + .6 * n2(x * .01)));
    g.lineTo(W, L.waterY); g.closePath(); g.fill();
    /* the tree line along the shore */
    g.fillStyle = P.hills[2]; g.beginPath(); g.moveTo(0, L.waterY);
    for (let x = 0; x <= W; x += 3) g.lineTo(x, L.horizon + 2 - n(x * .05) * 7 - n2(x * .2) * 3);
    g.lineTo(W, L.waterY); g.closePath(); g.fill();
    /* cherry trees in bloom along the far shore */
    for (let i = 0; i < 160; i++) {
      const x = R() * W, y = L.horizon + 1 - R() * 7, r = 1.5 + R() * 3.5;
      g.fillStyle = P.shoreBloom; g.globalAlpha = .55 + R() * .35;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    /* a small lakeside town */
    for (let i = 0; i < 90; i++) {
      const x = W * (.16 + R() * .62), w = 3 + R() * 8, h = 3 + R() * 7, y = L.waterY - h - R() * 2;
      g.fillStyle = P.town; g.fillRect(x, y, w, h);
      g.fillStyle = P.roof; g.fillRect(x - .5, y - 1, w + 1, 1.6);
      if (night && R() < .7) { g.fillStyle = `rgba(255,${190 + R() * 40 | 0},120,${(.6 + R() * .4).toFixed(2)})`; g.fillRect(x + 1 + R() * (w - 3), y + 1.5 + R() * (h - 3), 1.4, 1.4); }
    }
    if (night) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 30; i++) {
        const x = W * (.12 + R() * .72), y = L.waterY - 2 - R() * 6, r = 3 + R() * 6;
        const gl = g.createRadialGradient(x, y, 0, x, y, r);
        gl.addColorStop(0, 'rgba(255,200,130,.75)'); gl.addColorStop(1, 'rgba(255,200,130,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = night ? 'rgba(150,160,210,.25)' : 'rgba(255,255,255,.45)';
    g.fillRect(0, L.waterY - .8, W, 1.2);
    return c;
  }

  function paintLake(L, P, q, layers) {
    const { W, H } = L, wh = H - L.waterY;
    const water = makeCanvas(W, wh), wg = water.getContext('2d');
    const grd = wg.createLinearGradient(0, 0, 0, wh);
    for (const [s, col] of P.water) grd.addColorStop(s, col);
    wg.fillStyle = grd; wg.fillRect(0, 0, W, wh);
    /* the mirror image of everything above the water line */
    const refl = makeCanvas(W * q, wh * q), rg = refl.getContext('2d');
    rg.setTransform(q, 0, 0, -q, 0, L.waterY * q);
    if (canFilter) rg.filter = 'blur(1.2px)';
    for (const l of layers) rg.drawImage(l, 0, 0, W, H);
    rg.filter = 'none';
    rg.setTransform(q, 0, 0, q, 0, 0);
    rg.globalCompositeOperation = 'destination-in';
    const fade = rg.createLinearGradient(0, 0, 0, wh);
    fade.addColorStop(0, `rgba(0,0,0,${P.reflA})`); fade.addColorStop(.7, `rgba(0,0,0,${P.reflA * .35})`); fade.addColorStop(1, 'rgba(0,0,0,.05)');
    rg.fillStyle = fade; rg.fillRect(0, 0, W, wh);
    rg.globalCompositeOperation = 'source-over';
    /* ripple highlights, thin near the far shore and longer up close */
    const ripples = makeCanvas(W, wh), pg = ripples.getContext('2d'), R = rng(13);
    for (let i = 0; i < 1100; i++) {
      const k = Math.pow(R(), 1.3), y = k * wh, len = lerp(5, 70, k) * (.4 + R()), th = lerp(.5, 1.8, k);
      pg.fillStyle = `rgba(${P.ripple},${(.05 + R() * .16).toFixed(3)})`;
      pg.fillRect(R() * W, y, len, th);
    }
    return { water, refl, ripples, wh };
  }

  /* Soft cumulus and wisp sprites */
  function cloudSprite(w, h, P, seed, wisp) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), R = rng(seed);
    const puff = (x, y, r, col, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(.6, `rgba(${col},${a * .55})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    };
    if (wisp) {
      for (let i = 0; i < 46; i++) {
        const x = w * (.08 + .84 * R()), y = h * (.35 + .3 * R()), r = h * (.18 + .3 * R());
        g.save(); g.translate(x, y); g.scale(2.8, 1); puff(0, 0, r, R() < .5 ? P.cloudLit : P.cloudShade, .22); g.restore();
      }
      return c;
    }
    const pts = [];
    for (let i = 0; i < 34; i++) {
      const u = R(), x = w * (.12 + .76 * u), bulge = 1 - Math.pow(Math.abs(u - .5) * 2, 1.6);
      const y = h * .66 - bulge * h * .36 * Math.sqrt(R()), r = h * (.12 + .2 * R()) * (.55 + .45 * bulge);
      pts.push([x, y, r]);
    }
    for (const [x, y, r] of pts) puff(x, y + r * .15, r * 1.05, P.cloudShade, .9);
    for (const [x, y, r] of pts) puff(x - r * .12, y - r * .22, r * .82, P.cloudLit, .85);
    for (const [x, y, r] of pts) if (R() < .4) puff(x, y + r * .35, r * .7, P.cloudPink, .25);
    /* flatten the base */
    g.globalCompositeOperation = 'destination-out';
    const base = g.createLinearGradient(0, h * .66, 0, h * .9);
    base.addColorStop(0, 'rgba(0,0,0,0)'); base.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    if (!canFilter) return c;
    const out = makeCanvas(w, h), og = out.getContext('2d');
    og.filter = 'blur(1.5px)'; og.drawImage(c, 0, 0); og.filter = 'none';
    return out;
  }

  /* ============================================================
     Flowers and petals
     ============================================================ */
  function flowerSprite(inner, outer, center, stamen, size = 56) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size * .48;
    g.translate(size / 2, size / 2);
    for (let k = 0; k < 5; k++) {
      g.save(); g.rotate(k * TAU / 5 + .2);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, center); grd.addColorStop(.2, mix(center, inner, .7)); grd.addColorStop(.45, inner); grd.addColorStop(.8, mix(inner, outer, .45)); grd.addColorStop(1, outer);
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(-r * .64, -r * .18, -r * .6, -r * .92, -r * .17, -r * .98);
      g.lineTo(0, -r * .83); g.lineTo(r * .17, -r * .98);
      g.bezierCurveTo(r * .6, -r * .92, r * .64, -r * .18, 0, 0);
      g.fill();
      g.strokeStyle = 'rgba(120,40,75,.13)'; g.lineWidth = size * .012; g.stroke();
      g.restore();
    }
    g.lineCap = 'round';
    for (let k = 0; k < 13; k++) {
      const a = k / 13 * TAU + .3, l = r * (.22 + (k % 3) * .05);
      g.strokeStyle = center; g.globalAlpha = .8; g.lineWidth = size * .012;
      g.beginPath(); g.moveTo(Math.cos(a) * r * .05, Math.sin(a) * r * .05); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
      g.globalAlpha = 1; g.fillStyle = stamen;
      g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, size * .02, 0, TAU); g.fill();
    }
    return c;
  }
  function petalSprite(a, b, size = 40) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size * .45;
    g.translate(size / 2, size / 2);
    const grd = g.createLinearGradient(0, r, 0, -r);
    grd.addColorStop(0, b); grd.addColorStop(.55, a); grd.addColorStop(1, mix(a, b, .35));
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, r);
    g.bezierCurveTo(-r * .78, r * .55, -r * .72, -r * .6, -r * .2, -r);
    g.lineTo(0, -r * .8); g.lineTo(r * .2, -r);
    g.bezierCurveTo(r * .72, -r * .6, r * .78, r * .55, 0, r);
    g.fill();
    g.strokeStyle = 'rgba(150,60,95,.15)'; g.lineWidth = 1; g.stroke();
    return c;
  }
  function blurred(src, px) {
    const pad = px * 3, c = makeCanvas(src.width + pad * 2, src.height + pad * 2), g = c.getContext('2d');
    if (canFilter) g.filter = `blur(${px}px)`;
    g.drawImage(src, pad, pad);
    return c;
  }
  function makeSprites(P) {
    return {
      front: P.flowers.map(([i, o, c]) => flowerSprite(i, o, c, P.stamen)),
      back: P.flowers.map(([i, o, c]) => flowerSprite(mix(i, P.backShade, .32), mix(o, P.backShade, .38), mix(c, P.backShade, .3), mix(P.stamen, P.backShade, .4))),
      petal: P.petals.map(([a, b]) => petalSprite(a, b)),
      petalBack: P.petals.map(([a, b]) => petalSprite(mix(a, P.backShade, .22), mix(b, P.backShade, .28))),
      bokeh: P.petals.map(([a, b]) => blurred(petalSprite(a, b, 64), 4)),
    };
  }

  /* ============================================================
     Cherry trees: generated as nested groups so each limb can sway around its own joint
     ============================================================ */
  const SWAY_AMP = [.004, .016, .03, .05];
  function treeSpecs(W, H) {
    const u = Math.min(W, H * 1.6) / 1440;
    const specs = [
      { seed: 101, x: W + 40 * u, y: -40 * u, angle: Math.PI * .87, len: 250 * u, width: 40 * u, depth: 6, spread: .5, droop: .17, swayAt: [1, 3], clusterR: [24 * u, 44 * u], clusterN: 28, bloomFrom: 2, flower: [9 * u, 16 * u], lanterns: 4 },
      { seed: 202, x: -30 * u, y: H * .03, angle: .16, len: 190 * u, width: 24 * u, depth: 5, spread: .55, droop: .13, swayAt: [1, 3], clusterR: [20 * u, 36 * u], clusterN: 26, bloomFrom: 2, flower: [8 * u, 14 * u], lanterns: 1 },
    ];
    [[-.03, .22], [.1, .1], [.21, -.05], [.8, .05], [.9, -.1], [1.03, -.22]].forEach(([fx, lean], i) => specs.push({
      seed: 300 + i * 17, x: W * fx, y: H + 40 * u, angle: -Math.PI / 2 + lean, len: 96 * u, width: 30 * u, depth: 5, spread: .62, droop: .03,
      swayAt: [2], clusterR: [30 * u, 50 * u], clusterN: 30, bloomFrom: 2, flower: [9 * u, 15 * u], lanterns: 0, bottom: true,
    }));
    return specs;
  }
  function buildTree(spec) {
    const R = rng(spec.seed);
    const newGroup = (px, py, level) => ({ px, py, level, ops: [], kids: [], amp: SWAY_AMP[Math.min(level, 3)] * (.8 + R() * .4), f: .7 + R() * .6, ph: R() * TAU, ph2: R() * TAU, dir: 1 });
    const root = newGroup(spec.x, spec.y, 0);
    let lanternsLeft = spec.lanterns;
    const grow = (g, x, y, ang, len, wid, depth) => {
      const a1 = ang + (R() - .5) * .35;
      const ex = x + Math.cos(a1) * len, ey = y + Math.sin(a1) * len;
      const nx = -Math.sin(ang), ny = Math.cos(ang), bow = (R() - .5) * len * .22;
      g.ops.push({ t: 'b', x0: x, y0: y, cx: lerp(x, ex, .5) + nx * bow, cy: lerp(y, ey, .5) + ny * bow, x1: ex, y1: ey, w0: wid, w1: wid * .66 });
      if (g.ops.length === 1) g.dir = Math.sin(a1) > 0 ? -1 : 1;
      if (depth >= spec.bloomFrom && R() < .55) g.ops.push({ t: 'c', x: lerp(x, ex, .5 + R() * .3), y: lerp(y, ey, .5 + R() * .3), r: lerp(spec.clusterR[0], spec.clusterR[1], R()) * .7, n: spec.clusterN * .6 | 0, seed: R() * 1e9 | 0 });
      if (depth >= spec.depth || len < 8) {
        g.ops.push({ t: 'c', x: ex, y: ey, r: lerp(spec.clusterR[0], spec.clusterR[1], R()), n: spec.clusterN, seed: R() * 1e9 | 0 });
        if (lanternsLeft > 0 && R() < .14) { lanternsLeft--; g.ops.push({ t: 'l', x: ex, y: ey, len: (30 + R() * 50) * (spec.len / 250), s: 11 * (spec.width / 40) + 6 }); }
        return;
      }
      const kids = depth === 0 ? 3 : (R() < .65 ? 2 : 3);
      for (let k = 0; k < kids; k++) {
        let na = a1 + spec.spread * (k - (kids - 1) / 2) * (.7 + R() * .6) + (R() - .5) * .3;
        na += angleDiff(Math.PI / 2, na) * spec.droop * (spec.bottom ? 1 : depth * .55 + .3);
        const nl = len * (.64 + R() * .16), nw = wid * (.62 + R() * .1);
        if (spec.swayAt.includes(depth + 1)) {
          const cg = newGroup(ex, ey, g.level + 1);
          g.kids.push(cg); grow(cg, 0, 0, na, nl, nw, depth + 1);
        } else grow(g, ex, ey, na, nl, nw, depth + 1);
      }
    };
    grow(root, 0, 0, spec.angle, spec.len, spec.width, 0);
    return root;
  }
  /* Where blossoms are, in screen space, so petals can fall from them */
  function bloomPoints(g, ox, oy, out) {
    const wx = ox + g.px, wy = oy + g.py;
    for (const op of g.ops) if (op.t === 'c') out.push([wx + op.x, wy + op.y, op.r]);
    for (const k of g.kids) bloomPoints(k, wx, wy, out);
    return out;
  }
  function drawBranch(g, op, P) {
    /* a tapered limb drawn as one smooth filled shape, then a soft highlight on the lit side */
    const N = 14, L = [], Rt = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, it = 1 - t;
      const x = it * it * op.x0 + 2 * it * t * op.cx + t * t * op.x1, y = it * it * op.y0 + 2 * it * t * op.cy + t * t * op.y1;
      const dx = 2 * it * (op.cx - op.x0) + 2 * t * (op.x1 - op.cx), dy = 2 * it * (op.cy - op.y0) + 2 * t * (op.y1 - op.cy);
      const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = lerp(op.w0, op.w1, t) / 2;
      L.push([x + nx * w, y + ny * w]); Rt.push([x - nx * w, y - ny * w]); mid.push([x, y, nx, ny, w]);
    }
    g.fillStyle = P.bark; g.beginPath();
    L.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(op.x0, op.y0, op.w0 / 2, 0, TAU); g.fill();
    g.beginPath(); g.arc(op.x1, op.y1, op.w1 / 2, 0, TAU); g.fill();
    /* highlight on whichever edge faces up */
    const side = mid[0][3] < 0 ? 1 : -1;
    g.strokeStyle = P.barkHi; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = Math.max(.6, op.w0 * .18);
    g.beginPath();
    mid.forEach(([x, y, nx, ny, w], i) => { const px = x + nx * w * .55 * side, py = y + ny * w * .55 * side; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
    /* a couple of thin bark lines on the thick limbs */
    if (op.w0 > 10) {
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .8;
      for (const f of [-.25, .2]) { g.beginPath(); mid.forEach(([x, y, nx, ny, w], i) => { const px = x + nx * w * f, py = y + ny * w * f; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
    }
  }
  function drawCluster(g, op, P, sp, spec) {
    const R = rng(op.seed);
    g.strokeStyle = P.bark; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = R() * TAU, l = op.r * (.4 + R() * .55);
      g.lineWidth = .7 + R() * 1.1;
      g.beginPath(); g.moveTo(op.x, op.y); g.lineTo(op.x + Math.cos(a) * l, op.y + Math.sin(a) * l); g.stroke();
    }
    const N = op.n;
    for (let i = 0; i < N; i++) {
      const back = i < N * .42;
      const a = R() * TAU, rr = Math.sqrt(R()) * op.r;
      const fx = op.x + Math.cos(a) * rr * 1.3, fy = op.y + Math.sin(a) * rr;
      const s = lerp(spec.flower[0], spec.flower[1], Math.pow(R(), .8)) * (back ? .82 : 1) * (R() < .1 ? .6 : 1);
      const set = back ? sp.back : sp.front, spr = set[(R() * set.length) | 0];
      g.save(); g.translate(fx, fy); g.rotate(R() * TAU); g.drawImage(spr, -s / 2, -s / 2, s, s); g.restore();
      if (R() < .07) { g.fillStyle = P.bud; g.beginPath(); g.arc(fx + (R() - .5) * s, fy + (R() - .5) * s, s * .16, 0, TAU); g.fill(); }
    }
  }
  function drawLantern(g, op) {
    const s = op.s, x = op.x, y = op.y + op.len;
    g.strokeStyle = 'rgba(30,20,20,.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(op.x, op.y); g.lineTo(x, y - s); g.stroke();
    const halo = g.createRadialGradient(x, y, 0, x, y, s * 5);
    halo.addColorStop(0, 'rgba(255,170,90,.42)'); halo.addColorStop(.4, 'rgba(255,140,70,.14)'); halo.addColorStop(1, 'rgba(255,140,70,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, s * 5, 0, TAU); g.fill();
    const body = g.createRadialGradient(x - s * .25, y - s * .2, 0, x, y, s);
    body.addColorStop(0, '#ffe3a8'); body.addColorStop(.45, '#ff9a4d'); body.addColorStop(1, '#c8402a');
    g.fillStyle = body; g.beginPath(); g.ellipse(x, y, s * .8, s, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,40,25,.45)'; g.lineWidth = .8;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x, y, s * .8 * Math.abs(k) / 2.4 + .1, s, 0, 0, TAU); g.stroke(); }
    g.fillStyle = '#2a1a16';
    g.fillRect(x - s * .45, y - s * 1.08, s * .9, s * .2); g.fillRect(x - s * .45, y + s * .9, s * .9, s * .2);
  }
  function renderGroup(grp, spec, P, sp, q, lanterns) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const box = (x, y, m) => { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); };
    for (const op of grp.ops) {
      if (op.t === 'b') { box(op.x0, op.y0, op.w0); box(op.x1, op.y1, op.w0); box(op.cx, op.cy, op.w0); }
      else if (op.t === 'c') box(op.x, op.y, op.r * 1.2 + spec.flower[1]);
      else if (op.t === 'l' && lanterns) { box(op.x, op.y, 2); box(op.x, op.y + op.len, op.s * 5.2); }
    }
    const pad = 4, cw = x1 - x0 + pad * 2, ch = y1 - y0 + pad * 2;
    const c = makeCanvas(cw * q, ch * q), g = c.getContext('2d');
    g.scale(q, q); g.translate(-x0 + pad, -y0 + pad);
    for (const op of grp.ops) if (op.t === 'b') drawBranch(g, op, P);
    for (const op of grp.ops) if (op.t === 'c') drawCluster(g, op, P, sp, spec);
    if (lanterns) for (const op of grp.ops) if (op.t === 'l') drawLantern(g, op);
    grp.canvas = c; grp.ox = x0 - pad; grp.oy = y0 - pad; grp.cw = cw; grp.ch = ch;
    for (const k of grp.kids) renderGroup(k, spec, P, sp, q, lanterns);
  }

  /* ============================================================
     Engine
     ============================================================ */
  let canvas = null, ctx = null, active = false, opts = { ...DEFAULTS };
  let raf = 0, last = 0, clock = rand(0, 50), W = 0, H = 0, q = 1, resizeT = 0;
  let S = null, builtKey = '';
  let gust = 0, gustHold = 0, nextGust = 6;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const night = () => opts.mode === 'night';

  function buildGeometry() {
    q = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * q); canvas.height = Math.round(H * q);
    ctx.setTransform(q, 0, 0, q, 0, 0);
    const L = layout(W, H), profile = makeProfile(L);
    const specs = treeSpecs(W, H), trees = specs.map(sp => ({ spec: sp, root: buildTree(sp) }));
    const blooms = []; for (const t of trees) bloomPoints(t.root, 0, 0, blooms);
    const R = rng(3);
    const stars = Array.from({ length: 260 }, () => ({ x: R() * W, y: Math.pow(R(), 1.4) * L.horizon * .85, r: Math.pow(R(), 3) * 1.5 + .35, a: .3 + R() * .7, tw: .5 + R() * 2, ph: R() * TAU }))
      .filter(s => s.y < profile(s.x) - 4 && Math.hypot(s.x - L.moonX, s.y - L.moonY) > H * .07);
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: R() * W * 1.2 - W * .1, y: H * (.05 + R() * .26), w: W * (.16 + R() * .14), h: H * (.07 + R() * .05), v: 3 + R() * 6, seed: 500 + i, a: .75 + R() * .25 }));
    S = { L, profile, trees, blooms, stars, clouds, petals: S ? S.petals : [], birds: [], nextBirds: 8, glitter: [], glitterT: 0 };
    builtKey = '';
  }
  function buildLook() {
    const P = PAL[opts.mode], n = night(), L = S.L;
    S.P = P; S.sp = makeSprites(P);
    S.sky = paintSky(L, P, q, n);
    S.mtn = paintMountain(L, P, q, S.profile);
    S.shore = paintShore(L, P, q, n);
    S.lake = paintLake(L, P, Math.min(q, 1.25), [S.sky, S.mtn, S.shore]);
    for (const c of S.clouds) c.sprite = cloudSprite(c.w, c.h, P, c.seed, false);
    S.wisp = cloudSprite(W * .34, H * .08, P, 77, true);
    S.mist = cloudSprite(W * .8, H * .09, P, 91, true);
    for (const t of S.trees) renderGroup(t.root, t.spec, P, S.sp, q, n && opts.lanterns);
    builtKey = `${W}x${H}:${opts.mode}:${n && opts.lanterns}`;
  }

  function spawnPetal(anywhere) {
    const sp = S.sp, k = (Math.random() * sp.petal.length) | 0;
    const z = Math.random() < .12 ? rand(1.4, 2) : rand(.35, 1.15);
    const p = { k, z, s: rand(8, 14) * z, rot: rand(0, TAU), rs: rand(-2.5, 2.5), flip: rand(0, TAU), fs: rand(1.5, 4.5), vx: 0, vy: 0, wf: rand(.6, 1.6), ph: rand(0, TAU), fall: rand(26, 52) * (.55 + .5 * z), bokeh: z > 1.35 };
    if (anywhere) { p.x = rand(-20, W + 20); p.y = rand(-20, H); }
    else if (Math.random() < .62 && S.blooms.length) {
      const b = S.blooms[(Math.random() * S.blooms.length) | 0];
      p.x = b[0] + rand(-b[2], b[2]); p.y = b[1] + rand(-b[2], b[2]) * .7;
    } else if (Math.random() < .5) { p.x = rand(-W * .2, W); p.y = -20; }
    else { p.x = -20; p.y = rand(0, H * .6); }
    S.petals.push(p);
  }
  function target() { return Math.round(clamp(opts.petals, 0, 100) / 100 * 280 * Math.sqrt(W * H / (1440 * 900))); }

  function step(dt, t) {
    const w = clamp(opts.wind, 0, 100) / 100;
    /* gusts: every so often the wind picks up, shakes the trees and strips petals off them */
    if (w > 0) {
      nextGust -= dt;
      if (nextGust <= 0) { gustHold = rand(.8, 1.8); nextGust = rand(7, 16) / (.4 + w); for (let i = 0; i < target() * .18; i++) spawnPetal(false); }
    }
    if (gustHold > 0) { gustHold -= dt; gust += (1 - gust) * Math.min(1, dt * 2); } else gust += (0 - gust) * Math.min(1, dt * .5);
    const tgt = target();
    if (S.petals.length < tgt) { S.spawnAcc = (S.spawnAcc || 0) + dt * tgt / 9; while (S.spawnAcc >= 1) { S.spawnAcc--; spawnPetal(false); } }
    const windX = w * (55 + 110 * gust);
    S.petals = S.petals.filter(p => {
      p.vx += ((windX * (.35 + .65 * Math.min(1.4, p.z)) + Math.sin(t * p.wf + p.ph) * 24 * p.z) - p.vx) * Math.min(1, dt * 1.3);
      const fall = p.fall * (.7 + .55 * Math.sin(t * p.wf * 1.7 + p.ph));
      p.vy += (fall - p.vy) * Math.min(1, dt * 2);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.rs * dt * (1 + gust); p.flip += p.fs * dt * (1 + gust * .8);
      return p.y < H + 40 && p.x < W + 80 && p.x > -100;
    });
    if (opts.clouds) for (const c of S.clouds) { c.x += c.v * (.4 + w) * dt; if (c.x > W + 20) c.x = -c.w - 20; }
    if (!night()) {
      S.nextBirds -= dt;
      if (S.nextBirds <= 0) {
        S.nextBirds = rand(20, 40);
        const y0 = H * rand(.1, .3), n = 3 + (Math.random() * 4 | 0);
        for (let i = 0; i < n; i++) S.birds.push({ x: -30 - i * rand(14, 24), y: y0 + Math.abs(i - n / 2) * 9 + rand(-4, 4), v: rand(42, 56), ph: rand(0, TAU), s: rand(3.5, 5.5) });
      }
      S.birds = S.birds.filter(b => { b.x += b.v * dt; b.y += Math.sin(t * .8 + b.ph) * 3 * dt; return b.x < W + 40; });
    }
  }

  function drawGroup(g, grp, t, swayK) {
    g.save(); g.translate(grp.px, grp.py);
    if (swayK > 0) {
      const amp = grp.amp * swayK;
      g.rotate(amp * (Math.sin(t * grp.f + grp.ph) + .35 * Math.sin(t * grp.f * 2.3 + grp.ph2)) + amp * (2.2 * gust + .6) * grp.dir * (opts.wind / 100));
    }
    g.drawImage(grp.canvas, grp.ox, grp.oy, grp.cw, grp.ch);
    for (const k of grp.kids) drawGroup(g, k, t, swayK);
    g.restore();
  }
  function drawPetal(g, p) {
    const sp = S.sp;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    const c = Math.cos(p.flip);
    g.scale(Math.max(.12, Math.abs(c)), 1);
    if (p.bokeh) { const s = p.s * 2.4; g.globalAlpha = .55; g.drawImage(sp.bokeh[p.k % sp.bokeh.length], -s / 2, -s / 2, s, s); }
    else { g.globalAlpha = p.z < .6 ? .75 : 1; g.drawImage((c >= 0 ? sp.petal : sp.petalBack)[p.k % sp.petal.length], -p.s / 2, -p.s / 2, p.s, p.s); }
    g.restore();
  }
  function drawLake(g, t) {
    const L = S.L, lk = S.lake, wh = lk.wh, qq = lk.refl.width / W;
    g.drawImage(lk.water, 0, L.waterY, W, wh);
    const strip = 3;
    for (let yy = 0; yy < wh; yy += strip) {
      const k = yy / wh, amp = .6 + 6 * k;
      const dx = (Math.sin(yy * .11 - t * 1.6) + .6 * Math.sin(yy * .037 + t * .7)) * amp;
      g.drawImage(lk.refl, 0, yy * qq, lk.refl.width, (strip + 1) * qq, dx, L.waterY + yy, W, strip + 1);
    }
    const off = (t * 7) % W;
    g.globalAlpha = .55 + .25 * Math.sin(t * .9);
    g.drawImage(lk.ripples, -off, L.waterY, W, wh); g.drawImage(lk.ripples, W - off, L.waterY, W, wh);
    g.globalAlpha = .45 + .25 * Math.sin(t * .9 + 2);
    g.drawImage(lk.ripples, off * .6 - W, L.waterY + 2, W, wh); g.drawImage(lk.ripples, off * .6, L.waterY + 2, W, wh);
    g.globalAlpha = 1;
    /* glitter on the water: moonlight at night, sun glints by day */
    S.glitterT -= 1 / 60;
    if (S.glitterT <= 0) {
      S.glitterT = .12;
      const n = night(), cx = n ? L.moonX : W * .32;
      S.glitter = Array.from({ length: n ? 90 : 40 }, () => {
        const k = Math.pow(Math.random(), 1.2), y = L.waterY + k * wh;
        const spread = (n ? 14 : 60) + k * (n ? 90 : 260);
        return [cx + (Math.random() + Math.random() + Math.random() - 1.5) * spread, y, 3 + k * 26 * Math.random(), Math.random() * (n ? .85 : .5)];
      });
    }
    const P = S.P;
    for (const [x, y, l, a] of S.glitter) { g.fillStyle = `rgba(${P.glint},${a.toFixed(3)})`; g.fillRect(x - l / 2, y, l, 1.1); }
  }

  function frameDraw(t) {
    const g = ctx, L = S.L, n = night();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(S.sky, 0, 0, W, H);
    if (n) for (const s of S.stars) {
      g.fillStyle = `rgba(235,240,255,${(s.a * (.55 + .45 * Math.sin(t * s.tw + s.ph))).toFixed(3)})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    }
    if (opts.clouds) for (const c of S.clouds) { g.globalAlpha = c.a * (n ? .8 : 1); g.drawImage(c.sprite, c.x, c.y, c.w, c.h); }
    g.globalAlpha = 1;
    g.drawImage(S.mtn, 0, 0, W, H);
    if (opts.clouds) {
      const ww = W * .34, wx = L.peakX - ww * .3 + Math.sin(t * .045) * W * .035, wy = L.peakY + H * .015;
      g.globalAlpha = .6 + .2 * Math.sin(t * .2); g.drawImage(S.wisp, wx, wy, ww, H * .08);
      const mw = W * .8, mx = ((t * 6) % (W + mw)) - mw;
      g.globalAlpha = .5; g.drawImage(S.mist, mx, L.horizon - H * .075, mw, H * .09);
      g.globalAlpha = .38; g.drawImage(S.mist, W - mx - mw * .6, L.horizon - H * .05, mw, H * .08);
      g.globalAlpha = 1;
    }
    g.drawImage(S.shore, 0, 0, W, H);
    drawLake(g, t);
    if (!n && S.birds.length) {
      g.strokeStyle = 'rgba(40,40,60,.55)'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (const b of S.birds) {
        const f = Math.sin(t * 9 + b.ph) * b.s * .6;
        g.beginPath(); g.moveTo(b.x - b.s, b.y - f); g.quadraticCurveTo(b.x - b.s * .4, b.y - b.s * .3, b.x, b.y);
        g.quadraticCurveTo(b.x + b.s * .4, b.y - b.s * .3, b.x + b.s, b.y - f); g.stroke();
      }
    }
    const swayK = opts.sway ? .35 + 1.3 * clamp(opts.wind, 0, 100) / 100 : 0;
    for (const p of S.petals) if (p.z < .6) drawPetal(g, p);
    for (const tr of S.trees) if (tr.spec.bottom) drawGroup(g, tr.root, t, swayK);
    for (const tr of S.trees) if (!tr.spec.bottom) drawGroup(g, tr.root, t, swayK);
    for (const p of S.petals) if (p.z >= .6) drawPetal(g, p);
    g.globalAlpha = 1;
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
  function prefill() { S.petals = []; for (let i = 0; i < target(); i++) spawnPetal(true); }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'scene-sakura'; canvas.className = 'scene-canvas'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => {
      if (!active) return;
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { buildGeometry(); buildLook(); prefill(); if (!raf) once(); }, 150);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (active) start(); });
  }

  window.ChronosSakura = {
    /* on: show or hide the scene. o: any of DEFAULTS' keys (mode is 'day' or 'night') */
    set(on, o = {}) {
      for (const key in DEFAULTS) if (o[key] !== undefined && o[key] !== null) opts[key] = o[key];
      if (!on) { if (active) { stop(); active = false; canvas.hidden = true; } return; }
      if (!active) {
        ensureCanvas(); canvas.hidden = false; active = true;
        buildGeometry(); buildLook(); prefill(); start();
        return;
      }
      if (builtKey !== `${W}x${H}:${opts.mode}:${night() && opts.lanterns}`) buildLook();
      if (!raf) once();
    },
  };
})();
