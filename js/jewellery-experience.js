/* ==========================================================================
   The Art of Adornment: scroll-driven jewellery experience
   Self-contained: needs gsap + ScrollTrigger and the #adornment markup.
   API: window.JewelleryExperience.init(root?) / .destroy()
   Calibration: add ?jx-debug to the URL, drag pieces, copy the printed config.
   ========================================================================== */
(() => {
  'use strict';

  const BASE = 'images/jewellery-experience/';

  /* ------------------------------------------------------------------------
     Placement config. All numbers are percentages of the model photo
     (1024 x 1536, so the figure container's aspect-ratio must stay 2 / 3):
       x, y    the point on the body the piece attaches to
       width   the piece's width as a % of the photo width
       anchor  the matching point inside the piece's own image (0-1, 0-1)
       rotate  degrees, around the anchor (rings follow the finger's angle)
       z       stacking order above the model (the model is 1)
     Measured on model-base.webp; re-tune visually with ?jx-debug.
     Changing these never touches the animation logic below.
     ------------------------------------------------------------------------ */
  const PIECES = {
    necklace:      { src: 'necklace.png',       size: [720, 522], x: 49.71, y: 16.28, width: 10.16, anchor: [0.5, 0.0],  z: 2 },
    earringLeft:   { src: 'earrings-left.png',  size: [365, 570], x: 44.82, y: 10.94, width: 1.25,  anchor: [0.5, 0.45], z: 3 },
    earringRight:  { src: 'earrings-right.png', size: [354, 573], x: 55.18, y: 10.94, width: 1.25,  anchor: [0.5, 0.45], z: 3 },
    braceletLeft:  { src: 'bracelet-left.png',  size: [720, 356], x: 31.84, y: 47.92, width: 4.0,   anchor: [0.5, 0.55], z: 4 },
    braceletRight: { src: 'bracelet-right.png', size: [720, 356], x: 67.09, y: 47.79, width: 4.0,   anchor: [0.5, 0.55], z: 4 },
    ring1:         { src: 'ring-1.png',         size: [720, 390], x: 30.37, y: 52.28, width: 1.2,   anchor: [0.5, 0.6],  z: 5, rotate: -50 },
    ring2:         { src: 'ring-2.png',         size: [720, 336], x: 68.95, y: 52.28, width: 1.2,   anchor: [0.5, 0.6],  z: 5, rotate: 50 },
  };

  /* Timeline in percent of the pinned scroll (the timeline is exactly 100 long).
     Each piece flies in from outside the arch and sticks to the body:
       at, dur  when the flight starts and how long it takes
       from     start offset [x, y] in arch widths / heights (outside the frame)
       scale    starting size (the piece shrinks as it travels towards the body)
       spin     extra rotation at the start, in degrees */
  const SEQUENCE = {
    earringLeft:   { at: 15, dur: 12, from: [-0.95, -0.3],  scale: 7,   spin: -70 },
    earringRight:  { at: 18, dur: 12, from: [0.95, -0.36],  scale: 7,   spin: 70 },
    necklace:      { at: 35, dur: 14, from: [0.15, -0.75],  scale: 3.2, spin: -18 },
    braceletLeft:  { at: 55, dur: 12, from: [-1.05, 0.12],  scale: 3.4, spin: -110 },
    braceletRight: { at: 58, dur: 12, from: [1.05, 0.02],   scale: 3.4, spin: 110 },
    ring1:         { at: 74, dur: 10, from: [-0.85, 0.55],  scale: 7,   spin: -200 },
    ring2:         { at: 77, dur: 10, from: [0.85, 0.6],    scale: 7,   spin: 200 },
  };

  /* A dot on each piece once it has landed, with a callout naming the product.
     Name, type, price and link come from js/products.js by SKU.
     side: which way the callout points; dy: nudges the callout up/down (px) when two sit close. */
  const HOTSPOTS = [
    { step: 'earrings',  piece: 'earringLeft',   sku: 'DSDE00047314', side: 'left' },
    { step: 'necklace',  piece: 'necklace',      sku: 'DSDN00014450', side: 'right' },
    { step: 'bracelets', piece: 'braceletRight', sku: 'DSDB00002216', side: 'right', dy: -46 },
    { step: 'rings',     piece: 'ring1',         sku: 'DSDR00014626', side: 'left' },
    { step: 'rings',     piece: 'ring2',         sku: 'LSDR00019279', side: 'right', dy: 42 },
  ];
  const POP = 1.9; // how far a piece swells once it has landed

  const STEPS = [ // copy blocks: [data-step, in at, out at]
    ['intro', 0, 14],
    ['earrings', 15, 34],
    ['necklace', 35, 54],
    ['bracelets', 55, 74],
    ['rings', 75, 89],
    ['final', 90, null],
  ];

  let mm = null;
  let state = null;

  function scrollDistance() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 820) return Math.round(Math.min(2600, Math.max(2200, h * 3)));
    return Math.round(Math.min(3500, Math.max(2500, h * 3.4)));
  }

  /* Build one absolutely positioned layer (and a glint) per piece. */
  function buildLayers(figure) {
    const layers = {};
    Object.entries(PIECES).forEach(([key, p]) => {
      const img = new Image(p.size[0], p.size[1]);
      img.className = 'jx-piece';
      img.src = BASE + p.src;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.dataset.piece = key;
      img.setAttribute('aria-hidden', 'true'); // product copy carries the names
      place(img, p);
      figure.appendChild(img);

      const glint = document.createElement('span');
      glint.className = 'jx-glint';
      glint.setAttribute('aria-hidden', 'true');
      glint.style.left = p.x + '%';
      glint.style.top = p.y + '%';
      figure.appendChild(glint);

      layers[key] = { img, glint };
    });
    return layers;
  }

  function place(img, p) {
    img.style.left = p.x + '%';
    img.style.top = p.y + '%';
    img.style.width = p.width + '%';
    img.style.zIndex = p.z;
    img.style.transformOrigin = `${p.anchor[0] * 100}% ${p.anchor[1] * 100}%`;
    img.style.transform = `translate(${-p.anchor[0] * 100}%, ${-p.anchor[1] * 100}%) rotate(${p.rotate || 0}deg)`;
  }

  /* Centre of a placed piece, in % of the arch (ignoring its small rotation). */
  function pieceCentre(p) {
    const hPct = (p.width * (p.size[1] / p.size[0])) / 1.5; // the arch is 2:3
    return [p.x + (0.5 - p.anchor[0]) * p.width, p.y + (0.5 - p.anchor[1]) * hPct];
  }

  function buildHotspots(overlay, products) {
    const inr = (n) => '\u20b9 ' + Math.round(n).toLocaleString('en-IN');
    return HOTSPOTS.map((h) => {
      const prod = products.get(h.sku);
      const [cx, cy] = pieceCentre(PIECES[h.piece]);
      const el = document.createElement('a');
      el.className = `jx-hot jx-hot--${h.side}`;
      el.style.left = cx + '%';
      el.style.top = cy + '%';
      if (h.dy) el.style.setProperty('--dy', h.dy + 'px');
      // The dot sits just beside the piece (half its width plus a gap), so it never covers the jewellery.
      el.style.setProperty('--half', (PIECES[h.piece].width / 2) + '%');
      el.tabIndex = -1;                       // the copy column carries the same links for keyboards
      el.setAttribute('aria-hidden', 'true'); // and for screen readers
      if (prod) { el.href = prod.url; el.target = '_blank'; el.rel = 'noopener'; }
      const name = prod ? prod.name : h.step;
      const type = prod ? prod.type : h.step;
      el.innerHTML = `<span class="jx-hot-line"></span><span class="jx-hot-dot"></span>`
        + `<span class="jx-hot-label"><span class="jx-hot-thumb"><img alt="" decoding="async" draggable="false"></span>`
        + `<span class="jx-hot-text"><small></small><b></b>${prod ? '<em></em>' : ''}</span></span>`;
      // The piece itself, enlarged in the callout: on the full-length model it is only a few pixels wide.
      el.querySelector('.jx-hot-thumb img').src = BASE + PIECES[h.piece].src;
      if (h.dy) { // elbow leader: along from the dot, then up or down to the callout's middle
        const line = el.querySelector('.jx-hot-line');
        line.classList.add(h.dy < 0 ? 'is-up' : 'is-down');
        line.style.top = Math.min(0, h.dy) + 'px';
        line.style.height = Math.abs(h.dy) + 'px';
      }
      el.querySelector('small').textContent = type;
      el.querySelector('b').textContent = name;
      if (prod) el.querySelector('em').textContent = inr(prod.price);
      overlay.appendChild(el);
      return { ...h, el };
    });
  }

  /* ---------------------------------------------------------------- motion */
  function buildTimeline(root, layers, hotspots) {
    const { gsap } = window;
    const pin = root.querySelector('.jx-pin');
    const step = (name) => root.querySelector(`[data-step="${name}"]`);
    const railFill = root.querySelector('.jx-rail-fill');
    const railItems = root.querySelectorAll('.jx-rail > span:not(.jx-rail-fill)');
    const cue = root.querySelector('.jx-cue');

    const stepEls = STEPS.map(([name]) => step(name));
    let current = -1;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: root,
        pin,
        start: 'top top',
        end: () => '+=' + scrollDistance(),
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => root.classList.toggle('is-active', self.isActive),
        onUpdate: (self) => {
          // Only the visible copy block takes clicks; the class changes once per step, not per frame.
          const at = self.progress * 100;
          const i = STEPS.findIndex(([, from, to]) => at >= from - 1 && (to == null || at < to));
          if (i !== current) {
            current = i;
            stepEls.forEach((el, k) => el && el.classList.toggle('is-current', k === i));
            hotspots.forEach((h) => h.el.classList.toggle('is-current', STEPS[i] && STEPS[i][0] === h.step));
            root.classList.toggle('is-final', STEPS[i] && STEPS[i][0] === 'final');
          }
        },
      },
    });
    tl.to({}, { duration: 100 }, 0); // fixes the timeline length at 100 = 100% of the scroll

    // Pieces: fly in from outside the arch, shrinking and unspinning, and stick to the body.
    // x and y use different eases, so each flight curves instead of travelling in a straight line.
    const overlay = root.querySelector('.jx-overlay');
    const W = () => overlay.clientWidth;
    const H = () => overlay.clientHeight;
    Object.entries(SEQUENCE).forEach(([key, s]) => {
      const p = PIECES[key];
      const { img, glint } = layers[key];
      const rot = p.rotate || 0;
      // Hand the anchor offset from CSS to GSAP so it composes with the flight.
      img.style.transform = '';
      gsap.set(img, { xPercent: -p.anchor[0] * 100, yPercent: -p.anchor[1] * 100 });
      tl.fromTo(img, { autoAlpha: 0 }, { autoAlpha: 1, duration: s.dur * 0.25, ease: 'none' }, s.at)
        .fromTo(img, { x: () => W() * s.from[0] }, { x: 0, duration: s.dur, ease: 'power2.inOut' }, s.at)
        .fromTo(img, { y: () => H() * s.from[1] }, { y: 0, duration: s.dur, ease: 'power3.out' }, s.at)
        .fromTo(img, { rotation: rot + s.spin }, { rotation: rot, duration: s.dur, ease: 'power2.out' }, s.at)
        // shrinks onto the body, presses in slightly and settles: the "stick"
        .fromTo(img, { scale: s.scale }, { scale: 0.86, duration: s.dur * 0.9, ease: 'power2.in' }, s.at)
        .to(img, { scale: 1, duration: s.dur * 0.25, ease: 'back.out(3)' }, s.at + s.dur * 0.9)
        // then it pops: swells with a halo so it reads on the body, and settles back
        .to(img, { scale: POP, duration: 1.6, ease: 'power2.out' }, s.at + s.dur * 1.15)
        .to(img, { scale: 1, duration: 2.4, ease: 'power2.inOut' }, s.at + s.dur * 1.15 + 1.6)
        .fromTo(img, { '--halo': 0 }, { '--halo': 1, duration: 1.6, ease: 'power2.out' }, s.at + s.dur * 1.15);
      // a brief catch of light as it lands
      tl.fromTo(glint, { autoAlpha: 0, scale: 0.2, rotate: -45 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 2, ease: 'power1.out' }, s.at + s.dur - 3)
        .to(glint, { autoAlpha: 0, scale: 0.3, rotate: 45, duration: 2.5, ease: 'power1.in' }, s.at + s.dur - 1);
    });

    // Hotspots: the dot pops once its piece has landed, then the line and callout draw out.
    hotspots.forEach((h) => {
      const s = SEQUENCE[h.piece];
      const at = s.at + s.dur + 0.5;
      const dot = h.el.querySelector('.jx-hot-dot');
      const line = h.el.querySelector('.jx-hot-line');
      const label = h.el.querySelector('.jx-hot-label');
      const dir = h.side === 'left' ? 1 : -1;
      tl.fromTo(h.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'none' }, at)
        .fromTo(dot, { scale: 0 }, { scale: 1, duration: 2, ease: 'back.out(3)' }, at)
        .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.5, ease: 'power2.out' }, at + 1)
        .fromTo(label, { autoAlpha: 0, '--lx': `${12 * dir}px` }, { autoAlpha: 1, '--lx': '0px', duration: 2.5, ease: 'power2.out' }, at + 1.8);
    });

    // Copy: one block at a time. Opacity only (no visibility), so all copy stays
    // available to assistive tech regardless of scroll position.
    STEPS.forEach(([name, at, out], i) => {
      const el = step(name);
      if (!el) return;
      if (i === 0) gsap.set(el, { opacity: 1, y: 0 });
      else tl.fromTo(el, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 4 }, at);
      if (out != null) tl.to(el, { opacity: 0, y: -18, duration: 3, ease: 'power2.in' }, out - 2);
    });

    // Progress rail
    if (railFill) tl.fromTo(railFill, { scaleX: 0 }, { scaleX: 1, duration: 75, ease: 'none' }, 15);
    railItems.forEach((li, i) => tl.to(li, { opacity: 1, duration: 3 }, 15 + i * 20));
    if (cue) tl.to(cue, { autoAlpha: 0, duration: 6 }, 0);

    // Links in a hidden block must never take focus unseen: focusing one scrolls
    // to the point where its block is showing.
    const onFocus = (e) => {
      const el = e.target.closest('.jx-step');
      const st = tl.scrollTrigger;
      const i = stepEls.indexOf(el);
      if (!st || i < 0 || i === current) return;
      const target = Math.min(99, STEPS[i][1] + 4) / 100;
      window.scrollTo({ top: st.start + (st.end - st.start) * target, behavior: 'auto' });
    };
    root.addEventListener('focusin', onFocus);

    return () => {
      root.removeEventListener('focusin', onFocus);
      stepEls.forEach((el) => el && el.classList.remove('is-current'));
      hotspots.forEach((h) => h.el.classList.remove('is-current'));
      root.classList.remove('is-final', 'is-active');
    };
  }

  /* Static final look: reduced motion, missing GSAP, or calibration. */
  function showAll(layers) {
    Object.entries(layers).forEach(([key, { img }]) => {
      place(img, PIECES[key]);
      img.style.opacity = '1';
      img.style.visibility = 'visible';
    });
  }

  /* ---------------------------------------------------------- calibration */
  function debugMode(root, figure, layers) {
    root.classList.add('is-debug');
    const panel = document.createElement('div');
    panel.className = 'jx-debug-panel';
    document.body.appendChild(panel);
    const print = () => {
      const rows = Object.entries(PIECES).map(([k, p]) =>
        `  ${k}: { x: ${p.x.toFixed(2)}, y: ${p.y.toFixed(2)}, width: ${p.width.toFixed(2)}${p.rotate ? `, rotate: ${p.rotate}` : ''} },`);
      panel.textContent = 'Drag a piece. Shift + wheel resizes it.\n\n{\n' + rows.join('\n') + '\n}';
    };
    Object.entries(layers).forEach(([key, { img }]) => {
      const p = PIECES[key];
      const dot = document.createElement('i');
      dot.className = 'jx-debug-dot';
      const syncDot = () => { dot.style.left = p.x + '%'; dot.style.top = p.y + '%'; };
      syncDot();
      figure.appendChild(dot);
      img.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        img.setPointerCapture(e.pointerId);
        const r = figure.getBoundingClientRect();
        const ox = e.clientX - (r.left + (p.x / 100) * r.width);
        const oy = e.clientY - (r.top + (p.y / 100) * r.height);
        const move = (ev) => {
          p.x = ((ev.clientX - ox - r.left) / r.width) * 100;
          p.y = ((ev.clientY - oy - r.top) / r.height) * 100;
          place(img, p); syncDot(); print();
        };
        const up = () => { img.removeEventListener('pointermove', move); img.removeEventListener('pointerup', up); };
        img.addEventListener('pointermove', move);
        img.addEventListener('pointerup', up);
      });
      img.addEventListener('wheel', (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        p.width = Math.max(0.3, p.width * (e.deltaY > 0 ? 0.97 : 1.03));
        place(img, p); print();
      }, { passive: false });
    });
    print();
    return () => panel.remove();
  }

  /* Prices and links come from js/products.js (window.JL), so they follow the
     gold rate whenever that file is regenerated. Elements: [data-jx-sku]. */
  function fillProducts(root) {
    const bySku = new Map();
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') { if (o.sku && o.url) bySku.set(o.sku, o); Object.values(o).forEach(walk); }
    };
    walk(window.JL);
    const inr = (n) => '\u20b9 ' + Math.round(n).toLocaleString('en-IN');
    root.querySelectorAll('[data-jx-sku]').forEach((el) => {
      const p = bySku.get(el.dataset.jxSku);
      if (!p) return;
      const price = el.querySelector('.jx-price');
      if (price) price.innerHTML = inr(p.price) + (p.regular > p.price ? ` <s>${inr(p.regular)}</s>` : '');
      const link = el.querySelector('.jx-link');
      if (link) { link.href = p.url; link.target = '_blank'; link.rel = 'noopener'; }
    });
    return bySku;
  }

  /* ------------------------------------------------------------- lifecycle */
  function init(root = document.getElementById('adornment')) {
    if (!root || state) return;
    const figure = root.querySelector('.jx-overlay') || root.querySelector('.jx-figure');
    if (!figure) return;
    const products = fillProducts(root);
    const layers = buildLayers(figure);
    const hotspots = buildHotspots(figure, products);
    state = { root, layers, hotspots, cleanups: [] };

    const { gsap, ScrollTrigger } = window;
    const debug = /[?&]jx-debug\b/.test(location.search);

    if (debug || !gsap || !ScrollTrigger) {
      showAll(layers);
      if (debug) state.cleanups.push(debugMode(root, figure, layers));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    mm = gsap.matchMedia();
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      if (!ctx.conditions.motion) {
        showAll(layers);
        return undefined;
      }
      // Class and initial states are applied in the same task, so the
      // un-adorned first frame is never painted with pieces visible.
      root.classList.add('is-animated');
      const undo = buildTimeline(root, layers, hotspots);
      return () => {
        undo();
        root.classList.remove('is-animated');
      };
    });

    // Sections above can change height once fonts and product photos load.
    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState !== 'complete') window.addEventListener('load', refresh, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    state.cleanups.push(() => window.removeEventListener('load', refresh));
  }

  function destroy() {
    if (!state) return;
    if (mm) { mm.revert(); mm = null; }
    state.cleanups.forEach((fn) => fn && fn());
    Object.values(state.layers).forEach(({ img, glint }) => { img.remove(); glint.remove(); });
    state.hotspots.forEach((h) => h.el.remove());
    state.root.querySelectorAll('.jx-debug-dot').forEach((d) => d.remove());
    state.root.classList.remove('is-animated', 'is-debug', 'is-final', 'is-active');
    state = null;
  }

  window.JewelleryExperience = { init, destroy, pieces: PIECES, sequence: SEQUENCE, hotspots: HOTSPOTS };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})();
