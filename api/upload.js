import { put } from '@vercel/blob';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '25mb'
        }
    }
};

export default async function handler(req, res) {
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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { filename, base64Data, contentType } = req.body || {};

        if (!base64Data) {
            return res.status(400).json({ error: 'Missing base64Data in upload request body' });
        }

        // Clean data URL prefix if present (e.g. data:image/jpeg;base64,...)
        let rawBase64 = base64Data;
        let mimeType = contentType || 'image/jpeg';

        if (base64Data.includes(';base64,')) {
            const parts = base64Data.split(';base64,');
            mimeType = parts[0].replace('data:', '');
            rawBase64 = parts[1];
        }

        const buffer = Buffer.from(rawBase64, 'base64');
        const cleanName = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : `asset-${Date.now()}.jpg`;
        const blobPath = `products/${Date.now()}-${cleanName}`;

        const blob = await put(blobPath, buffer, {
            access: 'public',
            contentType: mimeType,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        return res.status(200).json({
            success: true,
            url: blob.url,
            pathname: blob.pathname
        });
    } catch (err) {
        console.error('Vercel Blob upload failed:', err);
        return res.status(500).json({
            error: 'Failed to upload to Vercel Blob',
            details: err.message
        });
    }
}
