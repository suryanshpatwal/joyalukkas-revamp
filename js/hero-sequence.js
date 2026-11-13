/* ==========================================================================
   Hero: scroll-scrubbed film, "From sketch to heirloom".
   Six shots of the Primora film (js/hero-sequence-frames.js) are drawn to a canvas as the
   pinned hero is scrolled. Neighbouring frames are blended so the motion stays smooth even
   between frames, each shot gets a slow camera push, and shots crossfade into each other.
   With reduced motion, no canvas, or no frame data, the hero stays a still image.
   ========================================================================== */
(() => {
  const data = window.JL_HERO_SEQUENCE;
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hsCanvas');
  if (!data || !hero || !canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  /* ---------- Tuning ---------- */
  const SCREENS_PER_SHOT = 0.95; // scroll distance per shot, in viewport heights
  const WEIGHT = { forest: 1.25, heirloom: 1.15 }; // the first and last shots hold a little longer
  const CROSSFADE = 0.2;         // last fraction of each shot spent dissolving into the next
  const PUSH = 0.07;             // camera push-in across one shot (scale)
  const CAPTION = { forest: [0, 0.62], heirloom: [0.18, 1.01], default: [0.14, 0.8] }; // visible part of each shot
  const EASE = 0.16;             // how quickly the drawn frame catches up with the scroll position

  const root = document.documentElement;
  const stage = hero.querySelector('.hs-stage');
  const rail = Array.from(hero.querySelectorAll('.hs-rail li'));
  const loadBar = document.getElementById('hsLoading');
  const caps = {};
  hero.querySelectorAll('.hs-cap').forEach((el) => { caps[el.dataset.chapter] = el; });

  // Same word structure as the page's other headings (main.js splits only [data-anim] headings).
  hero.querySelectorAll('.hs-cap:not([data-anim]) h2').forEach((h) => {
    let wi = 0;
    const walk = (node) => Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) { walk(child); return; }
      if (child.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--wi', wi++);
        w.appendChild(inner);
        frag.appendChild(w);
      });
      child.replaceWith(frag);
    });
    walk(h);
  });

  /* ---------- Shots and their place on the scroll ---------- */
  const shots = data.chapters.map((c) => ({ ...c, weight: WEIGHT[c.id] || 1 }));
  const totalWeight = shots.reduce((s, c) => s + c.weight, 0);
  let acc = 0;
  shots.forEach((c) => { c.start = acc / totalWeight; acc += c.weight; c.end = acc / totalWeight; });

  let vh = window.innerHeight;
  let lastWidth = 0;
  let filmDistance = 0; // px of scroll over which the film plays
  function layout() {
    // Phones resize the viewport as the address bar shows and hides; keep the scroll length
    // steady unless the width changes or the height changes a lot.
    const w = window.innerWidth;
    if (w !== lastWidth || Math.abs(window.innerHeight - vh) > 160 || !filmDistance) vh = window.innerHeight;
    lastWidth = w;
    filmDistance = Math.round(totalWeight * SCREENS_PER_SHOT * vh);
    // film + one screen for the next section to slide over + the stage's own screen
    hero.style.setProperty('--hs-height', `${filmDistance + 2 * vh}px`);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.clientWidth * dpr);
    canvas.height = Math.round(stage.clientHeight * dpr);
    needsDraw = true;
  }

  /* ---------- Frames: portrait set on tall screens, loaded coarse to fine ---------- */
  const pickSet = () => (window.innerWidth / window.innerHeight < 0.9 ? 'mobile' : 'desktop');
  let set = null;
  let frames = [];
  let loadedCount = 0;
  let loadToken = 0;

  function loadSet(name) {
    if (name === set) return;
    set = name;
    const token = ++loadToken;
    frames = new Array(data.total).fill(null);
    loadedCount = 0;
    hero.classList.remove('is-loaded-all');
    // First frame of every shot, then every 8th, 4th, 2nd frame, then the rest.
    const order = [];
    const seen = new Set();
    const push = (i) => { if (!seen.has(i)) { seen.add(i); order.push(i); } };
    shots.forEach((c) => push(c.from));
    [8, 4, 2, 1].forEach((step) => shots.forEach((c) => {
      for (let i = 0; i < c.count; i += step) push(c.from + i);
      push(c.from + c.count - 1);
    }));
    let next = 0;
    const pump = () => {
      if (token !== loadToken || next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.src = `${data.path}${name}/${String(i).padStart(3, '0')}.webp`;
      const done = () => {
        if (token !== loadToken) return;
        if (img.naturalWidth) { frames[i] = img; loadedCount++; needsDraw = true; }
        loadBar.style.setProperty('--load', (next / order.length).toFixed(3));
        if (next >= order.length) hero.classList.add('is-loaded-all');
        pump();
      };
      (img.decode ? img.decode() : Promise.reject()).then(done, () => { img.complete ? done() : (img.onload = img.onerror = done); });
    };
    for (let k = 0; k < 6; k++) pump();
  }

  // Closest frame to `i` inside the shot that has finished loading.
  function nearest(shot, i) {
    const last = shot.from + shot.count - 1;
    for (let d = 0; d < shot.count; d++) {
      if (i - d >= shot.from && frames[i - d]) return i - d;
      if (i + d <= last && frames[i + d]) return i + d;
    }
    return -1;
  }

  /* ---------- Drawing ---------- */
  function drawImage(img, scale, alpha) {
    if (!img || alpha <= 0) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * scale;
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) * 0.45, w, h);
  }

  // One shot at local time t (0..1): blend the two frames either side of the exact position.
  function drawShot(shot, t, alpha) {
    const pos = shot.from + t * (shot.count - 1);
    const a = nearest(shot, Math.floor(pos));
    if (a < 0) return false;
    const scale = 1 + PUSH * t;
    drawImage(frames[a], scale, alpha);
    const b = Math.ceil(pos);
    const frac = pos - Math.floor(pos);
    if (b !== a && frames[b] && frac > 0.01) drawImage(frames[b], scale, alpha * frac);
    return true;
  }

  const smooth = (x) => x * x * (3 - 2 * x);
  let current = 0;  // eased film progress 0..1
  let needsDraw = true;
  let lastIndex = -1;

  function render(p) {
    let idx = shots.findIndex((c) => p < c.end);
    if (idx < 0) idx = shots.length - 1;
    const shot = shots[idx];
    const t = Math.min(1, Math.max(0, (p - shot.start) / (shot.end - shot.start)));
    const nextShot = shots[idx + 1];
    const fade = nextShot ? smooth(Math.max(0, (t - (1 - CROSSFADE)) / CROSSFADE)) : 0;

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0d0806';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const drew = drawShot(shot, t, 1);
    if (fade > 0) drawShot(nextShot, 0, fade);
    ctx.globalAlpha = 1;
    if (drew) hero.classList.add('has-frame');

    // Captions, rail and state classes
    shots.forEach((c, i) => {
      const lt = (p - c.start) / (c.end - c.start);
      const [a, b] = CAPTION[c.id] || CAPTION.default;
      const cap = caps[c.id];
      if (cap) {
        const on = lt >= a && lt < b;
        if (cap.classList.contains('hs-cap--hero')) cap.classList.toggle('is-off', !on);
        else cap.classList.toggle('is-on', on);
      }
      if (rail[i]) {
        rail[i].style.setProperty('--p', Math.min(1, Math.max(0, lt)).toFixed(3));
        rail[i].classList.toggle('is-on', i === idx);
      }
    });
    if (idx !== lastIndex) {
      hero.classList.toggle('is-hero-chapter', idx === 0);
      lastIndex = idx;
    }
  }

  /* ---------- Loop: runs only while the hero is on screen ---------- */
  let visible = true;
  let running = false;
  function targetProgress() {
    const y = window.scrollY - hero.offsetTop;
    hero.classList.toggle('is-scrolled', y > 40);
    stage.style.setProperty('--hs-out', Math.min(1, Math.max(0, (y - filmDistance) / vh)).toFixed(3));
    return filmDistance > 0 ? Math.min(1, Math.max(0, y / filmDistance)) : 0;
  }
  function tick() {
    const target = targetProgress();
    const diff = target - current;
    if (Math.abs(diff) > 0.00005) { current += diff * EASE; needsDraw = true; }
    else if (current !== target) { current = target; needsDraw = true; }
    if (needsDraw) { render(current); needsDraw = false; }
    if (visible) requestAnimationFrame(tick);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }

  root.classList.add('hs-on');
  layout();
  loadSet(pickSet());
  current = targetProgress(); // reloads mid-page start in place
  start();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) { needsDraw = true; start(); }
    }).observe(hero);
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); loadSet(pickSet()); start(); }, 150);
  });

  // The camera settles in as the loader fades away.
  const enter = () => hero.classList.add('is-entered');
  if (root.classList.contains('is-loaded')) enter();
  else document.addEventListener('jl:open', enter, { once: true });
  setTimeout(enter, 5000);

  window.HeroSequence = { get progress() { return current; }, shots };
})();
