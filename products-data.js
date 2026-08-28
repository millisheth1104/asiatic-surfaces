/* ====================================================
   Shared Real-Time Product Catalog Data Engine
   Connects the 360° Panorama Viewer & Product Table
   Synced with Vercel KV & Vercel Blob Storage
   ==================================================== */

window.ProductCatalog = (function () {
    'use strict';

    const STORAGE_KEY = 'realtime_360_product_catalog_v2';

    const REAL_WORKSPACE_PRODUCTS = [
        {
            id: 'prod-4006',
            code: '#4006',
            slug: '4006',
            name: 'Bedroom Interior Laminate #4006',
            category: 'Laminates',
            pitch: 23,
            yaw: 0,
            fullsheet: true,
            fullsheetUrl: 'src/Fullsheet/Fullsheet1.jpeg',
            threeD: false,
            threeDUrl: null,
            description: 'Featured premium laminate finish in the 360° virtual bedroom tour.'
        }
    ];

    // Synchronous local read for instant render
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(REAL_WORKSPACE_PRODUCTS));
        return REAL_WORKSPACE_PRODUCTS;
    }

    // Background sync from Vercel KV
    async function syncFromCloud() {
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.products));
                    window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: data.products }));
                    return data.products;
                }
            }
        } catch (err) {
            // Local / Offline mode fallback
        }
        return getProducts();
    }

    // Auto-sync in background on init
    syncFromCloud();

    async function syncToCloud(productsList) {
        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: productsList })
            });
        } catch (err) {
            console.warn('Could not sync catalog to cloud KV:', err);
        }
    }

    function saveProducts(productsList) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(productsList));
        window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: productsList }));
        syncToCloud(productsList);
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
        deleteAsset(`fullsheet-${id}`);
        deleteAsset(`threeD-${id}`);
        return productsList;
    }

    function resetToRealDefaults() {
        saveProducts(REAL_WORKSPACE_PRODUCTS);
        return REAL_WORKSPACE_PRODUCTS;
    }

    // ---- Upload image asset to Vercel Blob (Permanent CDN URL) ----
    async function uploadAssetToBlob(filename, base64Data) {
        if (!base64Data) return null;
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, base64Data })
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.url) {
                    return data.url; // e.g. https://...public.blob.vercel-storage.com/...
                }
            }
        } catch (err) {
            console.warn('Vercel Blob upload failed, falling back to local storage:', err);
        }
        return null;
    }

    // ---- IndexedDB Fallback for Large Assets Storage ----
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
        // If it is already a direct URL (HTTP or Blob CDN or file path), return directly
        if (typeof key === 'string' && (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('data:') || key.startsWith('src/'))) {
            return key;
        }
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
        syncFromCloud,
        saveProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        resetToRealDefaults,
        uploadAssetToBlob,
        storeAsset,
        getAsset,
        deleteAsset
    };
})();
