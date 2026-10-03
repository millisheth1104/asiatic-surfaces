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

// SVG is deliberately absent. An SVG is a document, not just a picture: it can carry
// script, and these files are served from the site's own origin, so opening one directly
// would run that script as the site. With uploads unauthenticated that is a hole anyone
// could use. Nothing here needs vector art - every image is a photograph or a render.
$types = [
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
    'webp' => 'image/webp', 'gif' => 'image/gif', 'avif' => 'image/avif',
];
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
if (!isset($types[$ext])) {
    http_response_code(404);
    exit;
}

// Panoramas are stored exactly as uploaded - often ~49 MB PNG renders, which take 25 s+
// to open in the tour. ?v=jpg asks for a full-resolution JPEG copy instead (same pixel
// size, ~6 MB, visually identical at q92). It is made once with GD, kept beside the
// original as <file>.q92.jpg, and the original is served if conversion is not possible.
if (isset($_GET['v']) && $_GET['v'] === 'jpg' && $ext === 'png') {
    $jpgPath = $path . '.q92.jpg';
    if (!is_file($jpgPath) && function_exists('imagecreatefrompng') && function_exists('imagejpeg')) {
        @ini_set('memory_limit', '512M');   // 8192x4096 truecolor is ~150 MB in GD
        @set_time_limit(120);
        $im = @imagecreatefrompng($path);
        if ($im) {
            $tmp = $jpgPath . '.' . uniqid('', true) . '.tmp';
            if (@imagejpeg($im, $tmp, 92)) {
                @rename($tmp, $jpgPath);
            } else {
                @unlink($tmp);
            }
            imagedestroy($im);
        }
    }
    if (is_file($jpgPath)) {
        $path = $jpgPath;
        $ext = 'jpg';
    }
}

$size  = filesize($path);
$mtime = filemtime($path);
$etag  = '"' . md5($name . $size . $mtime) . '"';

// Upload filenames are timestamped and never rewritten, so these are immutable.
header('Content-Type: ' . $types[$ext]);
// Belt and braces: never let a browser sniff its way to a different type, and give the
// file no privileges of its own if one is ever opened directly.
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
// no-transform: asks the CDN not to recompress or resize these (it was shrinking 8K
// panoramas to 1600px). Clients also bypass the /uploads/ path for panoramas.
header('Cache-Control: public, max-age=2592000, immutable, no-transform');
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
