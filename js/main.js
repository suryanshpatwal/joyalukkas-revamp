(() => {
  'use strict';

  const D = window.JL;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,.8,.2,1)';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => '₹ ' + Math.round(n).toLocaleString('en-IN');
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const offPct = (p) => (p.regular > p.price ? Math.round(((p.regular - p.price) / p.regular) * 100) : 0);

  // A real product photo. Light studio shots sit on the matching grey; dark lifestyle shots fill the frame.
  const photo = (p, i = 0, opts = {}) => {
    const k = Math.min(i, p.images.length - 1);
    const alt = opts.decorative ? '' : esc(p.name);
    const loading = opts.eager ? 'eager' : 'lazy';
    return `<img class="ph ${p.dark[k] ? 'is-dark' : 'is-light'}" src="${p.images[k]}" alt="${alt}" loading="${loading}" decoding="async" draggable="false">`;
  };

  /* ---------- Bag, wishlist, toast ---------- */
  let bag = 0;
  const wishSet = new Set();
  const bagEl = $('#bagCount');
  const wishEl = $('#wishCount');
  const toastEl = $('#toast');
  let toastTimer;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }
  function bump(el, n) {
    el.textContent = n;
    el.classList.toggle('has', n > 0);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function addToBag(name, qty = 1) {
    bag += qty;
    bump(bagEl, bag);
    toast(`${name} added to bag (sample)`);
  }
  function toggleWish(name) {
    const on = !wishSet.has(name);
    if (on) wishSet.add(name); else wishSet.delete(name);
    $$('[data-wish]').forEach((b) => {
      if (b.dataset.wish === name) {
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    });
    bump(wishEl, wishSet.size);
    toast(on ? `${name} saved to wishlist` : `${name} removed from wishlist`);
  }
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { addToBag(add.dataset.add); return; }
    const wish = e.target.closest('[data-wish]');
    if (wish) toggleWish(wish.dataset.wish);
  });

  const V = window.JL_VIDEOS;

  /* ---------- Smooth scroll (Lenis), falling back to native scrolling ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const lockScroll = (on) => {
    if (lenis) { if (on) lenis.stop(); else lenis.start(); }
    document.body.style.overflow = on ? 'hidden' : '';
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Nav, progress, hero parallax ---------- */
  const nav = $('#nav');
  const hero = $('#hero');
  const progress = $('#scrollProgress');
  const menuBtn = $('#menuBtn');
  const navLinks = $('#navLinks');
  const scrollHooks = []; // scroll-linked animations registered by each section
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  let ticking = false;
  let lastY = 0;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      scrollHooks.forEach((fn) => fn());
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // The scroll film pins for most of its height; the page counts as "past the hero" once it's covered.
      const heroH = hero.offsetHeight - (document.documentElement.classList.contains('hs-on') ? window.innerHeight : 0);
      progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      nav.classList.toggle('is-solid', y > heroH - 120);
      // Hide the nav while scrolling down, bring it back on the way up.
      if (!navLinks.classList.contains('is-open')) {
        if (y > lastY + 6 && y > heroH * 0.5) nav.classList.add('is-hidden');
        else if (y < lastY - 6 || y < 80) nav.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  menuBtn.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const tickerWords = ['Try the Look', 'Gold', 'Diamonds', 'Temple Heritage', 'Polki', 'Bridal', 'Pearls', 'Gemstones'];
  const tickerSet = tickerWords.map((w) => `<span>${w}</span>`).join('');
  $('#tickerTrack').innerHTML = tickerSet + tickerSet;

  /* ---------- Loader: hold briefly, then fade out to reveal the film ---------- */
  const loader = $('#loader');
  const loadStart = performance.now();
  let loaded = false;
  function finishLoading() {
    if (loaded) return;
    loaded = true;
    const wait = reduceMotion ? 0 : Math.max(0, 1300 - (performance.now() - loadStart));
    const open = () => {
      document.documentElement.classList.add('is-loaded');
      loader.classList.add('is-open');
      document.dispatchEvent(new CustomEvent('jl:open'));
      startReveals();
      setTimeout(() => loader.remove(), 900);
    };
    setTimeout(open, wait);
  }
  window.addEventListener('load', finishLoading);
  setTimeout(finishLoading, 3500); // never wait on slow images for long

  /* ---------- Custom cursor and magnetic buttons (mouse and trackpad only) ---------- */
  const cursor = $('#cursor');
  const cursorLabel = $('#cursorLabel');
  if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    let mx = -100;
    let my = -100;
    let cx = -100;
    let cy = -100;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      cursor.classList.add('is-active');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    const follow = () => {
      cx += (mx - cx) * 0.2;
      cy += (my - cy) * 0.2;
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      const control = t.closest('a, button, input, select');
      const product = t.closest('.ed-tile, .vault-item');
      const zone = t.closest('[data-cursor]');
      let label = '';
      if (product) label = 'View';
      else if (zone && !control) label = zone.dataset.cursor;
      cursorLabel.textContent = label;
      cursor.classList.toggle('is-label', Boolean(label));
      cursor.classList.toggle('is-link', !label && Boolean(control));
    });
    let magnet = null;
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest('.btn, .round-btn');
      if (magnet && magnet !== el) magnet.style.translate = '';
      magnet = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.translate = `${((e.clientX - (r.left + r.width / 2)) * 0.25).toFixed(1)}px ${((e.clientY - (r.top + r.height / 2)) * 0.35).toFixed(1)}px`;
    }, { passive: true });
  }

  /* ---------- Headings rise in word by word ---------- */
  function splitWords(el) {
    let wi = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
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
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
  }
  $$('[data-anim] h1, [data-anim] h2').forEach(splitWords);

  /* ---------- Six moods: editorial grid ---------- */
  const moodTiles = [{ name: D.moods[0].name, filter: D.moods[0].filter, p: D.hero }, ...D.moods.slice(1)];
  // Wide banner tiles where a square packshot crops badly: a still from the Primora film instead.
  const moodBanners = {
    'Diamond Grace': { src: 'images/moods/diamond-grace.webp', alt: 'A diamond peacock necklace with an emerald drop, resting on a stone' },
  };
  const moodMedia = (m) => {
    const b = moodBanners[m.name];
    return b ? `<img class="ph is-dark" src="${b.src}" alt="${esc(b.alt)}" width="1920" height="600" loading="lazy" decoding="async" draggable="false">` : photo(m.p);
  };
  $('#moodGrid').innerHTML = moodTiles.map((m, i) => `
    <a class="ed-tile ed-${i}" href="#vault" data-filter="${m.filter}">
      <div class="ed-media" data-mask style="--d:${((i % 3) * 0.12).toFixed(2)}s">${moodMedia(m)}</div>
      <div class="ed-cap"><span class="ed-num">${String(i + 1).padStart(2, '0')}</span><span class="ed-name">${esc(m.name)}</span><span class="ed-arrow">${icon('arrow')}</span></div>
    </a>`).join('');

  /* ---------- Try the look ---------- */
  const looks = D.looks;
  const stage = $('#lookStage');
  stage.innerHTML = looks.map((l, i) => `
    <div class="look-card" data-i="${i}">
      <div class="look-frame">${photo(l.items[0], 0, { decorative: true })}</div>
      <span class="look-badge">${photo(l.items[1], 0, { decorative: true })}</span>
    </div>`).join('');
  const lookCards = $$('.look-card', stage);
  let lookIndex = 2;

  function positionLooks() {
    const spacing = Math.min(stage.clientWidth * 0.27, 230);
    lookCards.forEach((card, i) => {
      const o = i - lookIndex;
      const a = Math.abs(o);
      card.style.transform = `translateX(calc(-50% + ${o * spacing}px)) scale(${Math.max(1 - a * 0.16, 0.5)})`;
      card.style.filter = a ? `blur(${Math.min(a, 3) * 2.5}px)` : 'none';
      card.style.opacity = a > 2 ? 0 : 1 - a * 0.3;
      card.style.zIndex = 10 - a;
    });
  }
  function renderLook() {
    positionLooks();
    const look = looks[lookIndex];
    $('#lookCounter').innerHTML = `<b>${lookIndex + 1} of ${looks.length}</b> · ${esc(look.name)}`;
    $('#lookItems').innerHTML = look.items.map((it, k) => `
      <li class="look-item" style="--d:${(k * 0.05).toFixed(2)}s">
        <span class="thumb">${photo(it, 0, { decorative: true })}</span>
        <span>
          <a class="item-name" href="${it.url}" target="_blank" rel="noopener">${esc(it.name)}</a><br>
          <span class="item-price">${inr(it.price)}</span>
        </span>
        <button class="mini-btn heart${wishSet.has(it.name) ? ' is-on' : ''}" data-wish="${esc(it.name)}" aria-label="Save ${esc(it.name)}">${icon('heart')}</button>
        <button class="mini-btn" data-add="${esc(it.name)}" aria-label="Add ${esc(it.name)} to bag">${icon('plus')}</button>
      </li>`).join('');
    const total = look.items.reduce((s, it) => s + it.price, 0);
    $('#bundleWas').textContent = inr(total);
    $('#bundlePrice').textContent = inr(total * 0.9);
  }
  const goLook = (i) => {
    const next = Math.max(0, Math.min(looks.length - 1, i));
    if (next !== lookIndex) { lookIndex = next; renderLook(); }
  };
  $('#lookPrev').addEventListener('click', () => goLook(lookIndex - 1));
  $('#lookNext').addEventListener('click', () => goLook(lookIndex + 1));
  $('#addLook').addEventListener('click', () => addToBag(`${looks[lookIndex].name} look`, looks[lookIndex].items.length));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goLook(lookIndex - 1);
    if (e.key === 'ArrowRight') goLook(lookIndex + 1);
  });

  let dragX = null;
  let dragMoved = false;
  stage.addEventListener('pointerdown', (e) => {
    dragX = e.clientX;
    dragMoved = false;
    stage.classList.add('is-dragging');
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    const dx = e.clientX - dragX;
    if (Math.abs(dx) > 60) {
      goLook(lookIndex + (dx < 0 ? 1 : -1));
      dragX = e.clientX;
      dragMoved = true;
    }
  });
  stage.addEventListener('pointerup', (e) => {
    if (dragX === null) return;
    if (!dragMoved) {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const card = hit && hit.closest('.look-card');
      if (card) goLook(Number(card.dataset.i));
    }
    dragX = null;
    stage.classList.remove('is-dragging');
  });
  stage.addEventListener('pointercancel', () => { dragX = null; stage.classList.remove('is-dragging'); });

  let wheelLock = 0;
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
    e.preventDefault();
    const now = Date.now();
    if (now - wheelLock < 420) return;
    wheelLock = now;
    goLook(lookIndex + (e.deltaX > 0 ? 1 : -1));
  }, { passive: false });

  /* ---------- Pick a gem ---------- */
  const fan = $('#fan');
  fan.innerHTML = D.gems.map((g, i) => `
    <article class="gem-card" style="--c:${g.color}" data-i="${i}">
      <div class="gem-title">${esc(g.title).replace(' ', '<br>')}</div>
      <div class="gem-plate">${photo(g.p)}</div>
      <div class="gem-meta">
        <span class="gem-name">${esc(g.title)}</span>
        <span class="gem-sub">${esc(g.p.name)}</span>
        <span class="gem-price">${inr(g.p.price)}</span>
      </div>
      <button class="gem-heart heart" data-wish="${esc(g.p.name)}" aria-label="Save ${esc(g.p.name)}">${icon('heart')}</button>
      <button class="gem-add" data-add="${esc(g.p.name)}" aria-label="Add ${esc(g.p.name)} to bag">${icon('plus')}</button>
    </article>`).join('');
  const gemCards = $$('.gem-card', fan);
  const pickSection = $('#pick');

  // Twinkles over each jewel, shown while the card is hovered.
  gemCards.forEach((c) => {
    const plate = $('.gem-plate', c);
    for (let k = 0; k < 7; k++) {
      const t = document.createElement('span');
      t.className = 'twinkle';
      t.style.left = `${15 + Math.random() * 70}%`;
      t.style.top = `${15 + Math.random() * 70}%`;
      t.style.setProperty('--d', `${(Math.random() * 1.4).toFixed(2)}s`);
      plate.appendChild(t);
    }
  });

  // Cards start stacked and fan out as the section scrolls into view.
  scrollHooks.push(() => {
    if (reduceMotion) { fan.style.setProperty('--spread', 1); return; }
    const r = fan.getBoundingClientRect();
    const p = clamp01((window.innerHeight - r.top) / (window.innerHeight * 0.75));
    fan.style.setProperty('--spread', (1 - Math.pow(1 - p, 3)).toFixed(3));
  });

  function layoutFan() {
    const mid = (gemCards.length - 1) / 2;
    const step = Math.min(fan.clientWidth / (gemCards.length + 0.6), 236);
    gemCards.forEach((c, i) => {
      const o = i - mid;
      c.style.setProperty('--x', `${o * step}px`);
      c.style.setProperty('--y', `${o * o * 16}px`);
      c.style.setProperty('--r', `${o * 7}deg`);
      c.style.zIndex = 10 - Math.abs(Math.round(o));
    });
  }
  function burst(card, e) {
    const r = card.getBoundingClientRect();
    for (let k = 0; k < 16; k++) {
      const b = document.createElement('span');
      b.className = 'burst';
      b.style.left = `${e.clientX - r.left}px`;
      b.style.top = `${e.clientY - r.top}px`;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      b.style.setProperty('--bx', `${Math.cos(angle) * dist}px`);
      b.style.setProperty('--by', `${Math.sin(angle) * dist}px`);
      card.appendChild(b);
      setTimeout(() => b.remove(), 750);
    }
  }
  gemCards.forEach((c, i) => {
    c.style.setProperty('--i', i);
    c.addEventListener('pointerenter', () => pickSection.style.setProperty('--amb', D.gems[i].color));
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty('--ty', `${(px * 16).toFixed(1)}deg`);
      c.style.setProperty('--tx', `${(-py * 16).toFixed(1)}deg`);
      c.style.setProperty('--px', px.toFixed(3));
      c.style.setProperty('--py', py.toFixed(3));
    });
    c.addEventListener('pointerleave', () => {
      ['--tx', '--ty'].forEach((v) => c.style.setProperty(v, '0deg'));
      ['--px', '--py'].forEach((v) => c.style.setProperty(v, 0));
      c.classList.remove('is-pressed');
      pickSection.style.setProperty('--amb', '#FFFFFF');
    });
    c.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) c.classList.add('is-pressed'); });
    c.addEventListener('pointerup', () => c.classList.remove('is-pressed'));
    c.querySelector('.gem-plate').addEventListener('click', (e) => burst(c, e));
  });

  /* ---------- The vault ---------- */
  const vault = D.vault;
  const cats = [['all', 'All pieces'], ['necklaces', 'Necklaces'], ['earrings', 'Earrings'], ['rings', 'Rings'], ['bangles', 'Bangles'], ['bridal', 'Bridal']];
  const sizes = {
    rings: ['10', '12', '14', '16', '18'],
    bangles: ['2.4', '2.6', '2.8'],
    necklaces: ['16 in', '18 in'],
    bridal: ['Standard'],
    earrings: ['One size'],
  };

  const chipsEl = $('#vaultChips');
  const itemsEl = $('#vaultItems');
  const captionEl = $('#vaultCaption');
  // Touch screens can't hover, so the hints say tap and swipe instead.
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (!canHover) {
    captionEl.textContent = 'Tap a piece to see it up close';
    $('.hint').textContent = 'Swipe to browse';
  }
  const captionDefault = captionEl.textContent;
  chipsEl.innerHTML = cats.map(([k, label]) => {
    const count = k === 'all' ? vault.length : vault.filter((v) => v.cat === k).length;
    return `<button class="chip${k === 'all' ? ' is-on' : ''}" role="tab" aria-selected="${k === 'all'}" data-cat="${k}">${label}<span>${count}</span></button>`;
  }).join('');
  itemsEl.innerHTML = vault.map((v, i) => `
    <button class="vault-item" data-i="${i}" style="--i:${i}" aria-label="${esc(v.p.name)}, ${inr(v.p.price)}">
      <span class="stand">${photo(v.p, 0, { decorative: true })}</span>
    </button>`).join('');
  const vaultEls = $$('.vault-item', itemsEl);
  const vaultBox = $('.vault');
  const vaultBar = $('#vaultBar');

  // Gold progress bar in place of the browser scrollbar.
  function updateVaultBar() {
    const { scrollLeft, scrollWidth, clientWidth } = itemsEl;
    const share = scrollWidth ? clientWidth / scrollWidth : 1;
    vaultBar.style.width = `${Math.min(share, 1) * 100}%`;
    vaultBar.style.transform = `translateX(${scrollWidth > clientWidth ? (scrollLeft / (scrollWidth - clientWidth)) * ((1 / Math.min(share, 1)) - 1) * 100 : 0}%)`;
  }
  itemsEl.addEventListener('scroll', updateVaultBar, { passive: true });

  // The rail drifts sideways as the page scrolls, until the visitor takes over.
  let vaultTouched = 0;
  const touchVault = () => { vaultTouched = Date.now(); };
  scrollHooks.push(() => {
    if (reduceMotion || Date.now() - vaultTouched < 2500) return;
    const r = vaultBox.getBoundingClientRect();
    const p = clamp01((window.innerHeight * 0.85 - r.top) / (window.innerHeight * 0.85));
    itemsEl.scrollLeft = p * (itemsEl.scrollWidth - itemsEl.clientWidth);
  });
  $('#vaultPrev').addEventListener('click', () => { touchVault(); itemsEl.scrollBy({ left: -itemsEl.clientWidth * 0.7, behavior: 'smooth' }); });
  $('#vaultNext').addEventListener('click', () => { touchVault(); itemsEl.scrollBy({ left: itemsEl.clientWidth * 0.7, behavior: 'smooth' }); });
  itemsEl.addEventListener('wheel', touchVault, { passive: true });
  itemsEl.addEventListener('touchstart', touchVault, { passive: true });

  // Drag the rail with a mouse; a drag doesn't count as a click on a piece.
  let railDrag = null;
  let railDragged = false;
  itemsEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    touchVault();
    railDrag = { x: e.clientX, left: itemsEl.scrollLeft };
    railDragged = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!railDrag) return;
    const dx = e.clientX - railDrag.x;
    if (Math.abs(dx) > 5) { railDragged = true; itemsEl.classList.add('is-dragging'); }
    itemsEl.scrollLeft = railDrag.left - dx;
    touchVault();
  });
  window.addEventListener('pointerup', () => { railDrag = null; itemsEl.classList.remove('is-dragging'); });
  itemsEl.addEventListener('click', (e) => {
    if (railDragged) { e.stopPropagation(); e.preventDefault(); railDragged = false; }
  }, true);

  // A soft spotlight follows the hovered piece.
  const spotOn = (el) => {
    const b = vaultBox.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    vaultBox.style.setProperty('--spot-x', `${r.left + r.width / 2 - b.left}px`);
    vaultBox.classList.add('has-spot');
  };
  itemsEl.addEventListener('mouseleave', () => vaultBox.classList.remove('has-spot'));
  const visibleVault = () => vaultEls.filter((el) => !el.hidden);
  const setVaultCount = () => { $('#vaultCount').textContent = `Explore the collection · ${visibleVault().length} pieces`; };
  setVaultCount();
  $('#fetchNote').textContent = `Real products and prices from joyalukkas.in · fetched ${D.fetched}`;
  $('#footerNote').textContent = `Concept landing page · product photos and prices from joyalukkas.in (fetched ${D.fetched})`;

  vaultEls.forEach((el) => {
    const v = vault[Number(el.dataset.i)];
    const show = () => {
      captionEl.textContent = `${v.p.name} — ${inr(v.p.price)}`;
      captionEl.classList.remove('pop');
      void captionEl.offsetWidth;
      captionEl.classList.add('pop');
      spotOn(el);
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', () => { captionEl.textContent = captionDefault; });
    el.addEventListener('click', () => openDetail(Number(el.dataset.i)));
  });

  let vaultFilter = 'all';
  let filtering = false;
  function applyFilter(cat) {
    if (cat === vaultFilter || filtering) return;
    filtering = true;
    vaultFilter = cat;
    $$('.chip', chipsEl).forEach((c) => {
      const on = c.dataset.cat === cat;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-selected', String(on));
    });
    const match = (el) => cat === 'all' || vault[Number(el.dataset.i)].cat === cat;
    const leaving = vaultEls.filter((el) => !el.hidden && !match(el));
    const first = new Map();
    visibleVault().forEach((el) => first.set(el, el.getBoundingClientRect()));
    const outAnims = [];

    const finish = () => {
      leaving.forEach((el) => { el.hidden = true; });
      outAnims.forEach((a) => a.cancel());
      const entering = vaultEls.filter((el) => el.hidden && match(el));
      entering.forEach((el) => { el.hidden = false; });
      if (!reduceMotion) {
        visibleVault().forEach((el, k) => {
          const f = first.get(el);
          if (!f || entering.includes(el)) {
            el.animate([{ opacity: 0, transform: 'translateX(70px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: EASE, delay: 60 + k * 40, fill: 'backwards' });
            return;
          }
          const dx = f.left - el.getBoundingClientRect().left;
          if (dx) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 650, easing: EASE });
        });
      }
      setVaultCount();
      updateVaultBar();
      filtering = false;
    };

    if (!leaving.length || reduceMotion) { finish(); return; }
    let done = 0;
    leaving.forEach((el) => {
      const anim = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-40px) scale(.9)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
      outAnims.push(anim);
      anim.onfinish = () => { if (++done === leaving.length) finish(); };
    });
  }
  chipsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) applyFilter(chip.dataset.cat);
  });
  $$('.ed-tile').forEach((m) => m.addEventListener('click', () => applyFilter(m.dataset.filter)));

  /* ---------- Vault detail ---------- */
  const detail = $('#detail');
  const detailPiece = $('#detailPiece');
  const detailAdd = $('#detailAdd');
  const detailSizes = $('#detailSizes');
  const detailToggle = $('#detailToggle');
  let detailIndex = 0;
  let detailSize = null;
  let lastFocus = null;

  function updateAdd() {
    detailAdd.textContent = detailSize ? `Add to bag · ${detailSize}` : 'Select a size';
  }
  function showView(k) {
    const p = vault[detailIndex].p;
    detailPiece.innerHTML = photo(p, k, { eager: true });
    $$('button', detailToggle).forEach((b) => b.classList.toggle('is-on', Number(b.dataset.view) === k));
  }
  function showDetail(i) {
    detailIndex = i;
    const v = vault[i];
    const p = v.p;
    const list = sizes[v.cat];
    detailSize = list.length === 1 ? list[0] : null;
    showView(0);
    detailToggle.hidden = p.images.length < 2;
    $('#detailCat').textContent = p.type;
    $('#detailName').textContent = p.name;
    $('#detailPrice').textContent = inr(p.price);
    $('#detailWas').textContent = p.regular > p.price ? inr(p.regular) : '';
    $('#detailLink').href = p.url;
    detailSizes.innerHTML = list.map((s) => `<button class="size${s === detailSize ? ' is-on' : ''}" data-size="${s}">${s}</button>`).join('');
    const heart = $('#detailHeart');
    heart.dataset.wish = p.name;
    heart.classList.toggle('is-on', wishSet.has(p.name));
    updateAdd();
  }
  function openDetail(i) {
    lastFocus = document.activeElement;
    detail.hidden = false;
    lockScroll(true);
    showDetail(i);
    $('#detailClose').focus();
  }
  function closeDetail() {
    detail.hidden = true;
    lockScroll(false);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function stepDetail(dir) {
    const list = visibleVault().map((el) => Number(el.dataset.i));
    const pos = Math.max(0, list.indexOf(detailIndex));
    showDetail(list[(pos + dir + list.length) % list.length]);
  }
  $('#detailClose').addEventListener('click', closeDetail);
  $('#detailPrev').addEventListener('click', () => stepDetail(-1));
  $('#detailNext').addEventListener('click', () => stepDetail(1));
  $('#detailAvail').addEventListener('click', closeDetail);
  detail.addEventListener('click', (e) => { if (e.target === detail) closeDetail(); });
  // Swipe the photo to move between pieces.
  let detailSx = null;
  detailPiece.style.touchAction = 'pan-y';
  detailPiece.addEventListener('pointerdown', (e) => { detailSx = e.clientX; });
  detailPiece.addEventListener('pointerup', (e) => {
    if (detailSx === null) return;
    const dx = e.clientX - detailSx;
    detailSx = null;
    if (Math.abs(dx) > 40) stepDetail(dx < 0 ? 1 : -1);
  });
  detailToggle.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) showView(Number(b.dataset.view));
  });
  detailSizes.addEventListener('click', (e) => {
    const btn = e.target.closest('.size');
    if (!btn) return;
    detailSize = btn.dataset.size;
    $$('.size', detailSizes).forEach((s) => s.classList.toggle('is-on', s === btn));
    updateAdd();
  });
  detailAdd.addEventListener('click', () => {
    if (!detailSize) {
      detailSizes.classList.remove('shake');
      void detailSizes.offsetWidth;
      detailSizes.classList.add('shake');
      return;
    }
    addToBag(`${vault[detailIndex].p.name} (${detailSize})`);
  });

  /* ---------- Muse film: plays only while it is on screen ---------- */
  const filmEl = $('#filmScreen');
  filmEl.style.aspectRatio = V.film.ratio;
  filmEl.insertAdjacentHTML('afterbegin', `<video class="ph is-dark film-video" src="${V.film.src}" muted loop playsinline preload="metadata" aria-label="${esc(V.film.title)} brand film"></video>`);
  const filmVideo = $('.film-video', filmEl);
  $('#filmNote').textContent = `${V.film.title} · Joyalukkas`;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !reduceMotion) filmVideo.play().catch(() => {});
      else filmVideo.pause();
    }, { threshold: 0.3 }).observe(filmEl);
  }
  const half = Math.ceil(D.tiles.length / 2);
  const tiles = (arr) => arr.map((p) => `<div class="tile">${photo(p, 0, { decorative: true })}</div>`).join('');
  $('#colLeft').innerHTML = tiles(D.tiles.slice(0, half)).repeat(2);
  $('#colRight').innerHTML = tiles(D.tiles.slice(half)).repeat(2);
  const soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', () => {
    const on = filmVideo.muted;
    filmVideo.muted = !on;
    if (on) filmVideo.play().catch(() => {});
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
  });

  /* ---------- Shared arc layout (reels and bridal) ---------- */
  function layoutArc(cards, active, opt) {
    const n = cards.length;
    const halfN = Math.floor(n / 2);
    cards.forEach((c, i) => {
      let o = i - active;
      if (o > halfN) o -= n;
      if (o < -halfN) o += n;
      const a = Math.abs(o);
      c.style.transform = `translateX(calc(-50% + ${o * opt.spacing}px)) translateZ(${-a * opt.depth}px) rotateY(${o * opt.rot * opt.dir}deg)`;
      c.style.opacity = a > opt.visible ? 0 : 1 - a * opt.fade;
      c.style.filter = a ? `brightness(${1 - a * 0.1})` : 'none';
      c.style.zIndex = 10 - a;
      c.style.pointerEvents = a > opt.visible ? 'none' : '';
      c.classList.toggle('is-center', a === 0);
    });
  }
  function swipeable(el, onSwipe, onTap) {
    let sx = null;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) { onSwipe(dx < 0 ? 1 : -1); return; }
      const card = e.target.closest('.arc-card');
      if (card) onTap(Number(card.dataset.i));
    });
  }

  /* ---------- Reels ---------- */
  const reels = V.reels;
  const fmtTime = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '--:--');
  const reelCard = (r, i) => `
    <article class="arc-card" data-i="${i}">
      <div class="art"><video class="ph is-dark" src="${r.src}#t=0.5" muted playsinline preload="metadata" aria-label="${esc(r.title)}"></video></div>
      <div class="reel-top"><span>Reel ${String(i + 1).padStart(2, '0')}</span><span class="dur">--:--</span></div>
      <span class="play">${icon('play')}</span>
      <div class="reel-meta"><span class="tag">${esc(r.tag)}</span><h3>${esc(r.title)}</h3><p>${icon('pin')} ${esc(r.place)}</p></div>
      <div class="bar"><i></i></div>
    </article>`;
  const reelArc = $('#reelArc');
  reelArc.innerHTML = reels.map(reelCard).join('');
  const reelCards = $$('.arc-card', reelArc);
  const reelVideos = reelCards.map((c) => $('video', c));
  const reelToggle = $('#reelToggle');
  let reelIndex = 0;
  let reelPlaying = !reduceMotion;
  let reelInView = false;

  reelCards.forEach((card, i) => {
    const video = reelVideos[i];
    const bar = $('.bar i', card);
    video.addEventListener('loadedmetadata', () => { $('.dur', card).textContent = fmtTime(video.duration); });
    video.addEventListener('timeupdate', () => {
      if (i === reelIndex && video.duration) bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
    });
    video.addEventListener('ended', () => { if (i === reelIndex) setReel(reelIndex + 1); });
    video.addEventListener('play', () => card.classList.add('is-playing'));
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
  });

  const reelOpts = () => {
    const w = reelArc.clientWidth;
    return { spacing: Math.min(w * 0.19, 250), depth: 170, rot: 24, dir: -1, fade: 0.2, visible: w < 700 ? 1 : 2 };
  };
  const layoutReels = () => layoutArc(reelCards, reelIndex, reelOpts());
  // Only the centre reel plays; the rest pause on their first frame.
  function syncReels() {
    reelVideos.forEach((v, i) => {
      if (i === reelIndex && reelPlaying && reelInView) v.play().catch(() => {});
      else v.pause();
    });
  }
  function setReel(i) {
    const prev = reelVideos[reelIndex];
    reelIndex = (i + reels.length) % reels.length;
    if (prev !== reelVideos[reelIndex]) prev.currentTime = 0.5;
    reelVideos[reelIndex].currentTime = 0;
    reelCards.forEach((c) => { $('.bar i', c).style.width = '0%'; });
    layoutReels();
    syncReels();
  }
  const startReels = syncReels;
  const stopReels = () => reelVideos.forEach((v) => v.pause());
  function setReelButton() {
    reelToggle.innerHTML = icon(reelPlaying ? 'pause' : 'play');
    reelToggle.setAttribute('aria-label', reelPlaying ? 'Pause reels' : 'Play reels');
  }
  reelToggle.addEventListener('click', () => {
    reelPlaying = !reelPlaying;
    setReelButton();
    syncReels();
  });
  $('#reelPrev').addEventListener('click', () => setReel(reelIndex - 1));
  $('#reelNext').addEventListener('click', () => setReel(reelIndex + 1));

  // Full screen: the same reel with sound and controls.
  const viewer = $('#reelViewer');
  function openReel(i) {
    const r = reels[i];
    stopReels();
    $('#reelFull').innerHTML = `<video class="reel-full-video" src="${r.src}" controls autoplay playsinline aria-label="${esc(r.title)}"></video>
      <div class="reel-full-meta"><span class="tag">${esc(r.tag)}</span><h3>${esc(r.title)}</h3></div>`;
    viewer.hidden = false;
    lockScroll(true);
    $('#reelClose').focus();
  }
  function closeReel() {
    const v = $('#reelFull video');
    if (v) v.pause();
    $('#reelFull').innerHTML = '';
    viewer.hidden = true;
    lockScroll(false);
    startReels();
  }
  $('#reelClose').addEventListener('click', closeReel);
  viewer.addEventListener('click', (e) => { if (e.target === viewer) closeReel(); });
  swipeable(reelArc, (dir) => setReel(reelIndex + dir), (i) => { if (i === reelIndex) openReel(i); else setReel(i); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      reelInView = entries[0].isIntersecting;
      syncReels();
    }, { threshold: 0.35 }).observe(reelArc);
  }
  setReelButton();
  layoutReels();

  /* ---------- Bridal ---------- */
  const bridal = D.bridal;
  const bridalSection = $('#bridal');
  const bridalArc = $('#bridalArc');
  const bridalDots = $('#bridalDots');
  // Each piece appears twice around the ring so the circle reads as full.
  const ringCopies = bridal.length < 10 ? 2 : 1;
  const ringItems = Array.from({ length: bridal.length * ringCopies }, (_, j) => j % bridal.length);
  bridalArc.innerHTML = ringItems.map((i, j) => {
    const p = bridal[i];
    const pct = offPct(p);
    return `
    <article class="arc-card" data-i="${i}" data-j="${j}"${j >= bridal.length ? ' aria-hidden="true"' : ''}>
      <div class="art">${photo(p, 0, { decorative: true })}</div>
      ${pct ? `<span class="deal">${pct}% off</span>` : ''}
    </article>`;
  }).join('');
  bridalDots.innerHTML = bridal.map((p, i) => `<button data-i="${i}" aria-label="Show ${esc(p.name)}"><i></i></button>`).join('');
  const bridalCards = $$('.arc-card', bridalArc);
  const dotEls = $$('button', bridalDots);
  const bridalInfo = $('#bridalInfo');
  let bridalIndex = -1;
  let bridalSpread = reduceMotion ? 1 : 0;
  let shownPrice = bridal[0].price;

  // Falling gold flecks over the velvet background.
  const flecks = $('#bridalFlecks');
  for (let k = 0; k < 22; k++) {
    const f = document.createElement('span');
    f.style.left = `${Math.random() * 100}%`;
    f.style.setProperty('--s', (0.5 + Math.random()).toFixed(2));
    f.style.setProperty('--t', `${(9 + Math.random() * 10).toFixed(1)}s`);
    f.style.setProperty('--d', `${(-Math.random() * 18).toFixed(1)}s`);
    f.style.setProperty('--sway', `${(Math.random() * 60 - 30).toFixed(0)}px`);
    flecks.appendChild(f);
  }

  /* A ring of arches turning slowly in 3D. Card j sits at j * ringStep degrees;
     the one facing the viewer is the active piece. */
  const ringStep = 360 / ringItems.length;
  const normDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const RING_SPEED = reduceMotion ? 0 : 0.09; // degrees per frame at 60fps, about one piece every 5s
  let ringAngle = 0;
  let ringVel = 0;
  let ringTween = null;
  let ringHold = 0;
  let ringHover = false;
  let ringDrag = null;
  let frontCard = 0;

  function layoutBridal() {
    const cw = bridalCards[0].offsetWidth || 280;
    // radius from the arch width so neighbours sit just apart; it opens out as the section scrolls in
    const R = ((ringItems.length * cw * 1.12) / (2 * Math.PI)) * (0.45 + 0.55 * bridalSpread);
    let best = 999;
    bridalCards.forEach((c, j) => {
      const a = normDeg(j * ringStep + ringAngle);
      const k = Math.cos((a * Math.PI) / 180); // 1 = facing us, -1 = at the back
      c.style.transform = `translateX(-50%) translateZ(${(-R).toFixed(1)}px) rotateY(${a.toFixed(2)}deg) translateZ(${R.toFixed(1)}px)`;
      c.style.opacity = k < 0 ? 0 : Math.min(1, 0.15 + k * 1.1).toFixed(3);
      c.style.filter = `brightness(${(0.35 + 0.65 * Math.max(0, k) ** 2).toFixed(3)})`;
      c.style.zIndex = String(Math.round(50 + k * 40));
      c.style.pointerEvents = k < 0.25 ? 'none' : '';
      if (Math.abs(a) < best) { best = Math.abs(a); frontCard = j; }
    });
    bridalCards.forEach((c, j) => c.classList.toggle('is-center', j === frontCard && best < ringStep * 0.3));
    const i = ringItems[frontCard];
    if (i !== bridalIndex) showBridal(i);
  }

  // Rotate the ring so card j faces front, the short way round.
  function ringTo(j) {
    const to = ringAngle - normDeg(j * ringStep + ringAngle);
    if (reduceMotion) { ringAngle = to; layoutBridal(); return; }
    ringVel = 0;
    ringTween = { from: ringAngle, to, t0: performance.now(), dur: 900 };
  }
  // Nearest copy of piece i.
  function setBridal(i) {
    i = (i + bridal.length) % bridal.length;
    let bestJ = 0;
    let bestD = 999;
    ringItems.forEach((item, j) => {
      if (item !== i) return;
      const d = Math.abs(normDeg(j * ringStep + ringAngle));
      if (d < bestD) { bestD = d; bestJ = j; }
    });
    ringTo(bestJ);
  }
  const stepRing = (dir) => ringTo((frontCard + dir + ringItems.length) % ringItems.length);

  let ringRaf = 0;
  let ringLast = 0;
  function ringFrame(t) {
    const dt = Math.min(50, t - (ringLast || t)) / 16.67;
    ringLast = t;
    if (ringTween) {
      const k = Math.min(1, (t - ringTween.t0) / ringTween.dur);
      ringAngle = ringTween.from + (ringTween.to - ringTween.from) * (1 - Math.pow(1 - k, 3));
      if (k === 1) { ringTween = null; ringHold = t + 2600; }
    } else if (!ringDrag) {
      if (Math.abs(ringVel) > 0.02) {
        ringAngle += ringVel * dt;
        ringVel *= Math.pow(0.94, dt);
      } else if (!ringHover && t > ringHold) {
        ringAngle -= RING_SPEED * dt; // arches travel right to left
      }
    }
    layoutBridal();
    ringRaf = requestAnimationFrame(ringFrame);
  }
  const ringStart = () => { if (!ringRaf) { ringLast = 0; ringRaf = requestAnimationFrame(ringFrame); } };
  const ringStop = () => { cancelAnimationFrame(ringRaf); ringRaf = 0; };

  scrollHooks.push(() => {
    if (reduceMotion) return;
    const r = bridalArc.getBoundingClientRect();
    const p = clamp01((window.innerHeight - r.top) / (window.innerHeight * 0.7));
    const s = 1 - Math.pow(1 - p, 3);
    if (Math.abs(s - bridalSpread) > 0.002) { bridalSpread = s; if (!ringRaf) layoutBridal(); }
  });

  function countPrice(el, from, to) {
    if (reduceMotion || from === to) { el.textContent = inr(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / 700, 1);
      el.textContent = inr(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function showBridal(i) {
    bridalIndex = i;
    dotEls.forEach((d, k) => {
      d.classList.remove('is-on');
      d.setAttribute('aria-current', String(k === bridalIndex));
    });
    dotEls[bridalIndex].classList.add('is-on');
    const p = bridal[bridalIndex];
    bridalInfo.innerHTML = `
      <h3 style="--k:0">${esc(p.name)}</h3>
      <p class="meta" style="--k:1">${esc(p.type)} · Bridal collection · <a href="${p.url}" target="_blank" rel="noopener">View on joyalukkas.in</a></p>
      <p class="price" style="--k:2"><span class="price-now"></span>${p.regular > p.price ? ` <s>${inr(p.regular)}</s>` : ''}</p>
      <div class="bridal-row" style="--k:3">
        <button class="round-btn" data-step="-1" aria-label="Previous piece">${icon('prev')}</button>
        <button class="btn btn-gold" data-add="${esc(p.name)}">Add to cart</button>
        <button class="round-btn heart${wishSet.has(p.name) ? ' is-on' : ''}" data-wish="${esc(p.name)}" aria-label="Save ${esc(p.name)}">${icon('heart')}</button>
        <button class="round-btn" data-step="1" aria-label="Next piece">${icon('next')}</button>
      </div>`;
    countPrice($('.price-now', bridalInfo), shownPrice, p.price);
    shownPrice = p.price;
  }
  bridalInfo.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) stepRing(Number(step.dataset.step));
  });
  bridalDots.addEventListener('click', (e) => {
    const d = e.target.closest('button');
    if (d) setBridal(Number(d.dataset.i));
  });
  // The ring only turns while it is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      bridalSection.classList.toggle('is-paused', !on);
      if (on) ringStart(); else ringStop();
    }, { threshold: 0.2 }).observe(bridalArc);
  } else {
    ringStart();
  }
  bridalArc.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') stepRing(-1);
    if (e.key === 'ArrowRight') stepRing(1);
  });
  // The centre photo shifts gently with the cursor.
  bridalArc.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = bridalArc.getBoundingClientRect();
    bridalArc.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    bridalArc.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  bridalArc.addEventListener('pointerleave', () => {
    bridalArc.style.setProperty('--px', 0);
    bridalArc.style.setProperty('--py', 0);
  });
  // Drag spins the ring with momentum; a tap brings that arch to the front.
  bridalArc.style.touchAction = 'pan-y';
  bridalArc.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') ringHover = true; });
  bridalArc.addEventListener('pointerleave', () => { ringHover = false; });
  bridalArc.addEventListener('pointerdown', (e) => {
    ringTween = null;
    ringVel = 0;
    ringDrag = { x: e.clientX, angle: ringAngle, lastX: e.clientX, lastT: performance.now(), v: 0, moved: 0 };
  });
  window.addEventListener('pointermove', (e) => {
    if (!ringDrag) return;
    const dx = e.clientX - ringDrag.x;
    ringDrag.moved = Math.max(ringDrag.moved, Math.abs(dx));
    if (ringDrag.moved > 6 && !bridalArc.hasPointerCapture?.(e.pointerId)) bridalArc.setPointerCapture?.(e.pointerId);
    const now = performance.now();
    ringDrag.v = ((e.clientX - ringDrag.lastX) * 0.16) / Math.max(1, (now - ringDrag.lastT) / 16.67);
    ringDrag.lastX = e.clientX;
    ringDrag.lastT = now;
    ringAngle = ringDrag.angle + dx * 0.16;
    if (!ringRaf) layoutBridal();
  }, { passive: true });
  const endDrag = (e) => {
    if (!ringDrag) return;
    const d = ringDrag;
    ringDrag = null;
    if (d.moved <= 6) {
      const card = e.target.closest && e.target.closest('.arc-card');
      if (card) ringTo(Number(card.dataset.j));
      return;
    }
    ringVel = reduceMotion ? 0 : d.v;
    ringHold = performance.now() + 2200;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  layoutBridal();

  /* ---------- Visit form ---------- */
  $('#visitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const city = $('#visitCity').value.trim();
    $('#visitNote').textContent = city
      ? `Showroom search for "${city}" will connect to the store locator. (Sample)`
      : 'Please enter a city.';
  });

  /* ---------- Keyboard: close dialogs, arrow through the detail ---------- */
  document.addEventListener('keydown', (e) => {
    if (!detail.hidden) {
      if (e.key === 'Escape') closeDetail();
      if (e.key === 'ArrowLeft') stepDetail(-1);
      if (e.key === 'ArrowRight') stepDetail(1);
    } else if (!viewer.hidden && e.key === 'Escape') {
      closeReel();
    }
  });

  /* ---------- Reveal on scroll: fades, word-by-word headings, arch masks.
     Started once the loader lifts, so the hero's entrance is seen. ---------- */
  const reveals = $$('[data-reveal], [data-anim], [data-mask]');
  function startReveals() {
    if (!('IntersectionObserver' in window) || reduceMotion) {
      reveals.forEach((el) => el.classList.add('is-in'));
      return;
    }
    // A fully clipped element never counts as visible, so masked images are watched through their parent.
    const targets = new Map();
    reveals.forEach((el) => {
      const watch = el.hasAttribute('data-mask') ? el.parentElement : el;
      if (!targets.has(watch)) targets.set(watch, []);
      targets.get(watch).push(el);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          targets.get(entry.target).forEach((el) => el.classList.add('is-in'));
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((_, watch) => io.observe(watch));
  }

  /* ---------- Initial layout ---------- */
  function layoutAll() {
    positionLooks();
    layoutFan();
    layoutReels();
    layoutBridal();
  }
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = null; layoutAll(); });
  });
  renderLook();
  layoutBridal(); // the ring starts with the first piece in front
  layoutAll();
  updateVaultBar();
  onScroll();
})();
