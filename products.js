/* ====================================================
   Product Catalog — Sarom-Inspired Real-Time Engine
   Renders both Table Grid (with borders) and Card View
   ==================================================== */

(function () {
    'use strict';

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
    const qrModal = document.getElementById('qr-modal');
    const qrModalClose = document.getElementById('qr-modal-close');
    const qrModalCode = document.getElementById('qr-modal-code');
    const qrModalName = document.getElementById('qr-modal-name');
    const qrModalCategory = document.getElementById('qr-modal-category');
    const qrRenderArea = document.getElementById('qr-code-canvas');
    const qrLinkInput = document.getElementById('qr-link-input');
    const btnCopyQrLink = document.getElementById('btn-copy-qr-link');
    const btnDownloadQr = document.getElementById('btn-download-qr');
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

        toast.innerHTML = `${iconSvg} <span>${message}</span>`;
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

        const uniqueCategories = new Set(products.map(p => p.category));
        if (statCategories) statCategories.textContent = uniqueCategories.size;
    }

    // ---- Filtering & Sorting ----
    function getFilteredProducts() {
        products = getRealTimeProducts();
        const query = currentFilter.query.trim().toLowerCase().replace(/^#/, '');

        return products.filter(item => {
            const codeClean = (item.code || '').toLowerCase().replace(/^#/, '');
            const nameLower = (item.name || '').toLowerCase();
            const matchesQuery = !query || codeClean.includes(query) || nameLower.includes(query);
            const matchesCategory = currentFilter.category === 'ALL' || item.category === currentFilter.category;
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
                <tr data-id="${product.id}">
                    <td>
                        <span class="grid-code-badge">${product.code}</span>
                    </td>
                    <td>
                        <span class="grid-product-name">${product.name || ''}</span>
                    </td>
                    <td>
                        <span class="grid-cat-pill">${product.category}</span>
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
                        <button class="grid-action-btn open-qr-btn" data-id="${product.id}" title="View QR Code">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"/>
                                <rect x="14" y="3" width="7" height="7"/>
                                <rect x="14" y="14" width="7" height="7"/>
                                <rect x="3" y="14" width="7" height="7"/>
                            </svg>
                            <span>QR Code</span>
                        </button>
                    </td>
                    <td class="text-right">
                        <div class="grid-action-cell" style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="grid-action-btn edit-product-btn" data-id="${product.id}" title="Edit Product" style="border-color: var(--stone); display: flex; align-items: center; gap: 4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
                                <span>Edit</span>
                            </button>
                            <button class="grid-action-btn grid-action-btn--danger delete-product-btn" data-id="${product.id}" title="Delete Product">
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
                <div class="product-card" data-id="${product.id}">
                    <div class="card-header">
                        <span class="card-code">${product.code}</span>
                        <span class="card-category">${product.category}</span>
                    </div>

                    <div class="card-name">${product.name || ''}</div>

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
                        <button class="card-action-btn edit-product-btn" data-id="${product.id}" title="Edit Product" style="border-color: var(--stone); flex: 1;">Edit</button>
                        <button class="card-action-btn open-qr-btn" data-id="${product.id}" style="padding: 8px 14px;">QR</button>
                        <button class="card-action-btn card-action-btn--danger delete-product-btn" data-id="${product.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ---- Event Listeners for Table & Card Actions ----
    function attachActionEventListeners() {
        document.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openEditProductModal(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.open-qr-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openQrModal(e.currentTarget.getAttribute('data-id'));
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

    // ---- QR Code SVG Fallback ----
    function generateFallbackSVGQR(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
        }
        const size = 21;
        let rects = [];
        function isFinder(r, c) {
            if (r < 7 && c < 7) return true;
            if (r < 7 && c >= size - 7) return true;
            if (r >= size - 7 && c < 7) return true;
            return false;
        }
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (isFinder(r, c)) continue;
                const seed = Math.sin(hash + r * size + c) * 10000;
                if ((seed - Math.floor(seed)) > 0.45) {
                    rects.push(`<rect x="${c * 8}" y="${r * 8}" width="8" height="8" fill="#14110f"/>`);
                }
            }
        }
        const finders = [{ x: 0, y: 0 }, { x: (size - 7) * 8, y: 0 }, { x: 0, y: (size - 7) * 8 }];
        finders.forEach(f => {
            rects.push(`<rect x="${f.x}" y="${f.y}" width="56" height="56" fill="#14110f"/>
                <rect x="${f.x + 8}" y="${f.y + 8}" width="40" height="40" fill="#f5f0e8"/>
                <rect x="${f.x + 16}" y="${f.y + 16}" width="24" height="24" fill="#14110f"/>`);
        });
        return `<svg viewBox="0 0 168 168" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:#f5f0e8; border-radius:8px; padding:8px;">${rects.join('')}</svg>`;
    }

    // ---- QR Modal ----
    function openQrModal(productId) {
        const list = getRealTimeProducts();
        const product = list.find(p => p.id === productId);
        if (!product) return;

        qrModalCode.textContent = product.code;
        qrModalName.textContent = product.name;
        qrModalCategory.textContent = product.category;

        const cleanCat = (product.category || 'laminates')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-');
        const cleanCode = (product.code || product.slug || product.id || 'product')
            .toLowerCase()
            .trim()
            .replace(/#/g, '')
            .replace(/\s+/g, '-');
        const shareUrl = `${window.location.origin}/${cleanCat}/${cleanCode}`;
        qrLinkInput.value = shareUrl;

        qrRenderArea.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrRenderArea, {
                text: shareUrl,
                width: 180,
                height: 180,
                colorDark: '#14110f',
                colorLight: '#f5f0e8',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            qrRenderArea.innerHTML = generateFallbackSVGQR(shareUrl);
        }

        qrLaunch360Btn.href = product.threeD
            ? `${cleanCat}/${cleanCode}`
            : '#';

        if (!product.threeD) {
            qrLaunch360Btn.style.opacity = '0.5';
            qrLaunch360Btn.title = '3D image not uploaded yet';
        } else {
            qrLaunch360Btn.style.opacity = '1';
            qrLaunch360Btn.title = 'Open 3D Virtual Tour';
        }

        qrModal.style.display = 'flex';
    }

    function closeQrModal() { qrModal.style.display = 'none'; }

    btnCopyQrLink.addEventListener('click', () => {
        qrLinkInput.select();
        navigator.clipboard.writeText(qrLinkInput.value).then(() => {
            showToast('Product link copied!', 'success');
        }).catch(() => {
            document.execCommand('copy');
            showToast('Product link copied!', 'success');
        });
    });

    btnDownloadQr.addEventListener('click', () => {
        const img = qrRenderArea.querySelector('img') || qrRenderArea.querySelector('canvas');
        if (img) {
            const link = document.createElement('a');
            link.download = `QR_${qrModalCode.textContent.replace('#', '')}.png`;
            link.href = img.src || img.toDataURL('image/png');
            link.click();
            showToast('Downloaded QR Code!', 'success');
        } else {
            showToast('QR Code ready', 'info');
        }
    });

    qrModalClose.addEventListener('click', closeQrModal);
    qrModal.addEventListener('click', (e) => { if (e.target === qrModal) closeQrModal(); });

    // ---- Fullsheet Modal ----
    async function openFullsheetModal(productId) {
        const list = getRealTimeProducts();
        const product = list.find(p => p.id === productId);
        if (!product || !product.fullsheet) return;

        fsModalTitle.textContent = `${product.code} - ${product.name}`;

        let fsSrc = 'src/Fullsheet/Fullsheet1.jpeg';
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

    function compressImageFile(file, maxWidth = 1920, quality = 0.85) {
        return new Promise((resolve) => {
            if (!file) {
                resolve(null);
                return;
            }
            if (file.type === 'image/svg+xml') {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
                return;
            }

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let w = img.width;
                let h = img.height;

                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            };
            img.src = url;
        });
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
        document.getElementById('form-category').value = product.category;
        document.getElementById('form-name').value = product.name || '';
        document.getElementById('form-slug').value = product.slug || '';

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
                tempFullsheetDataUrl = await compressImageFile(file, 1920, 0.82);
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
                tempThreeDDataUrl = await compressImageFile(file, 2880, 0.82);
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

    function initWizardViewer() {
        if (wizardViewerInstance && typeof wizardViewerInstance.destroy === 'function') {
            try { wizardViewerInstance.destroy(); } catch (e) { }
            wizardViewerInstance = null;
        }

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
                if (dx < 5 && dy < 5 && wizardViewerInstance) {
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
        if (formSlugInput) formSlugInput.value = '';
        showFormStep(1);
        addProductModal.style.display = 'flex';
    });

    function closeAddModal() {
        if (wizardViewerInstance && typeof wizardViewerInstance.destroy === 'function') {
            try { wizardViewerInstance.destroy(); } catch (e) { }
            wizardViewerInstance = null;
        }
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
            const category = categorySelect.value.trim();

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
        const category = document.getElementById('form-category').value;
        const name = document.getElementById('form-name').value.trim();
        const slug = document.getElementById('form-slug').value || `prod-${Date.now()}`;

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
            // Retain current ID if in Edit mode, otherwise generate a new unique ID
            const productId = editingProductId || `prod-${Date.now()}`;

            // Check if fullsheet / 3D data are base64 strings and store in IndexedDB
            let finalFullsheetUrl = null;
            let finalThreeDDataUrl = null;

            if (tempFullsheetDataUrl) {
                if (tempFullsheetDataUrl.startsWith('data:')) {
                    finalFullsheetUrl = await persistAsset(
                        productId, 'fullsheet', tempFullsheetDataUrl, `fullsheet-${slug}.jpg`
                    );
                } else {
                    finalFullsheetUrl = tempFullsheetDataUrl;
                }
            } else if (editingProductId) {
                const existing = getRealTimeProducts().find(p => p.id === editingProductId);
                if (existing) finalFullsheetUrl = existing.fullsheetUrl;
            }

            if (tempThreeDDataUrl) {
                if (tempThreeDDataUrl.startsWith('data:')) {
                    finalThreeDDataUrl = await persistAsset(
                        productId, 'threeD', tempThreeDDataUrl, `panorama-3d-${slug}.jpg`
                    );
                } else {
                    finalThreeDDataUrl = tempThreeDDataUrl;
                }
            } else if (editingProductId) {
                const existing = getRealTimeProducts().find(p => p.id === editingProductId);
                if (existing) finalThreeDDataUrl = existing.threeDDataUrl;
            }

            const newProduct = {
                id: productId,
                code: rawCode,
                name: name || '',
                category: category,
                slug: slug,
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
                if (editingProductId) {
                    window.ProductCatalog.updateProduct(editingProductId, newProduct);
                } else {
                    window.ProductCatalog.addProduct(newProduct);
                }
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

            // saveProducts fires its cloud POST without awaiting it, so a save could be cut
            // short by the re-render that follows. Push once more and wait for it.
            if (window.ProductCatalog && typeof window.ProductCatalog.syncToCloud === 'function') {
                try {
                    await window.ProductCatalog.syncToCloud(window.ProductCatalog.getProducts());
                } catch (err) {
                    console.warn('Catalogue sync deferred:', err);
                }
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
