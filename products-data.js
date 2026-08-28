/* ====================================================
   Shared Real-Time Product Catalog Data Engine
   Connects the 360° Panorama Viewer & Product Table
   ==================================================== */

window.ProductCatalog = (function () {
    'use strict';

    const STORAGE_KEY = 'realtime_360_product_catalog_v2';

    // Real product assets existing in the workspace:
    // 1. #4006 - Bedroom Interior Laminate (Featured hotspot at pitch: 23, yaw: 0 in 360img.jpeg & Fullsheet1.jpeg)
    const REAL_WORKSPACE_PRODUCTS = [
        {
            id: 'prod-4006',
            code: '#4006',
            slug: '4006',
            name: 'Bedroom Interior Laminate #4006',
            category: 'Laminates',
            pitch: 23,
            yaw: 0,
            fullsheet: true, // File exists: src/Fullsheet/Fullsheet1.jpeg
            fullsheetUrl: 'src/Fullsheet/Fullsheet1.jpeg',
            threeD: true,     // File exists: src/360img.jpeg
            threeDUrl: 'tour/4006',
            description: 'Featured premium laminate finish in the 360° virtual bedroom tour.'
        }
    ];

    // Load products from localStorage or initialize with real workspace product
    function getProducts() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.error('Failed to parse local stored catalog', e);
            }
        }
        // Save initial real workspace product
        localStorage.setItem(STORAGE_KEY, JSON.stringify(REAL_WORKSPACE_PRODUCTS));
        return REAL_WORKSPACE_PRODUCTS;
    }

    function saveProducts(productsList) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(productsList));
        // Broadcast custom event for cross-component / multi-tab synchronization
        window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: productsList }));
    }

    function addProduct(productData) {
        const productsList = getProducts();
        productsList.unshift(productData);
        saveProducts(productsList);
        return productsList;
    }

    function updateProduct(id, updatedFields) {
        const productsList = getProducts();
        const index = productsList.findIndex(p => p.id === id);
        if (index !== -1) {
            productsList[index] = { ...productsList[index], ...updatedFields };
            saveProducts(productsList);
        }
        return productsList;
    }

    function deleteProduct(id) {
        let productsList = getProducts();
        productsList = productsList.filter(p => p.id !== id);
        saveProducts(productsList);
        // Clean up high-resolution IndexedDB media assets if present
        deleteAsset(`fullsheet-${id}`);
        deleteAsset(`threeD-${id}`);
        return productsList;
    }

    function resetToRealDefaults() {
        saveProducts(REAL_WORKSPACE_PRODUCTS);
        return REAL_WORKSPACE_PRODUCTS;
    }

    // ---- IndexedDB Configuration for Large Assets Storage ----
    const DB_NAME = 'ProductAssetsDB_v3';
    const STORE_NAME = 'assets';

    function getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function storeAsset(key, dataUrl) {
        if (!dataUrl) return false;
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(dataUrl, key);
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            console.error('IndexedDB storage error', e);
            return false;
        }
    }

    async function getAsset(key) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch (e) {
            console.error('IndexedDB retrieval error', e);
            return null;
        }
    }

    async function deleteAsset(key) {
        try {
            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(key);
            return new Promise((resolve) => {
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            console.error('IndexedDB deletion error', e);
            return false;
        }
    }

    return {
        getProducts,
        saveProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        resetToRealDefaults,
        storeAsset,
        getAsset,
        deleteAsset
    };
})();
