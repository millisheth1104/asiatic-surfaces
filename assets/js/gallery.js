/* =========================================================
   FULL SHEET VIEW — category page
   Column masonry, reveal-on-scroll, and the sheet lightbox.
   No dependencies: the gallery must render even if a CDN is down.
   ========================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var grid = document.getElementById('masonry');
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.sheet'));

  /* ---------- masonry -----------------------------------------------------
     Cards are dealt into N equal columns, each one going to whichever column
     is shortest so far — the Pinterest cascade, and the only arrangement that
     cannot leave a hole. Heights are predicted from `--ar` rather than
     measured, so the deal is right before a single image has loaded and never
     reshuffles as they arrive.                                              */
  var CAP_UNITS = 0.11;   // caption + gap, as a fraction of the column width

  function columnCount() {
    var w = window.innerWidth;
    if (w >= 1500) return 5;
    if (w >= 1120) return 4;
    if (w >= 820) return 3;
    return 2;             // two on phones: one 1:2 sheet per row is enormous
  }

  var dealt = 0;
  function deal() {
    var n = columnCount();
    if (n === dealt) return;
    dealt = n;

    var cols = [], heights = [], i;
    for (i = 0; i < n; i++) {
      var col = document.createElement('div');
      col.className = 'masonry__col';
      cols.push(col);
      heights.push(0);
    }
    for (i = 0; i < cards.length; i++) {
      var shortest = 0, j;
      for (j = 1; j < n; j++) if (heights[j] < heights[shortest] - 1e-6) shortest = j;
      cols[shortest].appendChild(cards[i]);
      var ar = parseFloat(cards[i].style.getPropertyValue('--ar')) || 0.5;
      heights[shortest] += 1 / ar + CAP_UNITS;
    }
    grid.textContent = '';
    for (i = 0; i < n; i++) grid.appendChild(cols[i]);
    grid.classList.add('is-cols');
  }

  var raf = 0;
  function relayout() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(deal);
  }

  deal();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

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

  // Source order, not the dealt order: arrowing through the lightbox should
  // walk the codes in sequence, not zig-zag down whichever column they landed in.
  var hits = cards.map(function (c) { return c.querySelector('.sheet__hit'); });
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
    // Synchronous, and it has to stay that way: `visibility` is transitioned
    // to 0s on open precisely so the dialog is focusable on this frame. A
    // rAF here would never fire in a throttled tab.
    btnX.focus();
  }

  function close() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
    // Drop the source so a 1 MB sheet is not held in memory behind the page.
    setTimeout(function () { if (!lb.classList.contains('is-open')) lbImg.removeAttribute('src'); }, 400);
    // Back to the sheet actually being viewed, which after arrowing through is
    // not the one that opened the lightbox.
    var back = hits[index] || lastFocus;
    if (back && back.focus) back.focus();
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
