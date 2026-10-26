/* =========================================================
   FULL SHEET VIEW — Dynamic Category Masonry Gallery
   Connects to Real-Time Product Catalog (IndexedDB + Cloud)
   Column masonry, reveal-on-scroll, and sheet lightbox.
   ========================================================= */
(async function () {
  'use strict';

  var grid = document.getElementById('masonry');
  if (!grid) return;

  // Product codes and names come from the admin form and the cloud catalogue,
  // and every card is built with innerHTML, so they are escaped on the way in.
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Filtering swaps the grid silently; a polite status line is the only way a
  // screen-reader user hears that the result count changed.
  var srStatus = document.createElement('p');
  srStatus.setAttribute('role', 'status');
  srStatus.setAttribute('aria-live', 'polite');
  srStatus.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;' +
    'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';
  grid.parentNode.insertBefore(srStatus, grid);

  var CATEGORY_MAP = {
    '45-degree': '45 Degree',
    '45degree': '45 Degree',
    'wooden': 'Synchro',
    'synchro': 'Synchro',
    'syncro': 'Synchro',
    'snycro': 'Synchro',
    'synvro': 'Synchro',
    'digital': 'Digital',
    'laminates': 'Laminates',
    'stone': 'Stone',
    'louvers': 'Louvers',
    'edge-bands': 'Edge Bands',
    'edgebands': 'Edge Bands',
    'texture': 'Texture'
  };

  // Wooden was renamed Synchro. Products saved before the rename still carry
  // category 'Wooden', so all spellings and aliases fold to the same page.
  var CATEGORY_ALIASES = {
    'wooden': 'synchro',
    'syncro': 'synchro',
    'snycro': 'synchro',
    'synvro': 'synchro',
    'synchro': 'synchro'
  };

  function canonCategory(v) {
    var k = (v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return CATEGORY_ALIASES[k] || k;
  }

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

  // Highlight active category in top navigation
  var navLinks = document.querySelectorAll('.gnav__cats a');
  var activeNorm = canonCategory(activeCategory);
  navLinks.forEach(function (link) {
    var href = (link.getAttribute('href') || '').toLowerCase();
    var isMatch = href.includes(activeNorm);
    if (!isMatch && activeNorm === 'synchro' && (href.includes('wooden') || href.includes('synchro'))) {
      isMatch = true;
    }
    if (isMatch) {
      link.classList.add('is-current');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('is-current');
      link.removeAttribute('aria-current');
    }
  });

  // Fallback textures if a product has no image
  var CAT_TEXTURE_MAP = {
    '45 degree': 'assets/textures/fabric.webp',
    'synchro': 'assets/textures/wooden.webp',
    'wooden': 'assets/textures/wooden.webp',
    'digital': 'assets/textures/charcoal.webp',
    'laminates': 'assets/textures/laminates.webp',
    'stone': 'assets/textures/thermolam.webp',
    'louvers': 'assets/textures/louvers.webp',
    'edge bands': 'assets/textures/edgebands.webp',
    'texture': 'assets/textures/texture.webp'
  };

  var cards = [];          // the cards currently dealt into the columns
  var hits = [];           // their buttons, in the same order
  var allCards = [];       // every card built for this category
  var allHits = [];
  var index = -1;          // position in lbList(), not in hits
  var lastFocus = null;

  // Only full-sheet-only cards (no 360 tour) open the lightbox, so prev/next and the
  // "n / N" count step through those alone. Read live: search changes `hits`.
  function lbList() {
    return hits.filter(function (h) { return h.getAttribute('data-lb') === '1'; });
  }
  // renderGallery() is async and yields on the IndexedDB read, while three
  // unsynchronised callers can start it (initial, 'catalogUpdated', and the
  // syncFromCloud tail). Without this, a superseded run resumes and pushes its
  // remaining cards into the newer run's arrays: duplicated tiles, a dropped
  // one, and a wrong "n / N" count in the lightbox.
  var renderToken = 0;

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
    var list = lbList();
    if (!lb || list.length === 0) return;
    if (i < 0) i = list.length - 1;
    if (i >= list.length) i = 0;
    index = i;
    var hit = list[i];
    var code = hit.getAttribute('data-code') || '';
    var name = hit.getAttribute('data-name') || '';
    var tourUrl = hit.getAttribute('data-tour') || '';
    var hasFull = hit.getAttribute('data-has-full') === '1';
    var fullUrl = hit.getAttribute('data-full') || '';

    var lbStage = lb.querySelector('.lb__stage');
    if (lbStage) lbStage.scrollTop = 0;   // a tall sheet scrolls; each new one starts at its top
    var existingNa = lbStage ? lbStage.querySelector('.lb__na') : null;
    if (existingNa) existingNa.remove();

    if (hasFull && fullUrl) {
      if (lbImg) {
        lbImg.style.display = '';
        lbImg.classList.remove('is-ready');
        lbImg.alt = code + (name ? ' - ' + name : '');
        lbImg.src = fullUrl;
      }
    } else {
      if (lbImg) {
        lbImg.style.display = 'none';
        lbImg.removeAttribute('src');
      }
      if (lbStage) {
        var naBox = document.createElement('div');
        naBox.className = 'lb__na';
        naBox.innerHTML = `
          <div class="lb__na-box">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            <span class="lb__na-badge">N/A</span>
            <h3 class="lb__na-title">No Fullsheet Available</h3>
            <p class="lb__na-sub">No full sheet image has been uploaded for this product.</p>
            ${tourUrl ? `<a class="lb__na-tour" href="${esc(tourUrl)}" target="_blank" rel="noopener">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              <span>Open 360° Tour</span>
            </a>` : ''}
          </div>
        `;
        lbStage.appendChild(naBox);
      }
    }

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
      tourBtn.target = '_blank';
      tourBtn.rel = 'noopener';
      tourBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        <span>360° Virtual Tour</span>
      `;
      lbCode.appendChild(tourBtn);
    }

    if (lbCount) lbCount.textContent = (i + 1) + ' / ' + list.length;

    // Preload neighbours
    [i - 1, i + 1].forEach(function (n) {
      var h = list[(n + list.length) % list.length];
      if (h && h.getAttribute('data-has-full') === '1') {
        var u = h.getAttribute('data-full');
        if (u) new Image().src = u;
      }
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
      if (!lb.classList.contains('is-open')) {
        if (lbImg) {
          lbImg.removeAttribute('src');
          lbImg.style.display = '';
        }
        var existingNa = lb.querySelector('.lb__na');
        if (existingNa) existingNa.remove();
      }
    }, 400);
    var back = lbList()[index] || lastFocus;
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
    var token = ++renderToken;
    var allProducts = [];
    if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
      allProducts = window.ProductCatalog.getProducts();
    } else {
      try {
        var raw = localStorage.getItem('realtime_360_product_catalog_v2');
        if (raw) allProducts = JSON.parse(raw);
      } catch (e) {}
    }

    var cleanActive = canonCategory(activeCategory);
    var filtered = allProducts.filter(function (p) {
      return canonCategory(p.category) === cleanActive;
    });

    // Every product added to a category appears on that category's page, whether or
    // not it has an image yet - one without falls back to the category texture. A
    // category with no products shows the empty state below; the site's imagery comes
    // from the admin now, so there are no shipped sheets to stand in.
    // A catalogue sync can land while the lightbox is open. Remember which
    // sheet that is, so it can be re-pointed at the rebuilt card rather than
    // left showing a stale image with a stale "n / N".
    var openHit = lbList()[index];
    var openCode = (lb && lb.classList.contains('is-open') && openHit)
      ? openHit.getAttribute('data-code') : null;

    grid.innerHTML = '';
    cards = [];
    hits = [];
    // Also clear the full set: the early return below skips the rebuild, and a
    // search run afterwards would otherwise filter over the previous render's
    // cards and deal detached nodes back into the grid.
    allCards = [];
    allHits = [];

    if (filtered.length === 0) {
      showCategoryEmpty();
      return;
    }

    for (var i = 0; i < filtered.length; i++) {
      var prod = filtered[i];
      var imgUrl = null;
      var hasFullsheet = false;

      if (prod.fullsheetUrl) {
        if (prod.fullsheetUrl.startsWith('db:')) {
          var dbKey = prod.fullsheetUrl.replace('db:', '');
          if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
            var stored = await window.ProductCatalog.getAsset(dbKey);
            if (token !== renderToken) return;   // a newer render superseded this one
            if (stored) {
              imgUrl = stored;
              hasFullsheet = true;
            }
          }
        } else {
          imgUrl = prod.fullsheetUrl;
          hasFullsheet = true;
        }
      }

      // Shared builder: built-ins get /<cat>/<code>, admin-created categories /c/<slug>/<code>,
      // decided without waiting for the category list to load.
      var tourUrl = (prod.threeD && prod.threeDDataUrl)
        ? window.ProductCatalog.tourUrl({ category: prod.category || activeCategory, code: prod.code, slug: prod.slug, id: prod.id })
        : null;

      var figure = document.createElement('figure');
      figure.className = 'sheet is-in';
      figure.style.setProperty('--ar', '0.65');
      figure.setAttribute('data-id', prod.id);

      // One hover affordance per card. The <a> is a SIBLING of the button --
      // an anchor inside a button is invalid -- and the frame positions both.
      figure.innerHTML = `
        <div class="sheet__frame${tourUrl ? ' sheet__frame--tour' : ''}">
          <button class="sheet__hit" type="button" data-has-full="${hasFullsheet ? '1' : '0'}" data-full="${esc(imgUrl || '')}" data-code="${esc(prod.code)}" data-name="${esc(prod.name || '')}" data-tour="${esc(tourUrl || '')}" aria-label="View ${esc(prod.code)} at full size">
            ${hasFullsheet ? `
              <img src="${esc(imgUrl)}" alt="${esc(prod.code)} — ${esc(prod.name || activeCategory)}" loading="lazy" decoding="async">
            ` : `
              <div class="sheet__na">
                <div class="sheet__na-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </div>
                <span class="sheet__na-badge">N/A</span>
                <span class="sheet__na-text">No Fullsheet</span>
              </div>
            `}
          </button>
          ${tourUrl ? `<a class="sheet__360" href="${esc(tourUrl)}" target="_blank" rel="noopener" aria-label="View in 360° — ${esc(prod.code)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><polyline points="20.6 4.2 20.6 9.1 15.7 9.1"/></svg>
            <span>View in 360°</span>
          </a>` : ''}
        </div>
        <figcaption class="sheet__cap">
          <b>${esc(prod.code)}</b>
          ${prod.name ? `<span>${esc(prod.name)}</span>` : ''}
        </figcaption>
      `;

      figure.setAttribute(
        'data-search',
        ((prod.code || '') + ' ' + (prod.name || '')).toLowerCase()
      );

      var hitBtn = figure.querySelector('.sheet__hit');
      if (hasFullsheet && !tourUrl) {
        // No 360 tour to examine the sheet in, so the card itself opens the full sheet.
        hitBtn.setAttribute('data-lb', '1');
        hitBtn.setAttribute('aria-label', 'View ' + (prod.code || '') + ' full sheet');
        hitBtn.addEventListener('click', function () {
          var i = lbList().indexOf(this);
          if (i !== -1) openLightbox(i);
        });
      } else {
        // With a 360 tour, the card's own 360 link is the way in; without a sheet there
        // is nothing to enlarge. Stays a button so markup and styles are unchanged, but
        // does nothing and leaves the tab order.
        hitBtn.disabled = true;
        hitBtn.tabIndex = -1;
        hitBtn.style.cursor = 'default';
        hitBtn.removeAttribute('aria-label');
      }

      cards.push(figure);
      hits.push(hitBtn);
    }

    allCards = cards.slice();
    allHits = hits.slice();
    applyFilter(searchInput ? searchInput.value : '');
    reconcileLightbox(openCode);
  }

  function reconcileLightbox(code) {
    if (code === null || !lb || !lb.classList.contains('is-open')) return;
    var list = lbList();
    for (var k = 0; k < list.length; k++) {
      if (list[k].getAttribute('data-code') === code) { showLightbox(k); return; }
    }
    closeLightbox();   // that sheet is no longer in the catalogue
  }

  // Shared by the initial render and by clearing the search box on a category
  // that has nothing in it -- both need to end at the same message.
  function showCategoryEmpty() {
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
        <h2 class="gallery-empty__title">No products in ${esc(activeCategory)} yet</h2>
        <p class="gallery-empty__sub">New additions to the ${esc(activeCategory)} collection will appear here in full sheet view.</p>
      </div>
    `;
  }

  /* ---------- search: code or name, live ---------- */
  function applyFilter(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) {
      cards = allCards.slice();
      hits = allHits.slice();
    } else {
      cards = [];
      hits = [];
      for (var i = 0; i < allCards.length; i++) {
        if ((allCards[i].getAttribute('data-search') || '').indexOf(q) !== -1) {
          cards.push(allCards[i]);
          hits.push(allHits[i]);
        }
      }
    }

    if (cards.length === 0) {
      // Nothing to show and nothing searched for: the category is simply empty.
      // Reporting that as a failed search printed 'No sheet matches ""'.
      if (!q) { showCategoryEmpty(); srStatus.textContent = ''; return; }
      grid.classList.remove('is-cols');
      grid.innerHTML =
        '<div class="gallery-empty">' +
        '<div class="gallery-empty__icon">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4" stroke-linecap="round"/></svg>' +
        '</div>' +
        '<h2 class="gallery-empty__title"></h2>' +
        '<p class="gallery-empty__sub">Search by product code or name \u2014 try a shorter piece of it.</p>' +
        '</div>';
      // textContent, not innerHTML: the query is whatever the visitor typed.
      grid.querySelector('.gallery-empty__title').textContent =
        'No sheet matches \u201c' + q + '\u201d';
      srStatus.textContent = 'No sheets match ' + q;
      return;
    }

    srStatus.textContent = q
      ? cards.length + (cards.length === 1 ? ' sheet matches ' : ' sheets match ') + q
      : '';
    deal();
  }

  var searchInput = document.getElementById('sheetSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      applyFilter(searchInput.value);
    });
    searchInput.addEventListener('search', function () {
      applyFilter(searchInput.value);   // the native clear button fires this
    });
    if (searchInput.form) {
      searchInput.form.addEventListener('submit', function (e) { e.preventDefault(); });
    }
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

  /* ---------- Edited name / description for a built-in category ---------- */
  // The eight built-in pages have their heading written into the HTML. An edit made
  // in the admin is laid over it; the originals are kept so clearing the edit restores
  // them. activeCategory itself never changes - it is what products are filtered by.
  // collection.html sets its own heading for admin-created categories.
  var headTitle = document.querySelector('.ghead__title');
  var headSub = document.querySelector('.ghead__sub');
  var titleText = headTitle ? headTitle.firstChild : null;   // "Stone " before <span>sheets</span>
  var orig = {
    name: titleText && titleText.nodeType === 3 ? titleText.nodeValue : null,
    sub: headSub ? headSub.textContent : null,
    doc: document.title
  };
  function applyCategoryEdits() {
    var PC = window.ProductCatalog;
    var cat = PC && typeof PC.findCategory === 'function' ? PC.findCategory(activeCategory) : null;
    if (!cat || !cat.builtIn) return;
    if (orig.name !== null) titleText.nodeValue = cat.label ? cat.label + ' ' : orig.name;
    if (headSub && orig.sub !== null) headSub.textContent = cat.blurb || orig.sub;
    document.title = cat.label ? cat.label + ' — Full Sheet View' : orig.doc;
  }
  applyCategoryEdits();
  window.addEventListener('categoriesUpdated', applyCategoryEdits);
  if (window.ProductCatalog && typeof window.ProductCatalog.syncCategoriesFromCloud === 'function') {
    window.ProductCatalog.syncCategoriesFromCloud();   // fires categoriesUpdated
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
