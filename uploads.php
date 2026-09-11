<?php
/**
 * Serves uploaded images out of persistent storage (above the web root).
 *
 * Product records store plain /uploads/<file> URLs. .htaccess rewrites those here so
 * the URLs in products.json never had to change when storage moved out of public_html.
 */

require_once __DIR__ . '/storage.php';

$requested = isset($_GET['f']) ? $_GET['f'] : '';

// Only ever a bare filename: no directories, no traversal, no null bytes.
$name = basename(str_replace("\0", '', $requested));
if ($name === '' || $name === '.' || $name === '..' || !preg_match('/^[A-Za-z0-9._-]+$/', $name)) {
    http_response_code(404);
    exit;
}

$dir = storage_uploads_dir();
if ($dir === false) {
    http_response_code(500);
    exit;
}

$path = $dir . '/' . $name;
if (!is_file($path)) {
    http_response_code(404);
    exit;
}

$types = [
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
    'webp' => 'image/webp', 'gif' => 'image/gif', 'avif' => 'image/avif',
    'svg' => 'image/svg+xml',
];
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!isset($types[$ext])) {
    http_response_code(404);
    exit;
}

$size  = filesize($path);
$mtime = filemtime($path);
$etag  = '"' . md5($name . $size . $mtime) . '"';

// Upload filenames are timestamped and never rewritten, so these are immutable.
header('Content-Type: ' . $types[$ext]);
header('Cache-Control: public, max-age=2592000, immutable');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
header('ETag: ' . $etag);

$ifNoneMatch = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH']) : '';
$ifModSince  = isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) ? strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) : 0;
if ($ifNoneMatch === $etag || ($ifModSince && $ifModSince >= $mtime)) {
    http_response_code(304);
    exit;
}

header('Content-Length: ' . $size);
readfile($path);
