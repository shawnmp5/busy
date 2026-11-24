/* Chronos — "Rainy night" scene.

   You are inside, at night, looking out of a rain-streaked window at a city. Everything is drawn in code:
   - the city: layered towers with lit windows, neon signs, street lamps, a wet road, and low storm cloud
     that drifts slowly and lights up in its true shape when lightning flashes,
   - traffic: headlights and tail lights drift along the street as soft out-of-focus lights, smeared on the wet road,
     and red warning lights blink on the tallest towers,
   - rain falling outside in streaks at several depths,
   - drops on the glass that land and run down it with a slight stutter, merge when they meet and wipe clear
     tracks through the fog on the pane; each drop is a little lens showing a flipped, sharp view of the street.
   It also makes its own sound (Web Audio, nothing downloaded): a bed of steady rain, drops tapping the glass,
   a low hum, and thunder that rolls in a few seconds after each flash.

   How the picture works: the drops are simulated on a 2D canvas (the "drop map"), whose red/green channels hold
   each drop's surface normal, blue its thickness and alpha its coverage. A WebGL shader refracts the painted city
   through that map and adds the moving lights, rain and lightning. Without WebGL it falls back to a simple 2D drawing.
   The picture pauses while the tab is hidden (the sound keeps going) and holds still for reduced motion. */
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* What the person can tune in Settings (percentages and switches) */
  const DEFAULTS = { amount: 50, size: 100, speed: 100, brightness: 100, city: true, traffic: true, lightning: true, fog: true, streaks: true, sound: false, volume: 60, thunder: true };
  function tune(o) {
    const a = clamp(+o.amount || 0, 0, 100) / 100;
    return {
      a, spawn: 120 * a,
      lightning: o.lightning ? (.5 + 2 * a) / 50 : 0,
      streaks: o.streaks ? .2 + 1.4 * a : 0,
      size: clamp(+o.size || 100, 40, 200) / 100,
      speed: clamp(+o.speed || 100, 25, 250) / 100,
      bright: clamp(+o.brightness || 100, 20, 180) / 100,
      fog: o.fog ? 1 : 0,
    };
  }
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function noise2(seed) {
    const R = rng(seed), v = Float32Array.from({ length: 4096 }, () => R()), at = (x, y) => v[(x & 63) * 64 + (y & 63)];
    const L = (a, b, t) => a + (b - a) * t;
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      return L(L(at(xi, yi), at(xi + 1, yi), u), L(at(xi, yi + 1), at(xi + 1, yi + 1), u), w);
    };
  }

  /* ============================================================
     The view outside, painted once per size
     ============================================================ */
  const ROAD = .9; /* where the street runs, as a fraction of the height */
  function paintCity(w, h, lights, towersOut) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), R = rng(41), r = () => R();
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#03040a'); sky.addColorStop(.4, '#080a15'); sky.addColorStop(.72, '#16121f'); sky.addColorStop(1, '#0c0b12');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    /* the orange-violet glow a city throws up into low cloud */
    const glow = g.createRadialGradient(w * .5, h * 1.02, 0, w * .5, h * 1.02, w * .75);
    glow.addColorStop(0, 'rgba(150,80,90,.4)'); glow.addColorStop(.45, 'rgba(70,44,86,.18)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    if (!lights) {
      g.fillStyle = 'rgba(4,5,9,.55)'; g.fillRect(0, 0, w, h);
      const cold = g.createRadialGradient(w * .3, h * .2, 0, w * .3, h * .2, w * .8);
      cold.addColorStop(0, 'rgba(70,85,120,.16)'); cold.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = cold; g.fillRect(0, 0, w, h);
      return c;
    }
    const unit = Math.max(w, h) / 1440;
    const warm = ['255,196,120', '255,214,160', '255,176,96', '255,228,190'], cool = ['170,205,255', '200,225,255', '150,240,230'];
    const towers = [];
    const layer = (fill, minH, maxH, minW, maxW, lit, winScale, haze) => {
      let x = -r() * 60 * unit;
      while (x < w) {
        const bw = (minW + r() * (maxW - minW)) * unit, bh = h * (minH + r() * (maxH - minH)), top = h * ROAD - bh;
        g.fillStyle = fill;
        g.fillRect(x, top, bw, h - top);
        /* roof details: a setback, a water tank or an antenna */
        const roll = r();
        if (roll < .25) g.fillRect(x + bw * .2, top - 14 * unit, bw * .6, 14 * unit);
        else if (roll < .45) { g.fillRect(x + bw * .6, top - 12 * unit, 10 * unit, 12 * unit); g.fillRect(x + bw * .6 - 2 * unit, top - 14 * unit, 14 * unit, 3 * unit); }
        else if (roll < .65) { g.fillRect(x + bw * .45, top - 40 * unit, 2 * unit, 40 * unit); towers.push([x + bw * .45 + unit, top - 40 * unit]); }
        if (bh > h * .45) towers.push([x + bw * .5, top - (roll < .25 ? 14 : 0) * unit]);
        /* windows, in floors, some floors lit all along */
        const ww = 4 * unit * winScale, wh = 6 * unit * winScale, gx = 10 * unit * winScale, gy = 13 * unit * winScale;
        const office = r() < .4;
        for (let yy = top + gy; yy < h * ROAD - gy; yy += gy) {
          const rowLit = r() < (office ? .22 : .06);
          for (let xx = x + gx * .6; xx < x + bw - gx * .6; xx += gx) {
            if (r() < (rowLit ? .8 : lit)) {
              const col = office && rowLit ? cool[(r() * 3) | 0] : r() < .8 ? warm[(r() * 4) | 0] : cool[(r() * 3) | 0];
              g.fillStyle = `rgba(${col},${(.5 + r() * .5).toFixed(2)})`; g.fillRect(xx, yy, ww, wh);
              if (r() < .3) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(xx, yy, ww * (.3 + r() * .5), wh); } /* a half-drawn curtain */
            }
          }
        }
        if (haze) { g.fillStyle = `rgba(40,30,60,${haze})`; g.fillRect(x, top - 40 * unit, bw, h - top + 40 * unit); }
        x += bw + r() * 14 * unit;
      }
    };
    layer('#0e0f1a', .3, .58, 50, 120, .09, .8, .1);
    layer('#0a0b13', .22, .66, 70, 170, .13, 1, 0);
    /* neon signs on the near blocks: a bright tube with a soft halo */
    const neon = ['255,60,170', '60,230,255', '255,90,70', '170,110,255', '255,200,60'];
    for (let i = 0; i < 13; i++) {
      const col = neon[i % neon.length], x = r() * w * .95, y = h * (.56 + r() * .24), sw = (22 + r() * 60) * unit, sh = (7 + r() * 12) * unit, vertical = r() < .3;
      const [ww2, hh2] = vertical ? [sh, sw * 1.4] : [sw, sh];
      g.shadowColor = `rgb(${col})`; g.shadowBlur = 40 * unit;
      g.fillStyle = `rgba(${col},.95)`; g.fillRect(x, y, ww2, hh2);
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + ww2 * .1, y + hh2 * .35, ww2 * .8, Math.max(1, hh2 * .15));
    }
    layer('#060609', .1, .34, 90, 220, .08, 1.3, 0);
    /* the street and its wet sheen */
    const road = g.createLinearGradient(0, h * ROAD, 0, h);
    road.addColorStop(0, '#0d0c14'); road.addColorStop(1, '#050409');
    g.fillStyle = road; g.fillRect(0, h * ROAD - 2 * unit, w, h);
    /* street lamps with their light pooled and smeared on the road */
    g.globalCompositeOperation = 'lighter';
    const smear = (x, y, rad, col, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(.25, `rgba(${col},${a * .5})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      const ref = g.createLinearGradient(0, y, 0, h);
      ref.addColorStop(0, `rgba(${col},${a * .32})`); ref.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = ref; g.fillRect(x - rad * .16, Math.max(y, h * ROAD), rad * .32, h - Math.max(y, h * ROAD));
    };
    for (let i = 0; i < 9; i++) {
      const x = (i + .3 + r() * .4) / 9 * w, y = h * (.7 + r() * .06);
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#07070b'; g.fillRect(x - 1.2 * unit, y, 2.4 * unit, h * ROAD - y);
      g.globalCompositeOperation = 'lighter'; smear(x, y, (36 + r() * 18) * unit, '255,186,110', .8 + r() * .2);
    }
    for (const [x, y] of [[.08, .82], [.34, .8], [.62, .83], [.86, .81]]) smear(x * w, y * h, 30 * unit, ['255,60,170', '60,230,255', '255,90,70', '170,110,255'][(r() * 4) | 0], .18);
    g.globalCompositeOperation = 'source-over';
    if (towersOut) towers.sort((a, b) => a[1] - b[1]).slice(0, 5).forEach(t => towersOut.push([t[0] / w, t[1] / h]));
    return c;
  }
  /* The same view through fogged glass: heavily blurred */
  function blurCopy(src, px) {
    const w = src.width, h = src.height, out = makeCanvas(w, h), g = out.getContext('2d');
    if ('filter' in g) { g.filter = `blur(${px}px)`; g.drawImage(src, -px * 2, -px * 2, w + px * 4, h + px * 4); g.filter = 'none'; }
    else { let cur = src; for (const f of [4, 8, 16]) { const t = makeCanvas(w / f, h / f); t.getContext('2d').drawImage(cur, 0, 0, t.width, t.height); cur = t; } g.drawImage(cur, 0, 0, w, h); }
    return out;
  }
  /* Storm cloud: dark most of the time, lit in full when lightning flashes */
  function paintClouds(w, h) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, N = noise2(7), M = noise2(13);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w * 5, v = y / h * 3;
      let n = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { n += a * N(u * f + M(u, v) * 1.6, v * f); f *= 2; a *= .5; }
      const fade = Math.max(0, 1 - y / (h * .72));
      const val = Math.max(0, Math.min(1, (n - .32) * 2.4)) * fade;
      const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.round(val * 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ============================================================
     Drops on the glass
     ============================================================ */
  function lensSprite(size = 96) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data, r = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + .5 - r) / r, ny = (y + .5 - r) / r, dist = Math.hypot(nx, ny);
      if (dist > 1) continue;
      const i = (y * size + x) * 4;
      d[i] = Math.round((nx * .5 + .5) * 255); d[i + 1] = Math.round((ny * .5 + .5) * 255);
      d[i + 2] = Math.round(Math.sqrt(1 - dist * dist) * 255); d[i + 3] = Math.round(255 * Math.min(1, (1 - dist) / .08));
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function softDot(size = 64) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.6, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return c;
  }
  const MIN_R = 1.8, MAX_R = 6.5;
  function Sim(w, h, k) {
    this.w = w; this.h = h; this.k = k;
    this.map = makeCanvas(w * k, h * k); this.mg = this.map.getContext('2d');
    this.wipe = makeCanvas(w / 4, h / 4); this.wg = this.wipe.getContext('2d');
    this.wg.fillStyle = '#000'; this.wg.fillRect(0, 0, this.wipe.width, this.wipe.height);
    this.lens = lensSprite(); this.dot = softDot();
    this.drops = []; this.cell = 40; this.grid = new Map();
    this.level = tune(DEFAULTS); this.spawnAcc = 0; this.fadeAcc = 0;
  }
  Sim.prototype.spawn = function () {
    const r = (MIN_R + Math.pow(Math.random(), 1.8) * (MAX_R - MIN_R)) * this.level.size;
    this.drops.push({ x: rand(-10, this.w + 10), y: rand(-20, this.h * .95), r, vy: rand(10, 50), vx: 0, pace: rand(.6, 1.35), stall: 0, sx: 1, sy: 1, dead: false });
  };
  Sim.prototype.prefill = function () { const a = this.level.spawn / 60; for (let i = 0; i < this.w * this.h / 3500 * a; i++) this.spawn(); };
  Sim.prototype.step = function (dt) {
    const L = this.level, k = this.k, sz = L.size, sp = L.speed;
    this.spawnAcc += L.spawn * dt; while (this.spawnAcc >= 1) { this.spawnAcc--; if (this.drops.length < 900) this.spawn(); }
    /* the fog creeps back over the wiped tracks (batched, as tiny fades round away on an 8-bit canvas) */
    this.fadeAcc += dt;
    if (this.fadeAcc >= .4) { this.wg.fillStyle = 'rgba(0,0,0,.05)'; this.wg.fillRect(0, 0, this.wipe.width, this.wipe.height); this.fadeAcc = 0; }
    const grid = this.grid, cs = this.cell; grid.clear();
    for (const d of this.drops) { const key = ((d.x / cs) | 0) + ',' + ((d.y / cs) | 0); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(d); }
    for (const d of this.drops) {
      if (d.dead) continue;
      /* glass has friction: drops stutter, stall and lurch rather than fall smoothly */
      if (d.stall > 0) { d.stall -= dt; d.vy *= Math.pow(.02, dt); }
      else { const top = (35 + d.r / sz * 20) * sp * d.pace; d.vy = Math.min(d.vy + top * 1.5 * dt, top); if (Math.random() < dt * .7) d.stall = rand(.03, .18) / sp; }
      d.vx += rand(-1, 1) * 160 * dt; d.vx *= Math.pow(.05, dt); d.vx = clamp(d.vx, -25, 25);
      d.x += d.vx * dt; d.y += d.vy * dt;
      const stretch = Math.min(1, d.vy / 160);
      d.sy += (1 + stretch * .5 - d.sy) * Math.min(1, dt * 10); d.sx += (1 - stretch * .18 - d.sx) * Math.min(1, dt * 10);
      this.wg.globalAlpha = .55; this.wg.drawImage(this.dot, (d.x - d.r * 1.6) / 4, (d.y - d.r * 1.6) / 4, d.r * 3.2 / 4, d.r * 3.2 / 4); this.wg.globalAlpha = 1;
      if (d.y - d.r * 2 > this.h) d.dead = true;
      const cx = (d.x / cs) | 0, cy = (d.y / cs) | 0;
      for (let gx = cx - 1; gx <= cx + 1 && !d.dead; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const b = grid.get(gx + ',' + gy); if (!b) continue;
        for (const o of b) {
          if (o === d || o.dead || d.dead) continue;
          const dx = o.x - d.x, dy = o.y - d.y, reach = (d.r + o.r) * .72;
          if (dx * dx + dy * dy > reach * reach) continue;
          const [big, small] = d.r > o.r ? [d, o] : [o, d];
          big.r = Math.min(MAX_R * 1.4 * sz, Math.sqrt(big.r * big.r + small.r * small.r * .85));
          big.vy = Math.max(big.vy, small.vy * .8); big.sx = 1.12; big.sy = .92;
          small.dead = true;
        }
      }
    }
    this.drops = this.drops.filter(d => !d.dead);
    void k;
  };
  Sim.prototype.compose = function () {
    const g = this.mg, k = this.k;
    g.clearRect(0, 0, this.map.width, this.map.height);
    for (const d of this.drops) {
      const rx = d.r * d.sx * k, ry = d.r * d.sy * k;
      g.drawImage(this.lens, d.x * k - rx, d.y * k - ry * 1.25, rx * 2, ry * 2.25); /* a teardrop: round head, tail stretched up */
    }
  };

  /* ============================================================
     Moving lights: traffic on the street and blinking tower beacons (in the city's 0..1 coordinates)
     ============================================================ */
  const MAXL = 24;
  function Traffic(towers) {
    this.cars = []; this.towers = towers; this.data = new Float32Array(MAXL * 4); this.cols = new Float32Array(MAXL * 3);
    for (let i = 0; i < 9; i++) this.car(true);
  }
  Traffic.prototype.car = function (anywhere) {
    const right = Math.random() < .5, speed = rand(.035, .07);
    this.cars.push({ x: anywhere ? Math.random() : right ? -.05 : 1.05, lane: right ? ROAD + .008 : ROAD + .024, v: right ? speed : -speed, head: right, gap: rand(.009, .012), r: rand(.0032, .0046), wait: 0 });
  };
  Traffic.prototype.step = function (dt, t, on) {
    let n = 0;
    const put = (x, y, r, a, c) => { if (n >= MAXL) return; this.data.set([x, y, r, a], n * 4); this.cols.set(c, n * 3); n++; };
    if (on) {
      for (const c of this.cars) c.x += c.v * dt;
      this.cars = this.cars.filter(c => c.x > -.08 && c.x < 1.08);
      while (this.cars.length < 9) this.car(false);
      for (const c of this.cars) {
        const col = c.head ? [1, .9, .72] : [1, .16, .12], a = c.head ? .85 : .75;
        put(c.x, c.lane, c.r, a, col); put(c.x + (c.head ? -c.gap : c.gap), c.lane, c.r, a, col);
      }
    }
    this.towers.forEach((p, i) => { const b = Math.max(0, Math.sin(t * 2.2 + i * 1.7)); put(p[0], p[1], .0028, b * b * 1.3, [1, .12, .1]); });
    for (let i = n; i < MAXL; i++) this.data[i * 4 + 3] = 0;
  };

  /* ============================================================
     WebGL renderer
     ============================================================ */
  const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uMap, uSharp, uBlur, uWipe, uCloud;
    uniform vec2 uRes;
    uniform float uTime, uFlash, uStreaks, uFog, uBright;
    uniform vec4 uL[${MAXL}];
    uniform vec3 uLC[${MAXL}];

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    /* rain falling outside, as thin slanted streaks */
    float streaks(vec2 uv, float scale, float speed, float seed) {
      vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
      p.x += p.y * .12;
      p *= vec2(scale, scale * .09);
      p.y -= uTime * speed;
      vec2 id = floor(p), f = fract(p);
      float h = hash(id + seed);
      float x0 = .15 + .7 * fract(h * 17.31);
      float width = smoothstep(.07, .0, abs(f.x - x0));
      float y0 = fract(h * 41.7) * .55, len = .25 + .2 * fract(h * 7.1);
      float t = (f.y - y0) / len;
      return step(.45, h) * width * step(0., t) * step(t, 1.) * t * t;
    }
    /* car lights and beacons: crisp through a drop, soft discs of bokeh through the fog, smeared on the wet road */
    vec3 lights(vec2 uv, float sharp) {
      vec3 s = vec3(0.);
      vec2 asp = vec2(uRes.x / uRes.y, 1.);
      for (int i = 0; i < ${MAXL}; i++) {
        vec4 L = uL[i];
        if (L.w <= 0.) continue;
        vec2 d = (uv - L.xy) * asp;
        float r = L.z * mix(2.6, 1., sharp);
        float dist = length(d);
        float disc = smoothstep(r, r * mix(.75, .3, sharp), dist);
        float glow = exp(-dist * dist / (r * r * 7.));
        float refl = step(.85, L.y) * exp(-pow(d.x / (r * .8), 2.)) * smoothstep(0., .01, d.y) * exp(-d.y * 9.) * .45;
        s += uLC[i] * L.w * (disc * .8 + glow * .35 + refl);
      }
      return s;
    }
    vec3 outside(vec2 uv, float sharp) {
      vec3 c = mix(texture2D(uBlur, uv).rgb * 1.35, texture2D(uSharp, uv).rgb, sharp);
      /* storm cloud: faintly lit from below by the city, drifting; fully revealed by lightning */
      float cl = texture2D(uCloud, uv + vec2(uTime * .0015, 0.)).r;
      c += cl * vec3(.11, .07, .12) * (1. - uv.y);
      c += uFlash * (cl * vec3(.75, .8, 1.) * 1.1 + vec3(.25, .28, .4) * (1. - uv.y) * (1. - uv.y));
      c += lights(uv, sharp);
      float s = streaks(uv, 34., 1.6, 1.) * .55 + streaks(uv, 60., 1.15, 7.) * .3 + streaks(uv, 18., 2.2, 3.) * .5;
      c += vec3(.55, .6, .7) * s * .16 * uStreaks * (1. + uFlash * 3.);
      return c;
    }
    void main() {
      vec2 uv = vUv;
      float wipe = texture2D(uWipe, uv).r;
      vec3 col = outside(uv, mix(.2, wipe * .4, uFog));
      vec3 fog = vec3(.05, .055, .07) + col * .8;
      col = mix(col, fog, (1. - wipe) * .38 * uFog);
      vec4 m = texture2D(uMap, uv);
      if (m.a > .01) {
        vec2 n = (m.rg - .5) * 2.;
        float thick = m.b;
        vec2 ruv = uv - n * vec2(.13 * uRes.y / uRes.x, .13) * (.6 + .4 * thick) + vec2(0., .03);
        vec3 lens = outside(clamp(ruv, .001, .999), 1.) * 1.5 + vec3(.012, .014, .02);
        float edge = length(n);
        lens *= 1. - smoothstep(.55, 1., edge) * .7;
        vec3 N = normalize(vec3(n * 1.2, thick + .25));
        float spec = pow(max(dot(N, normalize(vec3(-.35, -.75, .6))), 0.), 40.) * smoothstep(.3, .8, thick + edge * .3);
        float rim = pow(max(dot(N, normalize(vec3(.2, .9, .45))), 0.), 6.) * .18;
        lens += spec * (.45 + uFlash) + rim * vec3(.7, .75, .9);
        col = mix(col, lens, smoothstep(.12, .55, m.a));
      }
      vec2 q = uv - .5;
      col *= (1. - dot(q, q) * .55) * uBright;
      gl_FragColor = vec4(col, 1.);
    }`;
  function GL(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    try { gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); }
    catch (e) { console.warn('Rain shader failed, using the simple renderer', e); return null; }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const U = n => gl.getUniformLocation(prog, n);
    const tex = (unit, name) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(U(name), unit);
      return { upload(src) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } };
    };
    const T = { map: tex(0, 'uMap'), sharp: tex(1, 'uSharp'), blur: tex(2, 'uBlur'), wipe: tex(3, 'uWipe'), cloud: tex(4, 'uCloud') };
    const u = { res: U('uRes'), time: U('uTime'), flash: U('uFlash'), streaks: U('uStreaks'), fog: U('uFog'), bright: U('uBright'), L: U('uL'), LC: U('uLC') };
    return {
      setScene(sharp, blur, cloud) { T.sharp.upload(sharp); T.blur.upload(blur); T.cloud.upload(cloud); },
      draw(sim, t, flash, traffic) {
        const L = sim.level;
        gl.viewport(0, 0, canvas.width, canvas.height);
        T.map.upload(sim.map); T.wipe.upload(sim.wipe);
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.time, t % 1000); gl.uniform1f(u.flash, flash); gl.uniform1f(u.streaks, L.streaks);
        gl.uniform1f(u.fog, L.fog); gl.uniform1f(u.bright, L.bright);
        gl.uniform4fv(u.L, traffic.data); gl.uniform3fv(u.LC, traffic.cols);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
    };
  }
  /* Simple 2D fallback: the blurred street, with drops drawn as glassy circles */
  function Flat(canvas) {
    const g = canvas.getContext('2d'); let blur = null;
    return {
      setScene(sharp, b) { blur = b; },
      draw(sim, t, flash) {
        const w = canvas.width, h = canvas.height, sx = w / sim.w;
        g.drawImage(blur, 0, 0, w, h);
        if (flash > 0) { g.fillStyle = `rgba(160,175,220,${flash * .25})`; g.fillRect(0, 0, w, h); }
        if (sim.level.bright < 1) { g.fillStyle = `rgba(0,0,0,${1 - sim.level.bright})`; g.fillRect(0, 0, w, h); }
        for (const d of sim.drops) {
          const x = d.x * sx, y = d.y * sx, r = d.r * sx;
          g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, r * d.sx, r * d.sy, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(220,230,255,.35)'; g.beginPath(); g.arc(x - r * .3, y - r * .4, r * .28, 0, TAU); g.fill();
        }
      },
    };
  }

  /* ============================================================
     Sound: generated with Web Audio, nothing downloaded
     ============================================================ */
  const Sound = (() => {
    let ac = null, master = null, beds = null, dropTimer = 0, wanted = false, armed = false, nextDrop = 0;
    let vol = .6, intensity = .5, thunderOn = true, tap = null;
    function noise(sec, kind) {
      const n = Math.round(ac.sampleRate * sec), fade = Math.round(ac.sampleRate * .5), buf = ac.createBuffer(2, n, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const out = buf.getChannelData(ch), tmp = new Float32Array(n + fade);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
        for (let i = 0; i < n + fade; i++) {
          const w = Math.random() * 2 - 1;
          if (kind === 'brown') { last = (last + .02 * w) / 1.02; tmp[i] = last * 3.5; }
          else if (kind === 'pink') {
            b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
            b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
            tmp[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
          } else tmp[i] = w;
        }
        for (let i = 0; i < n; i++) out[i] = tmp[i];
        for (let i = 0; i < fade; i++) { const t = i / fade; out[i] = out[i] * t + tmp[n + i] * (1 - t); } /* loop without a seam */
      }
      return buf;
    }
    function loop(buf, nodes, gain) {
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = gain;
      let at = src; for (const n of nodes) { at.connect(n); at = n; } at.connect(g); g.connect(master);
      src.start(); return g;
    }
    const filt = (type, f, Q = .7) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = Q; return n; };
    function build() {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 10;
      master.connect(comp); comp.connect(ac.destination);
      const pink = noise(9, 'pink'), brown = noise(11, 'brown');
      tap = noise(.08, 'white');
      beds = {
        steady: loop(pink, [filt('highpass', 380), filt('lowpass', 5200)], .55), /* the main hiss of rain */
        body: loop(brown, [filt('lowpass', 900)], .5),                           /* weight and closeness */
        sheen: loop(noise(7, 'pink'), [filt('bandpass', 6500, .6)], .1),         /* fine patter on leaves and roofs */
        hum: loop(noise(13, 'brown'), [filt('lowpass', 120)], .35),              /* low hum of the city and the storm */
      };
      /* slow swells, as gusts push the rain about */
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .06; lg.gain.value = .12;
      lfo.connect(lg); lg.connect(beds.steady.gain); lfo.start();
      const lfo2 = ac.createOscillator(), lg2 = ac.createGain(); lfo2.frequency.value = .037; lg2.gain.value = .05;
      lfo2.connect(lg2); lg2.connect(beds.sheen.gain); lfo2.start();
    }
    function level() {
      if (!beds) return;
      const now = ac.currentTime, a = intensity;
      beds.steady.gain.setTargetAtTime(.25 + .5 * a, now, .8);
      beds.body.gain.setTargetAtTime(.15 + .55 * a, now, .8);
      beds.sheen.gain.setTargetAtTime(.04 + .12 * a, now, .8);
      master.gain.setTargetAtTime(wanted ? vol * 1.9 : 0, now, wanted ? .9 : .35);
    }
    /* single drops tapping the window, scheduled 1.5 s ahead so they keep going when a background tab slows timers down */
    function drops() {
      if (!ac || !wanted || ac.state !== 'running') return;
      const now = ac.currentTime, rate = 4 + 26 * intensity;
      let t = Math.max(nextDrop, now + .02);
      while (t < now + 1.5) {
        t += -Math.log(1 - Math.random()) / rate;
        const src = ac.createBufferSource(); src.buffer = tap; src.playbackRate.value = rand(.7, 1.4);
        const big = Math.random() < .12, bp = filt('bandpass', big ? rand(900, 1600) : rand(2000, 5200), big ? 4 : rand(2, 6));
        const g = ac.createGain(), pan = ac.createStereoPanner ? ac.createStereoPanner() : null, peak = (big ? .5 : .22) * rand(.4, 1);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + (big ? .12 : rand(.025, .06)));
        src.connect(bp); bp.connect(g);
        if (pan) { pan.pan.value = rand(-.9, .9); g.connect(pan); pan.connect(master); } else g.connect(master);
        src.start(t); src.stop(t + .15);
      }
      nextDrop = t;
    }
    function thunder(power) {
      if (!ac || !wanted || !thunderOn) return;
      const delay = rand(.6, 3.5) / (.6 + power), t0 = ac.currentTime + delay, len = rand(5, 9);
      const out = ac.createGain(); out.gain.value = vol > 0 ? 1 : 0; out.connect(master);
      if (delay < 1.6) { /* close enough for a crack */
        const src = ac.createBufferSource(); src.buffer = noise(1.2, 'white');
        const lp = filt('lowpass', 2600), g = ac.createGain();
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.55 * power, t0 + .015); g.gain.exponentialRampToValueAtTime(.001, t0 + .7);
        src.connect(lp); lp.connect(g); g.connect(out); src.start(t0); src.stop(t0 + 1.2);
      }
      const src = ac.createBufferSource(); src.buffer = noise(len + .5, 'brown');
      const lp = filt('lowpass', 420), g = ac.createGain();
      lp.frequency.setValueAtTime(420, t0); lp.frequency.exponentialRampToValueAtTime(90, t0 + len);
      g.gain.setValueAtTime(0, t0);
      let t = t0 + .05; g.gain.linearRampToValueAtTime(.9 * power, t + .25);
      while (t < t0 + len - 1) { t += rand(.35, 1.1); g.gain.linearRampToValueAtTime(rand(.35, 1) * power * (1 - (t - t0) / len), t); }
      g.gain.linearRampToValueAtTime(0, t0 + len);
      src.connect(lp); lp.connect(g); g.connect(out); src.start(t0); src.stop(t0 + len + .5);
    }
    /* browsers only let a page start sound after a click or key press */
    function arm() {
      if (armed) return; armed = true;
      const go = () => { armed = false; window.removeEventListener('pointerdown', go, true); window.removeEventListener('keydown', go, true); if (wanted) start(); };
      window.addEventListener('pointerdown', go, true); window.addEventListener('keydown', go, true);
    }
    function start() {
      try { if (!ac) build(); } catch (e) { return; }
      if (!ac.onstatechange) ac.onstatechange = () => onChange();
      if (ac.state === 'suspended') ac.resume().then(() => { level(); onChange(); }, () => arm()).catch(() => arm());
      level();
      if (!dropTimer) dropTimer = setInterval(drops, 250);
      if (ac.state !== 'running') arm();
    }
    let onChange = () => {};
    return {
      /* 'off', 'blocked' (wanted but the browser is waiting for a click) or 'playing' */
      status: () => !wanted ? 'off' : ac && ac.state === 'running' ? 'playing' : 'blocked',
      watch(fn) { onChange = fn; },
      set(o) {
        vol = clamp(o.volume / 100, 0, 1); intensity = o.amount; thunderOn = o.thunder;
        if (o.on && !wanted) { wanted = true; start(); }
        else if (!o.on && wanted) { wanted = false; if (ac) level(); if (dropTimer) { clearInterval(dropTimer); dropTimer = 0; } }
        else level();
        onChange();
      },
      thunder,
    };
  })();

  /* ============================================================
     Engine
     ============================================================ */
  let canvas = null, renderer = null, sim = null, traffic = null, active = false, opts = { ...DEFAULTS }, paintedCity = null;
  let raf = 0, last = 0, clock = rand(0, 100), W = 0, H = 0, flash = 0, nextFlash = 12, resizeT = 0;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    paintScene();
    sim = new Sim(W, H, Math.min(.75, 1100 / W));
    sim.level = tune(opts);
    sim.prefill();
    for (let i = 0; i < 90; i++) sim.step(1 / 30); /* start mid-shower rather than on a dry pane */
  }
  function paintScene() {
    const ps = Math.min(1, 1600 / W), towers = [], city = paintCity(W * ps, H * ps, opts.city, towers);
    renderer.setScene(city, blurCopy(city, Math.round(22 * ps)), paintClouds(Math.round(W * ps / 4), Math.round(H * ps / 4)));
    traffic = new Traffic(opts.city ? towers : []);
    paintedCity = opts.city;
  }
  function ensureCanvas() {
    if (canvas) return;
    const make = () => { const c = document.createElement('canvas'); c.id = 'scene-rain'; c.className = 'scene-canvas'; c.setAttribute('aria-hidden', 'true'); document.body.prepend(c); return c; };
    canvas = make();
    renderer = GL(canvas);
    if (!renderer) { canvas.remove(); canvas = make(); renderer = Flat(canvas); }
    window.addEventListener('resize', () => { if (!active) return; clearTimeout(resizeT); resizeT = setTimeout(() => { build(); if (!raf) once(); }, 150); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (active) start(); });
  }
  function lightning(dt) {
    const L = sim.level;
    if (L.lightning > 0) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 1; nextFlash = rand(.4, 1.6) / L.lightning; Sound.thunder(rand(.5, 1)); }
    }
    if (flash <= 0) return 0;
    const f = flash; flash = Math.max(0, flash - dt * 1.25);
    return f > .82 ? 1 : f > .7 ? .15 : f > .58 ? .75 : f > .5 ? .2 : f * .7;
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; clock += dt;
    sim.step(dt); sim.compose();
    traffic.step(dt, clock, opts.traffic && opts.city);
    renderer.draw(sim, clock, lightning(dt), traffic);
    raf = requestAnimationFrame(frame);
  }
  function once() { sim.compose(); traffic.step(0, clock, opts.traffic && opts.city); renderer.draw(sim, clock, 0, traffic); }
  function start() { stop(); if (reduce()) { once(); return; } last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  /* A small button in the corner: shows whether the rain is audible, and starts it (browsers need a click for sound) */
  let btn = null;
  function soundButton() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.className = 'rain-sound'; btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="w1" d="M15.5 8.5a5 5 0 0 1 0 7"/><path class="w2" d="M18.5 5.5a9 9 0 0 1 0 13"/><path class="x" d="m16 9 6 6m0-6-6 6"/></svg><span></span>';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const st = Sound.status();
      /* 'blocked' just needs this click to start; otherwise flip the setting (the app saves it) */
      if (st === 'blocked') Sound.set(soundState());
      else window.dispatchEvent(new CustomEvent('chronos:rain-sound', { detail: { on: st === 'off' } }));
    });
    document.body.appendChild(btn);
    Sound.watch(paintButton);
    return btn;
  }
  function paintButton() {
    if (!btn) return;
    btn.hidden = !active;
    const st = Sound.status();
    btn.dataset.state = st;
    btn.querySelector('span').textContent = st === 'blocked' ? 'Tap to hear the rain' : st === 'playing' ? 'Rain sound on' : 'Rain sound off';
    btn.setAttribute('aria-label', st === 'playing' ? 'Turn rain sound off' : 'Turn rain sound on');
    btn.title = btn.getAttribute('aria-label');
  }
  const soundState = () => ({ on: active && opts.sound, volume: opts.volume, amount: tune(opts).a, thunder: opts.thunder && opts.lightning });

  window.ChronosRain = {
    /* on: show or hide the scene. o: any of DEFAULTS' keys */
    set(on, o = {}) {
      for (const key in DEFAULTS) if (o[key] !== undefined && o[key] !== null) opts[key] = o[key];
      if (!on) { if (active) { stop(); active = false; canvas.hidden = true; } Sound.set(soundState()); paintButton(); return; }
      if (active) {
        sim.level = tune(opts);
        if (paintedCity !== opts.city) paintScene();
        if (!raf) once();
      } else {
        ensureCanvas(); canvas.hidden = false; active = true;
        build(); start();
      }
      soundButton();
      Sound.set(soundState());
      paintButton();
    },
  };
})();
