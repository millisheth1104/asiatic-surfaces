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
 * above the web root (open_basedir). That fallback is NOT deploy-safe: a deploy would
 * clear it, taking the catalogue and every uploaded image with it. storage_is_persistent()
 * reports which of the two is in use, so that condition can be checked if the data ever
 * goes missing again.
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
 * Deletions have to be recorded where every client can see them.
 *
 * Client-side tombstones only bind the browser that made the deletion; any other copy
 * still holds the product and pushes it back on its next full-list save. The server is
 * the one place all clients agree on, so the record lives here and the API refuses to
 * re-create anything listed in it.
 */
function storage_deleted_file()
{
    $base = storage_dir();
    return $base === false ? false : $base . '/deleted.json';
}

function storage_read_deleted()
{
    $f = storage_deleted_file();
    if ($f === false || !is_file($f)) {
        return [];
    }
    $data = json_decode(file_get_contents($f), true);
    if (!is_array($data)) {
        return [];
    }
    // Expire after 30 days. The window only has to outlast any stale client still
    // holding the product; the file itself is negligible either way, at roughly
    // 40 bytes an entry.
    $cutoff = time() - (30 * 24 * 60 * 60);
    $live = array_filter($data, function ($ts) use ($cutoff) {
        return is_numeric($ts) && $ts > $cutoff;
    });
    if (count($live) !== count($data)) {
        storage_write_deleted($live);
    }
    return $live;
}

function storage_write_deleted(array $map)
{
    $f = storage_deleted_file();
    if ($f === false) {
        return false;
    }
    return file_put_contents($f, json_encode($map, JSON_PRETTY_PRINT)) !== false;
}

function storage_tombstone(array $ids)
{
    $map = storage_read_deleted();
    $now = time();
    foreach ($ids as $id) {
        if (is_string($id) && $id !== '') {
            $map[$id] = $now;
        }
    }
    return storage_write_deleted($map);
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
