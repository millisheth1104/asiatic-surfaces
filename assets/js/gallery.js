/* =========================================================
   ASIATIC SURFACES — category page
   Masonry row spans, reveal-on-scroll, and the sheet lightbox.
   No dependencies: the gallery must render even if a CDN is down.
   ========================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var grid = document.getElementById('masonry');
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.sheet'));

  /* ---------- masonry -----------------------------------------------------
     Each card's height is intrinsic (aspect-ratio box + caption), so it can
     be measured before the images load. We convert that height into a span
     of the 4px auto-row. `align-items:start` is what keeps the measurement
     honest — without it the card stretches to the row and every span grows. */
  var ROW = 4;
  grid.classList.add('is-masonry');

  function layout() {
    var cs = getComputedStyle(grid);
    var gap = parseFloat(cs.rowGap) || 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      c.style.gridRowEnd = 'auto';
    }
    for (var j = 0; j < cards.length; j++) {
      var card = cards[j];
      var h = card.getBoundingClientRect().height;
      card.style.gridRowEnd = 'span ' + Math.ceil((h + gap) / (ROW + gap));
    }
  }

  var raf = 0;
  function relayout() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(layout);
  }

  layout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  // A tall image that fails to decode collapses its box; re-measure on load.
  grid.addEventListener('load', relayout, true);
  grid.addEventListener('error', relayout, true);

  /* ---------- reveal ---------------------------------------------------- */
  if (reduced || !('IntersectionObserver' in window)) {
    cards.forEach(function (c) { c.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    cards.forEach(function (c, i) {
      c.style.setProperty('--i', String(i % 6));
      io.observe(c);
    });
  }

  /* ---------- lightbox --------------------------------------------------- */
  var lb = document.getElementById('lb');
  if (!lb) return;

  var lbImg = lb.querySelector('.lb__stage img');
  var lbCode = lb.querySelector('.lb__code');
  var lbCount = lb.querySelector('.lb__count');
  var btnPrev = lb.querySelector('.lb__nav--prev');
  var btnNext = lb.querySelector('.lb__nav--next');
  var btnX = lb.querySelector('.lb__x');

  var hits = [].slice.call(grid.querySelectorAll('.sheet__hit'));
  var index = -1;
  var lastFocus = null;

  function show(i) {
    if (i < 0) i = hits.length - 1;
    if (i >= hits.length) i = 0;
    index = i;
    var hit = hits[i];
    var code = hit.getAttribute('data-code') || '';
    var name = hit.getAttribute('data-name') || '';

    lbImg.classList.remove('is-ready');
    lbImg.alt = hit.getAttribute('data-alt') || code;
    lbImg.src = hit.getAttribute('data-full');
    lbCode.innerHTML = '';
    lbCode.appendChild(document.createTextNode(code));
    if (name) {
      var em = document.createElement('em');
      em.textContent = name;
      lbCode.appendChild(em);
    }
    lbCount.textContent = (i + 1) + ' / ' + hits.length;

    // Warm the neighbours so arrowing through is instant.
    [i - 1, i + 1].forEach(function (n) {
      var h = hits[(n + hits.length) % hits.length];
      if (h) new Image().src = h.getAttribute('data-full');
    });
  }

  lbImg.addEventListener('load', function () { lbImg.classList.add('is-ready'); });

  function open(i) {
    lastFocus = document.activeElement;
    document.body.classList.add('lb-open');
    lb.classList.add('is-open');
    lb.removeAttribute('aria-hidden');
    show(i);
    // `visibility` only flips once the transition starts, so a synchronous
    // focus() lands on nothing. One frame later the dialog is focusable.
    requestAnimationFrame(function () { btnX.focus(); });
  }

  function close() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
    // Drop the source so a 1 MB sheet is not held in memory behind the page.
    setTimeout(function () { if (!lb.classList.contains('is-open')) lbImg.removeAttribute('src'); }, 400);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  hits.forEach(function (hit, i) {
    hit.addEventListener('click', function () { open(i); });
  });

  btnX.addEventListener('click', close);
  btnPrev.addEventListener('click', function () { show(index - 1); });
  btnNext.addEventListener('click', function () { show(index + 1); });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lb__stage')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { show(index - 1); }
    else if (e.key === 'ArrowRight') { show(index + 1); }
    else if (e.key === 'Tab') {
      // Three controls only, so a manual cycle is cheaper than a focus trap.
      var f = [btnX, btnPrev, btnNext];
      var at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  /* ---------- scroll progress (same bar as the home page) ---------------- */
  var bar = document.getElementById('scrollBar');
  if (bar) {
    var tick = 0;
    window.addEventListener('scroll', function () {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      });
    }, { passive: true });
  }

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
