(async function() {
    'use strict';

    // ---- DOM Elements ----
    const headerCategoryName = document.getElementById('header-category-name');
    const categoryEyebrow = document.getElementById('category-eyebrow');
    const categoryMainTitle = document.getElementById('category-main-title');
    const productsGrid = document.getElementById('category-products-grid');
    const emptyState = document.getElementById('category-empty-state');

    // Modals
    const fsModal = document.getElementById('fullsheet-modal');
    const fsModalTitle = document.getElementById('fs-modal-title');
    const fsModalImg = document.getElementById('fs-modal-img');
    const fsModalClose = document.getElementById('fs-modal-close');
    const fsViewport = document.getElementById('fs-image-viewport');
    const fsZoomTag = document.getElementById('fs-zoom-tag');
    const fsBtnZoomIn = document.getElementById('fs-btn-zoom-in');
    const fsBtnZoomOut = document.getElementById('fs-btn-zoom-out');
    const fsBtnReset = document.getElementById('fs-btn-reset');

    const qrModal = document.getElementById('qr-modal');
    const qrModalClose = document.getElementById('qr-modal-close');
    const qrRenderArea = document.getElementById('qr-code-graphic');
    const qrModalTitle = document.getElementById('qr-modal-title');

    // Fullsheet Zoom State
    let fsZoom = 1;
    let fsPanX = 0;
    let fsPanY = 0;
    let isDraggingFs = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // ---- Parse URL Parameter ----
    const urlParams = new URLSearchParams(window.location.search);
    const categoryQuery = urlParams.get('type') || 'Fabric';

    // Format category string (e.g. fabric -> Fabric, edgebands -> Edge Bands)
    const CATEGORIES_NORMALIZED = {
        'fabric': 'Fabric',
        'texture': 'Texture',
        'wooden': 'Wooden',
        'thermolam': 'Thermolam',
        'edgebands': 'Edge Bands',
        'laminates': 'Laminates',
        'louvers': 'Louvers',
        'charcoal': 'Charcoal Panels'
    };

    const normalizedKey = categoryQuery.toLowerCase().replace(/\s/g, '');
    const activeCategory = CATEGORIES_NORMALIZED[normalizedKey] || categoryQuery;

    // Update Titles
    if (headerCategoryName) headerCategoryName.textContent = activeCategory;
    if (categoryEyebrow) categoryEyebrow.textContent = `${activeCategory} Collection`;
    if (categoryMainTitle) categoryMainTitle.textContent = `${activeCategory} Surfaces`;

    // ---- Fetch Products Data ----
    let productsList = [];
    if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
        productsList = window.ProductCatalog.getProducts();
    } else {
        try {
            const raw = localStorage.getItem('realtime_products_db_v3');
            if (raw) {
                productsList = JSON.parse(raw);
            } else {
                const fallbackRaw = localStorage.getItem('realtime_360_product_catalog_v2');
                if (fallbackRaw) productsList = JSON.parse(fallbackRaw);
            }
        } catch (e) { }
    }

    // Filter by Category
    const filteredProducts = productsList.filter(p => p.category && p.category.toLowerCase() === activeCategory.toLowerCase());

    async function renderCategoryCards() {
        if (filteredProducts.length === 0) {
            if (productsGrid) productsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (productsGrid) {
            productsGrid.style.display = 'flex';
            productsGrid.innerHTML = '';
        }
        if (emptyState) emptyState.style.display = 'none';

        const getColCount = () => {
            const w = window.innerWidth;
            if (w > 1300) return 5;
            if (w > 1000) return 4;
            if (w > 700) return 3;
            if (w > 480) return 2;
            return 1;
        };

        const colCount = getColCount();
        const cols = [];
        for (let c = 0; c < colCount; c++) {
            const colEl = document.createElement('div');
            colEl.className = 'category-col';
            productsGrid.appendChild(colEl);
            cols.push(colEl);
        }

        for (let i = 0; i < filteredProducts.length; i++) {
            const p = filteredProducts[i];
            const card = document.createElement('div');
            card.className = 'masonry-item';
            card.setAttribute('data-id', p.id);

            // Category texture fallback map
            const CAT_TEXTURE_MAP = {
                'fabric': 'assets/textures/fabric.webp',
                'wooden': 'assets/textures/wooden.webp',
                'laminates': 'assets/textures/laminates.webp',
                'texture': 'assets/textures/texture.webp',
                'thermolam': 'assets/textures/thermolam.webp',
                'edge bands': 'assets/textures/edgebands.webp',
                'edgebands': 'assets/textures/edgebands.webp',
                'louvers': 'assets/textures/louvers.webp',
                'charcoal panels': 'assets/textures/charcoal.webp',
                'charcoal': 'assets/textures/charcoal.webp'
            };
            const catKey = (p.category || 'laminates').toLowerCase().trim();
            const fallbackTexture = CAT_TEXTURE_MAP[catKey] || 'assets/textures/laminates.webp';

            // Fetch fullsheet image
            let imgUrl = fallbackTexture;
            if (p.fullsheetUrl) {
                if (p.fullsheetUrl.startsWith('db:')) {
                    const dbKey = p.fullsheetUrl.replace('db:', '');
                    if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                        const storedData = await window.ProductCatalog.getAsset(dbKey);
                        if (storedData) imgUrl = storedData;
                    }
                } else if (p.fullsheetUrl.startsWith('http://') || p.fullsheetUrl.startsWith('https://') || p.fullsheetUrl.startsWith('data:')) {
                    imgUrl = p.fullsheetUrl;
                } else if (p.fullsheetUrl.startsWith('src/') || p.fullsheetUrl.startsWith('assets/')) {
                    imgUrl = p.fullsheetUrl;
                } else if (p.fullsheetUrl.startsWith('/')) {
                    imgUrl = p.fullsheetUrl.substring(1);
                } else {
                    imgUrl = p.fullsheetUrl;
                }
            }

            const slug = p.slug || p.code.replace(/#/g, '').trim();
            const tourUrl = `tour.html?code=${encodeURIComponent(slug)}`;

            card.innerHTML = `
                <a href="${tourUrl}" class="masonry-img-card" title="Click to view 3D virtual tour">
                    <img src="${imgUrl}" alt="${p.name}" loading="lazy" onerror="if(!this.dataset.fallbackTried){this.dataset.fallbackTried='1';this.src='${fallbackTexture}';}">
                </a>
                <div class="masonry-caption">
                    <span class="masonry-code">${p.code}</span>
                    <span class="masonry-name">${p.name}</span>
                </div>
            `;
            cols[i % colCount].appendChild(card);
        }

        attachActionEventListeners();
    }

    renderCategoryCards();

    // Debounced window resize handler to rebuild columns dynamically
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderCategoryCards, 150);
    });

    // ---- Event Handlers ----
    function attachActionEventListeners() {
        document.querySelectorAll('.view-fs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openFullsheetModal(e.currentTarget.getAttribute('data-id'));
            });
        });

        document.querySelectorAll('.open-qr-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openQrModal(e.currentTarget.getAttribute('data-id'));
            });
        });
    }

    // ---- Fullsheet Zoom / Transform Logic ----
    async function openFullsheetModal(productId) {
        const product = filteredProducts.find(p => p.id === productId);
        if (!product || !product.fullsheet) return;

        if (fsModalTitle) fsModalTitle.textContent = `${product.code} - ${product.name}`;

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

        if (fsModalImg) fsModalImg.src = fsSrc;

        fsZoom = 1; fsPanX = 0; fsPanY = 0;
        updateFsTransform();
        if (fsModal) fsModal.style.display = 'flex';
    }

    function closeFullsheetModal() { if (fsModal) fsModal.style.display = 'none'; }

    function updateFsTransform() {
        if (fsModalImg) {
            fsModalImg.style.transform = `translate(${fsPanX}px, ${fsPanY}px) scale(${fsZoom})`;
        }
        if (fsZoomTag) fsZoomTag.textContent = `${Math.round(fsZoom * 100)}%`;
    }

    if (fsBtnZoomIn) fsBtnZoomIn.addEventListener('click', () => { fsZoom = Math.min(fsZoom + 0.25, 4); updateFsTransform(); });
    if (fsBtnZoomOut) fsBtnZoomOut.addEventListener('click', () => { fsZoom = Math.max(fsZoom - 0.25, 0.5); updateFsTransform(); });
    if (fsBtnReset) fsBtnReset.addEventListener('click', () => { fsZoom = 1; fsPanX = 0; fsPanY = 0; updateFsTransform(); });

    if (fsViewport) {
        fsViewport.addEventListener('mousedown', (e) => {
            if (fsZoom <= 1) return;
            isDraggingFs = true; dragStartX = e.clientX - fsPanX; dragStartY = e.clientY - fsPanY;
        });
    }
    window.addEventListener('mousemove', (e) => {
        if (!isDraggingFs) return;
        fsPanX = e.clientX - dragStartX; fsPanY = e.clientY - dragStartY; updateFsTransform();
    });
    window.addEventListener('mouseup', () => { isDraggingFs = false; });

    if (fsModalClose) fsModalClose.addEventListener('click', closeFullsheetModal);
    if (fsModal) {
        fsModal.addEventListener('click', (e) => { if (e.target === fsModal) closeFullsheetModal(); });
    }

    // ---- QR Code Generator ----
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

    function openQrModal(productId) {
        const product = filteredProducts.find(p => p.id === productId);
        if (!product) return;

        if (qrModalTitle) qrModalTitle.textContent = `Tour QR Code (${product.code})`;

        const urlSlug = product.slug || product.code.replace(/#/g, '');
        const shareUrl = `${window.location.origin}/tour/${urlSlug}`;

        if (qrRenderArea) {
            qrRenderArea.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrRenderArea, {
                    text: shareUrl,
                    width: 160,
                    height: 160,
                    colorDark: '#1c1815',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                qrRenderArea.innerHTML = generateFallbackSVGQR(shareUrl);
            }
        }

        if (qrModal) qrModal.style.display = 'flex';
    }

    function closeQrModal() { if (qrModal) qrModal.style.display = 'none'; }

    if (qrModalClose) qrModalClose.addEventListener('click', closeQrModal);
    if (qrModal) {
        qrModal.addEventListener('click', (e) => { if (e.target === qrModal) closeQrModal(); });
    }

    // Esc key support to close modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFullsheetModal();
            closeQrModal();
        }
    });

    // Real-time multi-device cloud synchronization listener
    window.addEventListener('catalogUpdated', () => {
        renderCategoryCards(currentCategory);
    });

    // Trigger background cloud sync on page load
    if (window.ProductCatalog && typeof window.ProductCatalog.syncFromCloud === 'function') {
        window.ProductCatalog.syncFromCloud().then(() => {
            renderCategoryCards(currentCategory);
        });
    }

})();

