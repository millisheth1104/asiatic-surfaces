<?php
/**
 * Persistent storage locator.
 *
 * Hostinger's Git deploy performs a clean sync of public_html: anything not in the
 * repository is deleted. products.json and uploads/ used to live there, so every
 * deploy destroyed the catalogue and every uploaded image. Both now live one level
 * above the web root, where Git never reaches.
 *
 * Falls back to a directory inside public_html only if the host forbids writing
 * above the web root (open_basedir). That fallback is NOT deploy-safe, which is why
 * storage_is_persistent() exists - health.php reports it.
 */

function storage_dir()
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    foreach ([dirname(__DIR__) . '/asiatic-data', __DIR__ . '/.data'] as $candidate) {
        if (!is_dir($candidate)) {
            if (!@mkdir($candidate, 0755, true) && !is_dir($candidate)) {
                continue;
            }
        }
        if (is_writable($candidate)) {
            $resolved = $candidate;
            storage_migrate_legacy($resolved);
            return $resolved;
        }
    }

    // Nothing writable. Callers surface this as a 500 rather than silently losing data.
    $resolved = false;
    return $resolved;
}

function storage_is_persistent()
{
    $dir = storage_dir();
    return $dir !== false && strpos($dir, __DIR__) !== 0;
}

function storage_uploads_dir()
{
    $base = storage_dir();
    if ($base === false) {
        return false;
    }
    $uploads = $base . '/uploads';
    if (!is_dir($uploads) && !@mkdir($uploads, 0755, true) && !is_dir($uploads)) {
        return false;
    }
    return $uploads;
}

function storage_products_file()
{
    $base = storage_dir();
    return $base === false ? false : $base . '/products.json';
}

/**
 * One-time rescue: if a previous layout left products.json or uploads/ inside
 * public_html, pull them into persistent storage before the next deploy wipes them.
 */
function storage_migrate_legacy($base)
{
    $legacyJson = __DIR__ . '/products.json';
    if (is_file($legacyJson) && !is_file($base . '/products.json')) {
        @copy($legacyJson, $base . '/products.json');
    }

    $legacyUploads = __DIR__ . '/uploads';
    if (is_dir($legacyUploads)) {
        $target = $base . '/uploads';
        if (!is_dir($target)) {
            @mkdir($target, 0755, true);
        }
        foreach (glob($legacyUploads . '/*') ?: [] as $file) {
            if (is_file($file) && !is_file($target . '/' . basename($file))) {
                @copy($file, $target . '/' . basename($file));
            }
        }
    }
}
