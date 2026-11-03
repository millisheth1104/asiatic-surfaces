/**
 * Vercel's /api/auth - same contract as auth-api.php on Hostinger.
 *
 * status  GET                                    -> { hasPassword, loggedIn, storageReady }
 * setup   POST { action:'setup',  password }      -> works once: refused once a password exists
 * login   POST { action:'login',  password }
 * logout  POST { action:'logout' }
 * change  POST { action:'change', oldPassword, newPassword } -> requires being logged in
 */
import {
    storageReady, isSet, setPassword, checkPassword, isLoggedIn, requireAuth,
    startSession, endSession, loginLockedFor, recordFailure, recordSuccess, clientIp
} from './_lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (req.method === 'GET') {
            return res.status(200).json({
                success: true,
                hasPassword: await isSet(),
                loggedIn: await isLoggedIn(req),
                storageReady: storageReady()
            });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

        // Without Blob storage there is nowhere to keep the password; saying so beats a
        // setup that appears to work and is forgotten on the next request.
        if (!storageReady()) {
            return res.status(503).json({
                error: 'Storage is not connected on this Vercel project. Connect a Blob store in the Vercel dashboard (Storage tab), then redeploy.'
            });
        }

        const body = req.body || {};
        const action = body.action || '';

        if (action === 'setup') {
            if (await isSet()) return res.status(403).json({ error: 'A password is already set' });
            const password = String(body.password || '');
            if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
            const auth = await setPassword(password);
            startSession(res, auth);
            return res.status(200).json({ success: true });
        }

        if (action === 'login') {
            const ip = clientIp(req);
            const locked = loginLockedFor(ip);
            if (locked > 0) {
                const mins = Math.max(1, Math.ceil(locked / 60));
                res.setHeader('Retry-After', String(locked));
                return res.status(429).json({
                    error: `Too many failed attempts. This IP is temporarily blocked for ${mins} more minute(s).`,
                    retry_after: locked
                });
            }
            const auth = await checkPassword(String(body.password || ''));
            if (auth) {
                recordSuccess(ip);
                startSession(res, auth);
                return res.status(200).json({ success: true });
            }
            if (recordFailure(ip)) {
                res.setHeader('Retry-After', '3600');
                return res.status(429).json({ error: 'Too many failed attempts. This IP has been blocked for 1 hour.', retry_after: 3600 });
            }
            return res.status(401).json({ error: 'Incorrect password' });
        }

        if (action === 'logout') {
            endSession(res);
            return res.status(200).json({ success: true });
        }

        if (action === 'change') {
            if (!(await requireAuth(req, res))) return;
            if (!(await checkPassword(String(body.oldPassword || '')))) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            const next = String(body.newPassword || '');
            if (next.length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters' });
            const auth = await setPassword(next);
            startSession(res, auth);
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('API Error in /api/auth:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
