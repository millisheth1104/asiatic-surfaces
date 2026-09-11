/* =========================================================
   ASIATIC SURFACES — interactions

   1. hero headline fitted to the sheet width, on one line
   2. the eight-family plate: a snap-scrolling strip with arrows
   3. motion: GSAP + ScrollTrigger when available, CSS/IO fallback if not

   GSAP owns every entrance and scroll-linked move when it loads (the
   `gsap-on` class stands the CSS start states down). If the CDN is
   unreachable, or GSAP's ticker never advances, the CSS/IntersectionObserver
   path runs instead — the page is never left with hidden content.
   ========================================================= */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = window.requestAnimationFrame.bind(window);

  var G  = window.gsap;
  var ST = window.ScrollTrigger;
  var USE_G = !!(G && ST) && !REDUCED;   // reassigned by the watchdog below

  if (USE_G) {
    G.registerPlugin(ST);
    document.documentElement.classList.add('gsap-on');
    G.defaults({ ease: 'power3.out' });
  }

  var title = document.querySelector('.hero__title');
  var strip = document.getElementById('shelfStrip');

  /* ---------------------------------------------------------
     1 — FIT THE HEADLINE TO THE SHEET WIDTH, ONE LINE
     JS measures and passes the size in as --fit; CSS keeps the
     fallback and the mobile scale, so a stale value can't win.
     --------------------------------------------------------- */
  var FIT_MIN = 30;      // px — below this we let it wrap instead
  var FIT_MAX = 78;      // px — ceiling; a 3-word headline would otherwise balloon
  var FILL    = 0.74;    // share of the sheet width the headline spans
  var PROBE   = 100;

  function fitTitle() {
    if (!title) return;
    title.style.removeProperty('--fit');
    title.style.fontSize = '';
    if (window.innerWidth <= 900) return;          // CSS owns the mobile scale

    var line = title.querySelector('.line');
    var avail = title.parentElement.getBoundingClientRect().width;
    if (!avail || !line) return;

    title.style.fontSize = PROBE + 'px';
    var textW = line.scrollWidth;
    title.style.fontSize = '';
    if (!textW) return;

    var size = (avail / textW) * PROBE * FILL;
    if (size > FIT_MAX) size = FIT_MAX;
    if (size < FIT_MIN) return;                    // too cramped — let it wrap
    title.style.setProperty('--fit', size.toFixed(2) + 'px');
  }

  fitTitle();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fitTitle();
      if (USE_G) ST.refresh();
    });
  }
  var mqOneLine = window.matchMedia('(min-width: 901px)');
  if (mqOneLine.addEventListener) mqOneLine.addEventListener('change', fitTitle);

  /* ---------------------------------------------------------
     2 — THE EIGHT-FAMILY STRIP
     --------------------------------------------------------- */
  if (strip) {
    var navBtns = [].slice.call(document.querySelectorAll('[data-strip]'));
    var firstChip = strip.querySelector('.chip');

    var syncNav = function () {
      var atStart = strip.scrollLeft <= 2;
      var atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
      navBtns.forEach(function (b) {
        var isPrev = b.dataset.strip === 'prev';
        if ((isPrev && atStart) || (!isPrev && atEnd)) b.setAttribute('disabled', '');
        else b.removeAttribute('disabled');
      });
    };

    navBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var step = (firstChip ? firstChip.offsetWidth + 12 : 180) * 2;
        strip.scrollBy({ left: b.dataset.strip === 'next' ? step : -step, behavior: 'smooth' });
      });
    });

    strip.addEventListener('scroll', function () { raf(syncNav); }, { passive: true });
    window.addEventListener('resize', function () { raf(syncNav); });
    syncNav();
  }

  /* ---------------------------------------------------------
     2b — MARQUEE: clone the group until it cannot run out
     The -50% loop is only seamless when half the track is at least as wide as
     the viewport. One group is narrower than that on a wide screen, so clone.
     --------------------------------------------------------- */
  var mqEl = document.querySelector('.marquee');
  var mqTrack = document.getElementById('marqueeTrack');

  function buildMarquee() {
    if (!mqEl || !mqTrack) return;
    var groups = [].slice.call(mqTrack.querySelectorAll('.marquee__group'));
    for (var i = 1; i < groups.length; i++) groups[i].remove();
    var seed = groups[0];
    if (!seed) return;

    var groupW = seed.getBoundingClientRect().width;
    var frameW = mqEl.clientWidth;
    if (!groupW || !frameW) return;

    var half = Math.max(1, Math.ceil(frameW / groupW));   // groups per half-cycle
    for (var k = 1; k < half * 2; k++) {
      var clone = seed.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      mqTrack.appendChild(clone);
    }
    /* keep the speed constant however many groups it took */
    mqTrack.style.animationDuration = ((half * groupW) / 55).toFixed(1) + 's';
  }

  buildMarquee();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildMarquee);

  /* ---------------------------------------------------------
     3a — MOTION: GSAP path
     --------------------------------------------------------- */
  if (USE_G) {
    var heroTl = G.timeline({ delay: .15 });
    heroTl.from('.hero__eyebrow', { y: 14, opacity: 0, duration: .7 }, 0)
          .from('.hero__rule', { scaleX: 0, transformOrigin: 'left center', duration: .9 }, .08)
          .from('.hero__title .word', {
            yPercent: 112, rotate: 2, opacity: 0,
            duration: 1.05, ease: 'power4.out', stagger: .055
          }, .12)
          .from('.hero__sub', { y: 18, opacity: 0, duration: .9 }, .46)
          .from('.hero__cta', { y: 20, opacity: 0, duration: .9 }, .58)
          .from('.shelf', { yPercent: 100, opacity: 0, duration: 1.25, ease: 'power4.out' }, .3);

    /* section headings — word by word */
    G.utils.toArray('[data-reveal-title]').forEach(function (t) {
      G.from(t.querySelectorAll('.word'), {
        yPercent: 112, rotate: 2, opacity: 0,
        duration: 1.05, ease: 'power4.out', stagger: .07,
        scrollTrigger: { trigger: t, start: 'top 86%', once: true }
      });
    });

    /* generic blocks */
    G.utils.toArray('[data-reveal]').forEach(function (el) {
      var delay = (parseInt(el.dataset.delay, 10) || 1) - 1;
      G.from(el, {
        y: 28, opacity: 0, filter: 'blur(6px)',
        duration: 1, delay: delay * .09,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    /* bento tiles + their swatch chips.
       A ScrollTrigger config object is consumed by the instance that gets it,
       so each tween needs its own literal — sharing one breaks the second. */
    G.utils.toArray('.tile').forEach(function (tile) {
      G.from(tile, {
        y: 52, scale: .975, opacity: 0, duration: 1.05,
        scrollTrigger: { trigger: tile, start: 'top 94%', once: true }
      });
      var sw = tile.querySelector('.tile__swatch');
      if (sw) G.from(sw, {
        scale: 0, rotate: -30, duration: .8, ease: 'back.out(2.2)', delay: .12,
        scrollTrigger: { trigger: tile, start: 'top 94%', once: true }
      });
    });

    /* scrubbed parallax — ScrollTrigger batches these, so there is no
       per-frame getBoundingClientRect on every tile (that was the jank) */
    G.utils.toArray('.tile__media').forEach(function (m) {
      G.fromTo(m, { yPercent: -3.5 }, {
        yPercent: 3.5, ease: 'none',
        scrollTrigger: { trigger: m.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* hero copy drifts up and out as the hero leaves */
    G.to('.hero__inner', {
      y: 110, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    /* scroll progress */
    G.to('#scrollBar', {
      width: '100%', ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: .3 }
    });
  }

  /* ---------------------------------------------------------
     3b — MOTION: fallback (no GSAP, reduced motion, or a dead ticker)
     --------------------------------------------------------- */
  function startFallbackMotion() {
    var revealTargets = [].slice.call(
      document.querySelectorAll('[data-reveal],[data-reveal-title],[data-reveal-tile]')
    );
    if ('IntersectionObserver' in window && !REDUCED) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      revealTargets.forEach(function (el) { io.observe(el); });
    } else {
      revealTargets.forEach(function (el) { el.classList.add('is-in'); });
    }

    var bar    = document.getElementById('scrollBar');
    var heroIns = [].slice.call(document.querySelectorAll('.hero__inner'));
    var medias = [].slice.call(document.querySelectorAll('.tile__media'));
    var ticking = false;

    var onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var vh = window.innerHeight;
      var max = document.documentElement.scrollHeight - vh;
      if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0).toFixed(2) + '%';

      if (!REDUCED) {
        if (y < vh * 1.2) {
          var ty = 'translate3d(0,' + (y * 0.14).toFixed(1) + 'px,0)';
          var op = Math.max(0, 1 - (y / (vh * 0.8))).toFixed(3);
          for (var h2 = 0; h2 < heroIns.length; h2++) {
            heroIns[h2].style.transform = ty;
            heroIns[h2].style.opacity = op;
          }
        }
        for (var i = 0; i < medias.length; i++) {
          var r = medias[i].getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) continue;
          var mid = (r.top + r.height / 2 - vh / 2) / vh;
          medias[i].style.transform = 'translate3d(0,' + (mid * -18).toFixed(1) + 'px,0)';
        }
      }
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; raf(onScroll); }
    }, { passive: true });
    onScroll();
  }

  if (!USE_G) startFallbackMotion();

  /* ---------------------------------------------------------
     3c — WATCHDOG
     `gsap.from()` writes its start state immediately, so if GSAP's ticker
     never advances the tween never runs and the content stays invisible.
     If the ticker is dead while the tab is actually visible, revert GSAP and
     run the CSS/IO path instead. A merely backgrounded tab is not judged —
     rAF is throttled there by design, and it catches up on return.
     --------------------------------------------------------- */
  if (USE_G) {
    var tickerFrame0 = G.ticker.frame;

    var tearDownGsap = function () {
      try {
        ST.getAll().forEach(function (s) { s.kill(); });
        G.globalTimeline.clear();
        G.set([
          '[data-reveal]', '.tile', '.tile__swatch', '.tile__media',
          '[data-reveal-title] .word', '.hero__title .word',
          '.hero__eyebrow', '.hero__rule', '.hero__sub', '.hero__cta',
          '.shelf', '.hero__inner', '#scrollBar'
        ], { clearProps: 'all' });
      } catch (e) { /* fall through — the fallback still runs */ }

      document.documentElement.classList.remove('gsap-on');
      USE_G = false;
      startFallbackMotion();
    };

    var ensureTicking = function () {
      if (!USE_G || document.hidden) return;
      if (G.ticker.frame - tickerFrame0 > 2) return;      // healthy
      tearDownGsap();
    };

    setTimeout(ensureTicking, 1800);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && USE_G) {
        tickerFrame0 = G.ticker.frame;
        setTimeout(ensureTicking, 1200);
      }
    });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { fitTitle(); buildMarquee(); }, 120);
  });

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
