import { put } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { requireAuth, isLoggedIn } from './_lib/auth.js';

// Vercel refuses any function request body over 4.5 MB, so a panorama (~6-8 MB as JPEG,
// more as base64) can never arrive here as data. Large files go browser -> Blob directly:
// this route only hands out a short-lived upload token (the "blob.generate-client-token"
// request from @vercel/blob/client). Small files may still be posted as base64.
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4.5mb'
        }
    }
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;   // same ceiling as Hostinger's upload-api.php

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};

    // Client upload handshake. The completion callback comes from Vercel's servers with
    // no cookie; handleUpload verifies that one by its signature instead.
    if (body.type === 'blob.generate-client-token' || body.type === 'blob.upload-completed') {
        try {
            const result = await handleUpload({
                body,
                request: req,
                onBeforeGenerateToken: async () => {
                    if (!(await isLoggedIn(req))) throw new Error('Sign in required');
                    return {
                        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
                        maximumSizeInBytes: MAX_UPLOAD_BYTES,
                        addRandomSuffix: true
                    };
                }
            });
            return res.status(200).json(result);
        } catch (err) {
            const authFail = /sign in/i.test(err.message);
            return res.status(authFail ? 401 : 400).json({ error: err.message });
        }
    }

    if (!(await requireAuth(req, res))) return;

    try {
        const { filename, base64Data, contentType } = body;

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

        const uploadOptions = {
            access: 'public',
            contentType: mimeType
        };
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            uploadOptions.token = process.env.BLOB_READ_WRITE_TOKEN;
        }

        const blob = await put(blobPath, buffer, uploadOptions);

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
