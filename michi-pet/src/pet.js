// Michi Pet — comportamiento del gatito. Funciona en la app de escritorio y en la página de prueba.
(() => {
  const host = window.michipetHost || null;           // presente solo dentro de la app de Windows
  const META = window.MICHIPET_META;                  // tamaño de cada clip
  const SRC = window.MICHIPET_SRC;                    // ruta o data-URI de cada clip
  const stage = document.getElementById('stage');
  const pet = document.getElementById('pet');
  const shadow = document.getElementById('shadow');
  const statusEl = document.getElementById('status');
  const probe = document.getElementById('probe');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ——— videos ———
  const LOOP = { walk: true, sit: true, groom: false, belly: true, held: true, sleep: true, play: false, paw: false, knead: true };
  const FOOT = { walk: .985, sit: .995, groom: .995, belly: .99, held: 1, sleep: .99, play: .98, paw: .995, knead: .985 };
  const OFFX = { play: 22.5, knead: 5 }; // el clip de juego está corrido hacia adelante respecto de la caminata
  const vids = {};
  for (const name of Object.keys(META)) {
    if (!SRC[name]) continue;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.loop = LOOP[name]; v.preload = 'auto';
    v.src = SRC[name]; v.className = 'clip'; v.dataset.clip = name;
    pet.appendChild(v); vids[name] = v;
  }
  vids.groom.addEventListener('ended', () => { if (S.mode === 'groom') setMode('sit', rand(2500, 5000)); });
  if (vids.paw) vids.paw.addEventListener('ended', () => { if (S.mode === 'paw') setMode('sit', rand(2500, 5000)); });

  // ——— estado ———
  const S = { x: 300, y: 0, vx: 0, vy: 0, dir: 1, mode: 'sit', clip: 'sit', until: 0, target: 0, rate: 1,
              lastTouch: performance.now(), rub: 0, airborne: false, napUntil: 0 };
  let W = 0, ground = 0, unit = 1, paused = false, soundOn = true;

  const TEXT = { knead: 'está amasando feliz', paw: 'mueve las patitas de contento', chase: 'persigue el ovillo', play: 'juega con el ovillo', walk: 'está paseando', run: 'va corriendo', sit: 'está sentadito', groom: 'se está lamiendo la patita',
                 belly: 'ronronea panza arriba', held: 'está en tus brazos', fall: 'va cayendo de patitas', sleep: 'está durmiendo' };
  const CLIP = { knead: 'knead', paw: 'paw', chase: 'walk', play: 'play', walk: 'walk', run: 'walk', sit: 'sit', groom: 'groom', belly: 'belly', held: 'held', fall: 'held', sleep: 'sleep' };

  function showClip(name) {
    if (S.clip === name && vids[name].classList.contains('on')) return;
    for (const [n, v] of Object.entries(vids)) {
      if (n === name) { v.classList.add('on'); if (!LOOP[n] && n !== 'play') v.currentTime = 0; if (!paused) v.play().catch(() => {}); }
      else { v.classList.remove('on'); const vv = v; setTimeout(() => { if (!vv.classList.contains('on')) vv.pause(); }, 260); }
    }
    S.clip = name;
  }
  function setMode(m, ms = 0) {
    S.mode = m; S.until = performance.now() + ms; S.pendingNap = null;
    showClip(CLIP[m]);
    S.rate = m === 'run' ? 2.1 : 1; vids.walk.playbackRate = S.rate;
    if (m === 'chase') setChaseRate(1);
    if (statusEl) statusEl.textContent = 'Michi Pet ' + TEXT[m];
    if (m === 'belly' || m === 'knead') startPurr(); else stopPurr();
    layout();
  }

  // ——— tamaño en pantalla: el clip de caminata mide 6 cm de ancho ———
  function measure() {
    const cm6 = probe ? probe.getBoundingClientRect().width : 227;
    unit = cm6 / META.walk.w;
    const r = stage.getBoundingClientRect(); W = r.width;
    ground = host ? host.getGround() : r.height - (document.getElementById('floor')?.offsetHeight || 0) * .45;
    for (const [n, v] of Object.entries(vids)) { v.style.width = META[n].w * unit + 'px'; v.style.height = META[n].h * unit + 'px'; }
    shadow.style.width = META.walk.w * unit * .55 + 'px';
    if (typeof sizeYarn === 'function' && Y) sizeYarn();
    S.x = clamp(S.x, halfW(), W - halfW());
    if (!S.airborne && S.mode !== 'held') S.y = ground;
    layout();
  }
  const halfW = (c = S.clip) => META[c].w * unit / 2;

  // ——— dibujo ———
  function layout() {
    const c = S.clip, w = META[c].w * unit, h = META[c].h * unit;
    let top;
    if (S.mode === 'held' || S.mode === 'fall') top = S.y - h * .06;      // lo tomas de la nuca
    else top = S.y - h * FOOT[c];
    const ox = (OFFX[c] || 0) * unit * S.dir;
    pet.style.transform = `translate(${(S.x + ox - w / 2).toFixed(1)}px,${top.toFixed(1)}px)`;
    pet.style.width = w + 'px'; pet.style.height = h + 'px';
    pet.classList.toggle('left', S.dir < 0);
    const lift = (S.mode === 'held' || S.mode === 'fall') ? Math.max(0, ground - (top + h)) : 0;
    const k = Math.max(.25, 1 - lift / 400);
    shadow.style.transform = `translate(${(S.x - META.walk.w * unit * .275).toFixed(1)}px,${(ground - 8).toFixed(1)}px) scale(${k.toFixed(2)})`;
    shadow.style.opacity = (k * (c === 'belly' || c === 'sleep' ? .7 : .85)).toFixed(2);
    if (host) hitbox = { x: S.x + ox - w / 2 + w * .12, y: top + h * .08, w: w * .76, h: h * .9 };
    drawYarn();
    if (host) sendHits();
  }

  // ——— comportamiento propio ———
  const STRIDE = .47; // la pata apoyada avanza 0.47 anchos de clip por segundo: velocidad calzada con el paso
  function brain(now, dt) {
    const m = S.mode;
    if (m === 'held') return;
    if (m === 'fall') return;
    if (m === 'belly') { if (now > S.until) { if (vids.knead && Math.random() < .7) { S.dir = Math.random() < .5 ? 1 : -1; setMode('knead', rand(3500, 6000)); } else setMode('sit', rand(2500, 4500)); } return; }
    if (m === 'knead') { if (now > S.until) setMode('sit', rand(2500, 4500)); return; }
    if (m === 'paw') return; // termina al acabar el clip
    if (m === 'sleep') { if (S.napUntil && now > S.napUntil) { S.napUntil = 0; setMode('sit', 3000); } return; }
    if (m === 'groom') return; // termina al acabar el clip
    if (yarnBrain(now, dt)) return;
    if (m === 'walk' || m === 'run') {
      const speed = STRIDE * META.walk.w * unit * S.rate;
      const dx = S.target - S.x;
      if (Math.abs(dx) < 4) { if (S.pendingNap != null) { napNow(S.pendingNap); return; } setMode(pick(['sit', 'sit', 'groom']), rand(3000, 7000)); return; }
      S.dir = Math.sign(dx);
      S.x += S.dir * Math.min(Math.abs(dx), speed * dt);
      if (m === 'run' && now > S.until) setMode('walk');
      return;
    }
    // sentado
    const idle = now - S.lastTouch;
    if (idle > 180000) { goSleep(0); return; }
    if (now < S.until) return;
    const r = Math.random();
    if (Y.on && r < .2) { interest(); return; }
    if (vids.knead && r > .93) { setMode('knead', rand(4000, 7000)); return; }
    if (vids.paw && r > .88 && r <= .93) { setMode('paw'); return; }
    if (r < .55) walkTo(rand(halfW('walk'), W - halfW('walk')), Math.random() < .15);
    else if (r < .75) setMode('groom');
    else if (r < .82) goSleep(rand(25000, 60000));
    else setMode('sit', rand(3000, 7000));
  }
  function walkTo(x, run) {
    S.target = clamp(x, halfW('walk'), W - halfW('walk'));
    if (Math.abs(S.target - S.x) < 40) { setMode('sit', 3000); return; }
    setMode(run ? 'run' : 'walk', run ? rand(1500, 3000) : 0);
  }
  // Para dormir, primero camina a la esquina más cercana (así no tapa lo que estás leyendo)
  function cornerX() { const m = halfW('walk') + 6; return S.x < W / 2 ? m : W - m; }
  function goSleep(ms) {
    const cx = cornerX();
    if (W > 0 && Math.abs(S.x - cx) > 30 && !['held', 'fall'].includes(S.mode)) {
      S.target = cx; setMode('walk'); S.pendingNap = ms || 0; return;
    }
    napNow(ms);
  }
  function napNow(ms) { S.pendingNap = null; S.napUntil = ms ? performance.now() + ms : 0; setMode('sleep'); }

  // ——— física al soltarlo ———
  const G = 2400;
  function physics(dt) {
    yarnPhysics(dt);
    if (S.mode !== 'fall') return;
    S.vy += G * dt; S.y += S.vy * dt; S.x += S.vx * dt; S.vx *= Math.pow(.25, dt);
    S.x = clamp(S.x, halfW('held'), W - halfW('held'));
    const h = META.held.h * unit;
    if (S.y - h * .06 + h >= ground) {              // patas tocan el suelo
      S.y = ground; S.vy = 0; S.vx = 0; S.airborne = false;
      setMode('sit', rand(2500, 4000)); meow(.9);
    }
  }

  // ——— sonidos ———
  let ac = null, purr = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }
  function meow(pitch = 1) {
    if (!soundOn || !ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    const base = rand(600, 760) * pitch, len = rand(.45, .65);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.4, t + len * .3); o.frequency.linearRampToValueAtTime(base * .85, t + len);
    f.type = 'bandpass'; f.Q.value = 2.4; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2100, t + len * .35); f.frequency.linearRampToValueAtTime(800, t + len);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .06); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(f).connect(g).connect(ac.destination); o.start(t); o.stop(t + len + .05);
  }
  function startPurr() {
    if (!soundOn || !ac || purr) return;
    const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    const amp = ac.createGain(); amp.gain.value = .22;
    const lfo = ac.createOscillator(); lfo.frequency.value = 25; const lg = ac.createGain(); lg.gain.value = .22; lfo.connect(lg).connect(amp.gain);
    const master = ac.createGain(); master.gain.setValueAtTime(0, ac.currentTime); master.gain.linearRampToValueAtTime(1, ac.currentTime + .5);
    src.connect(lp).connect(amp).connect(master).connect(ac.destination); src.start(); lfo.start();
    purr = { src, lfo, master };
  }
  function stopPurr() {
    if (!purr || !ac) return; const p = purr; purr = null; const t = ac.currentTime;
    p.master.gain.cancelScheduledValues(t); p.master.gain.setValueAtTime(p.master.gain.value, t); p.master.gain.linearRampToValueAtTime(0, t + .4);
    setTimeout(() => { try { p.src.stop(); p.lfo.stop(); } catch (e) {} }, 500);
  }

  // ——— interacción ———
  function touch() { S.lastTouch = performance.now(); audio(); }
  function wake() { if (S.mode === 'sleep') { S.napUntil = 0; setMode('sit', 3500); meow(.8); return true; } return false; }
  let press = null, lastTap = 0, tapTimer = 0;
  pet.addEventListener('contextmenu', e => e.preventDefault());
  pet.addEventListener('pointerdown', e => {
    e.preventDefault(); touch();
    try { pet.setPointerCapture(e.pointerId); } catch (_) {}
    press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), drag: false, hist: [], lp: 0 };
    if (e.pointerType !== 'mouse') press.lp = setTimeout(() => press && grab(e.clientX, e.clientY), 380);
  });
  pet.addEventListener('pointermove', e => {
    const p = local(e);
    if (press && press.id === e.pointerId) {
      if (press.drag && e.pointerType === 'mouse' && !e.buttons) { release(); press = null; if (host) host.setGrab(false); return; }
      if (!press.drag && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 6) {
        if (e.pointerType === 'mouse') grab(e.clientX, e.clientY);
        else { clearTimeout(press.lp); rubBy(Math.hypot(e.movementX || 0, e.movementY || 0) || 8); }
      }
      if (press && press.drag) {
        const now = performance.now();
        press.hist.push([now, p.x, p.y]); if (press.hist.length > 6) press.hist.shift();
        const old = S.x; S.x = clamp(p.x, halfW('held'), W - halfW('held')); S.y = p.y;
        if (Math.abs(S.x - old) > 1.5) S.dir = Math.sign(S.x - old);
      }
      return;
    }
    if (e.pointerType === 'mouse' && !e.buttons) rubBy(Math.hypot(e.movementX || 0, e.movementY || 0));
  });
  function endPress(e) {
    if (!press || press.id !== e.pointerId) return;
    clearTimeout(press.lp);
    if (press.drag) release();
    else if (performance.now() - press.t0 < 350 && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) < 8) tap();
    press = null;
    if (host) host.setGrab(false);
  }
  pet.addEventListener('pointerup', endPress);
  pet.addEventListener('pointercancel', e => { if (press && press.drag) release(); press = null; if (host) host.setGrab(false); });
  function local(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function grab(cx, cy) {
    if (!press) return; press.drag = true; S.airborne = true; S.vx = S.vy = 0;
    const r = stage.getBoundingClientRect(); S.x = clamp(cx - r.left, halfW('held'), W - halfW('held')); S.y = cy - r.top;
    setMode('held'); meow(1.15); if (host) host.setGrab(true);
  }
  function release() {
    touch();
    const h = press.hist; let vx = 0, vy = 0;
    if (h.length > 1) { const a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b[0] - a[0]) / 1000); vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
    S.vx = clamp(vx, -1500, 1500) * .5; S.vy = clamp(vy, -1500, 1500) * .5;
    setMode('fall');
  }
  function tap() {
    const now = performance.now();
    if (S.mode === 'sleep') { clearTimeout(tapTimer); lastTap = 0; wake(); return; }   // un clic o doble clic lo despierta al tiro
    if (now - lastTap < 320) { clearTimeout(tapTimer); lastTap = 0; belly(4500); return; }
    lastTap = now;
    tapTimer = setTimeout(() => {
      if (wake()) return;
      meow();
      if (vids.paw && S.mode === 'sit' && Math.random() < .5) { setMode('paw'); return; }
      if (['walk', 'run', 'groom', 'knead'].includes(S.mode)) setMode('sit', rand(3000, 5000));
      else S.until = performance.now() + rand(3000, 5000);
    }, 320);
  }
  function rubBy(d) {
    if (['held', 'fall'].includes(S.mode)) return;
    touch(); S.rub += d;
    if (S.mode === 'belly' || S.mode === 'knead') { S.until = Math.max(S.until, performance.now() + 2200); return; }
    if (S.rub > 700) { S.rub = 0; S.napUntil = 0; belly(3500); }
  }
  function belly(ms) { setMode('belly', ms); }


  // ——— el ovillo de lana ———
  const YARN_SRC = window.MICHIPET_YARN;
  const yarnEl = document.createElement('img'); yarnEl.id = 'yarn'; yarnEl.alt = 'Ovillo de lana'; yarnEl.draggable = false;
  if (YARN_SRC) yarnEl.src = YARN_SRC;
  yarnEl.hidden = true; stage.insertBefore(yarnEl, pet);
  const thread = document.createElement('canvas'); thread.id = 'thread'; stage.insertBefore(thread, shadow);
  const tctx = thread.getContext('2d');
  const Y = { on: false, x: 0, h: 0, vx: 0, vy: 0, rot: 0, r: 25, r0: 25, held: false, trail: [], unrolled: 0,
              interestUntil: 0, hits: 0, maxHits: 6, swat: null, first: true };
  const REACH = 268;                         // distancia de la pata al centro del gatito, en px del clip
  const SEG = [{ start: 0, hit: 1.62, end: 2.1 }, { start: 2.55, hit: 3.22, end: 3.7 }];
  function sizeYarn() {
    Y.r0 = 50 * unit; Y.r = Math.max(Y.r0 * .78, Y.r0 - Y.unrolled * .004);
    yarnEl.style.width = yarnEl.style.height = Y.r * 2 + 'px';
    const dpr = window.devicePixelRatio || 1;
    thread.width = Math.round(W * dpr); thread.height = Math.round((ground + 20) * dpr);
    thread.style.width = W + 'px'; thread.style.height = (ground + 20) + 'px';
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function interest() { Y.interestUntil = performance.now() + rand(20000, 35000); Y.hits = 0; Y.maxHits = Math.round(rand(5, 9)); Y.first = true; }
  function giveYarn() {
    audio(); wake();
    if (!Y.on) { Y.on = true; Y.unrolled = 0; Y.trail = []; }
    const side = S.x < W / 2 ? 1 : -1;
    Y.x = clamp(S.x + side * rand(.25, .45) * W, Y.r0 * 2, W - Y.r0 * 2);
    Y.h = ground * .55; Y.vx = -side * rand(40, 140); Y.vy = 0; Y.held = false;
    yarnEl.hidden = false; sizeYarn(); interest();
    if (statusEl) statusEl.textContent = 'Michi Pet vio el ovillo';
  }
  function putYarnAway() { Y.on = false; yarnEl.hidden = true; Y.trail = []; Y.unrolled = 0; Y.interestUntil = 0; drawYarn(); }
  function yarnPhysics(dt) {
    if (!Y.on || Y.held) return;
    Y.vy -= G * .9 * dt; Y.h += Y.vy * dt; Y.x += Y.vx * dt;
    if (Y.h <= 0) {
      Y.h = 0;
      if (Y.vy < -120) Y.vy = -Y.vy * .42; else Y.vy = 0;
      Y.vx *= Math.pow(.32, dt);
      if (Math.abs(Y.vx) < 6) Y.vx = 0;
    }
    if (Y.x < Y.r) { Y.x = Y.r; Y.vx = Math.abs(Y.vx) * .55; }
    if (Y.x > W - Y.r) { Y.x = W - Y.r; Y.vx = -Math.abs(Y.vx) * .55; }
    if (Y.h < 2 && Math.abs(Y.vx) > 1) {             // rueda y va soltando hebra
      Y.rot += Y.vx * dt / Y.r * 57.3;
      const lastP = Y.trail[Y.trail.length - 1];
      if (!lastP || Math.abs(lastP - Y.x) > 6) { if (lastP != null) Y.unrolled += Math.abs(lastP - Y.x); Y.trail.push(Y.x); if (Y.trail.length > 400) Y.trail.shift(); }
      const r = Y.r; Y.r = Math.max(Y.r0 * .78, Y.r0 - Y.unrolled * .004); if (Math.abs(r - Y.r) > .3) yarnEl.style.width = yarnEl.style.height = Y.r * 2 + 'px';
    }
  }
  function drawYarn() {
    if (!tctx) return;
    tctx.clearRect(0, 0, W, ground + 20);
    if (!Y.on) return;
    const yb = ground - 1.5;
    if (Y.trail.length > 1) {
      tctx.strokeStyle = 'rgba(196,128,138,.95)'; tctx.lineWidth = Math.max(1.2, 3.2 * unit); tctx.lineCap = 'round'; tctx.lineJoin = 'round';
      tctx.beginPath();
      Y.trail.forEach((x, i) => { const y = yb - Math.sin(i * .9) * 1.6 * unit - (i % 5 === 0 ? 1 : 0); i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); });
      tctx.lineTo(Y.x, ground - Y.h - Y.r * .35);
      tctx.stroke();
    }
    yarnEl.style.transform = `translate(${(Y.x - Y.r).toFixed(1)}px,${(ground - Y.h - Y.r * 2).toFixed(1)}px) rotate(${Y.rot.toFixed(1)}deg)`;
  }
  function setChaseRate(r) { S.rate = r; vids.walk.playbackRate = r; }
  function yarnBrain(now, dt) {
    if (!Y.on || Y.held) { if (S.mode === 'chase' || S.mode === 'play') { if (S.mode === 'play' || Y.held) { setMode('sit', 1500); S.dir = Math.sign(Y.x - S.x) || S.dir; } } return S.mode === 'chase'; }
    if (now > Y.interestUntil && S.mode !== 'play') { if (S.mode === 'chase') setMode('sit', rand(2000, 4000)); return false; }
    const catW = META.walk.w * unit, reach = REACH * unit, half = halfW('walk');
    if (S.mode === 'play') {
      const v = vids.play, t = v.currentTime, seg = Y.swat;
      if (seg && !seg.done && t >= seg.hit) {
        seg.done = true;
        const paw = S.x + S.dir * reach;
        if (Math.abs(Y.x - paw) < Y.r * 1.9 && Y.h < Y.r * 1.2) {
          Y.vx = S.dir * rand(1.1, 2.0) * catW; Y.vy = rand(.5, 1.5) * catW; Y.h = Math.max(Y.h, 1);
          Y.hits++; if (Math.random() < .3) meow(1.2);
        }
      }
      if (!seg || t >= seg.end || v.ended) {
        if (Y.hits >= Y.maxHits) { Y.interestUntil = 0; setMode('groom'); if (statusEl) statusEl.textContent = 'Michi Pet se aburrió del ovillo'; }
        else setMode('chase');
      }
      return true;
    }
    if (!['sit', 'walk', 'run', 'chase'].includes(S.mode)) return false;
    // ¿desde qué lado lo alcanza?
    let dir = Math.sign(Y.x - S.x) || S.dir;
    if (dir > 0 && Y.x - reach < half) dir = -1;
    if (dir < 0 && Y.x + reach > W - half) dir = 1;
    const stand = clamp(Y.x - dir * reach, half, W - half);
    const dx = stand - S.x;
    const moving = Math.abs(Y.vx) > 60 || Y.h > Y.r * .6;
    if (Math.abs(dx) < 8 && !moving) {
      S.dir = dir;
      const seg = Y.first ? SEG[0] : SEG[1]; Y.first = false;
      Y.swat = { ...seg, done: false };
      vids.play.currentTime = seg.start;
      setMode('play');
      return true;
    }
    if (S.mode !== 'chase') setMode('chase');
    setChaseRate(Math.abs(dx) > catW * 1.6 ? 2.1 : 1);
    if (Math.abs(dx) > 2) S.dir = Math.sign(dx);
    const speed = STRIDE * catW * S.rate;
    S.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    if (Math.abs(dx) < 8) S.dir = dir;               // espera mirando el ovillo mientras rueda
    return true;
  }
  // tomar y lanzar el ovillo con el mouse
  let ypress = null;
  yarnEl.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); touch();
    try { yarnEl.setPointerCapture(e.pointerId); } catch (_) {}
    ypress = { id: e.pointerId, hist: [] }; Y.held = true; Y.vx = Y.vy = 0; if (host) host.setGrab(true);
  });
  yarnEl.addEventListener('pointermove', e => {
    if (!ypress || ypress.id !== e.pointerId) return;
    const p = local(e);
    Y.x = clamp(p.x, Y.r, W - Y.r); Y.h = Math.max(0, ground - p.y - Y.r);
    ypress.hist.push([performance.now(), Y.x, Y.h]); if (ypress.hist.length > 6) ypress.hist.shift();
  });
  const yrelease = e => {
    if (!ypress || ypress.id !== e.pointerId) return;
    const h = ypress.hist;
    if (h.length > 1) { const a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b[0] - a[0]) / 1000); Y.vx = clamp((b[1] - a[1]) / dt, -1800, 1800); Y.vy = clamp((b[2] - a[2]) / dt, -1800, 1800); }
    Y.held = false; ypress = null; if (host) host.setGrab(false); interest(); wake();
  };
  yarnEl.addEventListener('pointerup', yrelease); yarnEl.addEventListener('pointercancel', yrelease);

  // ——— la app de Windows: deja pasar los clics salvo sobre el gatito ———
  let hitbox = null, overCat = false, lastHits = '', lastHitsAt = 0;
  function sendHits() {
    const now = performance.now(); if (now - lastHitsAt < 40) return;
    const list = [];
    if (hitbox) list.push(hitbox);
    if (Y.on) list.push({ x: Y.x - Y.r * 1.15, y: ground - Y.h - Y.r * 2.15, w: Y.r * 2.3, h: Y.r * 2.3 });
    const key = list.map(h => [h.x, h.y, h.w, h.h].map(v => Math.round(v)).join(',')).join('|');
    if (key === lastHits) return;
    lastHits = key; lastHitsAt = now;
    host.setHits(list.map(h => ({ x: Math.round(h.x), y: Math.round(h.y), w: Math.round(h.w), h: Math.round(h.h) })));
  }
  function resetInput() {          // se llama al volver de suspensión
    if (press) { clearTimeout(press.lp); if (press.drag) release(); press = null; }
    if (ypress) { Y.held = false; ypress = null; }
    if (S.mode === 'held') setMode('fall');
    overCat = false; lastHits = ''; lastHitsAt = 0;
    host.setGrab(false);
    measure();
  }
  if (host) {
    window.addEventListener('mousemove', e => {
      const hb = hitbox; if (!hb) return;
      let inside = e.clientX >= hb.x && e.clientX <= hb.x + hb.w && e.clientY >= hb.y && e.clientY <= hb.y + hb.h;
      if (!inside && Y.on) inside = Math.hypot(e.clientX - Y.x, e.clientY - (ground - Y.h - Y.r)) < Y.r * 1.15;
      if (inside !== overCat) { overCat = inside; host.setOverCat(inside); }
    });
    host.onCommand(cmd => {
      if (cmd === 'pause') { paused = true; Object.values(vids).forEach(v => v.pause()); stopPurr(); }
      if (cmd === 'resume') { paused = false; vids[S.clip].play().catch(() => {}); }
      if (cmd === 'sound-on') soundOn = true;
      if (cmd === 'sound-off') { soundOn = false; stopPurr(); }
      if (cmd === 'call') { touch(); wake(); walkTo(W / 2, true); }
      if (cmd === 'sleep') goSleep(rand(60000, 120000));
      if (cmd === 'yarn') { touch(); giveYarn(); }
      if (cmd === 'yarn-away') putYarnAway();
      if (cmd === 'reset-input') resetInput();
    });
    host.onLayout(() => measure());
  }

  // ——— botones de la página de prueba ———
  const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { touch(); fn(b); }); };
  bind('bRun', () => { wake(); walkTo(S.x > W / 2 ? halfW() + 20 : W - halfW() - 20, true); });
  bind('bSleep', () => goSleep(rand(30000, 60000)));
  bind('bYarn', () => giveYarn());
  bind('bSound', b => { soundOn = !soundOn; b.setAttribute('aria-pressed', soundOn); b.textContent = soundOn ? 'Sonido' : 'Sin sonido'; if (!soundOn) stopPurr(); });

  // ——— bucle ———
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!paused) { physics(dt); brain(now, dt); }
    S.rub *= Math.pow(.2, dt);
    layout();
    requestAnimationFrame(frame);
  }
  measure();
  window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
  S.x = W * .5; S.y = ground;
  setMode('sit', 2500);
  requestAnimationFrame(frame);
})();
