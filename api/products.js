import { kv } from '@vercel/kv';

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

const KV_KEY = 'products_list_v1';

export default async function handler(req, res) {
    // Set CORS headers so API works smoothly across all environments
    res.setHeader('Access-Control-Allow-Credentials', true);
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
            let products = null;
            try {
                products = await kv.get(KV_KEY);
            } catch (err) {
                console.warn('Vercel KV fetch failed, checking fallback:', err.message);
            }

            if (!products || !Array.isArray(products) || products.length === 0) {
                products = DEFAULT_PRODUCTS;
            }

            return res.status(200).json({ success: true, products });
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            const body = req.body || {};
            let currentProducts = [];

            try {
                const stored = await kv.get(KV_KEY);
                if (Array.isArray(stored)) currentProducts = stored;
            } catch (e) { }

            if (currentProducts.length === 0) {
                currentProducts = [...DEFAULT_PRODUCTS];
            }

            // Case 1: Bulk replace or full list provided
            if (Array.isArray(body.products)) {
                currentProducts = body.products;
            } 
            // Case 2: Single product save / update
            else if (body.action === 'save' || body.product) {
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
            } 
            // Case 3: Delete product
            else if (body.action === 'delete' && body.id) {
                currentProducts = currentProducts.filter(item => item.id !== body.id);
            }

            try {
                await kv.set(KV_KEY, currentProducts);
            } catch (err) {
                console.error('Vercel KV save failed:', err);
                return res.status(500).json({ error: 'Failed to write to Vercel KV', details: err.message });
            }

            return res.status(200).json({ success: true, products: currentProducts });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing product ID' });

            let currentProducts = [];
            try {
                const stored = await kv.get(KV_KEY);
                if (Array.isArray(stored)) currentProducts = stored;
            } catch (e) { }

            currentProducts = currentProducts.filter(p => p.id !== id);
            try {
                await kv.set(KV_KEY, currentProducts);
            } catch (err) { }

            return res.status(200).json({ success: true, products: currentProducts });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (globalErr) {
        console.error('API Error in /api/products:', globalErr);
        return res.status(500).json({ error: 'Internal Server Error', details: globalErr.message });
    }
}
