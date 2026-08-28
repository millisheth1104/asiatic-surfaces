import { put, list } from '@vercel/blob';

const DEFAULT_PRODUCTS = [
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

const BLOB_CATALOG_PATH = 'catalog/products.json';
let memoryCache = null;

// Read products from Upstash Redis / Vercel KV / Vercel Blob
async function loadProductsFromCloud() {
    // 1. Try Upstash Redis / Vercel KV REST
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (kvUrl && kvToken) {
        try {
            const cleanUrl = kvUrl.replace(/\/$/, '');
            const res = await fetch(`${cleanUrl}/get/products_list_v1`, {
                headers: { Authorization: `Bearer ${kvToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.result) {
                    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        memoryCache = parsed;
                        return parsed;
                    }
                }
            }
        } catch (err) {
            console.warn('KV/Upstash read note:', err.message);
        }
    }

    // 2. Try Vercel Blob
    try {
        const { blobs } = await list({
            prefix: BLOB_CATALOG_PATH,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        const targetBlob = blobs.find(b => b.pathname === BLOB_CATALOG_PATH) || blobs[0];
        if (targetBlob && targetBlob.url) {
            const res = await fetch(`${targetBlob.url}?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    memoryCache = data;
                    return data;
                }
            }
        }
    } catch (err) {
        console.warn('Blob read note:', err.message);
    }

    return memoryCache || DEFAULT_PRODUCTS;
}

// Write products to Upstash Redis, Vercel KV, and Vercel Blob
async function saveProductsToCloud(products) {
    memoryCache = products;
    const payload = JSON.stringify(products, null, 2);

    // 1. Save to Upstash Redis / Vercel KV
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (kvUrl && kvToken) {
        try {
            const cleanUrl = kvUrl.replace(/\/$/, '');
            await fetch(`${cleanUrl}/set/products_list_v1`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${kvToken}`,
                    'Content-Type': 'application/json'
                },
                body: payload
            });
        } catch (err) {
            console.warn('KV/Upstash write note:', err.message);
        }
    }

    // 2. Save to Vercel Blob
    try {
        await put(BLOB_CATALOG_PATH, payload, {
            access: 'public',
            addRandomSuffix: false,
            contentType: 'application/json',
            token: process.env.BLOB_READ_WRITE_TOKEN
        });
    } catch (err) {
        console.warn('Blob write note:', err.message);
    }

    return true;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const products = await loadProductsFromCloud();
            return res.status(200).json({ success: true, products: products || DEFAULT_PRODUCTS });
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            const body = req.body || {};
            let currentProducts = await loadProductsFromCloud();
            if (!Array.isArray(currentProducts) || currentProducts.length === 0) {
                currentProducts = [...DEFAULT_PRODUCTS];
            }

            if (Array.isArray(body.products)) {
                currentProducts = body.products;
            } else if (body.action === 'save' || body.product) {
                const p = body.product;
                if (!p || !p.id) {
                    return res.status(400).json({ error: 'Product payload must include an id' });
                }
                const idx = currentProducts.findIndex(item => item.id === p.id);
                if (idx >= 0) {
                    currentProducts[idx] = { ...currentProducts[idx], ...p };
                } else {
                    currentProducts.unshift(p);
                }
            } else if (body.action === 'delete' && body.id) {
                currentProducts = currentProducts.filter(item => item.id !== body.id);
            }

            await saveProductsToCloud(currentProducts);
            return res.status(200).json({ success: true, products: currentProducts });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing product ID' });

            let currentProducts = await loadProductsFromCloud();
            if (Array.isArray(currentProducts)) {
                currentProducts = currentProducts.filter(p => p.id !== id);
                await saveProductsToCloud(currentProducts);
            }

            return res.status(200).json({ success: true, products: currentProducts });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (globalErr) {
        console.error('API Error in /api/products:', globalErr);
        return res.status(500).json({ error: 'Internal Server Error', details: globalErr.message });
    }
}
