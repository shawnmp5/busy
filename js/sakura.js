/* Chronos — "Cherry blossom" scene.

   Standing under cherry trees in full bloom, looking up: about three quarters of the view is blossom.
   Everything is painted in code, in three depths:
   - far: a soft, out-of-focus wall of pink blossom with bokeh highlights and blurred limbs,
   - middle: flowering trees slightly out of focus,
   - near: sharp, thin branches crossing the frame, covered in detailed five-petal flowers, swaying in the wind.
   Gaps in the canopy show the sky and drifting clouds. Petals tumble and flip as they fall, and burst off the
   branches when a gust comes through. A night version swaps in a moon, stars and paper lanterns in the branches.

   Static layers are painted once into offscreen canvases; each frame only moves them around, so it stays light.
   It pauses in background tabs and draws one still frame for reduced motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEFAULTS = { season: 'spring', orb: true, mode: 'day', petals: 55, wind: 40, brightness: 100, clouds: true, sway: true, lanterns: true, rays: true, parallax: true };

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
  function noise2(seed) {
    const R = rng(seed), v = Float32Array.from({ length: 4096 }, () => R()), at = (x, y) => v[(x & 63) * 64 + (y & 63)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), w);
    };
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
      canopy: ['244,190,210', '248,206,222', '240,172,198', '252,224,234', '236,160,188', '250,214,226'], limbFar: 'rgba(92,58,68,.5)', bokeh: '255,250,252', haze: '250,226,236',
      light: -1, horizonTint: '250,220,232', sunGlow: '255,246,228', ray: '255,246,226',
      cloudLit: '255,255,255', cloudShade: '200,205,232', cloudPink: '250,222,232', mist: '236,240,250',
      bark: '#4a3335', barkHi: 'rgba(255,226,232,.30)', backShade: '#d88aa9', bud: '#e5779e',
      flowers: [['#fff6f9', '#f8c5d5', '#e9a05a'], ['#ffeef4', '#f3aec6', '#d6648e'], ['#fffbfc', '#fbd8e4', '#ea8bad'], ['#fde3ec', '#ee9cb9', '#e39a55'], ['#ffffff', '#f6cfdc', '#df7aa1']],
      stamen: '#f2cf72', petals: [['#fff3f7', '#f4b4c9'], ['#ffeaf1', '#ef9fbb'], ['#fffafb', '#f8cddb'], ['#fde0ea', '#e98cae']],
    },
    night: {
      sky: [[0, '#02040d'], [.4, '#0a1230'], [.7, '#1c2149'], [.88, '#33294f'], [1, '#43304f']],
      canopy: ['112,74,116', '134,92,134', '96,64,104', '156,108,150', '84,56,96', '124,84,128'], limbFar: 'rgba(12,6,16,.7)', bokeh: '255,205,232', haze: '60,34,66',
      light: 1, halo: '170,182,250', moon: ['#fffef6', '#f1efe2', '#dcdacc'], moonGlow: '230,235,255', nightGlow: '140,90,130', ray: '200,190,255',
      cloudLit: '150,162,205', cloudShade: '38,44,78', cloudPink: '90,80,120', mist: '70,80,120',
      bark: '#170f18', barkHi: 'rgba(170,180,235,.16)', backShade: '#6a3466', bud: '#a35a8e',
      flowers: [['#f7e6f0', '#d7a3c4', '#a2427e'], ['#fbeef5', '#e2b2cf', '#b2508c'], ['#eedcea', '#c493b8', '#8c3a72'], ['#fff4f9', '#e9c3da', '#bd5f99']],
      stamen: '#cdb56c', petals: [['#f6e5ef', '#cf9fbf'], ['#eedbe8', '#bd8ab0'], ['#fbf0f6', '#dfb5cf']],
    },
  };

  /* Autumn: the same trees in maple colours, with leaves on the branches and falling instead of petals */
  const PAL_AUTUMN = {
    day: {
      sky: [[0, '#3a6fb8'], [.35, '#79a6d9'], [.62, '#c9d6e6'], [.82, '#f2dcc0'], [1, '#f6c99a']],
      canopy: ['236,120,40', '246,160,50', '214,80,30', '250,196,80', '196,60,30', '240,140,60'], limbFar: 'rgba(60,34,24,.55)', bokeh: '255,236,200', haze: '250,214,170',
      light: -1, horizonTint: '255,214,160', sunGlow: '255,236,196', ray: '255,226,170',
      cloudLit: '255,250,240', cloudShade: '214,200,196', cloudPink: '255,214,180', mist: '250,236,220',
      bark: '#3a2620', barkHi: 'rgba(255,220,190,.2)', backShade: '#a8341a', bud: null, leafScale: 1.55,
      leaves: [['#f79a1e', '#d8461a', '#ffd36a'], ['#ec5a1a', '#b01e16', '#ffa65a'], ['#ffbe2e', '#ee7a1c', '#ffe68a'], ['#de3a1c', '#9a1812', '#ff8a4a'], ['#f2822a', '#c8381a', '#ffc46a'], ['#e4471e', '#a52014', '#ff9e52']],
      petals: [['#f5a623', '#d9531e'], ['#e8601c', '#a8261a'], ['#ffc93c', '#f08a24'], ['#d8401e', '#8c1d14'], ['#c46a2a', '#7a3a14']],
    },
    night: {
      sky: [[0, '#05040c'], [.4, '#140c22'], [.7, '#2a1626'], [.88, '#3d1f22'], [1, '#4a2620']],
      canopy: ['120,46,24', '150,70,28', '96,32,22', '170,96,40', '80,26,20', '136,58,30'], limbFar: 'rgba(8,4,4,.7)', bokeh: '255,190,120', haze: '70,32,22',
      light: 1, halo: '255,168,96', moon: ['#fff3dc', '#ffd08c', '#e2914c'], moonGlow: '255,196,120', nightGlow: '150,70,40', ray: '255,170,110',
      cloudLit: '170,140,140', cloudShade: '40,26,36', cloudPink: '120,70,60', mist: '90,60,60',
      bark: '#120a08', barkHi: 'rgba(255,180,120,.1)', backShade: '#3a140c', bud: null, leafScale: 1.55,
      leaves: [['#c8661c', '#7a2412', '#f0a050'], ['#b2401a', '#5a1410', '#e07a40'], ['#d89a2a', '#8a4a14', '#f0c860'], ['#9a2a16', '#4a0e0c', '#d0603a']],
      petals: [['#c8661c', '#7a2412'], ['#b2401a', '#5a1410'], ['#d89a2a', '#8a4a14']],
    },
  };

  /* ============================================================
     Layout
     ============================================================ */
  function layout(W, H) {
    return { W, H, horizon: H * .68, moonX: W * .53, moonY: H * .27 };
  }
  /* ============================================================
     Static paintings (done once per size and per day/night)
     ============================================================ */
  function paintSky(L, P, q, night, orb = true) {
    const { W, H } = L, c = makeCanvas(W * q, H * q), g = c.getContext('2d'); g.scale(q, q);
    const grd = g.createLinearGradient(0, 0, 0, H * .85);
    for (const [s, col] of P.sky) grd.addColorStop(s, col);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (!night) {
      if (orb) {
        const sun = g.createRadialGradient(W * .06, -H * .06, 0, W * .06, -H * .06, W * .65);
        sun.addColorStop(0, `rgba(${P.sunGlow},.42)`); sun.addColorStop(1, `rgba(${P.sunGlow},0)`);
        g.fillStyle = sun; g.fillRect(0, 0, W, H);
      }
      const pink = g.createLinearGradient(0, L.horizon - H * .28, 0, L.horizon);
      pink.addColorStop(0, `rgba(${P.horizonTint},0)`); pink.addColorStop(1, `rgba(${P.horizonTint},.38)`);
      g.fillStyle = pink; g.fillRect(0, 0, W, H);
    } else if (orb) {
      const halo = g.createRadialGradient(L.moonX, L.moonY, 0, L.moonX, L.moonY, H * .55);
      halo.addColorStop(0, `rgba(${P.halo},.28)`); halo.addColorStop(.25, `rgba(${P.halo},.1)`); halo.addColorStop(1, `rgba(${P.halo},0)`);
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      const mr = Math.min(W, H) * .042;
      g.shadowColor = `rgba(${P.moonGlow},.9)`; g.shadowBlur = mr * 1.2;
      const disc = g.createRadialGradient(L.moonX - mr * .3, L.moonY - mr * .3, 0, L.moonX, L.moonY, mr);
      disc.addColorStop(0, P.moon[0]); disc.addColorStop(.8, P.moon[1]); disc.addColorStop(1, P.moon[2]);
      g.fillStyle = disc; g.beginPath(); g.arc(L.moonX, L.moonY, mr, 0, TAU); g.fill();
      g.shadowBlur = 0;
      const R = rng(9);
      for (let i = 0; i < 7; i++) { /* the moon's darker seas */
        const a = R() * TAU, d = R() * mr * .6, r = mr * (.12 + R() * .22);
        g.fillStyle = 'rgba(150,150,140,.16)'; g.beginPath(); g.arc(L.moonX + Math.cos(a) * d, L.moonY + Math.sin(a) * d, r, 0, TAU); g.fill();
      }
    }
    if (night) {
      const glow = g.createLinearGradient(0, L.horizon - H * .2, 0, L.horizon);
      glow.addColorStop(0, `rgba(${P.nightGlow},0)`); glow.addColorStop(1, `rgba(${P.nightGlow},.3)`);
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    }
    return c;
  }

  /* The canopy behind the near branches: a blurred wall of blossom, then softly focused flowering trees */
  function canopyMask(L, night) {
    const { W, H } = L, N = noise2(17), N2 = noise2(23);
    return (x, y) => {
      const nx = x / W, ny = y / H;
      let d = N(nx * 4.2, ny * 4.2) * .65 + N2(nx * 9 + 7, ny * 9 + 3) * .35;
      d += .3 * Math.max(Math.abs(nx - .5), Math.abs(ny - .5)) * 2;  /* fuller toward the edges and corners */
      if (night) d -= .6 * Math.max(0, 1 - Math.hypot(x - L.moonX, y - L.moonY) / (H * .17)); /* keep the moon clear */
      return d;
    };
  }
  function paintFar(L, P, q, night) {
    const { W, H } = L, u = Math.min(W, H * 1.6) / 1440, R = rng(88), dens = canopyMask(L, night);
    const raw = makeCanvas(W * q, H * q), g = raw.getContext('2d'); g.scale(q, q);
    /* blurred limbs far behind */
    g.strokeStyle = P.limbFar; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x0 = R() * W, y0 = H + 20, x1 = x0 + (R() - .5) * W * .6, y1 = R() * H * .4;
      g.lineWidth = (14 + R() * 26) * u;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(lerp(x0, x1, .5) + (R() - .5) * 200 * u, lerp(y0, y1, .5), x1, y1); g.stroke();
    }
    /* soft masses of blossom, leaving a few gaps for the sky */
    const count = Math.round(2600 * W * H / (1440 * 900));
    for (let i = 0; i < count; i++) {
      const x = R() * W, y = R() * H, d = dens(x, y);
      if (d < .55 + R() * .08) continue;
      const r = (18 + R() * 60) * u * (.7 + d * .6), col = P.canopy[(R() * P.canopy.length) | 0];
      g.fillStyle = `rgba(${col},${(.55 + R() * .45).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    const c = makeCanvas(W * q, H * q), cg = c.getContext('2d');
    if (canFilter) cg.filter = `blur(${Math.round(14 * u * q)}px)`;
    cg.drawImage(raw, 0, 0);
    cg.filter = 'none'; cg.scale(q, q);
    /* bokeh: soft discs of light where the sun catches out-of-focus flowers */
    for (let i = 0; i < 90; i++) {
      const x = R() * W, y = R() * H;
      if (dens(x, y) < .5) continue;
      const r = (6 + R() * 18) * u, grd = cg.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${P.bokeh},${(.1 + R() * .18).toFixed(2)})`); grd.addColorStop(.8, `rgba(${P.bokeh},.08)`); grd.addColorStop(1, `rgba(${P.bokeh},0)`);
      cg.fillStyle = grd; cg.beginPath(); cg.arc(x, y, r, 0, TAU); cg.fill();
    }
    return c;
  }
  function flatten(g, grp, ox, oy) {
    const x = ox + grp.px, y = oy + grp.py;
    g.drawImage(grp.canvas, x + grp.ox, y + grp.oy, grp.cw, grp.ch);
    for (const k of grp.kids) flatten(g, k, x, y);
  }
  function paintMid(L, P, q, sp, trees) {
    const { W, H } = L, c = makeCanvas(W * q, H * q), g = c.getContext('2d');
    const raw = makeCanvas(W * q, H * q), rg = raw.getContext('2d'); rg.scale(q, q);
    for (const t of trees) { renderGroup(t.root, t.spec, P, sp, q, false); flatten(rg, t.root, 0, 0); }
    if (canFilter) g.filter = `blur(${(1.4 * q).toFixed(1)}px)`;
    g.drawImage(raw, 0, 0); g.filter = 'none';
    /* a veil of air pushes them back behind the near branches */
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${P.haze},.22)`; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /* Blossom so close to the eye that it's a blur: big soft clusters in the bottom corners and on the right edge */
  function paintFore(L, P, q, sp) {
    const { W, H } = L, u = Math.min(W, H * 1.6) / 1440, R = rng(57);
    const raw = makeCanvas(W * q, H * q), g = raw.getContext('2d'); g.scale(q, q);
    const spots = [[-.03, 1.02, 210], [1.04, .98, 230], [1.05, .42, 150], [.3, 1.08, 130], [.72, 1.07, 120]];
    for (const [fx, fy, rad] of spots) {
      const cx = fx * W, cy = fy * H, r = rad * u;
      g.strokeStyle = P.bark; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) { g.lineWidth = (6 + R() * 8) * u; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (R() - .5) * r * 2.2, cy + (R() - .5) * r * 1.6); g.stroke(); }
      const n = Math.round(r * r / (130 * u * u));
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, rr = Math.sqrt(R()) * r, s = (34 + R() * 34) * u;
        const set = R() < .4 ? sp.back : sp.front, spr = set[(R() * set.length) | 0];
        g.save(); g.translate(cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr * .9); g.rotate(R() * TAU); g.drawImage(spr, -s / 2, -s / 2, s, s); g.restore();
      }
    }
    const c = makeCanvas(W * q, H * q), cg = c.getContext('2d');
    if (canFilter) cg.filter = `blur(${Math.round(9 * u * q)}px)`;
    cg.globalAlpha = .92; cg.drawImage(raw, 0, 0);
    return c;
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
    const shape = () => {
      g.beginPath(); g.moveTo(0, r);
      g.bezierCurveTo(-r * .78, r * .55, -r * .72, -r * .6, -r * .2, -r);
      g.lineTo(0, -r * .8); g.lineTo(r * .2, -r);
      g.bezierCurveTo(r * .72, -r * .6, r * .78, r * .55, 0, r);
    };
    /* a faint shadow so petals read against the blossom behind them */
    g.save(); g.translate(size * .03, size * .05); shape(); g.fillStyle = 'rgba(90,20,55,.22)'; g.fill(); g.restore();
    const grd = g.createLinearGradient(0, r, 0, -r);
    grd.addColorStop(0, mix(b, '#c2306a', .25)); grd.addColorStop(.55, mix(a, b, .35)); grd.addColorStop(1, mix(a, b, .55));
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, r);
    g.bezierCurveTo(-r * .78, r * .55, -r * .72, -r * .6, -r * .2, -r);
    g.lineTo(0, -r * .8); g.lineTo(r * .2, -r);
    g.bezierCurveTo(r * .72, -r * .6, r * .78, r * .55, 0, r);
    g.fill();
    g.strokeStyle = 'rgba(150,40,90,.35)'; g.lineWidth = 1; g.stroke();
    return c;
  }
  function blurred(src, px) {
    const pad = px * 3, c = makeCanvas(src.width + pad * 2, src.height + pad * 2), g = c.getContext('2d');
    if (canFilter) g.filter = `blur(${px}px)`;
    g.drawImage(src, pad, pad);
    return c;
  }
  /* A maple leaf: five pointed, toothed lobes, veins from the stem, and a few darker speckles */
  function mapleSprite(base, edge, vein, size, seed) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), R = rng(seed), r = size * .46;
    g.translate(size / 2, size * .54);
    const lobes = [[0, 1], [.95, .86], [-.95, .86], [1.95, .52], [-1.95, .52]];
    const p = new Path2D();
    for (let i = 0; i <= 240; i++) {
      const th = i / 240 * TAU - Math.PI;
      let rr = .34;
      for (const [a, l] of lobes) { const d = Math.abs(angleDiff(th, a)); if (d < .62) rr = Math.max(rr, .34 + (l - .34) * Math.pow(Math.cos(d / .62 * Math.PI / 2), 1.25)); }
      rr *= 1 - .07 * Math.abs(Math.sin(th * 15 + seed)) - (Math.abs(th) > 2.7 ? .12 : 0);
      const ang = th - Math.PI / 2, x = Math.cos(ang) * rr * r, y = Math.sin(ang) * rr * r;
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    p.closePath();
    const grd = g.createRadialGradient(0, 0, 0, 0, -r * .1, r);
    grd.addColorStop(0, vein); grd.addColorStop(.35, base); grd.addColorStop(.85, mix(base, edge, .6)); grd.addColorStop(1, edge);
    g.fillStyle = grd; g.fill(p);
    g.save(); g.clip(p);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(110,30,10,${(.12 + R() * .2).toFixed(2)})`;
      g.beginPath(); g.arc((R() - .5) * r * 1.5, (R() - .7) * r * 1.3, size * (.008 + R() * .02), 0, TAU); g.fill();
    }
    const sheen = g.createLinearGradient(-r, -r, r, r);
    sheen.addColorStop(0, 'rgba(255,255,220,.18)'); sheen.addColorStop(.5, 'rgba(255,255,220,0)'); sheen.addColorStop(1, 'rgba(60,10,0,.18)');
    g.fillStyle = sheen; g.fillRect(-r, -r * 1.2, r * 2, r * 2.4);
    g.restore();
    g.strokeStyle = mix(vein, '#ffffff', .2); g.globalAlpha = .55; g.lineCap = 'round';
    for (const [a, l] of lobes) {
      const ang = a - Math.PI / 2;
      g.lineWidth = size * .014; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * l * r * .92, Math.sin(ang) * l * r * .92); g.stroke();
      g.lineWidth = size * .007;
      for (const t of [.35, .6]) for (const sd of [-.5, .5]) {
        const bx = Math.cos(ang) * l * r * t, by = Math.sin(ang) * l * r * t;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ang + sd) * l * r * .25, by + Math.sin(ang + sd) * l * r * .25); g.stroke();
      }
    }
    g.globalAlpha = 1; g.strokeStyle = mix(edge, '#3a1a0a', .4); g.lineWidth = size * .018;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(size * .02, r * .55); g.stroke();
    return c;
  }
  function makeSprites(P) {
    if (P.leaves) return {
      front: P.leaves.map(([b, e, v], i) => mapleSprite(b, e, v, 64, i + 1)),
      back: P.leaves.map(([b, e, v], i) => mapleSprite(mix(b, P.backShade, .35), mix(e, P.backShade, .35), mix(v, P.backShade, .3), 64, i + 11)),
      petal: P.petals.map(([a, b], i) => mapleSprite(a, b, mix(a, '#fff2b0', .5), 48, i + 21)),
      petalBack: P.petals.map(([a, b], i) => mapleSprite(mix(a, P.backShade, .25), mix(b, P.backShade, .3), mix(a, P.backShade, .1), 48, i + 31)),
      bokeh: P.petals.map(([a, b], i) => blurred(mapleSprite(a, b, a, 64, i + 41), 4)),
    };
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
    const near = (o) => ({ depth: 6, spread: .5, droop: .1, swayAt: [1, 3], clusterR: [18 * u, 34 * u], clusterN: 20, along: 1, flower: [13 * u, 22 * u], lanterns: 0, ...o });
    const spray = (o) => near({ len: 78 * u, width: 9 * u, depth: 4, spread: .75, droop: .05, swayAt: [1], clusterR: [22 * u, 38 * u], clusterN: 24, ...o });
    const PI = Math.PI;
    return [
      near({ seed: 101, x: W + 30 * u, y: H * .34, angle: PI * .96, len: 150 * u, width: 12 * u, lanterns: 3 }),
      near({ seed: 202, x: -30 * u, y: H * .12, angle: .06, len: 150 * u, width: 11 * u, lanterns: 1 }),
      near({ seed: 404, x: W * .42, y: -40 * u, angle: PI * .5, len: 85 * u, width: 9 * u, depth: 5, spread: .65, droop: .15, swayAt: [1, 2], lanterns: 1 }),
      near({ seed: 505, x: -30 * u, y: H * .8, angle: -.38, len: 140 * u, width: 12 * u, droop: .05, bottom: true }),
      near({ seed: 606, x: W + 30 * u, y: H * .82, angle: PI + .32, len: 140 * u, width: 12 * u, droop: .06, bottom: true }),
      near({ seed: 707, x: W * .62, y: H + 30 * u, angle: -PI / 2 - .25, len: 90 * u, width: 10 * u, depth: 5, spread: .6, droop: .02, swayAt: [2], bottom: true }),
      /* corners */
      spray({ seed: 901, x: -20 * u, y: -20 * u, angle: .75 }),
      spray({ seed: 902, x: W + 20 * u, y: -20 * u, angle: PI - .75 }),
      spray({ seed: 903, x: -20 * u, y: H + 20 * u, angle: -.75, bottom: true }),
      spray({ seed: 904, x: W + 20 * u, y: H + 20 * u, angle: -PI + .75, bottom: true }),
      /* sides */
      spray({ seed: 905, x: -20 * u, y: H * .48, angle: .1 }),
      spray({ seed: 906, x: W + 20 * u, y: H * .55, angle: PI - .1 }),
      /* top and bottom edges */
      spray({ seed: 907, x: W * .2, y: -20 * u, angle: PI / 2 - .25 }),
      spray({ seed: 908, x: W * .78, y: -20 * u, angle: PI / 2 + .25, lanterns: 1 }),
      spray({ seed: 909, x: W * .14, y: H + 20 * u, angle: -PI / 2 + .25, bottom: true }),
      spray({ seed: 910, x: W * .4, y: H + 20 * u, angle: -PI / 2, bottom: true }),
      spray({ seed: 911, x: W * .86, y: H + 20 * u, angle: -PI / 2 - .25, bottom: true }),
    ];
  }
  /* softly focused trees between the far canopy and the near branches */
  function midSpecs(W, H) {
    const u = Math.min(W, H * 1.6) / 1440;
    const mid = (o) => ({ depth: 6, spread: .55, droop: .02, swayAt: [], clusterR: [22 * u, 40 * u], clusterN: 28, along: 1, flower: [7 * u, 11 * u], lanterns: 0, ...o });
    return [
      mid({ seed: 811, x: W * .42, y: H + 60 * u, angle: -Math.PI / 2 - .12, len: 170 * u, width: 30 * u }),
      mid({ seed: 822, x: W * .9, y: H + 60 * u, angle: -Math.PI / 2 - .25, len: 160 * u, width: 26 * u }),
      mid({ seed: 833, x: -40 * u, y: -20 * u, angle: .7, len: 170 * u, width: 22 * u, droop: .1 }),
      mid({ seed: 844, x: W + 40 * u, y: H * .35, angle: Math.PI + .1, len: 160 * u, width: 20 * u, droop: .08 }),
      mid({ seed: 855, x: W + 40 * u, y: -30 * u, angle: Math.PI - .8, len: 140 * u, width: 18 * u, droop: .1 }),
      mid({ seed: 866, x: -40 * u, y: H + 40 * u, angle: -.9, len: 140 * u, width: 18 * u }),
    ];
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
      /* blossom all along the limbs, so the wood mostly hides behind flowers */
      for (let k = 0; k < spec.along; k++) g.ops.push({ t: 'c', x: lerp(x, ex, .25 + R() * .6), y: lerp(y, ey, .25 + R() * .6), r: lerp(spec.clusterR[0], spec.clusterR[1], R()) * .8, n: spec.clusterN * .7 | 0, seed: R() * 1e9 | 0 });
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
    /* a tapered limb drawn as one smooth, matte filled shape */
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
    /* a couple of thin bark lines on the thick limbs */
    if (op.w0 > 10) {
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = .7;
      for (const f of [-.25, .2]) { g.beginPath(); mid.forEach(([x, y, nx, ny, w], i) => { const px = x + nx * w * f, py = y + ny * w * f; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
    }
  }
  function drawCluster(g, op, P, sp, spec) {
    const R = rng(op.seed);
    g.strokeStyle = P.bark; g.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const a = R() * TAU, l = op.r * (.3 + R() * .4);
      g.lineWidth = .6 + R() * .8;
      g.beginPath(); g.moveTo(op.x, op.y); g.lineTo(op.x + Math.cos(a) * l, op.y + Math.sin(a) * l); g.stroke();
    }
    const N = op.n;
    /* lay flowers out first, then paint the shaded underside before the sunlit top so each cluster has volume */
    const fl = [];
    for (let i = 0; i < N; i++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * op.r;
      fl.push([op.x + Math.cos(a) * rr * 1.3, op.y + Math.sin(a) * rr, R(), R(), R(), R(), R(), R()]);
    }
    fl.sort((p1, p2) => p2[1] - p1[1]);
    for (const [fx, fy, r1, r2, r3, r4, r5, r6] of fl) {
      const back = (fy - op.y) / op.r > r6 * 1.3 - .45;
      const s = lerp(spec.flower[0], spec.flower[1], Math.pow(r1, .8)) * (back ? .85 : 1) * (r2 < .1 ? .6 : 1) * (P.leafScale || 1);
      const set = back ? sp.back : sp.front, spr = set[(r3 * set.length) | 0];
      g.save(); g.translate(fx, fy); g.rotate(r4 * TAU); g.drawImage(spr, -s / 2, -s / 2, s, s); g.restore();
      if (P.bud && r5 < .07) { g.fillStyle = P.bud; g.beginPath(); g.arc(fx + (r2 - .5) * s, fy + (r6 - .5) * s, s * .16, 0, TAU); g.fill(); }
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
    const L = layout(W, H);
    const specs = treeSpecs(W, H), trees = specs.map(sp => ({ spec: sp, root: buildTree(sp) }));
    const mids = midSpecs(W, H).map(sp => ({ spec: sp, root: buildTree(sp) }));
    const blooms = []; for (const t of trees) bloomPoints(t.root, 0, 0, blooms);
    const R = rng(3);
    const stars = Array.from({ length: 300 }, () => ({ x: R() * W, y: R() * H * .8, r: Math.pow(R(), 3) * 1.5 + .35, a: .3 + R() * .7, tw: .5 + R() * 2, ph: R() * TAU }))
      .filter(s => Math.hypot(s.x - L.moonX, s.y - L.moonY) > H * .07);
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: R() * W * 1.2 - W * .1, y: H * (.05 + R() * .26), w: W * (.16 + R() * .14), h: H * (.07 + R() * .05), v: 3 + R() * 6, seed: 500 + i, a: .75 + R() * .25 }));
    S = { L, trees, mids, blooms, stars, clouds, petals: S ? S.petals : [], birds: [], nextBirds: 8, px: 0, py: 0 };
    builtKey = '';
  }
  function buildLook() {
    const P = (opts.season === 'autumn' ? PAL_AUTUMN : PAL)[opts.mode], n = night(), L = S.L;
    S.P = P; S.sp = makeSprites(P);
    S.sky = paintSky(L, P, q, n, opts.orb);
    S.far = paintFar(L, P, q, n && opts.orb);
    S.fore = paintFore(L, P, q, S.sp);
    S.ray = raySprite(P.ray);
    S.mid = paintMid(L, P, q, S.sp, S.mids);
    if (n && opts.orb) for (const c of [S.far, S.mid]) { /* a soft opening in the canopy where the moon shows through */
      const g = c.getContext('2d'); g.setTransform(q, 0, 0, q, 0, 0); g.globalCompositeOperation = 'destination-out';
      const hole = g.createRadialGradient(L.moonX, L.moonY, 0, L.moonX, L.moonY, H * .2);
      hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(.45, 'rgba(0,0,0,.95)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hole; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    }
    for (const c of S.clouds) c.sprite = cloudSprite(c.w, c.h, P, c.seed, false);
    for (const t of S.trees) renderGroup(t.root, t.spec, P, S.sp, q, n && opts.lanterns);
    builtKey = `${W}x${H}:${opts.season}:${opts.mode}:${n && opts.lanterns}:${opts.orb}`;
  }

  function spawnPetal(anywhere) {
    const sp = S.sp, k = (Math.random() * sp.petal.length) | 0;
    const z = Math.random() < .12 ? rand(1.4, 2) : rand(.35, 1.15);
    const leafy = opts.season === 'autumn';
    const p = { k, z, s: rand(10, 17) * z * (leafy ? 2.3 : 1), rot: rand(0, TAU), rs: rand(-2.5, 2.5), flip: rand(0, TAU), fs: rand(1.5, 4.5), vx: 0, vy: 0, wf: rand(.6, 1.6), ph: rand(0, TAU), fall: rand(26, 52) * (.55 + .5 * z), bokeh: z > 1.35 };
    if (anywhere) { p.x = rand(-20, W + 20); p.y = rand(-20, H); }
    else if (Math.random() < .62 && S.blooms.length) {
      const b = S.blooms[(Math.random() * S.blooms.length) | 0];
      p.x = b[0] + rand(-b[2], b[2]); p.y = b[1] + rand(-b[2], b[2]) * .7;
    } else if (Math.random() < .5) { p.x = rand(-W * .2, W); p.y = -20; }
    else { p.x = -20; p.y = rand(0, H * .6); }
    S.petals.push(p);
  }
  function target() { return Math.round(clamp(opts.petals, 0, 300) / 100 * 280 * Math.sqrt(W * H / (1440 * 900))); }

  let pointerX = 0, pointerY = 0;
  function step(dt, t) {
    const w = clamp(opts.wind, 0, 100) / 100;
    const tx = opts.parallax ? pointerX : 0, ty = opts.parallax ? pointerY : 0;
    S.px += (tx - S.px) * Math.min(1, dt * 2.5); S.py += (ty - S.py) * Math.min(1, dt * 2.5);
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
  function drawPetal(g, p, dx, dy) {
    const sp = S.sp, c = Math.cos(p.flip), sx = Math.max(.12, Math.abs(c)), cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    g.setTransform(q * cr * sx, q * sr * sx, -q * sr, q * cr, q * (p.x + dx * p.z), q * (p.y + dy * p.z));
    if (p.bokeh) { const s = p.s * 2.4; g.globalAlpha = .55; g.drawImage(sp.bokeh[p.k % sp.bokeh.length], -s / 2, -s / 2, s, s); }
    else { g.globalAlpha = p.z < .45 ? .55 : p.z < .6 ? .75 : 1; g.drawImage((c >= 0 ? sp.petal : sp.petalBack)[p.k % sp.petal.length], -p.s / 2, -p.s / 2, p.s, p.s); }
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
    if (!n && S.birds.length) {
      g.strokeStyle = 'rgba(40,40,60,.55)'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (const b of S.birds) {
        const f = Math.sin(t * 9 + b.ph) * b.s * .6;
        g.beginPath(); g.moveTo(b.x - b.s, b.y - f); g.quadraticCurveTo(b.x - b.s * .4, b.y - b.s * .3, b.x, b.y);
        g.quadraticCurveTo(b.x + b.s * .4, b.y - b.s * .3, b.x + b.s, b.y - f); g.stroke();
      }
    }
    /* depth: each layer drifts on its own, and shifts with the pointer by how close it is */
    const mx = S.px, my = S.py;
    g.drawImage(S.far, -12 + Math.sin(t * .05) * 5 - mx * 4, -10 + Math.cos(t * .043) * 4 - my * 3, W + 24, H + 20);
    for (const p of S.petals) if (p.z < .45) drawPetal(g, p, -mx * 8, -my * 6);
    g.setTransform(q, 0, 0, q, 0, 0);
    g.drawImage(S.mid, -14 + Math.sin(t * .09 + 1) * 4 - mx * 10, -12 + Math.cos(t * .07) * 3 - my * 7, W + 28, H + 24);
    /* soft shafts of light falling through the canopy */
    if (opts.rays) {
      g.globalCompositeOperation = n ? 'screen' : 'lighter';
      const rays = [[.22, -.05, .5, .17], [.38, -.08, .44, .12], [.6, -.05, .38, .1], [.12, -.06, .56, .09]];
      for (const [fx, fy, ang, a] of rays) {
        const ox = n ? (S.L.moonX - W * .4) : 0;
        g.setTransform(q, 0, 0, q, 0, 0); g.translate(fx * W + ox - mx * 6, fy * H); g.rotate(ang);
        g.globalAlpha = a * (n ? .7 : 1) * (.65 + .35 * Math.sin(t * .23 + fx * 9));
        g.drawImage(S.ray, -W * .06, 0, W * .12, H * 1.25);
      }
      g.setTransform(q, 0, 0, q, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    const swayK = opts.sway ? .35 + 1.3 * clamp(opts.wind, 0, 100) / 100 : 0;
    for (const p of S.petals) if (p.z >= .45 && p.z < .6) drawPetal(g, p, -mx * 12, -my * 9);
    g.setTransform(q, 0, 0, q, -mx * 18 * q, -my * 13 * q);
    for (const tr of S.trees) if (tr.spec.bottom) drawGroup(g, tr.root, t, swayK);
    for (const tr of S.trees) if (!tr.spec.bottom) drawGroup(g, tr.root, t, swayK);
    for (const p of S.petals) if (p.z >= .6) drawPetal(g, p, -mx * 20, -my * 15);
    g.setTransform(q, 0, 0, q, 0, 0); g.globalAlpha = 1;
    /* closest of all: out-of-focus blossom right in front of the eye */
    g.drawImage(S.fore, -40 + Math.sin(t * .3) * 6 - mx * 36, -30 + Math.cos(t * .26) * 4 - my * 26, W + 80, H + 60);
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
    window.addEventListener('pointermove', e => { pointerX = e.clientX / W * 2 - 1; pointerY = e.clientY / H * 2 - 1; }, { passive: true });
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
      if (builtKey !== `${W}x${H}:${opts.season}:${opts.mode}:${night() && opts.lanterns}:${opts.orb}`) { buildLook(); prefill(); }
      if (!raf) once();
    },
  };
})();
