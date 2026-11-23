/* Chronos — "Rain on glass" scene.

   You are looking out of a window at a city at night. Rain falls outside, and on the glass itself:
   - tiny droplets bead up all over the pane,
   - bigger drops grow until they are heavy enough to slide, in stop-start runs, leaving a trail of beads behind,
   - sliding drops swallow whatever they run into and wipe a clear path through the fog on the glass,
   - every drop is a little lens that shows an upside-down, sharper view of the street behind it.

   How it works: the drops are simulated on a 2D canvas (the "drop map"). Each drop is stamped from a sprite whose
   red/green channels hold the surface normal, blue its thickness and alpha its coverage. A WebGL shader reads that
   map and refracts a painted city backdrop through it. Without WebGL it falls back to a simpler 2D drawing.

   The scene pauses while the tab is hidden and draws one still frame when the system asks for reduced motion. */
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const LEVELS = {
    drizzle: { spawn: 7, beads: 90, lightning: 0, streaks: .45 },
    rain: { spawn: 16, beads: 200, lightning: 1 / 40, streaks: .8 },
    storm: { spawn: 34, beads: 360, lightning: 1 / 12, streaks: 1.25 },
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  /* ============================================================
     The view outside: a city at night, painted once per resize.
     ============================================================ */
  function paintCity(w, h) {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#04050a'); sky.addColorStop(.45, '#0a0c16'); sky.addColorStop(.75, '#15131f'); sky.addColorStop(1, '#0d0c13');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    /* the orange-violet glow a city throws up into low cloud */
    const glow = g.createRadialGradient(w * .55, h * .95, 0, w * .55, h * .95, w * .7);
    glow.addColorStop(0, 'rgba(120,70,90,.35)'); glow.addColorStop(.5, 'rgba(60,40,80,.15)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);

    const unit = Math.max(w, h) / 1440;
    const warm = ['255,196,120', '255,214,160', '255,170,90'], cool = ['170,205,255', '200,225,255'];
    const layer = (fill, minH, maxH, minW, maxW, lit, winScale) => {
      let x = -rand(0, 60) * unit;
      while (x < w) {
        const bw = rand(minW, maxW) * unit, bh = h * rand(minH, maxH), top = h - bh;
        g.fillStyle = fill; g.fillRect(x, top, bw, bh);
        if (Math.random() < .25) g.fillRect(x + bw * .4, top - 30 * unit, 2 * unit, 30 * unit); /* antenna */
        const ww = 3 * unit * winScale, wh = 4.5 * unit * winScale, gx = 9 * unit * winScale, gy = 12 * unit * winScale;
        const floorLit = Math.random() < .5;
        for (let yy = top + gy; yy < h - gy; yy += gy) {
          const rowLit = floorLit && Math.random() < .25;
          for (let xx = x + gx * .6; xx < x + bw - gx * .6; xx += gx) {
            if (Math.random() < (rowLit ? .7 : lit)) {
              const col = Math.random() < .78 ? warm[(Math.random() * 3) | 0] : cool[(Math.random() * 2) | 0];
              g.fillStyle = `rgba(${col},${rand(.35, .95).toFixed(2)})`; g.fillRect(xx, yy, ww, wh);
            }
          }
        }
        x += bw + rand(0, 14) * unit;
      }
    };
    layer('#0b0c15', .28, .5, 50, 120, .05, .8);
    layer('#08090f', .2, .62, 70, 170, .09, 1);
    /* a few neon signs on the near blocks */
    const neon = ['255,60,170', '60,230,255', '255,90,70', '170,110,255'];
    for (let i = 0; i < 6; i++) {
      const col = neon[i % neon.length], x = rand(.02, .95) * w, y = h * rand(.55, .82), sw = rand(26, 70) * unit, sh = rand(8, 16) * unit;
      g.shadowColor = `rgb(${col})`; g.shadowBlur = 24 * unit;
      g.fillStyle = `rgba(${col},.9)`; g.fillRect(x, y, sw, sh);
    }
    g.shadowBlur = 0;
    layer('#050509', .1, .34, 90, 220, .04, 1.3);

    /* street: lamps, headlights and tail lights, and their smeared reflections on the wet road */
    g.globalCompositeOperation = 'lighter';
    const road = h * .9;
    const light = (x, y, r, col, a) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(.25, `rgba(${col},${a * .5})`); grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      const ref = g.createLinearGradient(0, y, 0, Math.min(h, y + (h - y) * 1.6 + 40 * unit));
      ref.addColorStop(0, `rgba(${col},${a * .35})`); ref.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = ref; g.fillRect(x - r * .18, y, r * .36, h - y);
    };
    for (let i = 0; i < 9; i++) light(rand(0, w), h * rand(.66, .78), rand(18, 34) * unit, '255,190,110', rand(.35, .6));
    for (let i = 0; i < 16; i++) {
      const x = rand(0, w), y = road + rand(-12, 10) * unit, tail = Math.random() < .55;
      light(x, y, rand(8, 18) * unit, tail ? '255,50,50' : '255,245,225', rand(.4, .8));
      light(x + rand(14, 22) * unit, y, rand(8, 18) * unit, tail ? '255,50,50' : '255,245,225', rand(.4, .8));
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  /* The same view through fogged glass: heavily blurred and a touch darker */
  function blurCopy(src, px) {
    const w = src.width, h = src.height, out = makeCanvas(w, h), g = out.getContext('2d');
    if ('filter' in g) {
      g.filter = `blur(${px}px)`;
      g.drawImage(src, -px * 2, -px * 2, w + px * 4, h + px * 4);
      g.filter = 'none';
    } else { /* step down and back up, which blurs without filter support */
      let cur = src;
      for (const f of [4, 8, 16]) { const t = makeCanvas(w / f, h / f); t.getContext('2d').drawImage(cur, 0, 0, t.width, t.height); cur = t; }
      g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, w, h);
    }
    g.fillStyle = 'rgba(6,7,12,.06)'; g.fillRect(0, 0, w, h);
    return out;
  }

  /* ============================================================
     Drop sprites
     ============================================================ */
  /* The lens sprite for the drop map: RG = surface normal, B = thickness, A = coverage */
  function lensSprite(size = 96) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data, r = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const nx = (x + .5 - r) / r, ny = (y + .5 - r) / r, dist = Math.hypot(nx, ny);
      if (dist > 1) continue;
      const i = (y * size + x) * 4;
      d[i] = Math.round((nx * .5 + .5) * 255);
      d[i + 1] = Math.round((ny * .5 + .5) * 255);
      d[i + 2] = Math.round(Math.sqrt(1 - dist * dist) * 255);
      d[i + 3] = Math.round(255 * Math.min(1, (1 - dist) / .08));
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  /* A soft white dot, used to wipe fog off the glass */
  function softDot(size = 64) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.6, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return c;
  }

  /* ============================================================
     Drop simulation (all units are CSS pixels)
     ============================================================ */
  const MIN_R = 3, SLIDE_R = 12, MAX_R = 30;
  function Sim(w, h, mapScale) {
    this.w = w; this.h = h; this.k = mapScale;
    this.map = makeCanvas(w * mapScale, h * mapScale); this.mg = this.map.getContext('2d');
    this.beads = makeCanvas(w * mapScale, h * mapScale); this.bg = this.beads.getContext('2d');
    this.wipe = makeCanvas(w / 4, h / 4); this.wg = this.wipe.getContext('2d');
    this.wg.fillStyle = '#000'; this.wg.fillRect(0, 0, this.wipe.width, this.wipe.height);
    this.lens = lensSprite(); this.dot = softDot();
    this.drops = []; this.cell = 40; this.grid = new Map();
    this.level = LEVELS.rain; this.spawnAcc = 0; this.beadAcc = 0; this.fadeAcc = 0;
  }
  Sim.prototype.add = function (x, y, r, moving) {
    const d = { x, y, r, vy: 0, vx: 0, moving: !!moving, stall: 0, trail: 0, nextTrail: rand(6, 24), sx: 1, sy: 1, dead: false, wob: rand(0, TAU) };
    this.drops.push(d); return d;
  };
  Sim.prototype.spawn = function () {
    const r = MIN_R + Math.pow(Math.random(), 2.4) * (MAX_R * .7 - MIN_R);
    this.add(rand(-10, this.w + 10), rand(-10, this.h * .98), r, false);
  };
  /* Paint the little beads that mist the whole pane */
  Sim.prototype.bead = function () {
    const r = rand(.9, 2.4) * (Math.random() < .1 ? 1.7 : 1), k = this.k, x = Math.random() * this.w, y = Math.random() * this.h;
    this.bg.drawImage(this.lens, (x - r) * k, (y - r) * k, r * 2 * k, r * 2 * k * rand(.9, 1.1));
  };
  Sim.prototype.prefill = function () {
    for (let i = 0; i < this.w * this.h / 420; i++) this.bead();
    for (let i = 0; i < this.w * this.h / 9000; i++) this.spawn();
  };
  Sim.prototype.step = function (dt) {
    const L = this.level, k = this.k;
    this.spawnAcc += L.spawn * dt; while (this.spawnAcc >= 1) { this.spawnAcc--; if (this.drops.length < 900) this.spawn(); }
    this.beadAcc += L.beads * dt; while (this.beadAcc >= 1) { this.beadAcc--; this.bead(); }
    /* beads slowly evaporate, and the fog slowly creeps back over wiped paths */
    /* (batched, because tiny per-frame fades round away to nothing on an 8-bit canvas) */
    this.fadeAcc += dt;
    if (this.fadeAcc >= .4) {
      this.bg.globalCompositeOperation = 'destination-out';
      this.bg.fillStyle = 'rgba(0,0,0,.035)'; this.bg.fillRect(0, 0, this.beads.width, this.beads.height);
      this.bg.globalCompositeOperation = 'source-over';
      this.wg.fillStyle = 'rgba(0,0,0,.05)'; this.wg.fillRect(0, 0, this.wipe.width, this.wipe.height);
      this.fadeAcc = 0;
    }

    /* spatial grid for collisions */
    const grid = this.grid, cs = this.cell; grid.clear();
    for (const d of this.drops) { const key = ((d.x / cs) | 0) + ',' + ((d.y / cs) | 0); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(d); }

    const born = [];
    for (const d of this.drops) {
      if (d.dead) continue;
      if (!d.moving) {
        if (d.r >= SLIDE_R && Math.random() < dt * (d.r - SLIDE_R + .6) * .5) { d.moving = true; d.vy = 0; }
        d.sy += (1 - d.sy) * Math.min(1, dt * 6); d.sx += (1 - d.sx) * Math.min(1, dt * 6);
      } else {
        /* glass has friction: drops stutter, stall and lurch rather than fall smoothly */
        if (d.stall > 0) { d.stall -= dt; d.vy *= Math.pow(.02, dt); }
        else {
          d.vy = Math.min(d.vy + (40 + d.r * 16) * dt, 20 + d.r * 10);
          if (Math.random() < dt * 1.3) { d.stall = rand(.04, .35) * (d.r < 16 ? 1.6 : 1); }
        }
        d.vx += rand(-1, 1) * 160 * dt; d.vx *= Math.pow(.05, dt); d.vx = Math.max(-25, Math.min(25, d.vx));
        d.x += d.vx * dt; d.y += d.vy * dt;
        /* stretch with speed */
        const stretch = Math.min(1, d.vy / 220);
        d.sy += (1 + stretch * .5 - d.sy) * Math.min(1, dt * 10); d.sx += (1 - stretch * .18 - d.sx) * Math.min(1, dt * 10);
        /* leave a trail of beads and lose a little water doing it */
        d.trail += d.vy * dt;
        if (d.trail > d.nextTrail && d.r > 7) {
          d.trail = 0; d.nextTrail = rand(7, 30) * (18 / d.r);
          const tr = d.r * rand(.16, .32);
          born.push([d.x + rand(-d.r * .25, d.r * .25), d.y - d.r * d.sy * rand(.9, 1.4), tr]);
          d.r *= .987;
        }
        /* clear the mist and fog it runs through */
        this.bg.globalCompositeOperation = 'destination-out';
        this.bg.drawImage(this.dot, (d.x - d.r * 1.05) * k, (d.y - d.r * 1.25) * k, d.r * 2.1 * k, d.r * 2.5 * k);
        this.bg.globalCompositeOperation = 'source-over';
        this.wg.globalAlpha = .55; this.wg.drawImage(this.dot, (d.x - d.r * 1.6) / 4, (d.y - d.r * 1.6) / 4, d.r * 3.2 / 4, d.r * 3.2 / 4); this.wg.globalAlpha = 1;
        if (d.r < 6.5) d.moving = false;
        if (d.y - d.r * 2 > this.h) d.dead = true;
      }
      /* merge with anything it touches; the bigger one survives and takes the water */
      const cx = (d.x / cs) | 0, cy = (d.y / cs) | 0;
      for (let gx = cx - 1; gx <= cx + 1 && !d.dead; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const b = grid.get(gx + ',' + gy); if (!b) continue;
        for (const o of b) {
          if (o === d || o.dead || d.dead) continue;
          const dx = o.x - d.x, dy = o.y - d.y, reach = (d.r + o.r) * .72;
          if (dx * dx + dy * dy > reach * reach) continue;
          if (!d.moving && !o.moving && Math.random() > .5) continue; /* still drops sit side by side for a while */
          const [big, small] = (d.r > o.r || (d.moving && !o.moving)) ? [d, o] : [o, d];
          big.r = Math.min(MAX_R * 1.25, Math.sqrt(big.r * big.r + small.r * small.r * .85));
          if (small.moving) { big.moving = true; big.vy = Math.max(big.vy, small.vy * .8); }
          big.sx = 1.12; big.sy = .92; /* a little wobble on impact */
          small.dead = true;
        }
      }
    }
    for (const [x, y, r] of born) this.add(x, y, r, false);
    this.drops = this.drops.filter(d => !d.dead);
  };
  /* Compose the map: the bead layer, then every drop stamped on top */
  Sim.prototype.compose = function () {
    const g = this.mg, k = this.k;
    g.clearRect(0, 0, this.map.width, this.map.height);
    g.drawImage(this.beads, 0, 0);
    for (const d of this.drops) {
      const rx = d.r * d.sx * k, ry = d.r * d.sy * k;
      /* moving drops are teardrops: a round head with the tail stretched upward */
      g.drawImage(this.lens, d.x * k - rx, d.y * k - ry * (d.moving ? 1.25 : 1), rx * 2, ry * (d.moving ? 2.25 : 2));
    }
  };

  /* ============================================================
     WebGL renderer
     ============================================================ */
  const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uMap, uSharp, uBlur, uWipe;
    uniform vec2 uRes;
    uniform float uTime, uFlash, uStreaks;

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
      float body = step(0., t) * step(t, 1.) * t * t;
      return step(.45, h) * width * body;
    }
    vec3 outside(vec2 uv, float sharp) {
      vec3 c = mix(texture2D(uBlur, uv).rgb, texture2D(uSharp, uv).rgb, sharp);
      float s = streaks(uv, 34., 1.6, 1.) * .55 + streaks(uv, 60., 1.15, 7.) * .3 + streaks(uv, 18., 2.2, 3.) * .5;
      c += vec3(.55, .6, .7) * s * .16 * uStreaks;
      /* lightning lights up the clouds most, the street least */
      c += uFlash * vec3(.55, .6, .78) * (.15 + .85 * (1. - uv.y) * (1. - uv.y)) * .55;
      return c;
    }
    void main() {
      vec2 uv = vUv;
      float wipe = texture2D(uWipe, uv).r;
      /* the pane: fogged where nothing has run down it, clearer in the wiped tracks */
      vec3 col = outside(uv, wipe * .4);
      vec3 fog = vec3(.07, .075, .09) + col * .55;
      col = mix(col, fog, (1. - wipe) * .38);

      vec4 m = texture2D(uMap, uv);
      if (m.a > .01) {
        vec2 n = (m.rg - .5) * 2.;
        float thick = m.b;
        /* a drop is a fisheye lens: it shows a wide, flipped, sharp view of the street */
        vec2 ruv = uv - n * vec2(.13 * uRes.y / uRes.x, .13) * (.6 + .4 * thick) + vec2(0., .03);
        vec3 lens = outside(clamp(ruv, .001, .999), 1.) * 1.5 + vec3(.012, .014, .02);
        /* darker rim where light bends away, a soft inner glow, and a sharp highlight from above */
        float edge = length(n);
        lens *= 1. - smoothstep(.55, 1., edge) * .7;
        vec3 N = normalize(vec3(n * 1.2, thick + .25));
        float spec = pow(max(dot(N, normalize(vec3(-.35, -.75, .6))), 0.), 40.) * smoothstep(.3, .8, thick + edge * .3);
        float rim = pow(max(dot(N, normalize(vec3(.2, .9, .45))), 0.), 6.) * .18;
        lens += spec * .45 + rim * vec3(.7, .75, .9);
        float a = smoothstep(.12, .55, m.a);
        col = mix(col, lens, a);
      }
      /* soft vignette so the corners fall into the dark */
      vec2 q = uv - .5;
      col *= 1. - dot(q, q) * .55;
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
      return { unit, t, upload(src) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } };
    };
    const T = { map: tex(0, 'uMap'), sharp: tex(1, 'uSharp'), blur: tex(2, 'uBlur'), wipe: tex(3, 'uWipe') };
    const u = { res: U('uRes'), time: U('uTime'), flash: U('uFlash'), streaks: U('uStreaks') };
    return {
      setScene(sharp, blur) { T.sharp.upload(sharp); T.blur.upload(blur); },
      draw(sim, t, flash, streakAmt) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        T.map.upload(sim.map); T.wipe.upload(sim.wipe);
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.time, t % 1000); gl.uniform1f(u.flash, flash); gl.uniform1f(u.streaks, streakAmt);
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
        for (const d of sim.drops) {
          const x = d.x * sx, y = d.y * sx, r = d.r * sx;
          g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, r * d.sx, r * d.sy, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(220,230,255,.35)'; g.beginPath(); g.arc(x - r * .3, y - r * .4, r * .28, 0, TAU); g.fill();
        }
      },
    };
  }

  /* ============================================================
     Engine
     ============================================================ */
  let canvas = null, renderer = null, sim = null, active = false, level = 'rain';
  let raf = 0, last = 0, clock = rand(0, 100), W = 0, H = 0, flash = 0, nextFlash = 20, resizeT = 0;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    /* paint the street at no more than ~1600px wide; the blur hides the rest */
    const ps = Math.min(1, 1600 / W), city = paintCity(W * ps, H * ps);
    renderer.setScene(city, blurCopy(city, Math.round(22 * ps)));
    sim = new Sim(W, H, Math.min(.75, 1100 / W));
    sim.level = LEVELS[level] || LEVELS.rain;
    sim.prefill();
    for (let i = 0; i < 90; i++) sim.step(1 / 30); /* start mid-shower rather than on a dry pane */
  }
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'scene'; canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    renderer = GL(canvas);
    if (!renderer) { canvas.remove(); canvas = document.createElement('canvas'); canvas.id = 'scene'; canvas.setAttribute('aria-hidden', 'true'); document.body.prepend(canvas); renderer = Flat(canvas); }
    window.addEventListener('resize', () => {
      if (!active) return;
      clearTimeout(resizeT); resizeT = setTimeout(() => { build(); if (!raf) once(); }, 150);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (active) start(); });
  }
  function lightning(dt) {
    const L = sim.level;
    if (L.lightning > 0) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 1; nextFlash = rand(.4, 1.6) / L.lightning; }
    }
    if (flash <= 0) return 0;
    const f = flash; flash = Math.max(0, flash - dt * 1.25);
    return f > .82 ? 1 : f > .7 ? .15 : f > .58 ? .75 : f > .5 ? .2 : f * .7;
  }
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; clock += dt;
    sim.step(dt); sim.compose();
    renderer.draw(sim, clock, lightning(dt), sim.level.streaks);
    raf = requestAnimationFrame(frame);
  }
  function once() { sim.compose(); renderer.draw(sim, clock, 0, sim.level.streaks); }
  function start() {
    stop();
    if (reduce()) { once(); return; }
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  window.ChronosScenes = {
    set(id, opts = {}) {
      const want = id === 'rain';
      const newLevel = LEVELS[opts.level] ? opts.level : 'rain';
      if (!want) { if (active) { stop(); active = false; canvas.hidden = true; } return; }
      if (active) { if (newLevel !== level) { level = newLevel; sim.level = LEVELS[level]; } return; }
      level = newLevel;
      ensureCanvas(); canvas.hidden = false; active = true;
      build(); start();
    },
  };
})();
