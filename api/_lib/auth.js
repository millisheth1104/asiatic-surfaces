/**
 * Vercel's copy of the admin password (auth.php is Hostinger's). Same contract, no disk.
 *
 * The bcrypt-free scrypt hash lives in Vercel Blob under auth/, written with a random
 * suffix so its public URL cannot be guessed, and found again through list() (which needs
 * the store token). Sessions are a signed cookie rather than server state: the signing
 * key is derived from BLOB_READ_WRITE_TOKEN and the current hash, so the key never leaves
 * the server and changing the password signs every existing session out.
 *
 * This deployment is independent of fullsheetview.in - it never calls Hostinger.
 */
import { put, list, del } from '@vercel/blob';
import crypto from 'node:crypto';

const AUTH_PREFIX = 'auth/admin';
const COOKIE = 'fsv_admin';
const LIFETIME_S = 30 * 24 * 60 * 60;

export function storageReady() {
    return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Newest blob under a prefix, or null. Blobs are written with random suffixes. */
export async function newestBlob(prefix) {
    const { blobs } = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!blobs.length) return null;
    return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
}

/** Replaces the JSON document under a prefix: new random-suffix blob, then old ones removed. */
export async function writeJsonBlob(prefix, data) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const { blobs: old } = await list({ prefix, token });
    await put(prefix + '.json', JSON.stringify(data), {
        access: 'public', addRandomSuffix: true, contentType: 'application/json', token
    });
    if (old.length) await del(old.map(b => b.url), { token });
}

export async function readJsonBlob(prefix) {
    const b = await newestBlob(prefix);
    if (!b) return null;
    const res = await fetch(b.url, { cache: 'no-store' });
    return res.ok ? res.json() : null;
}

async function readAuth() {
    if (!storageReady()) return null;
    try {
        const data = await readJsonBlob(AUTH_PREFIX);
        return data && data.hash && data.salt ? data : null;
    } catch (e) {
        return null;
    }
}

function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key.toString('hex')));
    });
}

function signingKey(auth) {
    return crypto.createHmac('sha256', process.env.BLOB_READ_WRITE_TOKEN).update('fsv-session:' + auth.hash).digest();
}

function sign(auth, exp) {
    return crypto.createHmac('sha256', signingKey(auth)).update('v1.' + exp).digest('hex');
}

export async function isSet() {
    return !!(await readAuth());
}

export async function setPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt);
    await writeJsonBlob(AUTH_PREFIX, { salt, hash, updatedAt: Date.now() });
    return { salt, hash };
}

export async function checkPassword(password) {
    const auth = await readAuth();
    if (!auth || !password) return null;
    const hash = await scrypt(password, auth.salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(auth.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? auth : null;
}

function readCookie(req) {
    const header = req.headers.cookie || '';
    const m = header.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
}

export async function isLoggedIn(req) {
    const value = readCookie(req);
    const [exp, sig] = value.split('.');
    if (!exp || !sig || Number(exp) < Math.floor(Date.now() / 1000)) return false;
    const auth = await readAuth();
    if (!auth) return false;
    const want = Buffer.from(sign(auth, exp), 'hex');
    const got = Buffer.from(sig, 'hex');
    return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function startSession(res, auth) {
    const exp = Math.floor(Date.now() / 1000) + LIFETIME_S;
    res.setHeader('Set-Cookie',
        `${COOKIE}=${exp}.${sign(auth, exp)}; Path=/; Max-Age=${LIFETIME_S}; HttpOnly; Secure; SameSite=Strict`);
}

export function endSession(res) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

/** Sends 401 and returns false unless the request carries a valid session. */
export async function requireAuth(req, res) {
    if (await isLoggedIn(req)) return true;
    res.status(401).json({ error: 'Sign in required' });
    return false;
}

// Per-instance only: Vercel may run several instances, so this slows guessing rather
// than stopping it. Hostinger's ratelimit.php is the stricter of the two.
const failures = new Map();
export function loginLockedFor(ip) {
    const f = failures.get(ip);
    if (!f || !f.until) return 0;
    const left = Math.ceil((f.until - Date.now()) / 1000);
    return left > 0 ? left : 0;
}
export function recordFailure(ip) {
    const f = failures.get(ip) || { count: 0, until: 0 };
    f.count += 1;
    if (f.count >= 10) { f.until = Date.now() + 3600 * 1000; f.count = 0; }
    failures.set(ip, f);
    return f.until > Date.now();
}
export function recordSuccess(ip) {
    failures.delete(ip);
}
export function clientIp(req) {
    return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}
