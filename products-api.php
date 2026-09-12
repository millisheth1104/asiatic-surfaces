<?php
require_once __DIR__ . '/cors.php';
cors_send_headers();

require_once __DIR__ . '/storage.php';

$dataFile = storage_products_file();
if ($dataFile === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Storage unavailable: no writable data directory']);
    exit;
}

// An absent catalogue means an empty catalogue. It used to be seeded with a demo
// product (#4006), which reappeared every time the file was missing - and looked
// exactly like a deleted product coming back. Every product is created through the
// admin now, so there is nothing to seed.
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    @chmod($dataFile, 0666);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $content = file_get_contents($dataFile);
    $products = json_decode($content, true) ?: [];
    $deleted = storage_read_deleted();

    // Defensive: never hand back something already deleted, even if an older write
    // slipped it into the file.
    $products = array_values(array_filter($products, function ($p) use ($deleted) {
        return !isset($p['id']) || !isset($deleted[$p['id']]);
    }));

    echo json_encode([
        'success'  => true,
        'products' => $products,
        'deleted'  => array_keys($deleted),
    ]);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    // Saving a product is a handful of requests; a script rewriting the catalogue in a
    // loop is not. Applied after the GET branch so reading the catalogue is untouched.
    require_once __DIR__ . '/ratelimit.php';
    rate_limit('products-write', 60, 60);

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }

    $content = file_get_contents($dataFile);
    $current = json_decode($content, true) ?: [];

    $deleted = storage_read_deleted();

    // A catalogue is a few hundred products at most. Without a ceiling, one request can
    // write a file of any size, which is a slower route to the same full disk.
    if (isset($input['products']) && is_array($input['products']) && count($input['products']) > 5000) {
        http_response_code(413);
        echo json_encode(['error' => 'Too many products in one request']);
        exit;
    }

    if (isset($input['products']) && is_array($input['products'])) {
        // A full-list save from a client that still holds deleted rows would otherwise
        // resurrect them: the list replaces the file wholesale and the last writer wins.
        // Strip anything the deletion record covers before it is stored.
        $current = array_values(array_filter($input['products'], function ($p) use ($deleted) {
            return !isset($p['id']) || !isset($deleted[$p['id']]);
        }));
    } elseif (isset($input['product']) && isset($input['product']['id'])) {
        $p = $input['product'];
        if (isset($deleted[$p['id']])) {
            echo json_encode(['success' => true, 'products' => $current, 'skipped' => 'deleted']);
            exit;
        }
        $found = false;
        foreach ($current as $k => $item) {
            if ($item['id'] === $p['id']) {
                $current[$k] = array_merge($item, $p);
                $found = true;
                break;
            }
        }
        if (!$found) {
            array_unshift($current, $p);
        }
    } elseif (isset($input['action']) && $input['action'] === 'delete' && isset($input['id'])) {
        $ids = is_array($input['id']) ? $input['id'] : [$input['id']];
        storage_tombstone($ids);
        $current = array_values(array_filter($current, function ($item) use ($ids) {
            return !isset($item['id']) || !in_array($item['id'], $ids, true);
        }));
    }

    file_put_contents($dataFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    @chmod($dataFile, 0666);
    echo json_encode(['success' => true, 'products' => $current]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
