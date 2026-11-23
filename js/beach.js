/* Chronos — "Beach" scene.

   A Hawaiian beach, painted entirely in code:
   - sky with drifting cumulus, a green headland and a far island on the horizon,
   - turquoise water deepening to blue, wave crests rolling in, sun or moon glitter on the water,
   - waves that break on the shore, wash up the sand, slide back and leave a band of wet sand,
   - lava rocks at the waterline with foam swirling around them, footprints and shells in the sand,
   - palm trees whose fronds are built from hundreds of leaflets that sway and flutter in the wind,
   - hibiscus bushes in the corners with big flowers and glossy leaves that move in the breeze.
   Day, Sunset (the sun setting into the ocean) and Night (moon, stars, glowing surf and tiki torches).

   Static layers are painted once into offscreen canvases; each frame moves them, rolls the waves and redraws
   the palm fronds. It pauses in background tabs and draws one still frame for reduced motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2, DOWN = Math.PI / 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);
  const DEFAULTS = { mode: 'day', wind: 40, waves: 50, brightness: 100, clouds: true, flowers: true, birds: true, torches: true, parallax: true };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function noise1(seed) {
    const R = rng(seed), v = Float32Array.from({ length: 256 }, () => R());
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(v[i & 255], v[(i + 1) & 255], u); };
  }
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const angleDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(lerp(v, hexRgb(b)[i], t)).toString(16).padStart(2, '0')).join('');
  const rgb = h => hexRgb(h).join(',');
  const canFilter = (() => { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();

  /* ============================================================
     Palettes
     ============================================================ */
  const PAL = {
    day: {
      sky: [[0, '#1b62c6'], [.42, '#3c95e0'], [.78, '#8fcaef'], [1, '#d6eef6']],
      cloudLit: '255,255,255', cloudShade: '186,206,232', cloudWarm: '255,248,238', below: false,
      mtnFar: '#7ea6b5', mtnNear: '#2c6a38', jungle: ['#2e7d32', '#3d8d38', '#56a43e', '#1e5b2a', '#7bb948'], haze: '196,226,240', hazeA: .3,
      sea: [[0, '#15579d'], [.22, '#1971b6'], [.55, '#129cc1'], [.82, '#2ec5c4'], [1, '#8be0d2']],
      reef: '14,90,108', shallow: '150,232,222', streak: '255,255,255', foam: '255,255,255', glint: '255,252,235',
      sand: ['#f2dfb9', '#e9cf9e', '#d9b780'], wet: '112,80,44', grain: '120,88,48',
      rock: '#38332e', rockLit: '#6c645b',
      frond: ['#1a5222', '#2f7f2a', '#76b545', '#a89a52'], rachis: '#8e9c3e',
      trunk: ['#6a4e34', '#a57b50', '#d6b088'], nut: '#6c782c',
      tint: null, tintAmt: 0, gull: 'light',
    },
    sunset: {
      sky: [[0, '#28356f'], [.32, '#6a4793'], [.58, '#dd6d89'], [.82, '#ffa155'], [1, '#ffd178']],
      cloudLit: '255,176,118', cloudShade: '104,66,116', cloudWarm: '255,132,116', below: true,
      mtnFar: '#76507a', mtnNear: '#2b3732', jungle: ['#2c4a2c', '#3b5a30', '#4e6a34', '#21362a', '#6c7a3c'], haze: '240,150,130', hazeA: .32,
      sea: [[0, '#e3937c'], [.1, '#a87092'], [.32, '#4a6aa0'], [.6, '#2a86a8'], [.85, '#2a9fae'], [1, '#77c9bd']],
      reef: '40,60,90', shallow: '255,190,150', streak: '255,214,170', foam: '255,238,220', glint: '255,206,130',
      sand: ['#ebc79b', '#dba97a', '#c28c61'], wet: '90,52,40', grain: '110,66,44',
      rock: '#2a2224', rockLit: '#7a5248',
      frond: ['#16321e', '#2a4f28', '#61803a', '#a8864a'], rachis: '#6f6a34',
      trunk: ['#43301f', '#7a5436', '#c78c5a'], nut: '#4d4a24',
      tint: '#ff8a5a', tintAmt: .14, gull: 'dark',
    },
    night: {
      sky: [[0, '#020614'], [.5, '#091936'], [.85, '#132d55'], [1, '#1c3c62']],
      cloudLit: '118,138,186', cloudShade: '20,30,56', cloudWarm: '86,104,150', below: false,
      mtnFar: '#142339', mtnNear: '#0a181c', jungle: ['#0d2820', '#113126', '#163b2e', '#091e18', '#1d4836'], haze: '30,50,82', hazeA: .3,
      sea: [[0, '#0a1a38'], [.4, '#0b2848'], [.8, '#0e3d53'], [1, '#195464']],
      reef: '4,14,26', shallow: '80,170,190', streak: '170,205,255', foam: '160,235,255', glint: '220,232,255',
      sand: ['#4b4c5c', '#3b3c4c', '#2b2c3a'], wet: '14,14,22', grain: '10,10,18',
      rock: '#121418', rockLit: '#3e4a5e',
      frond: ['#06130d', '#0c2517', '#1d462e', '#2a4a34'], rachis: '#18362a',
      trunk: ['#14110e', '#28231d', '#4a4438'], nut: '#141a10',
      tint: '#0e1a33', tintAmt: .52, gull: 'none',
    },
  };
  const FLOWERS = [
    { petal: '#ff8d69', edge: '#ffc3a0', eye: '#c42853', pollen: '#ffe27a', stigma: '#a8123c' }, /* coral */
    { petal: '#e6243a', edge: '#ff5c62', eye: '#6c0820', pollen: '#ffd23f', stigma: '#560716' }, /* red */
    { petal: '#ff5b97', edge: '#ffadcf', eye: '#990e46', pollen: '#ffe066', stigma: '#780a34' }, /* pink */
    { petal: '#ffcd3c', edge: '#fff0a4', eye: '#c6184e', pollen: '#fff3b0', stigma: '#a0123e' }, /* yellow */
  ];

  /* ============================================================
     Layout
     ============================================================ */
  function layout(W, H, mode) {
    const u = Math.min(W, H * 1.6) / 1440, horizon = H * .52, n = noise1(5);
    const shore = x => H * (.705 + .05 * (x / W)) + (n(x * .006) - .5) * H * .022;
    let mn = Infinity, mx = -Infinity;
    for (let x = -60; x <= W + 60; x += 4) { const y = shore(x); mn = Math.min(mn, y); mx = Math.max(mx, y); }
    const light = mode === 'sunset' ? [W * .6, horizon - H * .028] : mode === 'night' ? [W * .6, H * .14] : [W * .1, -H * .12];
    return { W, H, u, horizon, shore, shoreMin: mn, shoreMax: mx, pad: 44, lx: light[0], ly: light[1] };
  }
  /* A canvas covering part of the world, with its context already transformed to world coordinates */
  function layer(x0, y0, w, h, qs) {
    const c = makeCanvas(w * qs, h * qs), g = c.getContext('2d');
    g.setTransform(qs, 0, 0, qs, -x0 * qs, -y0 * qs);
    return { c, g, x0, y0, w, h, qs };
  }
  const put = (g, l, dx, dy) => g.drawImage(l.c, l.x0 + dx, l.y0 + dy, l.w, l.h);

  /* ============================================================
     Sky, headland, sea, sand, rocks
     ============================================================ */
  function paintSky(L, P, mode, qs) {
    const { W, H, pad } = L, h = L.horizon + pad + 6;
    const l = layer(-pad, -pad, W + pad * 2, h, qs), g = l.g;
    const grd = g.createLinearGradient(0, -pad, 0, L.horizon + 4);
    for (const [s, c] of P.sky) grd.addColorStop(s, c);
    g.fillStyle = grd; g.fillRect(-pad, -pad, W + pad * 2, h);
    const glow = (x, y, r, col, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(-pad, -pad, W + pad * 2, h);
    };
    if (mode === 'day') {
      glow(L.lx, L.ly, W * .75, '255,252,236', .6);
      const hz = g.createLinearGradient(0, L.horizon - H * .15, 0, L.horizon);
      hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(255,255,255,.42)');
      g.fillStyle = hz; g.fillRect(-pad, 0, W + pad * 2, h);
    } else if (mode === 'sunset') {
      glow(L.lx, L.ly, H * .95, '255,140,90', .5);
      glow(L.lx, L.ly, H * .28, '255,222,150', .8);
      const r = H * .05;
      g.save(); g.shadowColor = 'rgba(255,205,120,1)'; g.shadowBlur = r * 1.2;
      const d = g.createRadialGradient(L.lx, L.ly, 0, L.lx, L.ly, r);
      d.addColorStop(0, '#fffbe8'); d.addColorStop(.7, '#ffe7a2'); d.addColorStop(1, '#ffc066');
      g.fillStyle = d; g.beginPath(); g.arc(L.lx, L.ly, r, 0, TAU); g.fill(); g.restore();
      /* thin bands of cloud near the horizon, lit along their lower edge */
      const R = rng(71);
      if (canFilter) g.filter = `blur(${(2.2 * qs).toFixed(1)}px)`;
      for (let i = 0; i < 16; i++) {
        const y = L.horizon - H * (.025 + R() * .17), x = R() * W, w = W * (.1 + R() * .3), hh = H * (.005 + R() * .011);
        g.fillStyle = `rgba(104,48,88,${(.25 + R() * .3).toFixed(2)})`;
        g.beginPath(); g.ellipse(x, y, w / 2, hh, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(255,172,112,${(.35 + R() * .35).toFixed(2)})`;
        g.beginPath(); g.ellipse(x, y + hh * .6, w / 2 * .9, hh * .45, 0, 0, TAU); g.fill();
      }
      g.filter = 'none';
    } else {
      glow(L.lx, L.ly, H * .6, '170,190,255', .22);
      const mr = Math.min(W, H) * .04;
      g.save(); g.shadowColor = 'rgba(225,232,255,.9)'; g.shadowBlur = mr * 1.3;
      const d = g.createRadialGradient(L.lx - mr * .3, L.ly - mr * .3, 0, L.lx, L.ly, mr);
      d.addColorStop(0, '#fffef6'); d.addColorStop(.8, '#eeeedf'); d.addColorStop(1, '#d6d6c8');
      g.fillStyle = d; g.beginPath(); g.arc(L.lx, L.ly, mr, 0, TAU); g.fill(); g.restore();
      const R = rng(9);
      for (let i = 0; i < 7; i++) {
        const a = R() * TAU, dd = R() * mr * .6, rr = mr * (.12 + R() * .2);
        g.fillStyle = 'rgba(150,150,140,.16)'; g.beginPath(); g.arc(L.lx + Math.cos(a) * dd, L.ly + Math.sin(a) * dd, rr, 0, TAU); g.fill();
      }
      const hz = g.createLinearGradient(0, L.horizon - H * .2, 0, L.horizon);
      hz.addColorStop(0, 'rgba(60,90,150,0)'); hz.addColorStop(1, 'rgba(60,90,150,.28)');
      g.fillStyle = hz; g.fillRect(-pad, 0, W + pad * 2, h);
    }
    return l;
  }

  function tinyPalm(g, x, y, s, col) {
    g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = s * .09;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * .15, y - s * .5, x + s * .08, y - s); g.stroke();
    const cx = x + s * .08, cy = y - s;
    g.lineWidth = s * .06;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + k / 6 * Math.PI, ex = cx + Math.cos(a) * s * .55, ey = cy + Math.sin(a) * s * .25 + s * .2;
      g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * s * .35, cy - s * .12, ex, ey); g.stroke();
    }
  }
  function paintLand(L, P, mode, qs) {
    const { W, H, pad, u } = L, top = L.horizon - H * .24;
    const l = layer(-pad, top, W + pad * 2, L.horizon - top + 4, qs); let g = l.g;
    const n1 = noise1(31), n2 = noise1(37), R = rng(41);
    const hump = (x, c, w, h) => { const d = (x - c) / w; return d * d < 1 ? h * Math.pow(1 - d * d, .8) : 0; };
    const ridge = (fn, col) => {
      const p = new Path2D(); p.moveTo(-pad, L.horizon + 2);
      for (let x = -pad; x <= W + pad; x += 3) p.lineTo(x, L.horizon - fn(x));
      p.lineTo(W + pad, L.horizon + 2); p.closePath();
      g.fillStyle = col; g.fill(p); return p;
    };
    const canopy = (path, fn, x0, x1, count, size, light) => {
      const tmp = layer(l.x0, l.y0, l.w, l.h, qs), og = g; g = tmp.g;
      for (let i = 0; i < count; i++) {
        const x = lerp(x0, x1, R()), top = fn(x); if (top < 2) continue;
        const y = L.horizon - top * Math.pow(R(), .5), r = size * (.5 + R());
        const lit = (L.horizon - y) / top > .6 ? R() < light : R() < light * .4;
        g.fillStyle = P.jungle[lit ? (R() < .5 ? 2 : 4) : ((R() * 2) | 0) * 3 % 4];
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      g = og; g.save(); g.clip(path); g.setTransform(1, 0, 0, 1, 0, 0);
      if (canFilter) g.filter = `blur(${(1.1 * qs).toFixed(1)}px)`;
      g.globalAlpha = .9; g.drawImage(tmp.c, 0, 0); g.globalAlpha = 1; g.filter = 'none';
      g.restore();
    };
    /* the far mountains, then the green headland in front of them */
    const far = x => (Math.max(hump(x, W * .17, W * .3, H * .2), hump(x, W * .02, W * .2, H * .15)) * (.85 + .15 * n1(x * .01)));
    const pf = ridge(far, P.mtnFar);
    canopy(pf, far, -pad, W * .5, 2600, 1.8 * u, .4);
    g.save(); g.clip(pf); g.fillStyle = `rgba(${P.haze},${P.hazeA * 1.6})`; g.fillRect(-pad, top, W, H); g.restore();
    const near = x => Math.max(hump(x, W * .07, W * .33, H * .12), hump(x, W * .3, W * .15, H * .045)) * (.82 + .18 * n2(x * .02));
    const pn = ridge(near, P.mtnNear);
    canopy(pn, near, -pad, W * .48, 7000, 2.6 * u, .55);
    g.save(); g.clip(pn);
    const sh = g.createLinearGradient(0, L.horizon - H * .12, 0, L.horizon);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,10,0,.25)');
    g.fillStyle = sh; g.fillRect(-pad, top, W, H);
    g.fillStyle = `rgba(${P.haze},${P.hazeA})`; g.fillRect(-pad, top, W, H);
    g.restore();
    /* a few palms along the ridge */
    for (const fx of [.03, .07, .12, .2, .26, .31, .34]) {
      const x = W * fx, y = L.horizon - near(x) + 2;
      if (near(x) > H * .02) tinyPalm(g, x, y, (14 + R() * 8) * u, mix(P.mtnNear, '#000000', .2));
    }
    /* a far island on the right */
    const isl = x => hump(x, W * .86, W * .09, H * .02) + hump(x, W * .93, W * .05, H * .011);
    ridge(isl, mix(P.mtnFar, P.sky[P.sky.length - 1][1], .35));
    /* surf at the foot of the headland */
    g.fillStyle = mode === 'night' ? 'rgba(160,220,255,.25)' : 'rgba(255,255,255,.6)';
    for (let x = -pad; x < W * .46; x += 3) if (near(x) > 1) g.fillRect(x, L.horizon - .6 - R() * .8, 3, .8 + R() * .8);
    return l;
  }

  function paintSea(L, P, mode, qs) {
    const { W, H, pad, u } = L, bottom = L.shoreMax + 10;
    const l = layer(-pad, L.horizon - 1, W + pad * 2, bottom - L.horizon + 1, qs), g = l.g;
    const grd = g.createLinearGradient(0, L.horizon, 0, L.shoreMax);
    for (const [s, c] of P.sea) grd.addColorStop(s, c);
    g.fillStyle = grd; g.fillRect(-pad, L.horizon - 1, W + pad * 2, bottom - L.horizon + 1);
    /* reefs and sandy patches seen through the water */
    const R = rng(19);
    if (canFilter) g.filter = `blur(${Math.round(5 * qs)}px)`;
    for (let i = 0; i < 90; i++) {
      const k = .3 + R() * .68, y = lerp(L.horizon, L.shoreMin, k * k), x = R() * (W + pad * 2) - pad;
      const w = (30 + R() * 130) * (.3 + k) * u, h = w * (.07 + .08 * k);
      g.fillStyle = R() < .62 ? `rgba(${P.reef},${(.12 + R() * .2).toFixed(2)})` : `rgba(${P.shallow},${(.08 + R() * .14).toFixed(2)})`;
      g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill();
    }
    g.filter = 'none';
    /* shallow water brightens over the sand at the edge */
    for (let x = -pad; x < W + pad; x += 6) {
      const y1 = L.shore(x), y0 = y1 - H * .045, gr = g.createLinearGradient(0, y0, 0, y1 + 2);
      gr.addColorStop(0, `rgba(${P.shallow},0)`); gr.addColorStop(1, `rgba(${P.shallow},.55)`);
      g.fillStyle = gr; g.fillRect(x, y0, 6.5, y1 - y0 + 4);
    }
    g.fillStyle = `rgba(255,255,255,${mode === 'night' ? .08 : .22})`; g.fillRect(-pad, L.horizon, W + pad * 2, 1.2);
    return l;
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

  function paintSand(L, P, mode, qs, flowerSpr) {
    const { W, H, pad, u } = L, top = L.shoreMin - 4;
    const l = layer(-pad, top, W + pad * 2, H + pad - top, qs), g = l.g;
    const path = new Path2D(); path.moveTo(-pad, H + pad);
    for (let x = -pad; x <= W + pad; x += 4) path.lineTo(x, L.shore(x));
    path.lineTo(W + pad, H + pad); path.closePath();
    const grd = g.createLinearGradient(0, L.shoreMin, 0, H);
    P.sand.forEach((c, i) => grd.addColorStop(i / (P.sand.length - 1), c));
    g.fillStyle = grd; g.fill(path);
    g.save(); g.clip(path);
    /* damp sand along the waterline */
    for (let x = -pad; x < W + pad; x += 6) {
      const y0 = L.shore(x), gr = g.createLinearGradient(0, y0, 0, y0 + H * .045);
      gr.addColorStop(0, `rgba(${P.wet},.38)`); gr.addColorStop(1, `rgba(${P.wet},0)`);
      g.fillStyle = gr; g.fillRect(x, y0 - 2, 6.5, H * .05);
    }
    const R = rng(61);
    /* wind ripples */
    for (let i = 0; i < 70; i++) {
      const y = lerp(L.shoreMax + H * .03, H, R()), x = R() * W, w = (40 + R() * 160) * u * (.5 + (y - L.shoreMin) / H);
      g.lineWidth = 1.2 * u;
      g.strokeStyle = `rgba(${P.grain},.09)`; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - 4 * u, x + w / 2, y + 1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(x - w / 2, y + 1.5 * u); g.quadraticCurveTo(x, y - 2.5 * u, x + w / 2, y + 2.5 * u); g.stroke();
    }
    /* grain */
    const N = Math.round(W * (H - L.shoreMin) / 30);
    for (let i = 0; i < N; i++) {
      const x = R() * (W + pad * 2) - pad, y = L.shoreMin + R() * (H + pad - L.shoreMin), dark = R() < .55, s = .7 + R() * 1.3;
      g.fillStyle = dark ? `rgba(${P.grain},${(.05 + R() * .1).toFixed(3)})` : `rgba(255,255,255,${(.05 + R() * .13).toFixed(3)})`;
      g.fillRect(x, y, s, s);
    }
    /* a line of footprints wandering down to the water */
    let fx = W * .5, fy = H + 10;
    for (let i = 0; fy > L.shore(fx) + H * .05; i++) {
      const k = (fy - L.shoreMin) / (H - L.shoreMin), s = (.5 + .6 * k) * u, side = i % 2 ? 1 : -1, a = -1.15 + Math.sin(i * .3) * .15;
      const px = fx + side * 9 * s, py = fy;
      g.save(); g.translate(px, py); g.rotate(a + Math.PI / 2);
      g.fillStyle = `rgba(${P.grain},.2)`; g.beginPath(); g.ellipse(0, 0, 4.5 * s, 10 * s, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(1.2 * s, 1.2 * s, 3.5 * s, 8.5 * s, 0, 0, TAU); g.fill();
      g.restore();
      fx += Math.cos(a) * 26 * s; fy += Math.sin(a) * 26 * s;
    }
    /* shells */
    for (let i = 0; i < 18; i++) {
      const x = R() * W, y = lerp(L.shoreMax + 10, H, R()), s = (3 + R() * 4) * u * (.6 + (y - L.shoreMin) / H);
      g.save(); g.translate(x, y); g.rotate(R() * TAU);
      g.fillStyle = R() < .5 ? 'rgba(255,240,225,.85)' : 'rgba(250,200,190,.85)';
      g.beginPath(); g.moveTo(0, s); g.arc(0, 0, s, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,110,90,.4)'; g.lineWidth = .6;
      for (let k = 0; k < 4; k++) { const a = Math.PI * (1.2 + k * .16); g.beginPath(); g.moveTo(0, s * .9); g.lineTo(Math.cos(a) * s, Math.sin(a) * s); g.stroke(); }
      g.restore();
    }
    /* a hibiscus that has fallen on the sand */
    if (flowerSpr) {
      const x = W * .4, y = H * .925, s = 64 * u;
      g.save(); g.translate(x, y); g.scale(1, .55); g.rotate(.6);
      g.drawImage(flowerSpr, -s / 2, -s / 2, s, s); g.restore();
    }
    /* shade from the palm leaning over the beach */
    if (mode !== 'night') {
      const sx = W * .74, sy = H * .9, gr = g.createRadialGradient(sx, sy, 0, sx, sy, W * .12);
      gr.addColorStop(0, `rgba(${P.grain},.18)`); gr.addColorStop(1, `rgba(${P.grain},0)`);
      g.save(); g.translate(sx, sy); g.scale(1, .22); g.translate(-sx, -sy); g.fillStyle = gr; g.fillRect(sx - W * .12, sy - W * .12, W * .24, W * .24); g.restore();
    }
    g.restore();
    return l;
  }

  function drawRock(g, x, y, r, P, seed) {
    const n = noise1(seed), R = rng(seed);
    g.fillStyle = 'rgba(0,0,0,.24)'; g.beginPath(); g.ellipse(x + r * .2, y + r * .04, r * 1.25, r * .26, 0, 0, TAU); g.fill();
    const pts = [];
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * TAU, flat = Math.sin(a) > 0 ? .55 : 1, rr = r * (.78 + .38 * n(i * .55 + seed));
      pts.push([x + Math.cos(a) * rr * 1.15, y - r * .45 + Math.sin(a) * rr * .85 * flat]);
    }
    const p = new Path2D(); p.moveTo((pts[0][0] + pts[29][0]) / 2, (pts[0][1] + pts[29][1]) / 2);
    for (let i = 0; i < 30; i++) { const a = pts[i], b = pts[(i + 1) % 30]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    const grd = g.createLinearGradient(x - r, y - r * 1.2, x + r * .6, y);
    grd.addColorStop(0, P.rockLit); grd.addColorStop(.55, P.rock); grd.addColorStop(1, mix(P.rock, '#000000', .3));
    g.fillStyle = grd; g.fill(p);
    g.save(); g.clip(p);
    for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(x + (R() - .5) * r * 2, y - r * .45 + (R() - .5) * r * 1.2, r * (.03 + R() * .05), 0, TAU); g.fill(); }
    const wet = g.createLinearGradient(0, y - r * .25, 0, y + 2);
    wet.addColorStop(0, 'rgba(0,0,0,0)'); wet.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = wet; g.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 2);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = Math.max(1, r * .05);
    g.beginPath(); for (let i = 16; i < 27; i++) { const a = pts[i]; i === 16 ? g.moveTo(a[0], a[1]) : g.lineTo(a[0], a[1]); } g.stroke();
  }
  function paintRocks(L, P, qs, rocks) {
    const { W, H, pad } = L, top = L.horizon + 2;
    const l = layer(-pad, top, W + pad * 2, H + pad - top, qs);
    for (const r of rocks) drawRock(l.g, r.x, r.y, r.r, P, r.seed);
    return l;
  }

  /* ============================================================
     Palm trees
     ============================================================ */
  function palmSpecs(L) {
    const { W, H, u } = L;
    return [
      { near: true, base: [W + 70 * u, H * 1.05], ctrl: [W * 1.0, H * .42], crown: [W * .865, H * .07], w0: 52 * u, w1: 26 * u, n: 21, len: H * .44, curl: 1, leaf: 92 * u, rw: 4.5 * u, steps: 44, seed: 11, nut: 13 * u },
      { near: true, base: [-90 * u, H * .68], ctrl: [-W * .005, H * .2], crown: [W * .085, H * .035], w0: 46 * u, w1: 24 * u, n: 19, len: H * .4, curl: 1, leaf: 84 * u, rw: 4 * u, steps: 42, seed: 23, nut: 12 * u },
      { near: false, base: [W * .72, L.shore(W * .72) + H * .13], ctrl: [W * .7, H * .7], crown: [W * .6, H * .6], w0: 17 * u, w1: 9 * u, n: 15, len: H * .15, curl: .9, leaf: 32 * u, rw: 2 * u, steps: 26, seed: 37, nut: 4.5 * u },
    ];
  }
  function makeFronds(spec) {
    const R = rng(spec.seed), out = [];
    for (let i = 0; i < spec.n; i++) {
      const a0 = i / spec.n * TAU + R() * .35, up = Math.max(0, -Math.sin(a0));
      const f = {
        a0, len: spec.len * (.78 + R() * .3) * (1 - .32 * up), curl: spec.curl * (.75 + R() * .5), leaf: spec.leaf * (.85 + R() * .3),
        w: spec.rw * (.8 + R() * .4), fq: .55 + R() * .5, ph: R() * TAU, ph2: R() * TAU, gdir: Math.sin(a0) < 0 ? 1 : -1,
        rnd: Float32Array.from({ length: 128 }, () => R()),
      };
      f.lit = Math.sin(a0 + 1) < Math.sin(a0 - 1) ? 1 : -1;
      f.back = Math.sin(a0) < -.25; f.mid = !f.back && Math.sin(a0) < .3;
      out.push(f);
    }
    out.sort((p1, p2) => Math.sin(p1.a0) - Math.sin(p2.a0));
    return out;
  }
  const bez = (p0, p1, p2, t) => { const it = 1 - t; return [it * it * p0[0] + 2 * it * t * p1[0] + t * t * p2[0], it * it * p0[1] + 2 * it * t * p1[1] + t * t * p2[1]]; };
  function paintTrunk(g, s, P, L) {
    const N = 70, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, [x, y] = bez(s.base, s.ctrl, s.crown, t), [x2, y2] = bez(s.base, s.ctrl, s.crown, Math.min(1, t + .01)), [x1, y1] = bez(s.base, s.ctrl, s.crown, Math.max(0, t - .01));
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const w = lerp(s.w0, s.w1, Math.pow(t, .8)) * (1 + .12 * Math.exp(-t * 14)) / 2;
      pts.push({ x, y, nx: -dy / len, ny: dx / len, w });
    }
    const litLeft = L.lx < s.crown[0];
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[i + 1];
      const lx = a.x + a.nx * a.w, ly = a.y + a.ny * a.w, rx = a.x - a.nx * a.w, ry = a.y - a.ny * a.w;
      const gr = g.createLinearGradient(lx, ly, rx, ry), [d, m, li] = P.trunk;
      if (litLeft === (a.nx < 0)) { gr.addColorStop(0, li); gr.addColorStop(.4, m); gr.addColorStop(1, d); }
      else { gr.addColorStop(0, d); gr.addColorStop(.6, m); gr.addColorStop(1, li); }
      g.fillStyle = gr; g.strokeStyle = gr; g.lineWidth = .8;
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(b.x + b.nx * b.w, b.y + b.ny * b.w); g.lineTo(b.x - b.nx * b.w, b.y - b.ny * b.w); g.lineTo(rx, ry); g.closePath(); g.fill(); g.stroke();
    }
    /* growth rings */
    let acc = 0;
    for (let i = 1; i <= N; i++) {
      const a = pts[i], p0 = pts[i - 1]; acc += Math.hypot(a.x - p0.x, a.y - p0.y);
      if (acc < a.w * .55) continue;
      acc = 0;
      const tx = -a.ny, ty = a.nx, bow = a.w * .35;
      g.lineWidth = Math.max(.8, a.w * .07);
      g.strokeStyle = 'rgba(30,18,8,.35)';
      g.beginPath(); g.moveTo(a.x + a.nx * a.w, a.y + a.ny * a.w); g.quadraticCurveTo(a.x + tx * bow, a.y + ty * bow, a.x - a.nx * a.w, a.y - a.ny * a.w); g.stroke();
      g.strokeStyle = 'rgba(255,236,200,.12)';
      g.beginPath(); g.moveTo(a.x + a.nx * a.w - tx * 2, a.y + a.ny * a.w - ty * 2); g.quadraticCurveTo(a.x + tx * (bow - 2), a.y + ty * (bow - 2), a.x - a.nx * a.w - tx * 2, a.y - a.ny * a.w - ty * 2); g.stroke();
    }
    /* the fibrous collar where the fronds start */
    const c = pts[N], R = rng(s.seed + 5);
    g.strokeStyle = mix(P.trunk[0], '#000000', .25); g.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      const a = R() * TAU, l = s.w1 * (.5 + R() * .7);
      g.lineWidth = Math.max(1, s.w1 * .06);
      g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + Math.cos(a) * l, c.y + Math.sin(a) * l * .7 + l * .2); g.stroke();
    }
  }
  function drawFrond(g, f, cx, cy, t, windK, gustK, P, steps, cols) {
    const sway = windK * (.05 * Math.sin(t * f.fq + f.ph) + .025 * Math.sin(t * f.fq * 2.3 + f.ph2)) + gustK * .1 * f.gdir + .012 * Math.sin(t * .7 + f.ph);
    let h = f.a0 + sway, x = cx, y = cy;
    const ds = f.len / steps, curl = f.curl * (1 - .18 * gustK), flut = windK * .09 + .02;
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], rach = [x, y];
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      h += angleDiff(DOWN, h) * curl * (.25 + 1.5 * s) * 1.25 / steps;
      x += Math.cos(h) * ds; y += Math.sin(h) * ds;
      rach.push(x, y);
      if (s < .05) continue;
      for (let side = -1; side <= 1; side += 2) {
        const r = f.rnd[(i * 2 + (side > 0 ? 1 : 0)) & 127];
        if (r < .035) continue; /* a gap where a leaflet has torn */
        const l = f.leaf * Math.sin(Math.PI * Math.pow(s, .7)) * (.8 + .35 * r) + 2;
        let th = h + side * (1.2 - .5 * s) + Math.sin(t * (2.2 + r * 2.5) + i * .55 + f.ph) * flut;
        th += angleDiff(DOWN, th) * (.35 + .25 * s);
        const c = Math.cos(th), sn = Math.sin(th);
        const tx = x + c * l, ty = y + sn * l + l * .12, mx = x + c * l * .5, my = y + sn * l * .5 + l * .14;
        const w = Math.max(.5, l * .06), nx = -sn * w, ny = c * w;
        const b = r > .975 ? 3 : side === f.lit ? (r < .5 ? 2 : 1) : (r < .55 ? 1 : 0);
        const p = paths[b];
        p.moveTo(x + nx, y + ny); p.quadraticCurveTo(mx + nx * .7, my + ny * .7, tx, ty); p.quadraticCurveTo(mx - nx * .7, my - ny * .7, x - nx, y - ny); p.closePath();
      }
    }
    for (let b = 0; b < 4; b++) { g.fillStyle = cols[b]; g.fill(paths[b]); }
    g.strokeStyle = P.rachis; g.lineCap = 'round'; g.lineJoin = 'round';
    const half = (rach.length / 4) | 0;
    g.lineWidth = f.w; g.beginPath(); g.moveTo(rach[0], rach[1]); for (let i = 1; i <= half; i++) g.lineTo(rach[i * 2], rach[i * 2 + 1]); g.stroke();
    g.lineWidth = f.w * .5; g.beginPath(); g.moveTo(rach[half * 2], rach[half * 2 + 1]); for (let i = half + 1; i < rach.length / 2; i++) g.lineTo(rach[i * 2], rach[i * 2 + 1]); g.stroke();
  }
  function drawPalm(g, palm, t, windK, gustK, P) {
    const [cx, cy] = palm.spec.crown;
    for (const f of palm.fronds) if (f.back) drawFrond(g, f, cx, cy, t, windK, gustK, P, palm.spec.steps, S.frondBack);
    const r = palm.spec.nut;
    for (const [ox, oy] of [[-.9, 1.2], [.8, 1.3], [0, 1.9], [1.5, .7]]) {
      const x = cx + ox * r, y = cy + oy * r, gr = g.createRadialGradient(x - r * .35, y - r * .35, 0, x, y, r);
      gr.addColorStop(0, mix(P.nut, '#ffffff', .25)); gr.addColorStop(.6, P.nut); gr.addColorStop(1, mix(P.nut, '#000000', .45));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (const f of palm.fronds) if (!f.back) drawFrond(g, f, cx, cy, t, windK, gustK, P, palm.spec.steps, f.mid ? S.frondMid : P.frond);
  }

  /* Soft cumulus sprites; at sunset they are lit from below */
  function cloudSprite(w, h, P, seed) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), R = rng(seed), dir = P.below ? 1 : -1;
    const puff = (x, y, r, col, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(.6, `rgba(${col},${a * .55})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    };
    const pts = [];
    for (let i = 0; i < 38; i++) {
      const u = R(), x = w * (.1 + .8 * u), bulge = 1 - Math.pow(Math.abs(u - .5) * 2, 1.6);
      const y = h * .68 - bulge * h * .4 * Math.sqrt(R()), r = h * (.12 + .2 * R()) * (.55 + .45 * bulge);
      pts.push([x, y, r]);
    }
    for (const [x, y, r] of pts) puff(x, y - dir * r * .15, r * 1.05, P.cloudShade, .9);
    for (const [x, y, r] of pts) puff(x - r * .12, y + dir * r * .22, r * .82, P.cloudLit, .85);
    for (const [x, y, r] of pts) if (R() < .4) puff(x, y + r * .3, r * .7, P.cloudWarm, .3);
    g.globalCompositeOperation = 'destination-out';
    const base = g.createLinearGradient(0, h * .68, 0, h * .92);
    base.addColorStop(0, 'rgba(0,0,0,0)'); base.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    return c;
  }

  /* ============================================================
     Engine
     ============================================================ */
  let canvas = null, ctx = null, active = false, opts = { ...DEFAULTS };
  let raf = 0, last = 0, clock = rand(0, 50), W = 0, H = 0, q = 1, resizeT = 0;
  let S = null, builtKey = '', gust = 0, gustHold = 0, nextGust = 6, pointerX = 0, pointerY = 0;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function buildGeometry() {
    q = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * q); canvas.height = Math.round(H * q);
    builtKey = '';
    S = { petals: [], birds: [], nextBirds: 4, px: 0, py: 0, glitter: [], glitterT: 0, embers: [] };
  }
  function buildLook() {
    const mode = opts.mode, P = PAL[mode], L = layout(W, H, mode), u = L.u, qs = Math.min(q, 1.25);
    const R = rng(3);
    S.L = L; S.P = P;
    S.frondBack = P.frond.map(c => mix(c, '#000000', .32)); S.frondMid = P.frond.map(c => mix(c, '#000000', .14));
    /* flowers and leaves, tinted for the time of day */
    const tint = c => P.tint ? mix(c, P.tint, P.tintAmt) : c;
    S.flowerSpr = FLOWERS.map((c, i) => hibiscusSprite({ petal: tint(c.petal), edge: tint(c.edge), eye: tint(c.eye), pollen: tint(c.pollen), stigma: tint(c.stigma) }, Math.round(300 * q * u / 1.2 + 60), 50 + i));
    const dim = mode === 'night' ? .25 : mode === 'sunset' ? .12 : 0;
    const leafDark = mix(tint('#164a22'), '#000000', dim), leafLight = mix(tint('#4f9a3c'), mode === 'sunset' ? '#6a4a2a' : '#000000', dim * 1.6);
    S.leafSpr = [0, 1, 2].map(i => leafSprite(mix(leafDark, '#000000', i * .15), mix(leafLight, '#86c060', i * .2 - .1 < 0 ? 0 : i * .2), Math.round(240 * q * u), Math.round(132 * q * u), 70 + i));
    S.budSpr = FLOWERS.map(c => budSprite({ petal: tint(c.petal), edge: tint(c.edge) }, Math.round(46 * q * u), Math.round(110 * q * u)));
    /* static layers */
    S.sky = paintSky(L, P, mode, qs);
    S.land = paintLand(L, P, mode, qs);
    S.sea = paintSea(L, P, mode, qs);
    S.sand = paintSand(L, P, mode, qs, S.flowerSpr[0]);
    const rocks = [], seaRocks = [];
    for (let i = 0; i < 10; i++) { const x = W * (-.03 + i * .028 + R() * .015); rocks.push({ x, y: L.shore(x) + R() * H * .012, r: (16 + R() * 26) * u * (1.3 - i * .06), seed: 200 + i }); }
    for (const [fx, k, rr] of [[.4, .86, 13], [.445, .9, 18], [.52, .84, 9]]) { const x = W * fx, y = lerp(L.horizon, L.shore(x), k); seaRocks.push({ x, y, r: rr * u, seed: 300 + seaRocks.length, ph: R() }); }
    rocks.push({ x: W * .27, y: H * .965, r: 46 * u, seed: 400 });
    S.seaRocks = seaRocks;
    S.rocks = paintRocks(L, P, qs, [...seaRocks, ...rocks]);
    /* palms */
    S.palms = palmSpecs(L).map(spec => ({ spec, fronds: makeFronds(spec) }));
    const { pad } = L;
    S.trunkNear = layer(-pad, -pad, W + pad * 2, H + pad * 2, qs);
    S.trunkMid = layer(W * .55, H * .5, W * .2, H * .45, qs);
    for (const p of S.palms) paintTrunk(p.spec.near ? S.trunkNear.g : S.trunkMid.g, p.spec, P, L);
    /* clouds */
    const nC = mode === 'sunset' ? 5 : mode === 'night' ? 4 : 7;
    S.clouds = Array.from({ length: nC }, (_, i) => {
      const w = W * (.13 + R() * .16), h = H * (.07 + R() * .06);
      return { x: R() * W * 1.2 - W * .1, y: H * (.05 + R() * .3), w, h, v: 3 + R() * 6, a: mode === 'night' ? .55 : .8 + R() * .2, sprite: cloudSprite(Math.round(w), Math.round(h), P, 500 + i) };
    });
    S.stars = Array.from({ length: 260 }, () => ({ x: R() * W, y: Math.pow(R(), 1.3) * L.horizon * .95, r: Math.pow(R(), 3) * 1.4 + .35, a: .3 + R() * .7, tw: .5 + R() * 2, ph: R() * TAU }))
      .filter(s => Math.hypot(s.x - L.lx, s.y - L.ly) > H * .07);
    /* rolling crests on the water */
    S.streaks = Array.from({ length: Math.round(300 * W / 1440) }, () => ({ k: R(), x: R() * (W + pad * 2) - pad, len: R(), a: R() }));
    /* the shoreline, sampled for the surf */
    S.xs = []; S.ys = [];
    for (let x = -pad; x <= W + pad; x += 8) { S.xs.push(x); S.ys.push(L.shore(x)); }
    S.rn = noise1(77);
    S.waves = [0, .5].map((ph, i) => ({ ph, id: i, lastP: 2, seed: R() * 500, reach: new Float32Array(S.xs.length), prev: new Float32Array(S.xs.length) }));
    /* hibiscus bushes in the bottom corners */
    S.bush = makeBush(L);
    S.torches = [[.37, .17], [.535, .15]].map(([fx, dy], i) => ({ x: W * fx, y: L.shore(W * fx) + H * dy, ph: i * 2.3 }));
    builtKey = `${W}x${H}:${mode}`;
  }
  function makeBush(L) {
    const { W, H, u } = L, R = rng(91), items = [];
    const leaf = (x, y, rot, s, z) => items.push({ t: 'leaf', x, y, rot, s, z, k: (R() * 3) | 0, ph: R() * TAU, f: .5 + R() * .7 });
    for (let i = 0; i < 34; i++) { const a = -R() * Math.PI * .56, b = .2 + Math.sqrt(R()) * .85; leaf(-W * .01 + Math.cos(a) * W * .27 * b, H * 1.01 + Math.sin(a) * H * .38 * b, a + (R() - .5) * 1.2, (.55 + R() * .4) * u, R() < .12 ? 3 : 0); }
    for (let i = 0; i < 20; i++) { const a = -Math.PI + R() * Math.PI * .5, b = .2 + Math.sqrt(R()) * .85; leaf(W * 1.01 + Math.cos(a) * W * .15 * b, H * 1.01 + Math.sin(a) * H * .27 * b, a + (R() - .5) * 1.2, (.5 + R() * .35) * u, R() < .1 ? 3 : 0); }
    const fl = (fx, fy, d, k, rot) => items.push({ t: 'flower', x: W * fx, y: H * fy, s: d * u, k, rot, sy: .82 + R() * .18, ph: R() * TAU, f: .5 + R() * .6, z: 2 });
    fl(.055, .815, 190, 0, .3); fl(.15, .925, 214, 1, -.5); fl(.218, .8, 150, 0, 1.1); fl(.03, .965, 168, 2, -1.2); fl(.272, .945, 128, 3, .7);
    fl(.935, .895, 160, 1, .9); fl(.986, .78, 122, 0, -.4);
    const bud = (fx, fy, k, rot) => items.push({ t: 'bud', x: W * fx, y: H * fy, s: u, k, rot, ph: R() * TAU, f: .6 + R() * .6, z: 1 });
    bud(.1, .76, 0, -.5); bud(.24, .875, 2, .6);
    items.sort((a, b) => a.z - b.z);
    return items;
  }

  function step(dt) {
    const w = clamp(opts.wind, 0, 100) / 100;
    S.px += ((opts.parallax ? pointerX : 0) - S.px) * Math.min(1, dt * 2.5);
    S.py += ((opts.parallax ? pointerY : 0) - S.py) * Math.min(1, dt * 2.5);
    if (w > 0) { nextGust -= dt; if (nextGust <= 0) { gustHold = rand(.8, 2); nextGust = rand(6, 14) / (.4 + w); } }
    if (gustHold > 0) { gustHold -= dt; gust += (1 - gust) * Math.min(1, dt * 1.6); } else gust += (0 - gust) * Math.min(1, dt * .5);
    if (opts.clouds) for (const c of S.clouds) { c.x += c.v * (.4 + w) * dt; if (c.x > W + 30) c.x = -c.w - 30; }
    if (opts.birds && opts.mode !== 'night') {
      S.nextBirds -= dt;
      if (S.nextBirds <= 0) {
        S.nextBirds = rand(14, 28);
        const y0 = H * rand(.12, .34), n = 2 + (Math.random() * 4 | 0), dir = Math.random() < .5 ? 1 : -1;
        for (let i = 0; i < n; i++) S.birds.push({ x: dir > 0 ? -30 - i * rand(30, 60) : W + 30 + i * rand(30, 60), y: y0 + rand(-20, 20), v: rand(38, 60) * dir, ph: rand(0, TAU), s: rand(6, 10) * S.L.u, glide: rand(0, TAU) });
      }
    }
    S.birds = S.birds.filter(b => { b.x += b.v * dt; b.y += Math.sin(clock * .5 + b.ph) * 6 * dt; return b.x > -200 && b.x < W + 200; });
  }

  function drawStreaks(g, dt) {
    const L = S.L, P = S.P, wv = clamp(opts.waves, 0, 100) / 100, sp = .02 + .03 * wv;
    for (const s of S.streaks) {
      s.k += dt * sp * (.35 + s.k);
      if (s.k > 1) { s.k = 0; s.x = Math.random() * (W + L.pad * 2) - L.pad; }
      const k = s.k, sy = L.shore(s.x) - H * .015, y = L.horizon + (sy - L.horizon) * Math.pow(k, 1.6);
      const len = (5 + 80 * k) * (.45 + s.len) * L.u, th = .5 + 1.9 * k;
      const a = (.12 + .5 * k) * (.35 + .65 * s.a) * Math.min(1, k / .06) * Math.min(1, (1 - k) / .08) * (.6 + .6 * wv);
      g.fillStyle = `rgba(0,25,50,${(a * .3).toFixed(3)})`; g.fillRect(s.x - len * .55, y - th * 1.6, len * 1.1, th);
      g.fillStyle = `rgba(${P.streak},${a.toFixed(3)})`; g.fillRect(s.x - len / 2, y, len, th);
    }
  }
  function drawGlitter(g, dt) {
    const L = S.L, P = S.P, mode = opts.mode;
    S.glitterT -= dt;
    if (S.glitterT <= 0) {
      S.glitterT = .11;
      const cx = mode === 'day' ? W * .22 : L.lx, n = mode === 'sunset' ? 110 : mode === 'night' ? 80 : 70;
      S.glitter = Array.from({ length: n }, () => {
        const k = Math.pow(Math.random(), 1.15), x0 = cx + (Math.random() + Math.random() + Math.random() - 1.5) * ((mode === 'day' ? 120 : 12) + k * (mode === 'day' ? 380 : 140)) * L.u;
        const y = L.horizon + 1 + k * (L.shore(x0) - L.horizon - 6);
        return [x0, y, (2 + k * 30 * Math.random()) * L.u, Math.random() * (mode === 'day' ? .55 : .9)];
      });
    }
    for (const [x, y, l, a] of S.glitter) { g.fillStyle = `rgba(${P.glint},${a.toFixed(3)})`; g.fillRect(x - l / 2, y, l, 1.1); }
  }
  function drawSurf(g, t) {
    const L = S.L, P = S.P, wv = clamp(opts.waves, 0, 100) / 100, night = opts.mode === 'night', u = L.u;
    const T = lerp(10, 6, wv), Rmax = H * lerp(.018, .07, wv), xs = S.xs, ys = S.ys, N = xs.length;
    const band = (top, bot, fill) => {
      g.beginPath(); g.moveTo(xs[0], top(0));
      for (let i = 1; i < N; i++) g.lineTo(xs[i], top(i));
      for (let i = N - 1; i >= 0; i--) g.lineTo(xs[i], bot(i));
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    const line = (fy, col, wdt) => { g.beginPath(); g.moveTo(xs[0], fy(0)); for (let i = 1; i < N; i++) g.lineTo(xs[i], fy(i)); g.strokeStyle = col; g.lineWidth = wdt; g.stroke(); };
    const lace = (fy, a, depth, id) => {
      g.beginPath();
      for (let i = 0; i < N; i++) for (let j = 0; j < 3; j++) {
        const h1 = hash(i * 7 + j * 131 + id * 977), h2 = hash(i * 13 + j * 71 + id * 433);
        const x = xs[i] + h1 * 8, y = fy(i) - h2 * depth - 1, r = (.7 + h1 * h2 * 2.4) * u;
        g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
      }
      g.fillStyle = `rgba(${P.foam},${(.55 * a).toFixed(3)})`; g.fill();
    };
    const phases = S.waves.map(w => {
      const p = ((t / T) + w.ph) % 1;
      if (p < w.lastP) {
        w.prev.set(w.reach); w.seed = Math.random() * 500;
        for (let i = 0; i < N; i++) w.reach[i] = Rmax * (.42 + .58 * S.rn(xs[i] * .0045 + w.seed));
      }
      w.lastP = p; return p;
    });
    /* wet sand left behind as the water drains */
    S.waves.forEach((w, k) => {
      const p = phases[k];
      const [arr, m, a] = p < .5 ? [w.prev, 1, .3 * (1 - p / .5)] : [w.reach, p < .8 ? 1 - Math.pow(1 - (p - .5) / .3, 2) : 1, .3];
      if (a > .01) band(i => ys[i] - 1, i => ys[i] + arr[i] * m + 2, `rgba(${P.wet},${a.toFixed(3)})`);
    });
    if (night) g.globalCompositeOperation = 'lighter';
    S.waves.forEach((w, k) => {
      const p = phases[k];
      /* a wave rolls in, curls and breaks on the sand */
      if (p > .22 && p < .56) {
        const qv = (p - .22) / .34, off = -H * .045 * Math.pow(1 - qv, 1.2) * (.6 + wv), a = qv < .82 ? .25 + .7 * qv : (1 - qv) / .18 * .95;
        const fy = i => ys[i] + off;
        band(fy, i => fy(i) + (3 + 7 * qv) * u, `rgba(${P.shallow},${(.3 * qv).toFixed(3)})`);
        line(fy, `rgba(${P.foam},${(a * .85).toFixed(3)})`, (1 + 3.5 * qv) * u);
        if (qv > .6) lace(i => fy(i) + 4 * u, a, 10 * u * qv, w.id + 7);
      }
      /* the swash runs up the beach, then slides back */
      if (p >= .5) {
        const q2 = (p - .5) / .3, e = p < .8 ? 1 - (1 - q2) * (1 - q2) : 1 - ease((p - .8) / .2), a = p < .8 ? 1 : 1 - (p - .8) / .2;
        const fy = i => ys[i] + w.reach[i] * e;
        const gr = g.createLinearGradient(0, L.shoreMin, 0, L.shoreMax + Rmax);
        gr.addColorStop(0, `rgba(${P.shallow},${(.6 * a).toFixed(3)})`); gr.addColorStop(1, `rgba(${P.shallow},${(.22 * a).toFixed(3)})`);
        band(i => ys[i] - 2, fy, gr);
        if (!night) line(i => fy(i) + 1.5, `rgba(${P.wet},${(.25 * a).toFixed(3)})`, 1.5 * u);
        line(fy, `rgba(${P.foam},${(.85 * a).toFixed(3)})`, 2 * u);
        lace(fy, a, 14 * u, w.id);
        if (p < .62) { const bq = 1 - (p - .5) / .12; line(i => ys[i] + 1, `rgba(${P.foam},${(.8 * bq).toFixed(3)})`, (4 + 6 * bq) * u); lace(i => ys[i] + 3, bq, 14 * u, w.id + 3); }
      }
    });
    /* foam swirling around the rocks in the water */
    for (const r of S.seaRocks) for (let k = 0; k < 2; k++) {
      const ph = (t * .45 + r.ph + k * .5) % 1;
      g.strokeStyle = `rgba(${P.foam},${(.55 * (1 - ph)).toFixed(3)})`; g.lineWidth = 1.4 * u;
      g.beginPath(); g.ellipse(r.x, r.y - r.r * .05, r.r * (1.25 + .9 * ph), r.r * (.28 + .22 * ph), 0, 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }
  function drawTorch(g, tr, t, u) {
    const s = u * 1.05, top = tr.y - 96 * s, x = tr.x, flick = .85 + .1 * Math.sin(t * 13 + tr.ph) + .07 * Math.sin(t * 21.7 + tr.ph * 2);
    /* light on the sand */
    g.globalCompositeOperation = 'lighter';
    const pool = g.createRadialGradient(x, tr.y, 0, x, tr.y, 90 * s);
    pool.addColorStop(0, `rgba(255,140,60,${(.22 * flick).toFixed(3)})`); pool.addColorStop(1, 'rgba(255,140,60,0)');
    g.save(); g.translate(x, tr.y); g.scale(1, .35); g.translate(-x, -tr.y); g.fillStyle = pool; g.fillRect(x - 90 * s, tr.y - 90 * s, 180 * s, 180 * s); g.restore();
    g.globalCompositeOperation = 'source-over';
    /* bamboo pole */
    g.fillStyle = '#2a1f14'; g.fillRect(x - 3.5 * s, top, 7 * s, tr.y - top);
    g.fillStyle = 'rgba(255,170,90,.25)'; g.fillRect(x - 3.5 * s, top, 2 * s, tr.y - top);
    g.fillStyle = '#18120c'; for (let k = 1; k < 5; k++) g.fillRect(x - 4 * s, top + k * 24 * s, 8 * s, 1.6 * s);
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(x - 8 * s, top); g.lineTo(x + 8 * s, top); g.lineTo(x + 5 * s, top + 14 * s); g.lineTo(x - 5 * s, top + 14 * s); g.closePath(); g.fill();
    /* the flame */
    const fh = 30 * s * flick, lean = (clamp(opts.wind, 0, 100) / 100 * 7 + gust * 6) * s + Math.sin(t * 9 + tr.ph) * 2 * s;
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(x, top - fh * .4, 0, x, top - fh * .4, 110 * s);
    halo.addColorStop(0, `rgba(255,150,60,${(.32 * flick).toFixed(3)})`); halo.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = halo; g.fillRect(x - 110 * s, top - fh * .4 - 110 * s, 220 * s, 220 * s);
    const fl = g.createRadialGradient(x, top - fh * .2, 0, x, top - fh * .3, fh);
    fl.addColorStop(0, 'rgba(255,248,210,1)'); fl.addColorStop(.35, 'rgba(255,190,80,.95)'); fl.addColorStop(.8, 'rgba(255,90,20,.6)'); fl.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = fl; g.beginPath(); g.moveTo(x - 8 * s, top + 2 * s);
    g.quadraticCurveTo(x - 10 * s, top - fh * .5, x + lean, top - fh);
    g.quadraticCurveTo(x + 10 * s, top - fh * .5, x + 8 * s, top + 2 * s); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    /* embers */
    if (Math.random() < .08) S.embers.push({ x: x + rand(-4, 4) * s, y: top - fh * .6, vx: rand(5, 20) * s, vy: -rand(25, 45) * s, life: 0, max: rand(.8, 1.6) });
  }
  function drawEmbers(g, dt) {
    g.globalCompositeOperation = 'lighter';
    S.embers = S.embers.filter(e => {
      e.life += dt; e.x += (e.vx + gust * 20) * dt; e.y += e.vy * dt;
      const a = 1 - e.life / e.max; if (a <= 0) return false;
      g.fillStyle = `rgba(255,170,80,${a.toFixed(3)})`; g.fillRect(e.x, e.y, 1.6, 1.6);
      return true;
    });
    g.globalCompositeOperation = 'source-over';
  }

  function frameDraw(t, dt) {
    const g = ctx, L = S.L, P = S.P, mode = opts.mode, u = L.u;
    const windK = clamp(opts.wind, 0, 100) / 100, gustK = gust * windK;
    const at = d => { const ox = -S.px * d * 26, oy = -S.py * d * 14; g.setTransform(q, 0, 0, q, ox * q, oy * q); };
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    at(.05); put(g, S.sky, 0, 0);
    if (mode === 'night') for (const s of S.stars) {
      g.fillStyle = `rgba(235,240,255,${(s.a * (.55 + .45 * Math.sin(t * s.tw + s.ph))).toFixed(3)})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    }
    at(.1);
    if (opts.clouds) for (const c of S.clouds) { g.globalAlpha = c.a; g.drawImage(c.sprite, c.x, c.y, c.w, c.h); }
    g.globalAlpha = 1;
    if (S.birds.length) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const b of S.birds) {
        const f = Math.sin(t * 6 + b.ph) * (Math.sin(t * .4 + b.glide) > .3 ? .15 : 1) * b.s * .5, s = b.s;
        const path = () => { g.beginPath(); g.moveTo(b.x - s, b.y - f); g.quadraticCurveTo(b.x - s * .45, b.y - s * .55 - f * .3, b.x, b.y); g.quadraticCurveTo(b.x + s * .45, b.y - s * .55 - f * .3, b.x + s, b.y - f); };
        if (P.gull === 'light') { path(); g.strokeStyle = 'rgba(50,60,75,.45)'; g.lineWidth = 2.6 * u; g.stroke(); path(); g.strokeStyle = 'rgba(252,252,255,.95)'; g.lineWidth = 1.5 * u; g.stroke(); }
        else { path(); g.strokeStyle = 'rgba(40,18,32,.8)'; g.lineWidth = 1.8 * u; g.stroke(); }
      }
    }
    at(.18); put(g, S.land, 0, 0);
    at(.32);
    put(g, S.sea, 0, 0);
    drawStreaks(g, dt); drawGlitter(g, dt);
    put(g, S.sand, 0, 0);
    drawSurf(g, t);
    put(g, S.rocks, 0, 0);
    if (opts.torches && mode !== 'day') { for (const tr of S.torches) drawTorch(g, tr, t, u); drawEmbers(g, dt); }
    put(g, S.trunkMid, 0, 0);
    for (const p of S.palms) if (!p.spec.near) drawPalm(g, p, t, windK, gustK, P);
    at(.75);
    put(g, S.trunkNear, 0, 0);
    for (const p of S.palms) if (p.spec.near) drawPalm(g, p, t, windK, gustK, P);
    if (opts.flowers) {
      at(1);
      for (const it of S.bush) {
        const sw = (windK * .05 + .015) * Math.sin(t * it.f + it.ph) + gustK * .05;
        g.save(); g.translate(it.x, it.y); g.rotate(it.rot + sw);
        if (it.t === 'leaf') { const spr = S.leafSpr[it.k], lw = 190 * it.s, lh = lw * .55; g.drawImage(spr, 0, -lh / 2, lw, lh); }
        else if (it.t === 'flower') { g.scale(1, it.sy); g.drawImage(S.flowerSpr[it.k], -it.s / 2, -it.s / 2, it.s, it.s); }
        else { const bw = 40 * it.s, bh = 96 * it.s; g.drawImage(S.budSpr[it.k], -bw / 2, -bh, bw, bh); }
        g.restore();
      }
    }
    g.setTransform(q, 0, 0, q, 0, 0); g.globalAlpha = 1;
    const b = clamp(opts.brightness, 20, 180) / 100;
    if (b < 1) { g.fillStyle = `rgba(0,0,0,${(1 - b).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    else if (b > 1) { g.globalCompositeOperation = 'screen'; g.fillStyle = `rgba(255,255,255,${((b - 1) * .35).toFixed(3)})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
  }

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; clock += dt;
    step(dt); frameDraw(clock, dt);
    raf = requestAnimationFrame(frame);
  }
  function once() { frameDraw(clock, 0); }
  function start() {
    stop();
    if (reduce()) { once(); return; }
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'scene-beach'; canvas.className = 'scene-canvas'; canvas.setAttribute('aria-hidden', 'true');
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

  window.ChronosBeach = {
    /* on: show or hide the scene. o: any of DEFAULTS' keys (mode is 'day', 'sunset' or 'night') */
    set(on, o = {}) {
      for (const key in DEFAULTS) if (o[key] !== undefined && o[key] !== null) opts[key] = o[key];
      if (!on) { if (active) { stop(); active = false; canvas.hidden = true; } return; }
      if (!active) {
        ensureCanvas(); canvas.hidden = false; active = true;
        buildGeometry(); buildLook(); start();
        return;
      }
      if (builtKey !== `${W}x${H}:${opts.mode}`) buildLook();
      if (!raf) once();
    },
  };
})();
