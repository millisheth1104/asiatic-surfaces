<?php
require_once __DIR__ . '/cors.php';
cors_send_headers();

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/ratelimit.php';

// Uploading is the costly path: it decodes megabytes and writes them to disk. 20 a
// minute is far beyond normal use and far below what a script needs to be a nuisance.
rate_limit('upload', 20, 60);

require_once __DIR__ . '/auth.php';
auth_require();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['base64Data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing base64Data']);
        exit;
    }

    $base64Data = $input['base64Data'];

    // The 25 MB limit also exists in the browser, where it gives a helpful message. This
    // is the one that is actually enforced: an attacker posts straight to the endpoint
    // and never runs our JavaScript. Base64 carries about a third overhead, so the
    // encoded string is measured against the inflated figure.
    $maxBytes = 25 * 1024 * 1024;
    if (strlen($base64Data) > (int) ($maxBytes * 1.4)) {
        http_response_code(413);
        echo json_encode(['error' => 'Image is larger than the 25 MB limit']);
        exit;
    }
    $filename = !empty($input['filename']) ? preg_replace('/[^a-zA-Z0-9.-]/', '_', $input['filename']) : 'asset-' . time() . '.jpg';

    // Strip data prefix if present
    if (strpos($base64Data, ';base64,') !== false) {
        $parts = explode(';base64,', $base64Data);
        $base64Data = $parts[1];
    }

    $decoded = base64_decode($base64Data);
    if ($decoded === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Base64 decode failed']);
        exit;
    }

    // What arrived has to actually be an image. Nothing here checked, so any bytes at
    // all could be stored under a .jpg name; getimagesize reads the header and fails on
    // anything that is not a real raster image - including an SVG, which is a document
    // that can carry script.
    $info = @getimagesizefromstring($decoded);
    $allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF];
    if ($info === false || !in_array($info[2], $allowed, true)) {
        http_response_code(415);
        echo json_encode(['error' => 'That file is not a JPEG, PNG, WebP or GIF image']);
        exit;
    }

    // The extension is what uploads.php uses to decide the Content-Type, so it is taken
    // from the verified image type rather than from the name the caller supplied.
    $extByType = [
        IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png',
        IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif',
    ];
    $filename = preg_replace('/\.[A-Za-z0-9]+$/', '', $filename) . '.' . $extByType[$info[2]];

    $uploadDir = storage_uploads_dir();
    if ($uploadDir === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Storage unavailable: uploads directory not writable']);
        exit;
    }

    // A rate limit alone does not stop the disk filling: 20 uploads a minute at 25 MB is
    // roughly 29 GB an hour. Past a ceiling, new uploads are refused rather than taking
    // the site down with a full disk. Current real usage is about 12 MB.
    $storeMax = 2 * 1024 * 1024 * 1024;   // 2 GB
    $used = 0;
    foreach (glob($uploadDir . '/*') ?: [] as $f) {
        if (is_file($f)) {
            $used += filesize($f);
        }
    }
    if ($used + strlen($decoded) > $storeMax) {
        http_response_code(507);
        echo json_encode(['error' => 'Image storage is full. Remove some images before uploading more.']);
        exit;
    }

    $targetFile = $uploadDir . '/' . time() . '-' . $filename;
    file_put_contents($targetFile, $decoded);
    @chmod($targetFile, 0666);

    $relativeUrl = '/uploads/' . basename($targetFile);

    echo json_encode([
        'success' => true,
        'url' => $relativeUrl
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Upload failed', 'details' => $e->getMessage()]);
}
