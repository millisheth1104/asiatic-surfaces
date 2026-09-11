/* =========================================================
   FULL SHEET VIEW — Dynamic Category Masonry Gallery
   Connects to Real-Time Product Catalog (IndexedDB + Cloud)
   Column masonry, reveal-on-scroll, and sheet lightbox.
   ========================================================= */
(async function () {
  'use strict';

  var grid = document.getElementById('masonry');
  if (!grid) return;

  var CATEGORY_MAP = {
    '45-degree': '45 Degree',
    '45degree': '45 Degree',
    'wooden': 'Wooden',
    'digital': 'Digital',
    'laminates': 'Laminates',
    'stone': 'Stone',
    'louvers': 'Louvers',
    'edge-bands': 'Edge Bands',
    'edgebands': 'Edge Bands',
    'texture': 'Texture'
  };

  // 1. Detect Category from DOM attribute, URL query, or Path
  function detectCategory() {
    var fromAttr = document.body.getAttribute('data-category') ||
                   (document.querySelector('.gpage') && document.querySelector('.gpage').getAttribute('data-category'));
    if (fromAttr) return fromAttr;

    var params = new URLSearchParams(window.location.search);
    var qCat = params.get('type') || params.get('cat') || params.get('category');
    if (qCat) return qCat;

    var path = window.location.pathname.toLowerCase();
    for (var key in CATEGORY_MAP) {
      if (path.indexOf(key) !== -1) {
        return CATEGORY_MAP[key];
      }
    }
    return '45 Degree';
  }

  var activeCategory = detectCategory();

  // (The top-nav category pill row was removed; nothing to highlight.)

  // Fallback textures if a product has no image
  var CAT_TEXTURE_MAP = {
    '45 degree': 'assets/textures/fabric.webp',
    'wooden': 'assets/textures/wooden.webp',
    'digital': 'assets/textures/charcoal.webp',
    'laminates': 'assets/textures/laminates.webp',
    'stone': 'assets/textures/thermolam.webp',
    'louvers': 'assets/textures/louvers.webp',
    'edge bands': 'assets/textures/edgebands.webp',
    'texture': 'assets/textures/texture.webp'
  };

  var cards = [];
  var hits = [];
  var index = -1;
  var lastFocus = null;

  var CAP_UNITS = 0.11; // caption + gap fraction

  function columnCount() {
    var w = window.innerWidth;
    if (w >= 1500) return 5;
    if (w >= 1120) return 4;
    if (w >= 820) return 3;
    return 2;
  }

  var dealt = 0;
  function deal() {
    if (cards.length === 0) return;
    var n = columnCount();
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
      for (j = 1; j < n; j++) {
        if (heights[j] < heights[shortest] - 1e-6) shortest = j;
      }
      cols[shortest].appendChild(cards[i]);
      var ar = parseFloat(cards[i].style.getPropertyValue('--ar')) || 0.67;
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

  window.addEventListener('resize', relayout, { passive: true });
  window.addEventListener('orientationchange', relayout, { passive: true });

  // Lightbox References
  var lb = document.getElementById('lb');
  var lbImg = lb ? lb.querySelector('.lb__stage img') : null;
  var lbCode = lb ? lb.querySelector('.lb__code') : null;
  var lbCount = lb ? lb.querySelector('.lb__count') : null;
  var btnPrev = lb ? lb.querySelector('.lb__nav--prev') : null;
  var btnNext = lb ? lb.querySelector('.lb__nav--next') : null;
  var btnX = lb ? lb.querySelector('.lb__x') : null;

  function showLightbox(i) {
    if (!lb || hits.length === 0) return;
    if (i < 0) i = hits.length - 1;
    if (i >= hits.length) i = 0;
    index = i;
    var hit = hits[i];
    var code = hit.getAttribute('data-code') || '';
    var name = hit.getAttribute('data-name') || '';
    var tourUrl = hit.getAttribute('data-tour') || '';

    lbImg.classList.remove('is-ready');
    lbImg.alt = code + (name ? ' - ' + name : '');
    lbImg.src = hit.getAttribute('data-full');

    lbCode.innerHTML = '';
    var bold = document.createElement('b');
    bold.textContent = code;
    lbCode.appendChild(bold);

    if (name) {
      var em = document.createElement('span');
      em.style.marginLeft = '8px';
      em.style.opacity = '0.7';
      em.textContent = name;
      lbCode.appendChild(em);
    }

    // Add 360 tour button if available
    var existingTourBtn = lb.querySelector('.lb__tour-btn');
    if (existingTourBtn) existingTourBtn.remove();

    if (tourUrl) {
      var tourBtn = document.createElement('a');
      tourBtn.className = 'lb__tour-btn';
      tourBtn.href = tourUrl;
      tourBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        <span>360° Virtual Tour</span>
      `;
      lbCode.appendChild(tourBtn);
    }

    if (lbCount) lbCount.textContent = (i + 1) + ' / ' + hits.length;

    // Preload neighbours
    [i - 1, i + 1].forEach(function (n) {
      var h = hits[(n + hits.length) % hits.length];
      if (h) new Image().src = h.getAttribute('data-full');
    });
  }

  if (lbImg) {
    lbImg.addEventListener('load', function () { lbImg.classList.add('is-ready'); });
  }

  function openLightbox(i) {
    if (!lb) return;
    lastFocus = document.activeElement;
    document.body.classList.add('lb-open');
    lb.classList.add('is-open');
    lb.removeAttribute('aria-hidden');
    showLightbox(i);
    if (btnX) btnX.focus();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
    setTimeout(function () {
      if (!lb.classList.contains('is-open') && lbImg) lbImg.removeAttribute('src');
    }, 400);
    var back = hits[index] || lastFocus;
    if (back && back.focus) back.focus();
  }

  if (btnX) btnX.addEventListener('click', closeLightbox);
  if (btnPrev) btnPrev.addEventListener('click', function () { showLightbox(index - 1); });
  if (btnNext) btnNext.addEventListener('click', function () { showLightbox(index + 1); });
  if (lb) {
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb__stage')) closeLightbox();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!lb || !lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showLightbox(index - 1);
    else if (e.key === 'ArrowRight') showLightbox(index + 1);
  });

  // Render Category Products dynamically from Shared ProductCatalog
  async function renderGallery() {
    var allProducts = [];
    if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
      allProducts = window.ProductCatalog.getProducts();
    } else {
      try {
        var raw = localStorage.getItem('realtime_360_product_catalog_v2');
        if (raw) allProducts = JSON.parse(raw);
      } catch (e) {}
    }

    var cleanActive = activeCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
    var filtered = allProducts.filter(function (p) {
      var pCat = (p.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pCat === cleanActive;
    });

    grid.innerHTML = '';
    cards = [];
    hits = [];

    if (filtered.length === 0) {
      grid.classList.remove('is-cols');
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="gallery-empty__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <h2 class="gallery-empty__title">No products in ${activeCategory} yet</h2>
          <p class="gallery-empty__sub">New additions to the ${activeCategory} collection will appear here in full sheet view.</p>
        </div>
      `;
      return;
    }

    // Resolve images and build figures
    var fallback = CAT_TEXTURE_MAP[activeCategory.toLowerCase()] || 'assets/textures/laminates.webp';

    for (var i = 0; i < filtered.length; i++) {
      var prod = filtered[i];
      var imgUrl = fallback;

      if (prod.fullsheetUrl) {
        if (prod.fullsheetUrl.startsWith('db:')) {
          var dbKey = prod.fullsheetUrl.replace('db:', '');
          if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
            var stored = await window.ProductCatalog.getAsset(dbKey);
            if (stored) imgUrl = stored;
          }
        } else {
          imgUrl = prod.fullsheetUrl;
        }
      } else if (prod.threeDDataUrl && !prod.threeDDataUrl.startsWith('db:')) {
        imgUrl = prod.threeDDataUrl;
      }

      var cleanCat = (prod.category || activeCategory || 'laminates')
        .toLowerCase().trim().replace(/\s+/g, '-');
      var cleanCode = (prod.code || prod.slug || prod.id || 'product')
        .toLowerCase().trim().replace(/#/g, '').replace(/\s+/g, '-');
      var tourUrl = (prod.threeD && prod.threeDDataUrl) ? `/${cleanCat}/${cleanCode}` : null;

      var figure = document.createElement('figure');
      figure.className = 'sheet is-in';
      figure.style.setProperty('--ar', '0.65');
      figure.setAttribute('data-id', prod.id);

      figure.innerHTML = `
        <button class="sheet__hit" type="button" data-full="${imgUrl}" data-code="${prod.code}" data-name="${prod.name || ''}" data-tour="${tourUrl || ''}" aria-label="View ${prod.code} at full size">
          <img src="${imgUrl}" alt="${prod.code} — ${prod.name || activeCategory}" loading="lazy" decoding="async">
          <span class="sheet__zoom" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.4" stroke="currentColor" stroke-width="1.5"/><path d="M9 6.8v4.4M6.8 9h4.4M13 13l3.4 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </span>
        </button>
        <figcaption class="sheet__cap">
          <b>${prod.code}</b>
          ${prod.name ? `<span>${prod.name}</span>` : ''}
          ${tourUrl ? `<a href="${tourUrl}" class="sheet__tour-link" title="Open 360° Virtual Tour">360° Tour ↗</a>` : ''}
        </figcaption>
      `;

      var hitBtn = figure.querySelector('.sheet__hit');
      (function (hitIndex) {
        hitBtn.addEventListener('click', function () {
          openLightbox(hitIndex);
        });
      })(i);

      cards.push(figure);
      hits.push(hitBtn);
    }

    deal();
  }

  // Initial Load
  await renderGallery();

  // Listen for catalog changes (e.g. cross-tab save or sync)
  window.addEventListener('catalogUpdated', function () {
    renderGallery();
  });

  // Background Cloud Sync Trigger
  if (window.ProductCatalog && typeof window.ProductCatalog.syncFromCloud === 'function') {
    window.ProductCatalog.syncFromCloud().then(function () {
      renderGallery();
    });
  }

  /* ---------- Scroll Progress ---------- */
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
