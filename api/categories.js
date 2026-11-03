/**
 * Vercel's /api/categories - same contract as categories-api.php on Hostinger, stored in
 * Vercel Blob instead of asiatic-data.
 *
 * GET                           -> { success, categories: [...] }
 * POST { category: {...} }      -> create or update one
 * POST { action: 'delete', id } -> remove one
 */
import { storageReady, readJsonBlob, writeJsonBlob, requireAuth } from './_lib/auth.js';

const CATEGORIES_PREFIX = 'catalog/categories';

/** The eight categories baked into the site, slug => name. Mirrors products-data.js. */
const BUILT_IN_CATEGORIES = {
    '45-degree': '45 Degree',
    'synchro': 'Synchro',
    'digital': 'Digital',
    'stone': 'Stone',
    'laminates': 'Laminates',
    'louvers': 'Louvers',
    'edge-bands': 'Edge Bands',
    'texture': 'Texture'
};

function categorySlug(name) {
    return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Thumbnails on this deployment are Blob URLs; Hostinger's are /uploads/ paths.
function isOwnUpload(url) {
    return /^\/uploads\/[A-Za-z0-9._-]+$/.test(url) ||
        /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[A-Za-z0-9._\/-]+$/.test(url);
}

async function readCategories() {
    if (!storageReady()) return [];
    const data = await readJsonBlob(CATEGORIES_PREFIX).catch(() => null);
    return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (req.method === 'GET') {
            return res.status(200).json({ success: true, categories: await readCategories() });
        }
        if (req.method !== 'POST' && req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        if (!(await requireAuth(req, res))) return;

        const input = req.body;
        if (!input || typeof input !== 'object') return res.status(400).json({ error: 'Invalid JSON input' });

        let list = await readCategories();
        const now = Math.floor(Date.now() / 1000);

        if (input.action === 'delete' && input.id) {
            list = list.filter(c => !c.id || c.id !== input.id);
            await writeJsonBlob(CATEGORIES_PREFIX, list);
            return res.status(200).json({ success: true, categories: list });
        }

        const c = input.category;
        if (!c || typeof c !== 'object') return res.status(400).json({ error: 'Missing category' });

        const label = String(c.label || '').trim().slice(0, 60);
        const blurb = String(c.blurb || '').trim().slice(0, 300);
        const id = c.id ? String(c.id) : '';
        let existingIndex = list.findIndex(e => id !== '' && e.id === id);
        let existing = existingIndex >= 0 ? list[existingIndex] : null;

        let thumb = c.thumbnailUrl;
        if (thumb === '' || thumb === null || thumb === undefined) {
            thumb = null;
        } else if (typeof thumb !== 'string' || (!isOwnUpload(thumb) && !(existing && existing.thumbnailUrl === thumb))) {
            return res.status(400).json({ error: 'Thumbnail must be an uploaded image' });
        }

        let record;
        if (c.builtInSlug !== undefined) {
            const slug = String(c.builtInSlug);
            if (!BUILT_IN_CATEGORIES[slug]) return res.status(400).json({ error: 'Unknown built-in category' });
            const bid = 'builtin-' + slug;
            existingIndex = list.findIndex(e => e.id === bid);
            record = {
                id: bid,
                builtIn: true,
                name: BUILT_IN_CATEGORIES[slug],
                slug,
                label: label === BUILT_IN_CATEGORIES[slug] ? '' : label,
                thumbnailUrl: thumb,
                blurb,
                updatedAt: now
            };
        } else if (existing) {
            if (existing.builtIn) return res.status(400).json({ error: 'Edit a built-in category by its slug' });
            record = {
                ...existing,
                label: label === (existing.name || '') ? '' : label,
                thumbnailUrl: thumb,
                blurb,
                updatedAt: now
            };
        } else {
            const name = String(c.name || '').trim().slice(0, 60);
            if (!name) return res.status(400).json({ error: 'Category name is required' });
            const slug = categorySlug(name);
            if (!slug) return res.status(400).json({ error: 'Category name must contain a letter or number' });
            const taken = !!BUILT_IN_CATEGORIES[slug] || list.some(e => !e.builtIn && e.slug === slug);
            if (taken) return res.status(409).json({ error: 'A category with that name already exists' });
            record = { id: 'cat-' + slug, name, slug, label: '', thumbnailUrl: thumb, blurb, createdAt: now };
        }

        if (existingIndex >= 0) list[existingIndex] = record;
        else list.push(record);

        await writeJsonBlob(CATEGORIES_PREFIX, list);
        return res.status(200).json({ success: true, categories: list, category: record });
    } catch (err) {
        console.error('API Error in /api/categories:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
