/* ====================================================
   Shared Real-Time Product Catalog Data Engine
   Connects the 360° Panorama Viewer & Product Table
   Synced with Vercel KV & Vercel Blob Storage
   Resilient Offline-First Architecture (IndexedDB + Sync Queue)
   ==================================================== */

window.ProductCatalog = (function () {
    'use strict';

    const STORAGE_KEY = 'realtime_360_product_catalog_v2';
    const SYNC_QUEUE_KEY = 'realtime_360_sync_queue_v1';
    // Ids of deleted products, kept so a stale copy in another tab cannot resurrect them.
    const DELETED_KEY = 'realtime_360_deleted_ids_v1';
    const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
    const DB_NAME = 'ProductAssetsDB_v3';
    const STORE_NAME = 'assets';

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

    // ---- IndexedDB Helper for Large Binary Assets ----
    function getDB() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new Error('IndexedDB not supported'));
            }
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
            console.error('IndexedDB storage error:', e);
            return false;
        }
    }

    async function getAsset(key) {
        if (!key) return null;
        // Direct URL or local relative path returns directly
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
            console.error('IndexedDB retrieval error:', e);
            return null;
        }
    }

    async function deleteAsset(key) {
        if (!key) return false;
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
            console.error('IndexedDB deletion error:', e);
            return false;
        }
    }

    // ---- Clean Product for LocalStorage (Strip Heavy Base64) ----
    function getTombstones() {
        try {
            const raw = JSON.parse(localStorage.getItem(DELETED_KEY) || '{}');
            const cutoff = Date.now() - TOMBSTONE_TTL_MS;
            let pruned = false;
            for (const id of Object.keys(raw)) {
                if (!(raw[id] > cutoff)) { delete raw[id]; pruned = true; }
            }
            if (pruned) localStorage.setItem(DELETED_KEY, JSON.stringify(raw));
            return raw;
        } catch (e) {
            return {};
        }
    }

    function tombstone(id) {
        try {
            const all = getTombstones();
            all[id] = Date.now();
            localStorage.setItem(DELETED_KEY, JSON.stringify(all));
        } catch (e) {}
    }

    function isDeleted(id) {
        return Object.prototype.hasOwnProperty.call(getTombstones(), id);
    }

    function normalizeProduct(product) {
        if (!product) return product;
        const p = { ...product };
        if (typeof p.category === 'string') {
            const catLower = p.category.trim().toLowerCase();
            if (catLower === 'wooden' || catLower === 'syncro' || catLower === 'synchro') {
                p.category = 'Synchro';
            }
        }
        return p;
    }

    function sanitizeForStorage(product) {
        const p = normalizeProduct(product);
        // If fullsheetUrl contains large base64, offload to IndexedDB asynchronously
        if (typeof p.fullsheetUrl === 'string' && p.fullsheetUrl.startsWith('data:')) {
            const dbKey = `fullsheet-${p.id}`;
            storeAsset(dbKey, p.fullsheetUrl);
            p.fullsheetUrl = `db:${dbKey}`;
        }
        // If threeDDataUrl contains large base64, offload to IndexedDB asynchronously
        if (typeof p.threeDDataUrl === 'string' && p.threeDDataUrl.startsWith('data:')) {
            const dbKey = `threeD-${p.id}`;
            storeAsset(dbKey, p.threeDDataUrl);
            p.threeDDataUrl = `db:${dbKey}`;
        }
        return p;
    }

    // Synchronous local read for instant render
    function getProducts() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                let parsed = JSON.parse(stored);
                // A deleted product must not come back on the first render either, before
                // syncFromCloud has had a chance to reconcile.
                if (Array.isArray(parsed)) {
                    const graves = getTombstones();
                    parsed = parsed.filter(p => !Object.prototype.hasOwnProperty.call(graves, p.id));
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    let needsUpdate = false;
                    const cleaned = parsed.map(p => {
                        const norm = normalizeProduct(p);
                        if (norm.category !== p.category) needsUpdate = true;
                        if ((norm.fullsheetUrl && norm.fullsheetUrl.startsWith('data:')) ||
                            (norm.threeDDataUrl && norm.threeDDataUrl.startsWith('data:'))) {
                            needsUpdate = true;
                            return sanitizeForStorage(norm);
                        }
                        return norm;
                    });
                    if (needsUpdate) {
                        try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
                        } catch (e) {
                            console.warn('LocalStorage cleanup quota warning:', e);
                        }
                    }
                    return cleaned;
                }
            } catch (e) {
                console.error('Failed to parse local stored catalog:', e);
            }
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(REAL_WORKSPACE_PRODUCTS));
        } catch (e) {}
        return REAL_WORKSPACE_PRODUCTS;
    }

    // Background sync from Vercel KV or Blob
    async function syncFromCloud() {
        try {
            const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && Array.isArray(data.products) && data.products.length > 0) {
                    // Merge cloud products with any pending local uploads
                    const localProducts = getProducts();
                    const pendingQueue = getSyncQueue();

                    // If there are pending local items, preserve local db: pointers
                    const merged = data.products.map(cloudProd => {
                        const normCloud = normalizeProduct(cloudProd);
                        const localMatch = localProducts.find(lp => lp.id === normCloud.id);
                        if (localMatch) {
                            const hasPendingFs = pendingQueue.some(q => q.productId === normCloud.id && q.field === 'fullsheet');
                            const hasPending3D = pendingQueue.some(q => q.productId === normCloud.id && q.field === 'threeD');
                            return {
                                ...normCloud,
                                fullsheetUrl: hasPendingFs && localMatch.fullsheetUrl ? localMatch.fullsheetUrl : normCloud.fullsheetUrl,
                                threeDDataUrl: hasPending3D && localMatch.threeDDataUrl ? localMatch.threeDDataUrl : normCloud.threeDDataUrl
                            };
                        }
                        return normCloud;
                    });

                    // Preserve products created locally that the cloud has not seen yet -
                    // but never a product that was deleted. Without the tombstone check a
                    // stale copy in any other tab silently restores it and pushes it back.
                    localProducts.forEach(lp => {
                        if (!isDeleted(lp.id) && !merged.some(mp => mp.id === lp.id)) {
                            merged.unshift(lp);
                        }
                    });

                    // A deletion made while another device was offline still has to land.
                    const before = merged.length;
                    const kept = merged.filter(mp => !isDeleted(mp.id));
                    if (kept.length !== before) {
                        syncToCloud(kept);
                    }
                    merged.length = 0;
                    Array.prototype.push.apply(merged, kept);

                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                    } catch (e) {
                        console.warn('Quota warning while caching cloud products:', e);
                    }
                    window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: merged }));
                    return merged;
                }
            }
        } catch (err) {
            // Offline / server down mode fallback
        }
        return getProducts();
    }

    async function syncToCloud(productsList) {
        try {
            // Strip any internal local db: pointers before saving to cloud so cloud only has permanent URLs or null
            const cloudPayload = productsList.map(p => ({
                ...p,
                fullsheetUrl: p.fullsheetUrl && p.fullsheetUrl.startsWith('db:') ? null : p.fullsheetUrl,
                threeDDataUrl: p.threeDDataUrl && p.threeDDataUrl.startsWith('db:') ? null : p.threeDDataUrl
            }));

            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ products: cloudPayload })
            });
        } catch (err) {
            console.warn('Cloud catalog sync deferred (server unreachable):', err.message);
        }
    }

    function saveProducts(productsList) {
        const sanitized = productsList.map(sanitizeForStorage);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        } catch (e) {
            console.error('localStorage quota exceeded during saveProducts:', e);
        }
        window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: sanitized }));
        syncToCloud(sanitized);
    }

    function addProduct(productData) {
        const productsList = getProducts();
        productsList.unshift(normalizeProduct(productData));
        saveProducts(productsList);
        return productsList;
    }

    function updateProduct(id, updatedFields) {
        const productsList = getProducts();
        const index = productsList.findIndex(p => p.id === id);
        if (index !== -1) {
            productsList[index] = normalizeProduct({ ...productsList[index], ...updatedFields });
            saveProducts(productsList);
        }
        return productsList;
    }

    function deleteProduct(id) {
        tombstone(id);
        let productsList = getProducts();
        productsList = productsList.filter(p => p.id !== id);
        saveProducts(productsList);
        deleteAsset(`fullsheet-${id}`);
        deleteAsset(`threeD-${id}`);
        // Remove from pending sync queue if present
        const queue = getSyncQueue().filter(q => q.productId !== id);
        saveSyncQueue(queue);
        return productsList;
    }

    function resetToRealDefaults() {
        saveProducts(REAL_WORKSPACE_PRODUCTS);
        saveSyncQueue([]);
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
            console.warn('Vercel Blob upload call note (server might be down or offline):', err.message);
        }
        return null;
    }

    // ---- Offline Sync Queue Mechanism ----
    function getSyncQueue() {
        try {
            const raw = localStorage.getItem(SYNC_QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveSyncQueue(queue) {
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.warn('Could not save sync queue:', e);
        }
    }

    function enqueueSync(item) {
        const queue = getSyncQueue();
        // Remove existing queue item for same product and field to avoid duplicates
        const filtered = queue.filter(q => !(q.productId === item.productId && q.field === item.field));
        filtered.push({
            ...item,
            timestamp: Date.now()
        });
        saveSyncQueue(filtered);
    }

    let isProcessingQueue = false;

    async function processSyncQueue() {
        if (isProcessingQueue) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        const queue = getSyncQueue();
        if (!queue || queue.length === 0) return;

        isProcessingQueue = true;
        try {
            // Quick health check to see if server is online
            const ping = await fetch('/api/products?t=' + Date.now(), { method: 'GET', cache: 'no-store' }).catch(() => null);
            if (!ping || (!ping.ok && ping.status !== 304)) {
                // Server is down or unreachable, gracefully exit and try again later
                isProcessingQueue = false;
                return;
            }

            const remainingQueue = [];
            let catalogChanged = false;
            const currentProducts = getProducts();

            for (const item of queue) {
                try {
                    const rawAsset = await getAsset(item.dbKey);
                    if (!rawAsset || !rawAsset.startsWith('data:')) {
                        // Nothing left to upload for this entry. Say so rather than dropping
                        // it silently - a queue that empties itself with the images still
                        // missing is how the catalogue lost them without a trace before.
                        console.warn('Sync queue: no asset for', item.dbKey, '- entry discarded');
                        continue;
                    }

                    const cdnUrl = await uploadAssetToBlob(item.filename, rawAsset);
                    if (cdnUrl) {
                        const targetProd = currentProducts.find(p => p.id === item.productId);
                        if (targetProd) {
                            if (item.field === 'fullsheet') {
                                targetProd.fullsheetUrl = cdnUrl;
                            } else if (item.field === 'threeD') {
                                targetProd.threeDDataUrl = cdnUrl;
                            }
                            catalogChanged = true;
                        }
                        // Clean up heavy Base64 from local IndexedDB now that it has a permanent CDN URL
                        await deleteAsset(item.dbKey);
                    } else {
                        // Upload failed (e.g. server error), keep in queue for next cycle
                        remainingQueue.push(item);
                    }
                } catch (err) {
                    console.warn('Sync queue error for item:', item, err);
                    remainingQueue.push(item);
                }
            }

            saveSyncQueue(remainingQueue);

            if (catalogChanged) {
                saveProducts(currentProducts);
                window.dispatchEvent(new CustomEvent('catalogUpdated', { detail: currentProducts }));
                console.log('✅ Background sync successfully uploaded offline assets to Vercel Blob');
            }
        } catch (e) {
            console.warn('Sync queue execution paused:', e);
        } finally {
            isProcessingQueue = false;
        }
    }

    // Auto-sync triggers
    syncFromCloud().then(() => processSyncQueue());

    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            syncFromCloud();
            processSyncQueue();
        });

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    processSyncQueue();
                }
            });
        }

        // Periodic background poll every 40 seconds
        setInterval(() => {
            processSyncQueue();
        }, 40000);
    }

    return {
        getProducts,
        syncFromCloud,
        syncToCloud,
        saveProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        resetToRealDefaults,
        uploadAssetToBlob,
        storeAsset,
        getAsset,
        deleteAsset,
        enqueueSync,
        processSyncQueue,
        getSyncQueue
    };
})();
