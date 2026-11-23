/* Chronos — animated scene backgrounds.
   Each scene paints a full-window <canvas> behind the app. Panels turn into frosted glass on top of it.
   Scenes pause when the tab is hidden and draw a single still frame when the system asks for reduced motion. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Small helpers ---------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  /* A soft round glow, drawn once and stamped many times */
  function glowSprite(rgb, size = 64, core = 0.15) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, `rgba(${rgb},1)`);
    grd.addColorStop(core, `rgba(${rgb},.8)`);
    grd.addColorStop(0.45, `rgba(${rgb},.18)`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return c;
  }
  /* Seeded value noise + fBm, used to paint the nebula once */
  function noise2(seed) {
    const P = new Uint8Array(512);
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const V = new Float32Array(256).map(() => rnd());
    const fade = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]], c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]];
      const u = fade(xf), v = fade(yf);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    };
  }
  function makeStars(n, w, h, opts = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        x: Math.random() * w, y: Math.random() * h * (opts.maxY || 1),
        r: Math.pow(Math.random(), 3) * (opts.big || 1.6) + 0.3,
        a: rand(0.25, 1), tw: rand(0.4, 2.2), ph: rand(0, TAU),
      });
    }
    return out;
  }
  function drawStars(g, stars, t, tint = '255,255,255') {
    for (const s of stars) {
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph));
      g.fillStyle = `rgba(${tint},${a.toFixed(3)})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
      if (s.r > 1.3) { /* a little cross glint on the brightest */
        g.fillStyle = `rgba(${tint},${(a * 0.25).toFixed(3)})`;
        g.fillRect(s.x - s.r * 4, s.y - 0.4, s.r * 8, 0.8);
        g.fillRect(s.x - 0.4, s.y - s.r * 4, 0.8, s.r * 8);
      }
    }
  }

  /* ============================================================
     Scenes. Each has init(w, h) → state and draw(g, st, t, dt, w, h).
     ============================================================ */
  const SCENES = {};

  /* ---------- Nebula: slow drifting gas clouds and twinkling stars ---------- */
  SCENES.nebula = {
    init(w, h) {
      const N = noise2(7), M = noise2(19);
      const cw = 360, ch = Math.round(360 * h / w) || 200;
      const layer = (fn, pal) => {
        const c = makeCanvas(cw, ch), g = c.getContext('2d'), img = g.createImageData(cw, ch), d = img.data;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const v = fn(x / cw * 4, y / ch * 4 * ch / cw);
          const i = (y * cw + x) * 4, [r, gg, b, a] = pal(v);
          d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = a;
        }
        g.putImageData(img, 0, 0);
        return c;
      };
      const fbm = (n, x, y) => { let v = 0, amp = .5, f = 1; for (let o = 0; o < 5; o++) { v += amp * n(x * f, y * f); f *= 2; amp *= .5; } return v; };
      /* Warped noise gives the wispy, folded look */
      const warp = (x, y) => fbm(N, x + 1.6 * fbm(M, x, y), y + 1.6 * fbm(M, x + 5.2, y + 1.3));
      const clouds = layer(warp, v => {
        const t = Math.max(0, Math.min(1, (v - .4) / .38));
        const r = lerp(60, 210, t * t), g = lerp(20, 140, t * t * t), b = lerp(130, 255, t);
        return [r, g, b, Math.round(255 * Math.pow(t, 1.8))];
      });
      const dust = layer((x, y) => fbm(M, x * 1.5 + 9, y * 1.5), v => {
        const t = Math.max(0, Math.min(1, (v - .48) / .26));
        return t > .5 ? [90, 220, 255, Math.round(120 * t * t)] : [255, lerp(90, 160, t), lerp(170, 220, t), Math.round(150 * t * t)];
      });
      return {
        clouds, dust,
        stars: makeStars(Math.round(w * h / 2600), w, h),
        glow: glowSprite('255,240,255', 64, .08),
        bright: Array.from({ length: 7 }, () => ({ x: Math.random() * w, y: Math.random() * h, s: rand(14, 34), ph: rand(0, TAU) })),
        shoot: null, nextShoot: rand(4, 9),
      };
    },
    draw(g, st, t, dt, w, h) {
      const bg = g.createRadialGradient(w * .55, h * .45, 0, w * .55, h * .45, Math.max(w, h) * .8);
      bg.addColorStop(0, '#120c26'); bg.addColorStop(1, '#03020a');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      /* two copies of the clouds breathe and drift against each other */
      g.globalCompositeOperation = 'lighter';
      const s1 = 1.12 + .04 * Math.sin(t * .05), dx1 = Math.sin(t * .021) * w * .04, dy1 = Math.cos(t * .017) * h * .03;
      g.globalAlpha = .75;
      g.drawImage(st.clouds, -w * (s1 - 1) / 2 + dx1, -h * (s1 - 1) / 2 + dy1, w * s1, h * s1);
      const s2 = 1.3 + .05 * Math.cos(t * .04), dx2 = -Math.sin(t * .015) * w * .05;
      g.globalAlpha = .35;
      g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI + Math.sin(t * .01) * .05);
      g.drawImage(st.clouds, -w * s2 / 2 + dx2, -h * s2 / 2, w * s2, h * s2); g.restore();
      g.globalAlpha = .5 + .1 * Math.sin(t * .1);
      g.drawImage(st.dust, dx2 * .5, dy1, w * 1.05, h * 1.05);
      g.globalAlpha = 1;
      drawStars(g, st.stars, t);
      for (const b of st.bright) {
        const k = b.s * (0.85 + .15 * Math.sin(t * .8 + b.ph));
        g.drawImage(st.glow, b.x - k / 2, b.y - k / 2, k, k);
      }
      /* the odd shooting star */
      st.nextShoot -= dt;
      if (!st.shoot && st.nextShoot <= 0) { st.shoot = { x: rand(w * .1, w * .9), y: rand(0, h * .4), vx: rand(500, 800) * (Math.random() < .5 ? -1 : 1), vy: rand(180, 320), life: 0 }; st.nextShoot = rand(5, 12); }
      if (st.shoot) {
        const s = st.shoot; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        const a = Math.max(0, 1 - s.life / .9), len = .09;
        const grd = g.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
        grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = grd; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * len, s.y - s.vy * len); g.stroke();
        if (a <= 0) st.shoot = null;
      }
      g.globalCompositeOperation = 'source-over';
    },
  };

  /* ---------- Rain: a wet night window, blurred city lights, streaks, splashes and lightning ---------- */
  SCENES.rain = {
    init(w, h) {
      /* the blurry lights behind the glass, painted once */
      const city = makeCanvas(w / 2, h / 2), cg = city.getContext('2d');
      const cols = ['255,190,110', '255,150,90', '140,180,255', '200,220,255', '255,230,170'];
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * city.width, y = city.height * rand(.45, 1.05), r = rand(4, 26);
        const c = cols[(Math.random() * cols.length) | 0], grd = cg.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(${c},${rand(.12, .35)})`); grd.addColorStop(1, `rgba(${c},0)`);
        cg.fillStyle = grd; cg.beginPath(); cg.arc(x, y, r, 0, TAU); cg.fill();
      }
      const layers = [ /* far → near */
        { n: 170, speed: 820, len: 14, width: .7, alpha: .16 },
        { n: 110, speed: 1150, len: 22, width: 1, alpha: .24 },
        { n: 45, speed: 1550, len: 34, width: 1.3, alpha: .34 },
      ].map(L => ({ ...L, drops: Array.from({ length: Math.round(L.n * w / 1400) + 10 }, () => ({ x: Math.random() * w, y: Math.random() * h })) }));
      /* beads of water sitting on the glass */
      const beads = Array.from({ length: Math.round(w * h / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.pow(Math.random(), 2) * 3 + .6, vy: 0, slide: Math.random() < .08 }));
      return { city, layers, beads, splashes: [], flash: 0, nextFlash: rand(8, 18), wind: -0.12 };
    },
    draw(g, st, t, dt, w, h) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#07090d'); bg.addColorStop(.6, '#0d1118'); bg.addColorStop(1, '#151a22');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.globalAlpha = .9; g.drawImage(st.city, 0, 0, w, h); g.globalAlpha = 1;
      /* lightning: a quick double flicker every so often */
      st.nextFlash -= dt;
      if (st.nextFlash <= 0) { st.flash = 1; st.nextFlash = rand(9, 22); }
      if (st.flash > 0) {
        const f = st.flash, flick = f > .7 ? 1 : f > .55 ? .2 : f > .4 ? .7 : f * .9;
        g.fillStyle = `rgba(190,205,255,${(flick * .22).toFixed(3)})`; g.fillRect(0, 0, w, h);
        st.flash = Math.max(0, f - dt * 1.4);
      }
      const wind = st.wind + Math.sin(t * .3) * .05;
      g.lineCap = 'round';
      for (const L of st.layers) {
        g.strokeStyle = `rgba(190,205,225,${L.alpha})`; g.lineWidth = L.width;
        g.beginPath();
        for (const d of L.drops) {
          d.y += L.speed * dt; d.x += L.speed * wind * dt;
          if (d.y > h) {
            if (L.len > 30 && Math.random() < .5) st.splashes.push({ x: d.x, y: h - rand(2, 30), life: 0 });
            d.y = -rand(0, 120); d.x = Math.random() * (w + 200) - 100;
          }
          g.moveTo(d.x, d.y); g.lineTo(d.x - L.len * wind, d.y - L.len);
        }
        g.stroke();
      }
      g.strokeStyle = 'rgba(200,215,235,.35)'; g.lineWidth = 1;
      st.splashes = st.splashes.filter(s => {
        s.life += dt; const k = s.life / .35; if (k >= 1) return false;
        g.globalAlpha = 1 - k; g.beginPath(); g.ellipse(s.x, s.y, 2 + k * 10, 1 + k * 2.5, 0, 0, TAU); g.stroke();
        return true;
      });
      g.globalAlpha = 1;
      for (const b of st.beads) {
        if (b.slide) { b.vy = Math.min(b.vy + dt * 30, 90); b.y += b.vy * dt; if (b.y > h + 5) { b.y = -5; b.x = Math.random() * w; b.vy = 0; } }
        g.fillStyle = 'rgba(210,225,245,.10)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.arc(b.x - b.r * .3, b.y - b.r * .35, b.r * .3, 0, TAU); g.fill();
      }
    },
  };

  /* ---------- Aurora: northern lights rippling over a mountain ridge ---------- */
  SCENES.aurora = {
    init(w, h) {
      const strip = (rgbTop, rgbBot) => {
        const c = makeCanvas(1, 256), g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
        grd.addColorStop(0, `rgba(${rgbTop},0)`); grd.addColorStop(.55, `rgba(${rgbTop},.35)`);
        grd.addColorStop(.9, `rgba(${rgbBot},.9)`); grd.addColorStop(1, `rgba(${rgbBot},0)`);
        g.fillStyle = grd; g.fillRect(0, 0, 1, 256); return c;
      };
      const ridge = (base, amp, seed) => { const N = noise2(seed); return Array.from({ length: 121 }, (_, i) => base - amp * (N(i * .09, 0) * .7 + N(i * .35, 3) * .3)); };
      return {
        ribbons: [
          { strip: strip('170,80,255', '60,255,170'), y: .30, amp: .07, h: .32, sp: .23, k: 2.1, ph: 0 },
          { strip: strip('90,140,255', '80,255,200'), y: .40, amp: .05, h: .26, sp: .31, k: 3.3, ph: 2 },
          { strip: strip('255,90,190', '120,255,160'), y: .22, amp: .06, h: .2, sp: .17, k: 1.6, ph: 4 },
        ],
        soft: makeCanvas(w / 3, h / 3),
        stars: makeStars(Math.round(w * h / 3500), w, h, { maxY: .8 }),
        far: ridge(.84, .16, 3), near: ridge(.95, .13, 11),
      };
    },
    draw(g, st, t, dt, w, h) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#02040b'); bg.addColorStop(.7, '#061524'); bg.addColorStop(1, '#0a2230');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      drawStars(g, st.stars, t);
      /* ribbons are drawn small then scaled up, which blurs them for free */
      const s = st.soft, sg = s.getContext('2d'), sw = s.width, sh = s.height;
      sg.clearRect(0, 0, sw, sh); sg.globalCompositeOperation = 'lighter';
      for (const R of st.ribbons) {
        for (let x = 0; x < sw; x += 1) {
          const u = x / sw;
          const y = sh * (R.y + R.amp * Math.sin(u * R.k * TAU + t * R.sp + R.ph) + R.amp * .5 * Math.sin(u * R.k * 2.7 * TAU - t * R.sp * 1.6));
          const bright = .45 + .55 * Math.pow(.5 + .5 * Math.sin(u * 23 + t * 1.1 + R.ph * 3) * Math.sin(u * 7 - t * .4), 2);
          const len = sh * R.h * (.6 + .4 * Math.sin(u * 11 + t * .5 + R.ph));
          sg.globalAlpha = bright;
          sg.drawImage(R.strip, x, y - len, 1.5, len);
        }
      }
      sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true;
      g.globalAlpha = .62; g.drawImage(s, 0, 0, w, h); g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      const ridge = (pts, fill) => {
        g.fillStyle = fill; g.beginPath(); g.moveTo(0, h);
        pts.forEach((p, i) => g.lineTo(i / (pts.length - 1) * w, p * h));
        g.lineTo(w, h); g.closePath(); g.fill();
      };
      ridge(st.far, '#071420'); ridge(st.near, '#03080d');
    },
  };

  /* ---------- Snow: quiet flakes falling in three depths ---------- */
  SCENES.snow = {
    init(w, h) {
      const flake = glowSprite('255,255,255', 32, .35);
      const flakes = Array.from({ length: Math.round(w * h / 5500) }, () => {
        const z = Math.random();
        return { x: Math.random() * w, y: Math.random() * h, z, r: lerp(1.2, 5.5, z * z), vy: lerp(18, 75, z), sway: rand(10, 40), f: rand(.2, .7), ph: rand(0, TAU) };
      }).sort((a, b) => a.z - b.z);
      return { flake, flakes, hills: [noise2(5), noise2(8)] };
    },
    draw(g, st, t, dt, w, h) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0a0f1c'); bg.addColorStop(.75, '#1a2235'); bg.addColorStop(1, '#2a3247');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      const moon = g.createRadialGradient(w * .7, 0, 0, w * .7, 0, h * .6);
      moon.addColorStop(0, 'rgba(220,230,255,.18)'); moon.addColorStop(1, 'rgba(220,230,255,0)');
      g.fillStyle = moon; g.fillRect(0, 0, w, h);
      st.hills.forEach((N, k) => {
        g.fillStyle = k ? '#c9d3e6' : '#7f8ca6'; g.globalAlpha = k ? .16 : .12;
        g.beginPath(); g.moveTo(0, h);
        for (let i = 0; i <= 80; i++) g.lineTo(i / 80 * w, h * (k ? .9 : .82) - h * .1 * N(i * .07, k * 4));
        g.lineTo(w, h); g.closePath(); g.fill();
      });
      g.globalAlpha = 1;
      const wind = Math.sin(t * .15) * 20;
      for (const f of st.flakes) {
        f.y += f.vy * dt; f.x += (wind * f.z + Math.sin(t * f.f + f.ph) * f.sway * .6) * dt;
        if (f.y > h + 10) { f.y = -10; f.x = Math.random() * w; }
        if (f.x > w + 10) f.x = -10; else if (f.x < -10) f.x = w + 10;
        const k = f.r * 3;
        g.globalAlpha = lerp(.35, .95, f.z);
        g.drawImage(st.flake, f.x - k / 2, f.y - k / 2, k, k);
      }
      g.globalAlpha = 1;
    },
  };

  /* ---------- Fireflies: a summer field at night ---------- */
  SCENES.fireflies = {
    init(w, h) {
      const N = noise2(23);
      const blades = Array.from({ length: Math.round(w / 3) }, (_, i) => ({ x: i * 3 + rand(-2, 2), h: rand(.05, .16) + .06 * N(i * .05, 0), lean: rand(-.4, .4), ph: rand(0, TAU) }));
      const flies = Array.from({ length: Math.round(w * h / 22000) + 20 }, () => ({
        x: Math.random() * w, y: rand(.3, .98) * h, a: rand(0, TAU), sp: rand(8, 26), turn: rand(-1, 1),
        blink: rand(.4, 1.1), ph: rand(0, TAU), size: rand(14, 30),
      }));
      return { blades, flies, glow: glowSprite('214,255,120', 64, .06), trees: noise2(31), stars: makeStars(Math.round(w * h / 9000), w, h, { maxY: .5 }) };
    },
    draw(g, st, t, dt, w, h) {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#040a10'); bg.addColorStop(.6, '#071612'); bg.addColorStop(1, '#0b1f14');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      drawStars(g, st.stars, t, '220,255,230');
      /* tree line */
      g.fillStyle = '#030907'; g.beginPath(); g.moveTo(0, h);
      for (let i = 0; i <= 160; i++) { const u = i / 160; g.lineTo(u * w, h * (.62 - .12 * st.trees(u * 18, 0) - .05 * st.trees(u * 60, 2))); }
      g.lineTo(w, h); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (const f of st.flies) {
        f.turn += rand(-1, 1) * dt * 2; f.turn = Math.max(-1.2, Math.min(1.2, f.turn));
        f.a += f.turn * dt; f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt * .6;
        if (f.x < -20) f.x = w + 20; else if (f.x > w + 20) f.x = -20;
        if (f.y < h * .25 || f.y > h) f.a = -f.a;
        const pulse = Math.max(0, Math.sin(t * f.blink + f.ph)); const a = pulse * pulse;
        if (a < .02) continue;
        g.globalAlpha = a; const k = f.size * (.7 + .3 * a);
        g.drawImage(st.glow, f.x - k / 2, f.y - k / 2, k, k);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      /* grass swaying in front */
      g.strokeStyle = '#020604'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
      for (const b of st.blades) {
        const sway = Math.sin(t * .8 + b.ph + b.x * .004) * 8, top = h * (1 - b.h);
        g.moveTo(b.x, h); g.quadraticCurveTo(b.x + b.lean * 10, h - (h - top) * .5, b.x + b.lean * 30 + sway, top);
      }
      g.stroke();
    },
  };

  /* ---------- Synthwave: a neon sun setting over an endless grid ---------- */
  SCENES.synthwave = {
    init(w, h) {
      return { stars: makeStars(Math.round(w * h / 5000), w, h, { maxY: .55 }), mtn: noise2(41) };
    },
    draw(g, st, t, dt, w, h) {
      const hz = h * .62;
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#07021a'); sky.addColorStop(.6, '#2a0845'); sky.addColorStop(1, '#6b1460');
      g.fillStyle = sky; g.fillRect(0, 0, w, hz);
      drawStars(g, st.stars, t);
      /* sun with scanline cut-outs that scroll down */
      const R = Math.min(w, h) * .22, cx = w / 2, cy = hz - R * .35;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      const sun = g.createLinearGradient(0, cy - R, 0, cy + R);
      sun.addColorStop(0, '#ffe36e'); sun.addColorStop(.5, '#ff7a59'); sun.addColorStop(1, '#ff2a8a');
      g.fillStyle = sun; g.fillRect(cx - R, cy - R, R * 2, R * 2);
      g.fillStyle = '#2a0845';
      const off = (t * 10) % 18;
      for (let y = cy - R * .1 + off; y < cy + R; y += 18) { const k = (y - (cy - R * .1)) / (R * 1.1); g.fillRect(cx - R, y, R * 2, Math.max(0, 1 + k * 7)); }
      g.restore();
      const halo = g.createRadialGradient(cx, cy, R * .8, cx, cy, R * 2.2);
      halo.addColorStop(0, 'rgba(255,80,160,.3)'); halo.addColorStop(1, 'rgba(255,80,160,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, hz);
      /* distant mountains */
      g.fillStyle = '#12031f'; g.beginPath(); g.moveTo(0, hz);
      for (let i = 0; i <= 100; i++) { const u = i / 100, e = Math.pow(Math.abs(u - .5) * 2, 1.4); g.lineTo(u * w, hz - h * .16 * e * (.5 + st.mtn(u * 9, 1))); }
      g.lineTo(w, hz); g.closePath(); g.fill();
      /* the grid floor */
      const floor = g.createLinearGradient(0, hz, 0, h);
      floor.addColorStop(0, '#1a0430'); floor.addColorStop(1, '#05010c');
      g.fillStyle = floor; g.fillRect(0, hz, w, h - hz);
      g.strokeStyle = 'rgba(255,60,200,.75)'; g.lineWidth = 1.2; g.shadowColor = '#ff3cc8'; g.shadowBlur = 8;
      g.beginPath();
      const depth = h - hz, sp = (t * .35) % 1;
      for (let i = 0; i < 18; i++) { const z = Math.pow((i + sp) / 18, 2.2); const y = hz + depth * z; g.moveTo(0, y); g.lineTo(w, y); }
      for (let i = -24; i <= 24; i++) { const x = cx + i * w * .045; g.moveTo(cx + (x - cx) * .04, hz); g.lineTo(cx + (x - cx) * 2.2, h); }
      g.stroke(); g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,120,220,.5)'; g.fillRect(0, hz - 1, w, 2);
    },
  };

  /* ============================================================
     Engine
     ============================================================ */
  let canvas = null, ctx = null, current = null, scene = null, st = null;
  let raf = 0, last = 0, clock = 0, W = 0, H = 0;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'scene';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => { if (current) { resize(); if (!raf) frame(performance.now()); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (current) start(); });
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st = scene.init(W, H);
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; clock += dt;
    scene.draw(ctx, st, clock, dt, W, H);
    raf = reduce() ? 0 : requestAnimationFrame(frame);
  }
  function start() {
    stop(); last = performance.now();
    if (reduce()) { clock = 20; scene.draw(ctx, st, clock, 0, W, H); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  window.ChronosScenes = {
    has: id => Object.prototype.hasOwnProperty.call(SCENES, id),
    set(id) {
      if (id === current) return;
      if (!id || !SCENES[id]) {
        stop(); current = null;
        if (canvas) canvas.hidden = true;
        return;
      }
      ensureCanvas();
      canvas.hidden = false;
      current = id; scene = SCENES[id]; clock = rand(0, 30);
      resize(); start();
    },
  };
})();
