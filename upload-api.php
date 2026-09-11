<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/storage.php';

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
