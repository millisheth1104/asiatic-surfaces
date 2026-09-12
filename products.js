/* ====================================================
   Product Catalog — Sarom-Inspired Real-Time Engine
   Renders both Table Grid (with borders) and Card View
   ==================================================== */

(function () {
    'use strict';

    /**
     * Escapes a value before it is interpolated into innerHTML.
     *
     * Product codes and names arrive from the catalogue API, which accepts writes from
     * anyone, so they are untrusted input. Rendered raw they execute in the admin's
     * browser the moment the table is drawn. gallery.js has carried this helper all
     * along; this file did not.
     */
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ---- Load Real Products from Shared Catalog Engine ----
    function getRealTimeProducts() {
        if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
            return window.ProductCatalog.getProducts();
        }
        return [];
    }

    function saveRealTimeProducts(updatedList) {
        if (window.ProductCatalog && typeof window.ProductCatalog.saveProducts === 'function') {
            window.ProductCatalog.saveProducts(updatedList);
        }
    }

    /**
     * The public 360 tour address for a product: /<category>/<code>.
     *
     * .htaccess rewrites that shape to tour.html and app.js resolves the product from the
     * path, so the link must be slugged the way both expect - lowercase, '#' dropped, any
     * run of non-alphanumerics collapsed to a single hyphen. Derived from the product's
     * current category and code rather than stored, so renaming either moves the link with
     * it and every product, old or new, gets a working address.
     */
    function tourUrlFor(product) {
        const slug = v => String(v || '')
            .toLowerCase().trim()
            .replace(/#/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const cat = slug(normalizeCategory(product.category) || 'laminates');
        const code = slug(product.code || product.slug || product.id || 'product');

        // Only the eight built-in names have a route of their own. A category created
        // through the admin is served under /c/<slug>/, so its products need that form
        // or the rewrite would not match and the tour would 404.
        const PC = window.ProductCatalog;
        const known = PC && typeof PC.findCategory === 'function' ? PC.findCategory(cat) : null;
        if (known && known.builtIn === false) return `/c/${known.slug}/${code}`;
        return `/${cat}/${code}`;
    }

    function normalizeCategory(cat) {
        if (!cat) return '';
        const c = cat.trim().toLowerCase();
        if (c === 'wooden' || c === 'syncro' || c === 'synchro') return 'Synchro';
        return cat;
    }

    // ---- State ----
    let products = getRealTimeProducts();
    let sortField = 'code';
    let sortOrder = 'asc';
    let activeViewMode = 'table'; // 'table' or 'cards'
    let currentFilter = {
        query: '',
        category: 'ALL',
        fullsheet: 'ALL',
        threeD: 'ALL'
    };

    // Fullsheet modal zoom/pan state
    let fsZoom = 1;
    let fsPanX = 0;
    let fsPanY = 0;
    let isDraggingFs = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // ---- DOM Elements ----
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const categorySelect = document.getElementById('category-select');
    const fullsheetSelect = document.getElementById('fullsheet-select');
    const threeDSelect = document.getElementById('3d-select');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const emptyResetBtn = document.getElementById('empty-reset-btn');

    // View Switcher Elements
    const tableViewContainer = document.getElementById('table-view-container');
    const cardsViewContainer = document.getElementById('cards-view-container');
    const tableBody = document.getElementById('products-table-body');
    const btnModeTable = document.getElementById('view-mode-table');
    const btnModeCards = document.getElementById('view-mode-cards');

    const emptyState = document.getElementById('empty-state');
    const resultsCountBadge = document.getElementById('results-count-badge');
    const quickPills = document.querySelectorAll('.quick-pill');

    // Stats
    const statTotal = document.getElementById('stat-total-products');
    const statFullsheet = document.getElementById('stat-fullsheet-count');
    const stat3D = document.getElementById('stat-3d-count');
    const statCategories = document.getElementById('stat-categories-count');

    // QR Modal
    const qrLaunch360Btn = document.getElementById('qr-launch-360-btn');

    // Fullsheet Modal
    const fsModal = document.getElementById('fullsheet-modal');
    const fsModalClose = document.getElementById('fs-modal-close');
    const fsModalTitle = document.getElementById('fs-modal-title');
    const fsModalImg = document.getElementById('fs-modal-img');
    const fsZoomTag = document.getElementById('fs-zoom-tag');
    const fsViewport = document.getElementById('fs-image-viewport');
    const fsBtnZoomIn = document.getElementById('fs-btn-zoom-in');
    const fsBtnZoomOut = document.getElementById('fs-btn-zoom-out');
    const fsBtnReset = document.getElementById('fs-btn-reset');

    // Add Product Modal
    const addProductModal = document.getElementById('add-product-modal');
    const btnAddProduct = document.getElementById('btn-add-product');
    const addModalClose = document.getElementById('add-modal-close');
    const btnCancelAdd = document.getElementById('btn-cancel-add');
    const addProductForm = document.getElementById('add-product-form');

    // ---- Toast Notification ----
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success'
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b9c8b3" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e5c8b9" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

        toast.innerHTML = `${iconSvg} <span>${esc(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ---- Update Stats ----
    function updateStats() {
        products = getRealTimeProducts();
        if (statTotal) statTotal.textContent = products.length;
        if (statFullsheet) statFullsheet.textContent = products.filter(p => p.fullsheet).length;
        if (stat3D) stat3D.textContent = products.filter(p => p.threeD).length;

        const uniqueCategories = new Set(products.map(p => normalizeCategory(p.category)));
        if (statCategories) statCategories.textContent = uniqueCategories.size;
    }

    // ---- Filtering & Sorting ----
    function getFilteredProducts() {
        products = getRealTimeProducts();
        const query = currentFilter.query.trim().toLowerCase().replace(/^#/, '');

        return products.filter(item => {
            const codeClean = (item.code || '').toLowerCase().replace(/^#/, '');
            const nameLower = (item.name || '').toLowerCase();
            // The factory code is how the floor refers to a sheet, so it has to be
            // searchable alongside the catalogue code.
            const factoryLower = (item.factoryCode || '').toLowerCase();
            const matchesQuery = !query || codeClean.includes(query) ||
                nameLower.includes(query) || factoryLower.includes(query);
            const cleanFilterCat = normalizeCategory(currentFilter.category);
            const matchesCategory = currentFilter.category === 'ALL' ||
                normalizeCategory(item.category) === cleanFilterCat;
            const matchesFullsheet = currentFilter.fullsheet === 'ALL' ||
                (currentFilter.fullsheet === 'YES' && item.fullsheet) ||
                (currentFilter.fullsheet === 'NO' && !item.fullsheet);
            const matches3D = currentFilter.threeD === 'ALL' ||
                (currentFilter.threeD === 'YES' && item.threeD) ||
                (currentFilter.threeD === 'NO' && !item.threeD);

            return matchesQuery && matchesCategory && matchesFullsheet && matches3D;
        }).sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (typeof valA === 'boolean') { valA = valA ? 1 : 0; valB = valB ? 1 : 0; }
            else if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // ---- Render Content (Table Grid & Cards View) ----
    function renderCatalog() {
        const filtered = getFilteredProducts();
        updateStats();

        if (resultsCountBadge) {
            resultsCountBadge.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${products.length}</strong> products`;
        }

        if (filtered.length === 0) {
            tableViewContainer.style.display = 'none';
            cardsViewContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        if (activeViewMode === 'table') {
            tableViewContainer.style.display = 'block';
            cardsViewContainer.style.display = 'none';
            renderTableGridRows(filtered);
        } else {
            tableViewContainer.style.display = 'none';
            cardsViewContainer.style.display = 'grid';
            renderGridCards(filtered);
        }

        attachActionEventListeners();
    }

    // Render Table Grid Rows with Crisp Cells & Borders
    function renderTableGridRows(filtered) {
        if (!tableBody) return;

        tableBody.innerHTML = filtered.map(product => {
            const isFsLocal = product.fullsheetUrl && product.fullsheetUrl.startsWith('db:');
            const fullsheetCell = product.fullsheet
                ? (isFsLocal
                    ? `<span class="grid-status-badge local" title="Saved locally in IndexedDB. Will auto-sync to cloud when online." style="cursor: default; user-select: none;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v10m0 0l-4-4m4 4l4-4"/><path d="M20 16.5A4.5 4.5 0 0 0 17.5 8a6 6 0 0 0-11.5 2 4 4 0 0 0 .5 8h13"/></svg>
                        Local
                       </span>`
                    : `<span class="grid-status-badge yes" title="Synced to permanent cloud storage" style="cursor: default; user-select: none;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Uploaded
                       </span>`)
                : `<span class="grid-status-badge no" style="cursor: default; user-select: none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    No
                   </span>`;

            const is3DLocal = product.threeDDataUrl && product.threeDDataUrl.startsWith('db:');
            const threeDCell = product.threeD
                ? (is3DLocal
                    ? `<span class="grid-status-badge local" title="Saved locally in IndexedDB. Will auto-sync to cloud when online." style="cursor: default; user-select: none;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v10m0 0l-4-4m4 4l4-4"/><path d="M20 16.5A4.5 4.5 0 0 0 17.5 8a6 6 0 0 0-11.5 2 4 4 0 0 0 .5 8h13"/></svg>
                        Local
                       </span>`
                    : `<span class="grid-status-badge yes" title="Synced to permanent cloud storage" style="cursor: default; user-select: none;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Uploaded
                       </span>`)
                : `<span class="grid-status-badge no" style="cursor: default; user-select: none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    No
                   </span>`;

            return `
                <tr data-id="${esc(product.id)}">
                    <td>
                        <span class="grid-code-badge">${esc(product.code)}</span>
                    </td>
                    <td>
                        <span class="grid-product-name">${esc(product.name || '')}</span>
                    </td>
                    <td>
                        <span class="grid-cat-pill">${esc(normalizeCategory(product.category))}</span>
                    </td>
                    <td>
                        <span class="grid-factory-code">${esc(product.factoryCode || '')}</span>
                    </td>
                    <td class="text-center">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            ${fullsheetCell}
                        </div>
                    </td>
                    <td class="text-center">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            ${threeDCell}
                        </div>
                    </td>
                    <td class="text-center">
                        <a class="grid-action-btn tour-link" href="${esc(tourUrlFor(product))}" target="_blank" rel="noopener" title="Open the 360 tour for ${esc(product.code)}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                            <span>360 View</span>
                        </a>
                    </td>
                    <td class="text-right">
                        <div class="grid-action-cell" style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="grid-action-btn edit-product-btn" data-id="${esc(product.id)}" title="Edit Product" style="border-color: var(--stone); display: flex; align-items: center; gap: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
                                <span>Edit</span>
                            </button>
                            <button class="grid-action-btn grid-action-btn--danger delete-product-btn" data-id="${esc(product.id)}" title="Delete Product">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Render Grid Cards View
    function renderGridCards(filtered) {
        if (!cardsViewContainer) return;

        cardsViewContainer.innerHTML = filtered.map(product => {
            const isFsLocal = product.fullsheetUrl && product.fullsheetUrl.startsWith('db:');
            const is3DLocal = product.threeDDataUrl && product.threeDDataUrl.startsWith('db:');

            return `
                <div class="product-card" data-id="${esc(product.id)}">
                    <div class="card-header">
                        <span class="card-code">${esc(product.code)}</span>
                        <span class="card-category">${esc(normalizeCategory(product.category))}</span>
                        ${product.factoryCode ? `<span class="card-factory-code">${esc(product.factoryCode)}</span>` : ''}
                    </div>

                    <div class="card-name">${esc(product.name || '')}</div>

                    <div class="card-status-row">
                        <div class="status-chip ${product.fullsheet ? (isFsLocal ? 'status-chip--local' : 'status-chip--yes') : 'status-chip--no'}">
                            <span class="status-chip__dot"></span>
                            <span class="status-chip__label">
                                <span class="status-chip__title">Full Sheet</span>
                                <span class="status-chip__value">${product.fullsheet ? (isFsLocal ? 'Local' : 'Uploaded') : '✕ No'}</span>
                            </span>
                        </div>
                        <div class="status-chip ${product.threeD ? (is3DLocal ? 'status-chip--local' : 'status-chip--yes') : 'status-chip--no'}">
                            <span class="status-chip__dot"></span>
                            <span class="status-chip__label">
                                <span class="status-chip__title">3D Image</span>
                                <span class="status-chip__value">${product.threeD ? (is3DLocal ? 'Local' : 'Uploaded') : '✕ No'}</span>
                            </span>
                        </div>
                    </div>

                    <div class="card-actions" style="margin-top: 14px; display: flex; gap: 8px; align-items: center;">
                        <button class="card-action-btn edit-product-btn" data-id="${esc(product.id)}" title="Edit Product" style="border-color: var(--stone); flex: 1;">Edit</button>
                        <a class="card-action-btn tour-link" href="${esc(tourUrlFor(product))}" target="_blank" rel="noopener" style="padding: 8px 14px;">360 View</a>
                        <button class="card-action-btn card-action-btn--danger delete-product-btn" data-id="${esc(product.id)}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ---- Export ----------------------------------------------------------
    /**
     * Exports the products currently listed - the same filter, search and sort the
     * table is showing, so what you see is what you get - as a real .xlsx.
     *
     * Columns mirror the table except Actions, which holds buttons rather than data.
     * The 360 View column exports the full absolute URL instead of the link's label,
     * since a path is useless once the row is in a spreadsheet.
     */
    function buildExportRows() {
        return getFilteredProducts().map(p => ({
            'Code Number': p.code || '',
            'Product Name': p.name || '',
            'Product Category': normalizeCategory(p.category) || '',
            'Factory Code': p.factoryCode || '',
            'Full Sheet': p.fullsheet ? 'Uploaded' : 'No',
            '3D Image': p.threeD ? 'Uploaded' : 'No',
            '360 View': window.location.origin + tourUrlFor(p)
        }));
    }

    function exportFilename(ext) {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `products-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /** Used when the spreadsheet library did not load. Excel opens this natively. */
    function exportAsCsv(rows) {
        const headers = Object.keys(rows[0]);
        const cell = v => {
            const t = String(v == null ? '' : v);
            return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
        };
        const csv = [headers.join(',')]
            .concat(rows.map(r => headers.map(h => cell(r[h])).join(',')))
            .join('\r\n');
        // The BOM is what makes Excel read it as UTF-8 rather than mangling accents.
        downloadBlob(new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8;' }),
                     exportFilename('csv'));
    }

    function exportProducts() {
        const rows = buildExportRows();
        if (rows.length === 0) {
            showToast('Nothing to export - no products match the current filters.', 'info');
            return;
        }

        if (typeof XLSX === 'undefined') {
            exportAsCsv(rows);
            showToast(`Exported ${rows.length} products as CSV.`, 'success');
            return;
        }

        const sheet = XLSX.utils.json_to_sheet(rows);
        // Without explicit widths every column collapses to its header.
        sheet['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 46 }];
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, 'Products');
        XLSX.writeFile(book, exportFilename('xlsx'));
        showToast(`Exported ${rows.length} products.`, 'success');
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) btnExportExcel.addEventListener('click', exportProducts);

    // ---- Categories --------------------------------------------------------
    /**
     * Keeps every category dropdown in step with the list.
     *
     * The eight original categories were hardcoded as <option> tags in two places. A
     * category added through the admin has to appear in both, so the options are rebuilt
     * from the shared list instead, preserving whatever was selected.
     */
    function refreshCategoryOptions() {
        const PC = window.ProductCatalog;
        if (!PC || typeof PC.getAllCategories !== 'function') return;
        const cats = PC.getAllCategories();
        const opts = cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');

        const filter = document.getElementById('category-select');
        if (filter) {
            const keep = filter.value;
            filter.innerHTML = '<option value="ALL">All Categories</option>' + opts;
            filter.value = cats.some(c => c.name === keep) ? keep : 'ALL';
        }

        const formCat = document.getElementById('form-category');
        if (formCat) {
            const keep = formCat.value;
            formCat.innerHTML = '<option value="">Select Category</option>' + opts;
            if (cats.some(c => c.name === keep)) formCat.value = keep;
        }
    }

    function renderExistingCategories() {
        const box = document.getElementById('category-existing');
        const PC = window.ProductCatalog;
        if (!box || !PC) return;

        const custom = PC.getCustomCategories();
        if (custom.length === 0) {
            box.innerHTML = '<p style="margin:0;color:var(--stone);font-size:var(--fs-meta);">' +
                'No categories added yet. The eight built-in ones are always available.</p>';
            return;
        }

        box.innerHTML =
            '<p style="margin:0 0 10px;color:var(--stone);font-size:var(--fs-meta);text-transform:uppercase;letter-spacing:.06em;">Added categories</p>' +
            custom.map(function (c) {
                return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--rule);">' +
                    '<span style="flex:1;font-size:var(--fs-body);">' + esc(c.name) + '</span>' +
                    '<a href="collection.html?cat=' + encodeURIComponent(c.slug) + '" target="_blank" rel="noopener" style="font-size:var(--fs-meta);color:var(--stone);">view</a>' +
                    '<button type="button" class="cat-delete-btn" data-id="' + esc(c.id) + '" data-name="' + esc(c.name) + '" style="border:none;background:none;color:#9c2b1c;cursor:pointer;font-size:var(--fs-meta);">remove</button>' +
                    '</div>';
            }).join('');

        box.querySelectorAll('.cat-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                const used = getRealTimeProducts().filter(p => normalizeCategory(p.category) === name).length;
                const warning = used > 0
                    ? used + ' product(s) are in this category. They keep the name but its page stops working. Remove it anyway?'
                    : 'Remove the category ' + name + '?';
                if (!confirm(warning)) return;
                try {
                    await window.ProductCatalog.deleteCategory(id);
                    renderExistingCategories();
                    refreshCategoryOptions();
                    showToast('Category removed', 'info');
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    }

    const categoryModal = document.getElementById('category-modal');
    const categoryNameInput = document.getElementById('category-name');
    const categoryBlurbInput = document.getElementById('category-blurb');
    const categoryThumbInput = document.getElementById('category-thumb');
    const categoryThumbWrap = document.getElementById('category-thumb-wrap');
    const categoryThumbPreview = document.getElementById('category-thumb-preview');
    let categoryThumbDataUrl = null;

    function openCategoryModal() {
        if (!categoryModal) return;
        categoryNameInput.value = '';
        categoryBlurbInput.value = '';
        categoryThumbInput.value = '';
        categoryThumbDataUrl = null;
        if (categoryThumbWrap) categoryThumbWrap.style.display = 'none';
        renderExistingCategories();
        categoryModal.style.display = 'flex';
        categoryNameInput.focus();
    }

    function closeCategoryModal() {
        if (categoryModal) categoryModal.style.display = 'none';
    }

    if (categoryThumbInput) {
        categoryThumbInput.addEventListener('change', async function (e) {
            const file = e.target.files[0];
            if (!file) {
                categoryThumbDataUrl = null;
                if (categoryThumbWrap) categoryThumbWrap.style.display = 'none';
                return;
            }
            categoryThumbDataUrl = await prepareImageFile(file);
            if (categoryThumbPreview && categoryThumbWrap) {
                categoryThumbPreview.src = categoryThumbDataUrl;
                categoryThumbWrap.style.display = 'block';
            }
        });
    }

    const btnAddCategory = document.getElementById('btn-add-category');
    if (btnAddCategory) btnAddCategory.addEventListener('click', openCategoryModal);
    const categoryCloseBtn = document.getElementById('category-modal-close');
    if (categoryCloseBtn) categoryCloseBtn.addEventListener('click', closeCategoryModal);
    const categoryCancelBtn = document.getElementById('category-cancel');
    if (categoryCancelBtn) categoryCancelBtn.addEventListener('click', closeCategoryModal);

    const categorySaveBtn = document.getElementById('category-save');
    if (categorySaveBtn) {
        categorySaveBtn.addEventListener('click', async function () {
            const name = categoryNameInput.value.trim();
            if (!name) {
                showToast('A category needs a name', 'error');
                categoryNameInput.focus();
                return;
            }

            categorySaveBtn.disabled = true;
            categorySaveBtn.textContent = 'Creating...';
            try {
                // The thumbnail goes to the same store as product imagery, so it is served
                // from outside the web root and survives a deploy.
                let thumbnailUrl = null;
                if (categoryThumbDataUrl) {
                    const slug = window.ProductCatalog.categorySlug(name);
                    thumbnailUrl = await window.ProductCatalog.uploadAssetToBlob(
                        'category-' + slug + '.jpg', categoryThumbDataUrl);
                }

                await window.ProductCatalog.saveCategory({
                    name: name,
                    blurb: categoryBlurbInput.value.trim(),
                    thumbnailUrl: thumbnailUrl
                });
                refreshCategoryOptions();
                renderExistingCategories();
                showToast('Category created', 'success');
                closeCategoryModal();
            } catch (err) {
                showToast(err.message || 'Could not create the category', 'error');
            } finally {
                categorySaveBtn.disabled = false;
                categorySaveBtn.textContent = 'Create';
            }
        });
    }

    window.addEventListener('categoriesUpdated', function () {
        refreshCategoryOptions();
        renderExistingCategories();
    });

    refreshCategoryOptions();

    // ---- Event Listeners for Table & Card Actions ----
    function attachActionEventListeners() {
        document.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openEditProductModal(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.view-fs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openFullsheetModal(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.view-3d-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                open3DPanoramaModal(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.toggle-fs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openEditProductModal(e.currentTarget.getAttribute('data-id'), 2);
            });
        });

        document.querySelectorAll('.toggle-3d-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openEditProductModal(e.currentTarget.getAttribute('data-id'), 2);
            });
        });

        document.querySelectorAll('.delete-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const list = getRealTimeProducts();
                const p = list.find(prod => prod.id === id);
                if (p && confirm(`Delete ${p.code} - ${p.name}?`)) {
                    if (window.ProductCatalog && typeof window.ProductCatalog.deleteProduct === 'function') {
                        window.ProductCatalog.deleteProduct(id);
                    } else {
                        saveRealTimeProducts(list.filter(prod => prod.id !== id));
                    }
                    renderCatalog();
                    showToast(`Deleted ${p.code}`, 'info');
                }
            });
        });
    }



    // ---- View Switcher Listener ----
    if (btnModeTable) {
        btnModeTable.addEventListener('click', () => {
            activeViewMode = 'table';
            btnModeTable.classList.add('active');
            btnModeCards.classList.remove('active');
            renderCatalog();
        });
    }

    if (btnModeCards) {
        btnModeCards.addEventListener('click', () => {
            activeViewMode = 'cards';
            btnModeCards.classList.add('active');
            btnModeTable.classList.remove('active');
            renderCatalog();
        });
    }

    // ---- Column Sorting Listeners ----
    document.querySelectorAll('.grid-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            if (sortField === field) {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortOrder = 'asc';
            }

            document.querySelectorAll('.grid-table th').forEach(el => {
                el.classList.remove('sorted-asc', 'sorted-desc');
            });

            th.classList.add(sortOrder === 'asc' ? 'sorted-asc' : 'sorted-desc');
            renderCatalog();
        });
    });

    // ---- Fullsheet Modal ----
    async function openFullsheetModal(productId) {
        const list = getRealTimeProducts();
        const product = list.find(p => p.id === productId);
        if (!product || !product.fullsheet) return;

        fsModalTitle.textContent = `${product.code} - ${product.name}`;

        let fsSrc = 'assets/textures/laminates.webp';
        if (product.fullsheetUrl) {
            if (product.fullsheetUrl.startsWith('db:')) {
                const dbKey = product.fullsheetUrl.replace('db:', '');
                if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                    const storedData = await window.ProductCatalog.getAsset(dbKey);
                    if (storedData) fsSrc = storedData;
                }
            } else {
                fsSrc = product.fullsheetUrl;
            }
        }

        fsModalImg.src = fsSrc;

        fsZoom = 1; fsPanX = 0; fsPanY = 0;
        updateFsTransform();
        fsModal.style.display = 'flex';
    }

    function closeFullsheetModal() { fsModal.style.display = 'none'; }

    function updateFsTransform() {
        fsModalImg.style.transform = `translate(${fsPanX}px, ${fsPanY}px) scale(${fsZoom})`;
        fsZoomTag.textContent = `${Math.round(fsZoom * 100)}%`;
    }

    fsBtnZoomIn.addEventListener('click', () => { fsZoom = Math.min(fsZoom + 0.25, 4); updateFsTransform(); });
    fsBtnZoomOut.addEventListener('click', () => { fsZoom = Math.max(fsZoom - 0.25, 0.5); updateFsTransform(); });
    fsBtnReset.addEventListener('click', () => { fsZoom = 1; fsPanX = 0; fsPanY = 0; updateFsTransform(); });

    fsViewport.addEventListener('mousedown', (e) => {
        if (fsZoom <= 1) return;
        isDraggingFs = true; dragStartX = e.clientX - fsPanX; dragStartY = e.clientY - fsPanY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDraggingFs) return;
        fsPanX = e.clientX - dragStartX; fsPanY = e.clientY - dragStartY; updateFsTransform();
    });
    window.addEventListener('mouseup', () => { isDraggingFs = false; });

    fsModalClose.addEventListener('click', closeFullsheetModal);
    fsModal.addEventListener('click', (e) => { if (e.target === fsModal) closeFullsheetModal(); });

    // ---- 3D Panorama Viewer Modal ----
    let panoViewerInstance = null;
    const panoModal = document.getElementById('panorama-3d-modal');
    const panoModalClose = document.getElementById('pano-modal-close');
    const panoModalTitle = document.getElementById('pano-modal-title');
    const panoLaunchTourBtn = document.getElementById('pano-launch-tour-btn');

    async function open3DPanoramaModal(productId) {
        const list = getRealTimeProducts();
        const product = list.find(p => p.id === productId);
        if (!product || !product.threeD) return;

        if (panoModalTitle) panoModalTitle.textContent = `${product.code} - ${product.name} (3D Panorama)`;
        if (panoLaunchTourBtn) {
            const cleanCat = (product.category || 'laminates').toLowerCase().trim().replace(/\s+/g, '-');
            const cleanCode = (product.code || product.slug || product.id || 'product').toLowerCase().trim().replace(/#/g, '').replace(/\s+/g, '-');
            panoLaunchTourBtn.href = `${cleanCat}/${cleanCode}`;
        }

        if (panoModal) panoModal.style.display = 'flex';

        let panoramaSrc = 'src/360img.jpeg';
        if (product.threeDDataUrl) {
            if (product.threeDDataUrl.startsWith('db:')) {
                const dbKey = product.threeDDataUrl.replace('db:', '');
                if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                    const storedData = await window.ProductCatalog.getAsset(dbKey);
                    if (storedData) panoramaSrc = storedData;
                }
            } else {
                panoramaSrc = product.threeDDataUrl;
            }
        }

        // Clean up previous viewer and clear DOM container
        if (panoViewerInstance && typeof panoViewerInstance.destroy === 'function') {
            try { panoViewerInstance.destroy(); } catch (e) { }
        }
        panoViewerInstance = null;

        const viewerContainer = document.getElementById('modal-3d-viewer');
        if (viewerContainer) {
            viewerContainer.innerHTML = '';
        }

        setTimeout(() => {
            if (window.pannellum && document.getElementById('modal-3d-viewer')) {
                try {
                    panoViewerInstance = window.pannellum.viewer('modal-3d-viewer', {
                        type: 'equirectangular',
                        panorama: panoramaSrc,
                        autoLoad: true,
                        pitch: product.pitch || 0,
                        yaw: product.yaw || 0,
                        hfov: 100,
                        compass: false,
                        showZoomCtrl: true,
                        mouseZoom: true
                    });

                    // Ensure canvas fills container after layout
                    setTimeout(() => {
                        if (panoViewerInstance && typeof panoViewerInstance.resize === 'function') {
                            try { panoViewerInstance.resize(); } catch (e) { }
                        }
                    }, 150);
                } catch (err) {
                    console.error('Failed to initialize panorama viewer modal:', err);
                }
            }
        }, 80);
    }

    function close3DPanoramaModal() {
        if (panoModal) panoModal.style.display = 'none';
        if (panoViewerInstance && typeof panoViewerInstance.destroy === 'function') {
            try { panoViewerInstance.destroy(); } catch (e) { }
            panoViewerInstance = null;
        }
        const viewerContainer = document.getElementById('modal-3d-viewer');
        if (viewerContainer) {
            viewerContainer.innerHTML = '';
        }
    }

    if (panoModalClose) panoModalClose.addEventListener('click', close3DPanoramaModal);
    if (panoModal) panoModal.addEventListener('click', (e) => { if (e.target === panoModal) close3DPanoramaModal(); });

    // Auto-generate slug from Code input
    const formCodeInput = document.getElementById('form-code');
    const formFactoryCodeInput = document.getElementById('form-factory-code');

    // The slug is derived from the code rather than typed. It used to live in a read-only
    // box beside the name, which only ever showed what the code already implied; that box
    // is the factory code now.
    function slugFromCode(code) {
        const clean = String(code || '').toLowerCase().replace(/#/g, '').trim()
            .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return clean ? `prod-${clean}` : `prod-${Date.now()}`;
    }

    const formSlugInput = document.getElementById('form-slug');
    if (formCodeInput && formSlugInput) {
        formCodeInput.addEventListener('input', () => {
            const cleanCode = formCodeInput.value.trim().toLowerCase().replace(/#/g, '');
            const slug = cleanCode.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            formSlugInput.value = slug ? `prod-${slug}` : '';
        });
    }

    // ---- Add Product Modal ----
    let currentFormStep = 1;
    let tempFullsheetDataUrl = null;
    let tempThreeDDataUrl = null;
    let wizardViewerInstance = null;
    let tempHotspotsList = [];
    let editingProductId = null;

    const inputFullsheet = document.getElementById('form-fullsheet-file');
    const inputThreeD = document.getElementById('form-3d-file');
    const wrapFullsheet = document.getElementById('fullsheet-preview-wrap');
    const wrapThreeD = document.getElementById('threeD-preview-wrap');
    const imgFullsheet = document.getElementById('img-preview-fullsheet');
    const imgThreeD = document.getElementById('img-preview-threeD');

    /**
     * Gets an image to the server before the product is saved, so the catalogue never
     * records a product whose image exists only in this browser.
     *
     * The previous flow wrote to IndexedDB, recorded a db: pointer and left a background
     * queue to upload later. When that queue failed - or dropped an entry, which it does
     * silently when the asset read comes back empty - the image was lost with no trace,
     * and the browser copy is deleted as soon as an upload reports success. Uploading
     * first makes the server the primary home; IndexedDB is now only the offline retry.
     *
     * Returns a permanent /uploads/ URL, or a db: pointer if the upload could not be made.
     */
    async function persistAsset(productId, field, dataUrl, filename) {
        const PC = window.ProductCatalog;
        if (PC && typeof PC.uploadAssetToBlob === 'function') {
            try {
                const url = await PC.uploadAssetToBlob(filename, dataUrl);
                if (url) return url;
            } catch (err) {
                console.warn('Immediate upload failed, falling back to offline queue:', err);
            }
        }

        // Offline or server unreachable: hold it locally and let the queue retry.
        const key = `${field}-${productId}`;
        if (PC && typeof PC.storeAsset === 'function') {
            await PC.storeAsset(key, dataUrl);
        }
        if (PC && typeof PC.enqueueSync === 'function') {
            PC.enqueueSync({ productId, field, dbKey: key, filename });
        }
        showToast('Image saved offline — it will upload when the connection returns.', 'info');
        return `db:${key}`;
    }

    /**
     * Prepares an image for upload. The default is to not touch it at all.
     *
     * The original file is uploaded byte for byte, so a panorama arrives at the viewer
     * exactly as it left the camera or the render - full resolution, no re-encoding,
     * nothing for the tour to have lost. Earlier versions redrew every upload through a
     * canvas at quality 0.82 and forced panoramas down to 2880px wide, which is what
     * made tours look soft.
     *
     * Resampling now happens in one case only: a file too large to survive the upload
     * request itself. That is a hard transport limit, not a quality preference, and the
     * caller is told when it happens.
     */
    async function prepareImageFile(file, opts = {}) {
        if (!file) return null;

        // Base64 inflates the payload by about a third on the way to the server, so a
        // 20 MB file arrives as roughly 27 MB. A 26 MB payload was measured going through
        // this host intact, so 20 MB is the largest file proven to survive the request.
        const hardLimitBytes = opts.hardLimitBytes || 20 * 1024 * 1024;
        const onResample = typeof opts.onResample === 'function' ? opts.onResample : () => {};

        const readOriginal = () => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });

        if (file.size <= hardLimitBytes) {
            return readOriginal();
        }

        // Too large to send. Shrink as little as necessary rather than to a fixed size.
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = async () => {
                URL.revokeObjectURL(url);
                const w0 = img.naturalWidth || img.width;
                const h0 = img.naturalHeight || img.height;

                const scale = Math.sqrt(hardLimitBytes / file.size);
                let w = Math.max(1, Math.round(w0 * scale));
                let h = Math.max(1, Math.round(h0 * scale));

                // Older iOS refuses a canvas much beyond 16 megapixels and returns blank.
                const maxPixels = 16 * 1024 * 1024;
                if (w * h > maxPixels) {
                    const k = Math.sqrt(maxPixels / (w * h));
                    w = Math.round(w * k);
                    h = Math.round(h * k);
                }

                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d', { alpha: false });
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, w, h);
                    onResample(w0, h0, w, h);
                    // 0.95: the aspect ratio is preserved, so the sphere still maps correctly.
                    resolve(canvas.toDataURL('image/jpeg', 0.95));
                } catch (err) {
                    resolve(await readOriginal());
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                readOriginal().then(resolve);
            };

            img.src = url;
        });
    }

    /**
     * A 360 panorama is an equirectangular projection and must be exactly twice as wide
     * as it is tall. A 16:9 photo wrapped round a sphere renders stretched with a seam
     * that does not meet, which reads as "the tour looks wrong" rather than as a problem
     * with the file. Said once, at upload, where it can still be acted on.
     */
    function checkPanoramaShape(file) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const w = img.naturalWidth, h = img.naturalHeight;
            const ratio = w / h;
            if (Math.abs(ratio - 2) > 0.05) {
                showToast(
                    `This image is ${w}x${h} (${ratio.toFixed(2)}:1). A 360 panorama must be ` +
                    `exactly 2:1 - try ${h * 2}x${h} or 4096x2048 - or the tour will look stretched.`,
                    'info'
                );
            }
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
    }

    async function openEditProductModal(productId, startStep = 1) {
        const list = getRealTimeProducts();
        const product = list.find(p => p.id === productId);
        if (!product) return;

        editingProductId = productId;

        // Update modal title & description
        const headerTitle = document.querySelector('.form-modal-header h2');
        const headerDesc = document.querySelector('.form-modal-header p');
        if (headerTitle) headerTitle.textContent = `Edit Product ${product.code}`;
        if (headerDesc) headerDesc.textContent = 'Update product details, files, and hotspot positioning.';

        // Populate Step 1 fields
        document.getElementById('form-code').value = product.code;
        document.getElementById('form-category').value = normalizeCategory(product.category);
        document.getElementById('form-name').value = product.name || '';
        document.getElementById('form-factory-code').value = product.factoryCode || '';

        // Reset previous preview images
        if (wrapFullsheet) wrapFullsheet.style.display = 'none';
        if (wrapThreeD) wrapThreeD.style.display = 'none';
        tempFullsheetDataUrl = null;
        tempThreeDDataUrl = null;

        // Fetch assets from IndexedDB if db: key exists
        if (product.fullsheetUrl) {
            if (product.fullsheetUrl.startsWith('db:')) {
                const dbKey = product.fullsheetUrl.replace('db:', '');
                if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                    const storedData = await window.ProductCatalog.getAsset(dbKey);
                    if (storedData) {
                        tempFullsheetDataUrl = storedData;
                        if (imgFullsheet && wrapFullsheet) {
                            imgFullsheet.src = storedData;
                            wrapFullsheet.style.display = 'flex';
                        }
                    }
                }
            } else {
                tempFullsheetDataUrl = product.fullsheetUrl;
                if (imgFullsheet && wrapFullsheet) {
                    imgFullsheet.src = product.fullsheetUrl;
                    wrapFullsheet.style.display = 'flex';
                }
            }
        }

        if (product.threeDDataUrl) {
            if (product.threeDDataUrl.startsWith('db:')) {
                const dbKey = product.threeDDataUrl.replace('db:', '');
                if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                    const storedData = await window.ProductCatalog.getAsset(dbKey);
                    if (storedData) {
                        tempThreeDDataUrl = storedData;
                        if (imgThreeD && wrapThreeD) {
                            imgThreeD.src = storedData;
                            wrapThreeD.style.display = 'flex';
                        }
                    }
                }
            } else {
                tempThreeDDataUrl = product.threeDDataUrl;
                if (imgThreeD && wrapThreeD) {
                    imgThreeD.src = product.threeDDataUrl;
                    wrapThreeD.style.display = 'flex';
                }
            }
        }

        // Populate step 3 hotspots list
        tempHotspotsList = Array.isArray(product.hotspots) ? [...product.hotspots] : [];

        // Clear files input tags
        if (inputFullsheet) inputFullsheet.value = '';
        if (inputThreeD) inputThreeD.value = '';

        showFormStep(startStep);
        addProductModal.style.display = 'flex';
    }

    if (inputFullsheet) {
        inputFullsheet.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                tempFullsheetDataUrl = await prepareImageFile(file);
                if (imgFullsheet && wrapFullsheet) {
                    imgFullsheet.src = tempFullsheetDataUrl;
                    wrapFullsheet.style.display = 'flex';
                }
            } else {
                tempFullsheetDataUrl = null;
                if (wrapFullsheet) wrapFullsheet.style.display = 'none';
            }
        });
    }

    if (inputThreeD) {
        inputThreeD.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
// Uploaded exactly as supplied: whatever resolution the panorama has is what
                // the tour gets. Only the shape is checked, and only to warn.
                checkPanoramaShape(file);
                tempThreeDDataUrl = await prepareImageFile(file, {
                    onResample: (w0, h0, w, h) =>
                        showToast(`Panorama was ${w0}x${h0}, too large to upload; sent at ${w}x${h}.`, 'info')
                });
                if (imgThreeD && wrapThreeD) {
                    imgThreeD.src = tempThreeDDataUrl;
                    wrapThreeD.style.display = 'flex';
                }
            } else {
                tempThreeDDataUrl = null;
                if (wrapThreeD) wrapThreeD.style.display = 'none';
            }
        });
    }

    // Custom preview label constructor inside Pannellum
    function createWizardTooltip(hotspotDiv, labelText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'product-label';

        const dot = document.createElement('span');
        dot.className = 'product-label-dot';

        const text = document.createElement('span');
        text.className = 'product-label-text';
        text.textContent = labelText;

        wrapper.appendChild(dot);
        wrapper.appendChild(text);
        hotspotDiv.appendChild(wrapper);
    }

    function wizardViewerMessage(title, detail) {
        const container = document.getElementById('wizard-3d-viewer');
        if (!container) return;
        container.innerHTML = `
            <div style="width:100%;height:100%;min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0c0a09;color:#fff;text-align:center;padding:24px;box-sizing:border-box;border-radius:12px;user-select:none;">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom:12px;">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                <div style="font-size:1rem;font-weight:600;color:#fff;margin-bottom:6px;letter-spacing:-0.01em;"></div>
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.45);max-width:280px;line-height:1.45;"></div>
            </div>
        `;
        // textContent, so a product code in the message can never become markup.
        container.querySelectorAll('div div')[0].textContent = title;
        container.querySelectorAll('div div')[1].textContent = detail;
    }

    /**
     * Releases the panorama viewer AND the graphics context behind it.
     *
     * pannellum.destroy() tears down its own objects but leaves the canvas holding a live
     * WebGL context, and a browser grants only a handful across all of its tabs. Opening
     * the hotspot step repeatedly therefore consumed one each time until the browser would
     * not grant another, and the preview stopped working for the rest of the session -
     * which is why restarting the browser appeared to fix it.
     *
     * WEBGL_lose_context hands the context back immediately instead of waiting for garbage
     * collection, which may never come while the page is open.
     */
    function destroyWizardViewer() {
        const container = document.getElementById('wizard-3d-viewer');

        if (wizardViewerInstance && typeof wizardViewerInstance.destroy === 'function') {
            try { wizardViewerInstance.destroy(); } catch (e) { }
        }
        wizardViewerInstance = null;

        if (container) {
            container.querySelectorAll('canvas').forEach(canvas => {
                try {
                    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                    const lose = gl && gl.getExtension('WEBGL_lose_context');
                    if (lose) lose.loseContext();
                } catch (e) { }
                // Detaching the canvas as well, so nothing keeps a reference to it.
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            });
        }
    }

    function initWizardViewer() {
        destroyWizardViewer();

        const container = document.getElementById('wizard-3d-viewer');
        if (!container) return;
        container.innerHTML = '';

        if (!tempThreeDDataUrl) {
            container.innerHTML = `
                <div style="width: 100%; height: 100%; min-height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0c0a09; color: #fff; text-align: center; padding: 24px; box-sizing: border-box; border-radius: 12px; user-select: none;">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom: 12px;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    <div style="font-size: 1rem; font-weight: 600; color: #ffffff; margin-bottom: 6px; letter-spacing: -0.01em;">No 3D Image Available</div>
                    <div style="font-size: 0.72rem; color: rgba(255,255,255,0.45); max-width: 250px; line-height: 1.45;">
                        Go back to Step 2 (Assets) and upload a 360° panorama image to place hotspots.
                    </div>
                </div>
            `;
            return;
        }

        const panoramaSrc = tempThreeDDataUrl;

        // Map internal temp list to hotspots config
        const panoHotspots = tempHotspotsList.map((hs, index) => ({
            id: `wizard-hs-${index}`,
            pitch: hs.pitch,
            yaw: hs.yaw,
            type: 'info',
            createTooltipFunc: createWizardTooltip,
            createTooltipArgs: hs.code
        }));

        if (window.pannellum) {
            try {
                wizardViewerInstance = window.pannellum.viewer('wizard-3d-viewer', {
                    type: 'equirectangular',
                    panorama: panoramaSrc,
                    autoLoad: true,
                    // Only speak up once the viewer has actually failed. Testing for WebGL
                    // beforehand was worse than useless: the probe held a context of its
                    // own, and a false negative refused a render that would have worked.
                    error: function (msg) {
                        wizardViewerMessage('Panorama could not be loaded',
                            String(msg || 'The panorama image could not be read.'));
                    },
                    pitch: tempHotspotsList.length > 0 ? tempHotspotsList[tempHotspotsList.length - 1].pitch : 0,
                    yaw: tempHotspotsList.length > 0 ? tempHotspotsList[tempHotspotsList.length - 1].yaw : 0,
                    compass: false,
                    showZoomCtrl: false,
                    hotSpots: panoHotspots
                });

                setTimeout(() => {
                    if (wizardViewerInstance && typeof wizardViewerInstance.resize === 'function') {
                        try { wizardViewerInstance.resize(); } catch (e) { }
                    }
                }, 120);
            } catch (err) {
                console.error('Failed to init wizard viewer:', err);
            }

            // Capture clicks to create a new hotspot point
            let isDragging = false;
            let mousedownX = 0, mousedownY = 0;

            container.addEventListener('mousedown', (e) => {
                isDragging = false;
                mousedownX = e.clientX;
                mousedownY = e.clientY;
            });

            container.addEventListener('mouseup', (e) => {
                const dx = Math.abs(e.clientX - mousedownX);
                const dy = Math.abs(e.clientY - mousedownY);

                // Click (not a drag-to-look action)
                if (dx < 5 && dy < 5 && wizardViewerInstance &&
                    typeof wizardViewerInstance.mouseEventToCoords === 'function') {
                    const coords = wizardViewerInstance.mouseEventToCoords(e);
                    if (coords) {
                        const pitch = parseFloat(coords[0].toFixed(1));
                        const yaw = parseFloat(coords[1].toFixed(1));

                        openAddHotspotModal(pitch, yaw);
                    }
                }
            });
        }
    }

    function updateWizardHotspotsListUI() {
        const countBadge = document.getElementById('wizard-hotspot-count');
        const listContainer = document.getElementById('wizard-hotspots-list');

        if (countBadge) countBadge.textContent = tempHotspotsList.length;


        if (listContainer) {
            listContainer.innerHTML = '';
            if (tempHotspotsList.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.65rem; margin-top: 60px; font-style: italic;">
                        No hotspots added yet. Click on the 3D tour area to place labels.
                    </div>
                `;
                return;
            }

            tempHotspotsList.forEach((hs, index) => {
                const card = document.createElement('div');
                card.style.background = '#1a1a1a';
                card.style.borderRadius = '6px';
                card.style.padding = '8px 12px';
                card.style.display = 'flex';
                card.style.alignItems = 'center';
                card.style.justifyContent = 'space-between';
                card.style.border = '1px solid rgba(255,255,255,0.03)';
                card.style.marginBottom = '6px';

                card.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
                        <div style="width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: #fff; font-weight: bold; flex-shrink: 0;">
                            ${index + 1}
                        </div>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <div style="font-size: 0.7rem; font-weight: bold; color: #fff;">${hs.code}</div>
                            <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4);">pitch: ${hs.pitch}° · yaw: ${hs.yaw}°</div>
                        </div>
                    </div>
                    <button type="button" class="del-wizard-hs" data-index="${index}" style="background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.85rem; padding: 2px 6px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
                        &times;
                    </button>
                `;

                card.querySelector('.del-wizard-hs').addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                    tempHotspotsList.splice(idx, 1);
                    initWizardViewer();
                    updateWizardHotspotsListUI();
                });

                listContainer.appendChild(card);
            });
        }
    }

    const btnClearAll = document.getElementById('wizard-clear-hotspots');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            tempHotspotsList = [];
            initWizardViewer();
            updateWizardHotspotsListUI();
        });
    }

    // ---- Custom Hotspot Placement Modal Handlers ----
    let activePlacementPitch = 0;
    let activePlacementYaw = 0;

    const addHotspotModal = document.getElementById('add-hotspot-modal');
    const hotspotCoordsPreview = document.getElementById('hotspot-coords-preview');
    const hotspotInputLabel = document.getElementById('hotspot-input-label');
    const btnCancelHotspot = document.getElementById('btn-cancel-hotspot');
    const btnConfirmHotspot = document.getElementById('btn-confirm-hotspot');

    function openAddHotspotModal(pitch, yaw) {
        if (!addHotspotModal) return;
        activePlacementPitch = pitch;
        activePlacementYaw = yaw;

        if (hotspotCoordsPreview) {
            hotspotCoordsPreview.textContent = `Placing at pitch: ${pitch.toFixed(1)}°, yaw: ${yaw.toFixed(1)}°`;
        }

        if (hotspotInputLabel) {
            const currentCode = document.getElementById('form-code').value.trim() || '#4006';
            hotspotInputLabel.value = currentCode;
        }

        addHotspotModal.style.display = 'flex';

        // Auto-select text input for fast replacement
        setTimeout(() => {
            if (hotspotInputLabel) {
                hotspotInputLabel.focus();
                hotspotInputLabel.select();
            }
        }, 50);
    }

    function confirmHotspotPlacement() {
        if (!hotspotInputLabel || !addHotspotModal) return;
        const val = hotspotInputLabel.value.trim();
        if (val !== '') {
            tempHotspotsList.push({
                code: val,
                pitch: activePlacementPitch,
                yaw: activePlacementYaw
            });
            initWizardViewer();
            updateWizardHotspotsListUI();
        }
        addHotspotModal.style.display = 'none';
    }

    if (btnCancelHotspot) {
        btnCancelHotspot.addEventListener('click', () => {
            if (addHotspotModal) addHotspotModal.style.display = 'none';
        });
    }

    if (btnConfirmHotspot) {
        btnConfirmHotspot.addEventListener('click', confirmHotspotPlacement);
    }

    if (hotspotInputLabel) {
        hotspotInputLabel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmHotspotPlacement();
            } else if (e.key === 'Escape') {
                if (addHotspotModal) addHotspotModal.style.display = 'none';
            }
        });
    }

    function showFormStep(stepNum) {
        currentFormStep = stepNum;

        // Hide all pages
        document.querySelectorAll('.form-page').forEach(page => {
            page.style.display = 'none';
        });

        // Show active page
        const activePage = document.getElementById(`form-page-${stepNum}`);
        if (activePage) activePage.style.display = 'block';

        // Step 3 is the only step that holds a WebGL context. Leaving it while the modal
        // stays open used to keep that context alive, and they are a limited resource
        // shared across every open tab.
        if (stepNum !== 3) destroyWizardViewer();

        // Dynamically resize modal card width for split column Step 3
        const modalContainer = document.querySelector('.form-modal-card');
        if (modalContainer) {
            if (stepNum === 3) {
                modalContainer.style.maxWidth = '840px';
                modalContainer.style.width = '95%';
            } else {
                modalContainer.style.maxWidth = '520px';
                modalContainer.style.width = '';
            }
        }

        // Update progress indicators
        for (let i = 1; i <= 3; i++) {
            const stepEl = document.getElementById(`progress-step-${i}`);
            if (stepEl) {
                const numEl = stepEl.querySelector('.step-num');
                const labelEl = stepEl.querySelector('.step-label');

                if (i <= stepNum) {
                    stepEl.classList.add('active');
                    if (numEl) {
                        numEl.style.background = 'var(--charcoal)';
                        numEl.style.color = 'var(--ivory)';
                        numEl.style.borderColor = 'var(--charcoal)';
                    }
                    if (labelEl) labelEl.style.color = 'var(--charcoal)';
                } else {
                    stepEl.classList.remove('active');
                    if (numEl) {
                        numEl.style.background = 'transparent';
                        numEl.style.color = 'var(--stone)';
                        numEl.style.borderColor = 'var(--rule)';
                    }
                    if (labelEl) labelEl.style.color = 'var(--stone)';
                }
            }
        }
    }

    btnAddProduct.addEventListener('click', () => {
        editingProductId = null;
        addProductForm.reset();
        tempFullsheetDataUrl = null;
        tempThreeDDataUrl = null;
        tempHotspotsList = [];
        if (wrapFullsheet) wrapFullsheet.style.display = 'none';
        if (wrapThreeD) wrapThreeD.style.display = 'none';
        if (formFactoryCodeInput) formFactoryCodeInput.value = '';
        showFormStep(1);
        addProductModal.style.display = 'flex';
    });

    function closeAddModal() {
        destroyWizardViewer();
        editingProductId = null;
        addProductForm.reset();
        tempFullsheetDataUrl = null;
        tempThreeDDataUrl = null;
        tempHotspotsList = [];
        addProductModal.style.display = 'none';
    }

    addModalClose.addEventListener('click', closeAddModal);
    btnCancelAdd.addEventListener('click', closeAddModal);
    // Deliberately no backdrop-click close here. This form is three steps long and holds
    // uploaded images; a stray click outside the card used to discard all of it. It closes
    // only through Cancel or the X. The read-only viewers below keep backdrop dismissal.

    // Step 1 validation & Navigation
    const btnNextStep1 = document.getElementById('btn-next-step-1');
    if (btnNextStep1) {
        btnNextStep1.addEventListener('click', () => {
            const codeInput = document.getElementById('form-code');
            const categorySelect = document.getElementById('form-category');
            const nameInput = document.getElementById('form-name');

            if (!codeInput.checkValidity() || !categorySelect.checkValidity()) {
                if (!codeInput.checkValidity()) codeInput.reportValidity();
                else if (!categorySelect.checkValidity()) categorySelect.reportValidity();
                return;
            }

            let rawCode = codeInput.value.trim();
            const category = normalizeCategory(categorySelect.value.trim());

            if (rawCode && category) {
                if (!rawCode.startsWith('#')) rawCode = '#' + rawCode;
                const existingProducts = getRealTimeProducts();
                const cleanNewCode = rawCode.toLowerCase().replace(/#/g, '').trim();
                const cleanNewCat = category.toLowerCase().trim();

                const duplicate = existingProducts.find(p => {
                    if (editingProductId && p.id === editingProductId) return false;
                    const cleanExistingCode = (p.code || '').toLowerCase().replace(/#/g, '').trim();
                    const cleanExistingCat = (p.category || '').toLowerCase().trim();
                    return cleanExistingCode === cleanNewCode && cleanExistingCat === cleanNewCat;
                });

                if (duplicate) {
                    showToast(`Product code ${rawCode} already exists in ${category}. Please enter a unique code.`, 'error');
                    codeInput.focus();
                    return;
                }
            }

            showFormStep(2);
        });
    }

    // Step 2 Navigation
    const btnNextStep2 = document.getElementById('btn-next-step-2');
    const btnPrevStep2 = document.getElementById('btn-prev-step-2');
    if (btnNextStep2) {
        btnNextStep2.addEventListener('click', () => {
            showFormStep(3);
            setTimeout(() => {
                initWizardViewer();
                updateWizardHotspotsListUI();
            }, 50);
        });
    }
    if (btnPrevStep2) {
        btnPrevStep2.addEventListener('click', () => {
            showFormStep(1);
        });
    }

    // Step 3 Navigation
    const btnPrevStep3 = document.getElementById('btn-prev-step-3');
    if (btnPrevStep3) {
        btnPrevStep3.addEventListener('click', () => {
            showFormStep(2);
        });
    }

    // Prevent early submission on Enter key and navigate steps instead
    addProductForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
            if (currentFormStep === 1) {
                if (btnNextStep1) btnNextStep1.click();
            } else if (currentFormStep === 2) {
                if (btnNextStep2) btnNextStep2.click();
            }
        }
    });

    const btnSaveProduct = document.getElementById('btn-save-product');
    let isFormSubmitting = false;

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isFormSubmitting) return;

        let rawCode = document.getElementById('form-code').value.trim();
        const category = normalizeCategory(document.getElementById('form-category').value);
        const name = document.getElementById('form-name').value.trim();
        const slug = slugFromCode(document.getElementById('form-code').value);
        const factoryCode = (document.getElementById('form-factory-code').value || '').trim();

        // Validate required Step 1 fields (Code and Category are required, Name is optional)
        if (!rawCode || !category) {
            showFormStep(1);
            showToast('Please fill out Code Number and Category (*)', 'error');
            return;
        }

        if (!rawCode.startsWith('#')) rawCode = '#' + rawCode;

        // Check for duplicate code in the same category
        const existingProducts = getRealTimeProducts();
        const cleanNewCode = rawCode.toLowerCase().replace(/#/g, '').trim();
        const cleanNewCat = category.toLowerCase().trim();

        const duplicate = existingProducts.find(p => {
            if (editingProductId && p.id === editingProductId) return false;
            const cleanExistingCode = (p.code || '').toLowerCase().replace(/#/g, '').trim();
            const cleanExistingCat = (p.category || '').toLowerCase().trim();
            return cleanExistingCode === cleanNewCode && cleanExistingCat === cleanNewCat;
        });

        if (duplicate) {
            showFormStep(1);
            showToast(`Product with code ${rawCode} already exists in ${category}. Please use a unique code number.`, 'error');
            const codeInput = document.getElementById('form-code');
            if (codeInput) {
                codeInput.focus();
            }
            return;
        }

        isFormSubmitting = true;
        const submitBtn = btnSaveProduct || document.querySelector('#add-product-form button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
        }

        try {
            let saved = null;

            // Retain current ID if in Edit mode, otherwise generate a new unique ID
            const productId = editingProductId || `prod-${Date.now()}`;

            // Both images upload at once. They were awaited one after the other, so a
            // product with a sheet and a panorama waited for the sum of two uploads when
            // they have no dependency on each other.
            const existing = editingProductId
                ? getRealTimeProducts().find(p => p.id === editingProductId)
                : null;

            const fullsheetTask = (async () => {
                if (tempFullsheetDataUrl) {
                    return tempFullsheetDataUrl.startsWith('data:')
                        ? persistAsset(productId, 'fullsheet', tempFullsheetDataUrl, `fullsheet-${slug}.jpg`)
                        : tempFullsheetDataUrl;
                }
                return existing ? existing.fullsheetUrl : null;
            })();

            const threeDTask = (async () => {
                if (tempThreeDDataUrl) {
                    return tempThreeDDataUrl.startsWith('data:')
                        ? persistAsset(productId, 'threeD', tempThreeDDataUrl, `panorama-3d-${slug}.jpg`)
                        : tempThreeDDataUrl;
                }
                return existing ? existing.threeDDataUrl : null;
            })();

            const [finalFullsheetUrl, finalThreeDDataUrl] =
                await Promise.all([fullsheetTask, threeDTask]);

            const newProduct = {
                id: productId,
                code: rawCode,
                name: name || '',
                category: category,
                slug: slug,
                factoryCode: factoryCode,
                pitch: tempHotspotsList.length > 0 ? tempHotspotsList[0].pitch : 23,
                yaw: tempHotspotsList.length > 0 ? tempHotspotsList[0].yaw : 0,
                fullsheet: !!finalFullsheetUrl,
                fullsheetUrl: finalFullsheetUrl,
                threeD: !!finalThreeDDataUrl,
                threeDUrl: `/${(category || 'laminates').toLowerCase().trim().replace(/\s+/g, '-')}/${(rawCode || slug || 'product').toLowerCase().trim().replace(/#/g, '').replace(/\s+/g, '-')}`,
                threeDDataUrl: finalThreeDDataUrl,
                hotspots: tempHotspotsList,
                description: 'Registered product asset with hotspot placement'
            };

            // 1. Instant optimistic save & UI update (Safe: No Base64 in LocalStorage)
            if (window.ProductCatalog && typeof window.ProductCatalog.addProduct === 'function') {
                const list = editingProductId
                    ? window.ProductCatalog.updateProduct(editingProductId, newProduct)
                    : window.ProductCatalog.addProduct(newProduct);
                saved = list && list.saved;
            } else {
                const list = getRealTimeProducts();
                if (editingProductId) {
                    const index = list.findIndex(p => p.id === editingProductId);
                    if (index !== -1) list[index] = newProduct;
                } else {
                    list.unshift(newProduct);
                }
                saveRealTimeProducts(list);
            }

            editingProductId = null;

            // saveProducts already posted the catalogue; wait for that request rather
            // than sending the whole list a second time.
            try {
                if (saved && typeof saved.then === 'function') await saved;
            } catch (err) {
                console.warn('Catalogue sync deferred:', err);
            }

            renderCatalog();
            closeAddModal();
            showToast(`Product ${rawCode} saved successfully!`, 'success');

            // 2. Trigger background upload sync immediately if online
            if (window.ProductCatalog && typeof window.ProductCatalog.processSyncQueue === 'function') {
                window.ProductCatalog.processSyncQueue();
            }
        } catch (err) {
            console.error('Failed to save product:', err);
            showToast('Error saving product: ' + err.message, 'error');
        } finally {
            isFormSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        }
    });

    // ---- Search & Filter Listeners ----
    searchInput.addEventListener('input', (e) => {
        currentFilter.query = e.target.value;
        btnClearSearch.style.display = currentFilter.query ? 'flex' : 'none';
        renderCatalog();
    });

    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        currentFilter.query = '';
        btnClearSearch.style.display = 'none';
        quickPills.forEach(p => p.classList.remove('active'));
        renderCatalog();
    });

    quickPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            const code = e.currentTarget.getAttribute('data-code');
            searchInput.value = code;
            currentFilter.query = code;
            btnClearSearch.style.display = 'flex';
            quickPills.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderCatalog();
        });
    });

    // The catalogue engine renders from local storage first and fetches the server
    // copy in the background, announcing the result with 'catalogUpdated'. Nothing here
    // listened, so the table only ever showed whatever the browser already had: on a
    // device that had not opened the admin before, that was nothing at all. It went
    // unnoticed while a demo product was hardcoded as the empty-state fallback.
    window.addEventListener('catalogUpdated', () => {
        renderCatalog();
    });

    if (categorySelect) categorySelect.addEventListener('change', (e) => { currentFilter.category = e.target.value; renderCatalog(); });
    if (fullsheetSelect) fullsheetSelect.addEventListener('change', (e) => { currentFilter.fullsheet = e.target.value; renderCatalog(); });
    if (threeDSelect) threeDSelect.addEventListener('change', (e) => { currentFilter.threeD = e.target.value; renderCatalog(); });

    function resetAllFilters() {
        searchInput.value = '';
        currentFilter.query = '';
        currentFilter.category = 'ALL';
        currentFilter.fullsheet = 'ALL';
        currentFilter.threeD = 'ALL';
        if (categorySelect) categorySelect.value = 'ALL';
        if (fullsheetSelect) fullsheetSelect.value = 'ALL';
        if (threeDSelect) threeDSelect.value = 'ALL';
        btnClearSearch.style.display = 'none';
        quickPills.forEach(p => p.classList.remove('active'));
        renderCatalog();
        showToast('Filters reset', 'info');
    }

    if (btnResetFilters) btnResetFilters.addEventListener('click', resetAllFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

    // ---- Cross-tab sync ----
    window.addEventListener('catalogUpdated', () => { renderCatalog(); });

    // ---- URL param check ----
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam) {
        searchInput.value = codeParam;
        currentFilter.query = codeParam;
        if (btnClearSearch) btnClearSearch.style.display = 'flex';
    }

    // ---- Esc to close modals ----
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeQrModal();
            closeFullsheetModal();
            close3DPanoramaModal();
            closeAddModal();
        }
    });

    // ---- Initial render ----
    renderCatalog();

})();
