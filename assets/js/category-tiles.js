/* =========================================================
   Custom category tiles on the home page.

   The eight original collections are written into index.html. Categories added
   through the admin are appended to the same grid at runtime, using the same
   markup and classes, so they inherit the masonry layout, the reveal animation
   and the hover behaviour rather than approximating them.
   ========================================================= */
(function () {
  'use strict';

  var grid = document.getElementById('bento');
  if (!grid) return;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function render(categories) {
    grid.querySelectorAll('.tile--custom').forEach(function (t) { t.remove(); });
    if (!categories || categories.length === 0) return;

    // Continue the numbering from the tiles already on the page.
    var existing = grid.querySelectorAll('.tile').length;

    categories.forEach(function (cat, i) {
      var a = document.createElement('a');
      // tile--charcoal gives the dark treatment the no-image case needs, and is what
      // the stylesheet already uses for light text on a dark tile.
      a.className = 'tile tile--custom' + (cat.thumbnailUrl ? '' : ' tile--charcoal tile--noimage');
      a.href = 'collection.html?cat=' + encodeURIComponent(cat.slug);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('data-reveal-tile', '');
      a.style.setProperty('--i', String(existing + i));
      a.style.textDecoration = 'none';

      var media = cat.thumbnailUrl
        ? '<div class="tile__media"><img src="' + esc(cat.thumbnailUrl) + '" alt="' + esc(cat.name) + '" loading="lazy"></div>'
        // No thumbnail: a plain black panel, so the tile still reads as a tile in the
        // grid instead of collapsing to text on the page background.
        : '<div class="tile__media tile__media--empty" aria-hidden="true"></div>';

      a.innerHTML =
        media +
        '<div class="tile__body">' +
          '<span class="tile__num">' + pad(existing + i + 1) + '</span>' +
          '<h3 class="tile__name">' + esc(cat.name) + '</h3>' +
          (cat.blurb ? '<p class="tile__desc">' + esc(cat.blurb) + '</p>' : '') +
          '<span class="tile__go" aria-hidden="true">' +
            '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
        '</div>' +
        '<span class="tile__swatch" style="--sw:#6c7f64" aria-hidden="true"></span>';

      grid.appendChild(a);

      // The reveal observer has already run over the original tiles, so a tile added
      // afterwards would stay hidden without this.
      requestAnimationFrame(function () { a.classList.add('is-revealed', 'is-in'); });
    });
  }

  function load() {
    var PC = window.ProductCatalog;
    if (!PC) return;
    render(PC.getCustomCategories());
    if (typeof PC.syncCategoriesFromCloud === 'function') {
      PC.syncCategoriesFromCloud().then(render);
    }
  }

  window.addEventListener('categoriesUpdated', function (e) { render(e.detail); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
