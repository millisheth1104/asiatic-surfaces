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

/** The eight categories baked into the site, slug => name. Mirrors products-data.js. */
const BUILT_IN_CATEGORIES = [
    '45-degree'  => '45 Degree',
    'synchro'    => 'Synchro',
    'digital'    => 'Digital',
    'stone'      => 'Stone',
    'laminates'  => 'Laminates',
    'louvers'    => 'Louvers',
    'edge-bands' => 'Edge Bands',
    'texture'    => 'Texture',
];

/** Length cap that stays safe for multi-byte text when mbstring is available. */
function cat_cut($s, $n)
{
    return function_exists("mb_substr") ? mb_substr($s, 0, $n) : substr($s, 0, $n);
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

    require_once __DIR__ . '/auth.php';
    auth_require();

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

    // A category's name and slug are its identity: products store the name, and tour
    // links, QR codes and page URLs are built from the slug. Editing therefore never
    // touches either - it changes `label` (the name shown), the blurb and the thumbnail.
    $label = cat_cut(trim((string) ($c['label'] ?? '')), 60);
    $blurb = cat_cut(trim((string) ($c['blurb'] ?? '')), 300);

    $id = isset($c['id']) ? (string) $c['id'] : '';
    $existing = null;
    $existingIndex = null;
    foreach ($list as $i => $e) {
        if ($id !== '' && ($e['id'] ?? '') === $id) { $existing = $e; $existingIndex = $i; break; }
    }

    // Only the site's own uploads may be used as a thumbnail; an unchanged legacy value
    // is let through so an old record can still be edited.
    $thumb = $c['thumbnailUrl'] ?? null;
    if ($thumb === '' || $thumb === null) {
        $thumb = null;
    } elseif (!is_string($thumb) || (!preg_match('#^/uploads/[A-Za-z0-9._-]+$#', $thumb)
        && !($existing && ($existing['thumbnailUrl'] ?? null) === $thumb))) {
        http_response_code(400);
        echo json_encode(['error' => 'Thumbnail must be an uploaded image']);
        exit;
    }

    if (isset($c['builtInSlug'])) {
        // One of the eight original categories: stored as an override record.
        $slug = (string) $c['builtInSlug'];
        if (!isset(BUILT_IN_CATEGORIES[$slug])) {
            http_response_code(400);
            echo json_encode(['error' => 'Unknown built-in category']);
            exit;
        }
        $id = 'builtin-' . $slug;
        $existing = null;
        $existingIndex = null;
        foreach ($list as $i => $e) {
            if (($e['id'] ?? '') === $id) { $existing = $e; $existingIndex = $i; break; }
        }
        $record = [
            'id'           => $id,
            'builtIn'      => true,
            'name'         => BUILT_IN_CATEGORIES[$slug],
            'slug'         => $slug,
            'label'        => $label === BUILT_IN_CATEGORIES[$slug] ? '' : $label,
            'thumbnailUrl' => $thumb,
            'blurb'        => $blurb,
            'updatedAt'    => time(),
        ];
    } elseif ($existing) {
        if (!empty($existing['builtIn'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Edit a built-in category by its slug']);
            exit;
        }
        $record = array_merge($existing, [
            'label'        => $label === ($existing['name'] ?? '') ? '' : $label,
            'thumbnailUrl' => $thumb,
            'blurb'        => $blurb,
            'updatedAt'    => time(),
        ]);
    } else {
        // A new category: its name fixes its slug for good.
        $name = cat_cut(trim((string) ($c['name'] ?? '')), 60);
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
        // Two categories cannot share a gallery URL - including the eight built-ins,
        // whose names already route to their own pages.
        $taken = isset(BUILT_IN_CATEGORIES[$slug]);
        foreach ($list as $e) {
            if (empty($e['builtIn']) && ($e['slug'] ?? '') === $slug) { $taken = true; break; }
        }
        if ($taken) {
            http_response_code(409);
            echo json_encode(['error' => 'A category with that name already exists']);
            exit;
        }
        $record = [
            'id'           => 'cat-' . $slug,
            'name'         => $name,
            'slug'         => $slug,
            'label'        => '',
            'thumbnailUrl' => $thumb,
            'blurb'        => $blurb,
            'createdAt'    => time(),
        ];
    }

    if ($existingIndex !== null) {
        $list[$existingIndex] = $record;
    } else {
        $list[] = $record;
    }

    write_categories($file, $list);
    echo json_encode(['success' => true, 'categories' => $list, 'category' => $record]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
