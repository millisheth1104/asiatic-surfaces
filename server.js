const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.webp': 'image/webp',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let reqUrl = decodeURIComponent(req.url.split('?')[0]);
    const hasExtension = path.extname(reqUrl) !== '';

    const CATEGORY_PREFIXES = ['/45-degree/', '/wooden/', '/digital/', '/laminates/', '/stone/', '/louvers/', '/edge-bands/', '/edgebands/', '/texture/'];
    const isCategoryProductRoute = CATEGORY_PREFIXES.some(prefix => reqUrl.startsWith(prefix));

    if (reqUrl === '/' || reqUrl === '/home.html') {
        reqUrl = '/index.html';
    } else if (isCategoryProductRoute) {
        if (hasExtension) {
            reqUrl = '/' + path.basename(reqUrl);
        } else {
            reqUrl = '/tour.html';
        }
    }

    let filePath = path.join(PUBLIC_DIR, reqUrl);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1><p><a href="/products.html">Go to Product Catalog</a></p>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size
        });

        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    process.stdout.write(`Server listening on http://127.0.0.1:${PORT}/\n`);
});
