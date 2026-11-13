/* ==========================================================================
   The Making: a pinned scroll story of one necklace being made
   Sketch -> cast -> stones set -> polish -> the finished photo.
   Self-contained: needs gsap + ScrollTrigger and the #making markup.
   API: window.NecklaceMaking.init(root?) / .destroy()
   Layers come from tools/necklace-making/build_assets.py.
   ========================================================================== */
(() => {
  'use strict';

  /* The green drops, in the order they are set: centre (x, y) and radius in % of the
     1000 x 1000 canvas. Copied from images/necklace-making/stones.json. */
  const STONES = [{"x":60.99,"y":89.7,"r":1.29},{"x":56.34,"y":89.5,"r":1.09},{"x":64.95,"y":89.01,"r":1.59},{"x":52.67,"y":88.81,"r":1.37},{"x":67.95,"y":87.36,"r":1.42},{"x":48.71,"y":88.71,"r":1.29},{"x":70.99,"y":86.14,"r":1.47},{"x":45.05,"y":87.72,"r":1.59},{"x":74.26,"y":85.35,"r":1.52},{"x":42.87,"y":86.34,"r":1.12},{"x":77.5,"y":83.09,"r":1.68},{"x":38.32,"y":83.56,"r":1.73},{"x":79.7,"y":80.4,"r":1.94},{"x":37.72,"y":81.19,"r":1.5},{"x":80.0,"y":77.87,"r":1.88},{"x":34.85,"y":80.1,"r":1.55},{"x":81.19,"y":75.64,"r":1.58},{"x":32.38,"y":77.03,"r":1.28},{"x":82.57,"y":73.27,"r":1.24},{"x":28.61,"y":75.64,"r":1.45},{"x":84.75,"y":70.99,"r":1.52},{"x":25.05,"y":72.57,"r":1.31},{"x":87.23,"y":68.42,"r":1.62},{"x":23.17,"y":70.69,"r":1.55},{"x":88.91,"y":65.45,"r":1.59}];

  /* Timeline in percent of the pinned scroll (the timeline is exactly 100 long). */
  const STAGES = {
    sketch: { at: 4, end: 26 },
    cast:   { at: 29, end: 43 },
    set:    { at: 47, end: 63 },
    polish: { at: 66, end: 80 },
    final:  { at: 83, end: 94 },
  };
  const STEPS = [ // copy blocks: [data-step, in at, out at]
    ['intro', 0, 9],
    ['sketch', 10, 27],
    ['cast', 28, 45],
    ['set', 46, 64],
    ['polish', 65, 81],
    ['final', 83, null],
  ];

  let mm = null;
  let state = null;

  function scrollDistance() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 820) return Math.round(Math.min(2800, Math.max(2200, h * 3.2)));
    return Math.round(Math.min(3800, Math.max(2600, h * 3.6)));
  }

  /* One element per drop, each showing its own patch of the stones sprite. */
  function buildStones(holder) {
    return STONES.map((s) => {
      const el = document.createElement('span');
      const d = s.r * 2;
      const left = s.x - s.r;
      const top = s.y - s.r;
      el.className = 'nm-stone';
      el.style.left = left + '%';
      el.style.top = top + '%';
      el.style.width = d + '%';
      el.style.height = d + '%';
      el.style.backgroundSize = (10000 / d) + '% ' + (10000 / d) + '%';
      el.style.backgroundPosition = (left / (100 - d)) * 100 + '% ' + (top / (100 - d)) * 100 + '%';
      el.innerHTML = '<i class="nm-spark"></i>';
      holder.appendChild(el);
      return el;
    });
  }

  /* Price and link from js/products.js (window.JL), by the section's data-nm-sku. */
  function fillProduct(root) {
    let prod = null;
    const walk = (o) => {
      if (prod) return;
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') {
        if (o.sku === root.dataset.nmSku && o.url) prod = o;
        else Object.values(o).forEach(walk);
      }
    };
    walk(window.JL);
    if (!prod) return;
    const inr = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
    const price = root.querySelector('.nm-price');
    if (price) price.innerHTML = inr(prod.price) + (prod.regular > prod.price ? ` <s>${inr(prod.regular)}</s>` : '');
    const link = root.querySelector('.nm-btn');
    if (link) {
      link.href = prod.url; link.target = '_blank'; link.rel = 'noopener';
      link.insertAdjacentHTML('beforeend', '<span class="sr-only"> on joyalukkas.in (opens in a new tab)</span>');
    }
  }

  /* ---------------------------------------------------------------- motion */
  function buildTimeline(root, stones) {
    const { gsap } = window;
    const q = (sel) => root.querySelector(sel);
    const art = q('.nm-art');
    const plate = q('.nm-plate');
    const tags = root.querySelectorAll('.nm-tag span');
    const stepEls = STEPS.map(([name]) => q(`[data-step="${name}"]`));
    const railFill = q('.nm-rail-fill');
    const railItems = root.querySelectorAll('.nm-rail > span:not(.nm-rail-fill)');
    const { sketch, cast, set, polish, final } = STAGES;

    let current = -1;
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: root,
        pin: q('.nm-pin'),
        start: 'top top',
        end: () => '+=' + scrollDistance(),
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const at = self.progress * 100;
          const i = STEPS.findIndex(([, from, to]) => at >= from - 1 && (to == null || at < to));
          if (i !== current) {
            current = i;
            stepEls.forEach((el, k) => el && el.classList.toggle('is-current', k === i));
            root.classList.toggle('is-final', STEPS[i] && STEPS[i][0] === 'final');
          }
        },
      },
    });
    tl.to({}, { duration: 100 }, 0); // fixes the timeline length at 100 = 100% of the scroll

    // A wipe reveal using transforms only: the window moves in from one side while its
    // content moves the other way, so the image itself stays still.
    const wipe = (el, axis, from, at, dur, ease) => {
      const inner = el.querySelector('.nm-wipe-in');
      const prop = axis === 'x' ? 'xPercent' : 'yPercent';
      tl.fromTo(el, { [prop]: from }, { [prop]: 0, duration: dur, ease }, at)
        .fromTo(inner, { [prop]: -from }, { [prop]: 0, duration: dur, ease }, at);
    };
    const guides = q('.nm-guides');
    const outline = q('.nm-draw--outline');
    const drawing = q('.nm-draw--sketch');
    const pour = q('.nm-pour');

    // 1. Sketch: construction lines, then the outline, then the detail are drawn in,
    //    with the pencil point riding the edge.
    tl.fromTo(guides, { opacity: 0 }, { opacity: 1, duration: 5, ease: 'none' }, sketch.at - 2);
    wipe(outline, 'x', -100, sketch.at, 11, 'power1.inOut');
    wipe(drawing, 'x', -100, sketch.at + 5, 15, 'power1.inOut');
    tl.fromTo(q('.nm-pencil'), { opacity: 0 }, { opacity: 1, duration: 1, ease: 'none' }, sketch.at + 5)
      .to(q('.nm-pencil'), { opacity: 0, duration: 1.5, ease: 'none' }, sketch.at + 19);

    // 2. Cast: the paper fades to the studio, molten light pours in from below and
    //    leaves the dull raw casting where the drawing was.
    tl.fromTo(q('.nm-paper'), { opacity: 1 }, { opacity: 0, duration: 8, ease: 'power1.inOut' }, cast.at)
      .to([guides, outline, drawing], { opacity: 0, duration: 7, ease: 'power1.in' }, cast.at + 3)
      .fromTo(q('.nm-heat'), { opacity: 0 }, { opacity: 1, duration: 5, ease: 'power1.out' }, cast.at)
      .to(q('.nm-heat'), { opacity: 0, duration: 7, ease: 'power1.in' }, cast.at + 8)
      .fromTo(pour, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'none' }, cast.at);
    wipe(pour, 'y', 100, cast.at + 1, cast.end - cast.at - 2, 'power1.inOut');
    tl.to(q('.nm-molten'), { opacity: 0, duration: 2, ease: 'none' }, cast.end - 2);

    // 3. Set: each drop is lowered into place, centre first, catching the light as it lands.
    const lift = () => -plate.clientHeight * 0.07;
    const gap = (set.end - set.at - 3) / stones.length;
    stones.forEach((el, i) => {
      const at = set.at + i * gap;
      const spark = el.firstElementChild;
      tl.fromTo(el, { autoAlpha: 0, y: lift, scale: 1.7 }, { autoAlpha: 1, y: 0, scale: 1, duration: 2.6, ease: 'power3.in' }, at)
        .fromTo(spark, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power1.out' }, at + 2.4)
        .to(spark, { opacity: 0, scale: 1.3, duration: 1.4, ease: 'power1.in' }, at + 3.2);
    });

    // 4. Polish: a band of light sweeps the gold twice, and the lustre comes up under it.
    const band = q('.nm-shine i');
    const sweep = { xPercent: -110, skewX: -16 };
    tl.fromTo(q('.nm-gold'), { opacity: 0 }, { opacity: 1, duration: polish.end - polish.at - 2, ease: 'power1.inOut' }, polish.at)
      .fromTo(q('.nm-shine'), { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'none' }, polish.at)
      .fromTo(band, sweep, { xPercent: 300, skewX: -16, duration: 7, ease: 'power1.inOut' }, polish.at)
      .fromTo(band, sweep, { xPercent: 300, skewX: -16, duration: 6, ease: 'power1.inOut', immediateRender: false }, polish.at + 7)
      .to(q('.nm-shine'), { opacity: 0, duration: 1.5, ease: 'none' }, polish.end - 0.5);

    // 5. Finished: the full photograph (the same canvas) fades in around the piece.
    tl.fromTo(q('.nm-scene'), { opacity: 0 }, { opacity: 1, duration: final.end - final.at, ease: 'power1.inOut' }, final.at)
      .to(art, { opacity: 0, duration: 2, ease: 'none' }, final.end - 2);

    // Stage name in the plate's corner.
    const tagTimes = [sketch.at - 1, cast.at, set.at, polish.at, final.at];
    tags.forEach((t, i) => {
      tl.fromTo(t, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 2 }, tagTimes[i]);
      if (i < tags.length - 1) tl.to(t, { opacity: 0, y: -10, duration: 1.5, ease: 'power2.in' }, tagTimes[i + 1] - 1.5);
    });

    // Copy: one block at a time (opacity only, so it all stays readable to assistive tech).
    STEPS.forEach(([, at, out], i) => {
      const el = stepEls[i];
      if (!el) return;
      if (i === 0) gsap.set(el, { opacity: 1, y: 0 });
      else tl.fromTo(el, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 4 }, at);
      if (out != null) tl.to(el, { opacity: 0, y: -18, duration: 3, ease: 'power2.in' }, out - 2);
    });

    if (railFill) tl.fromTo(railFill, { scaleX: 0 }, { scaleX: 1, duration: 71, ease: 'none' }, 10);
    railItems.forEach((s, i) => tl.to(s, { opacity: 1, duration: 3 }, STEPS[i + 1][1]));

    // A focused link in a hidden block scrolls to where that block is showing.
    const onFocus = (e) => {
      const i = stepEls.indexOf(e.target.closest('.nm-step'));
      const st = tl.scrollTrigger;
      if (!st || i < 0 || i === current) return;
      window.scrollTo({ top: st.start + (st.end - st.start) * Math.min(0.99, (STEPS[i][1] + 4) / 100), behavior: 'auto' });
    };
    root.addEventListener('focusin', onFocus);

    return () => {
      root.removeEventListener('focusin', onFocus);
      stepEls.forEach((el) => el && el.classList.remove('is-current'));
      root.classList.remove('is-final');
    };
  }

  /* ------------------------------------------------------------- lifecycle */
  function init(root = document.getElementById('making')) {
    if (!root || state) return;
    fillProduct(root);
    const stones = buildStones(root.querySelector('.nm-stones'));
    state = { root, stones, cleanups: [] };

    const { gsap, ScrollTrigger } = window;
    if (!gsap || !ScrollTrigger) return; // static: the finished photo beside the steps

    gsap.registerPlugin(ScrollTrigger);
    mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      root.classList.add('is-animated');
      const undo = buildTimeline(root, stones);
      return () => { undo(); root.classList.remove('is-animated'); };
    });

    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState !== 'complete') window.addEventListener('load', refresh, { once: true });
    state.cleanups.push(() => window.removeEventListener('load', refresh));
  }

  function destroy() {
    if (!state) return;
    if (mm) { mm.revert(); mm = null; }
    state.cleanups.forEach((fn) => fn());
    state.stones.forEach((el) => el.remove());
    state.root.classList.remove('is-animated', 'is-final');
    state = null;
  }

  window.NecklaceMaking = { init, destroy, stages: STAGES };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})();
