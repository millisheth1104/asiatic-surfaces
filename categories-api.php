<?php
/**
 * Custom product categories.
 *
 * The eight original categories are baked into the pages. These are the ones added
 * through the admin, and they live beside the catalogue in asiatic-data so a deploy
 * cannot clear them - the same reason products.json and uploads/ live there.
 *
 * GET                      -> { success, categories: [...] }
 * POST { category: {...} } -> create or update one
 * POST { action: 'delete', id } -> remove one
 */

require_once __DIR__ . '/cors.php';
cors_send_headers();

require_once __DIR__ . '/storage.php';

$file = storage_categories_file();
if ($file === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Storage unavailable: no writable data directory']);
    exit;
}

if (!file_exists($file)) {
    file_put_contents($file, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    @chmod($file, 0666);
}

function read_categories($file)
{
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function write_categories($file, array $list)
{
    file_put_contents($file, json_encode(array_values($list), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    @chmod($file, 0666);
}

/** Lowercase, hyphenated, and stable - it becomes part of the gallery URL. */
function category_slug($name)
{
    $s = strtolower(trim((string) $name));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(['success' => true, 'categories' => read_categories($file)]);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    // Categories are created rarely by nature, so this can be tight.
    require_once __DIR__ . '/ratelimit.php';
    rate_limit('categories-write', 20, 60);

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON input']);
        exit;
    }

    $list = read_categories($file);

    if (isset($input['action']) && $input['action'] === 'delete' && isset($input['id'])) {
        $list = array_values(array_filter($list, function ($c) use ($input) {
            return !isset($c['id']) || $c['id'] !== $input['id'];
        }));
        write_categories($file, $list);
        echo json_encode(['success' => true, 'categories' => $list]);
        exit;
    }

    if (!isset($input['category']) || !is_array($input['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing category']);
        exit;
    }

    $c = $input['category'];
    $name = trim((string) ($c['name'] ?? ''));
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Category name is required']);
        exit;
    }

    $slug = category_slug($name);
    if ($slug === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Category name must contain a letter or number']);
        exit;
    }

    // The slug is the identity: two categories cannot share a gallery URL.
    $id = isset($c['id']) && $c['id'] !== '' ? $c['id'] : 'cat-' . $slug;
    foreach ($list as $existing) {
        if (($existing['slug'] ?? '') === $slug && ($existing['id'] ?? '') !== $id) {
            http_response_code(409);
            echo json_encode(['error' => 'A category with that name already exists']);
            exit;
        }
    }

    $record = [
        'id'           => $id,
        'name'         => $name,
        'slug'         => $slug,
        'thumbnailUrl' => isset($c['thumbnailUrl']) ? $c['thumbnailUrl'] : null,
        'blurb'        => isset($c['blurb']) ? trim((string) $c['blurb']) : '',
        'createdAt'    => isset($c['createdAt']) ? $c['createdAt'] : time(),
    ];

    $found = false;
    foreach ($list as $i => $existing) {
        if (($existing['id'] ?? '') === $id) {
            $list[$i] = array_merge($existing, $record);
            $found = true;
            break;
        }
    }
    if (!$found) {
        $list[] = $record;
    }

    write_categories($file, $list);
    echo json_encode(['success' => true, 'categories' => $list, 'category' => $record]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
