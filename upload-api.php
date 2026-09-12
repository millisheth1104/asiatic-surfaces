<?php
require_once __DIR__ . '/cors.php';
cors_send_headers();

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/ratelimit.php';

// Uploading is the costly path: it decodes megabytes and writes them to disk. 20 a
// minute is far beyond normal use and far below what a script needs to be a nuisance.
rate_limit('upload', 20, 60);

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

    $uploadDir = storage_uploads_dir();
    if ($uploadDir === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Storage unavailable: uploads directory not writable']);
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
