<?php
/**
 * Reconciles product records against the files actually present in storage.
 *
 * Uploads are named "<timestamp>-fullsheet-<product-slug>.jpg" (or "-panorama-3d-"),
 * so the catalogue can be rebuilt from the directory when the two drift apart - which
 * is what the pre-storage-fix deploys caused: records kept URLs whose files were wiped,
 * while later re-uploads landed on disk with nothing pointing at them.
 *
 * GET  /repair.php            dry run, reports what it would change
 * GET  /repair.php?apply=1    writes the changes
 */

require_once __DIR__ . '/storage.php';
header('Content-Type: application/json; charset=utf-8');

$apply     = isset($_GET['apply']) && $_GET['apply'] === '1';
$dir       = storage_uploads_dir();
$dataFile  = storage_products_file();

if ($dir === false || $dataFile === false || !is_file($dataFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Storage or catalogue unavailable']);
    exit;
}

$products = json_decode(file_get_contents($dataFile), true) ?: [];

// Newest file wins per (field, slug). basename keeps the timestamp prefix sortable.
$byKey = [];
foreach (glob($dir . '/*') ?: [] as $path) {
    if (!is_file($path)) {
        continue;
    }
    $base = basename($path);
    if (!preg_match('/^(\d+)-(fullsheet|panorama-3d)-(.+)\.[A-Za-z0-9]+$/', $base, $m)) {
        continue;
    }
    $key = $m[2] . '|' . strtolower($m[3]);
    if (!isset($byKey[$key]) || (int) $m[1] > $byKey[$key]['ts']) {
        $byKey[$key] = ['ts' => (int) $m[1], 'file' => $base];
    }
}

/** Slugs a product can plausibly have been uploaded under. */
function candidate_slugs(array $p)
{
    $out = [];
    foreach ([$p['slug'] ?? '', $p['id'] ?? '', $p['code'] ?? ''] as $raw) {
        $s = strtolower(trim((string) $raw));
        $s = str_replace('#', '', $s);
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        $s = trim($s, '-');
        if ($s === '') {
            continue;
        }
        $out[] = $s;
        // Uploads were named from the slug, which is sometimes prefixed "prod-".
        $out[] = 'prod-' . $s;
        // and sometimes drops a leading zero: nsy-064 vs nsy-64
        $out[] = preg_replace('/-0+(\d)/', '-$1', $s);
        $out[] = 'prod-' . preg_replace('/-0+(\d)/', '-$1', $s);
    }
    return array_values(array_unique($out));
}

$changes = [];
$cleared = [];

foreach ($products as $i => $p) {
    foreach ([['fullsheet', 'fullsheetUrl'], ['panorama-3d', 'threeDDataUrl']] as $pair) {
        list($prefix, $field) = $pair;

        $match = null;
        foreach (candidate_slugs($p) as $slug) {
            if (isset($byKey[$prefix . '|' . $slug])) {
                $match = $byKey[$prefix . '|' . $slug]['file'];
                break;
            }
        }

        $current = isset($p[$field]) ? $p[$field] : null;

        if ($match !== null) {
            $url = '/uploads/' . $match;
            if ($current !== $url) {
                $changes[] = ['code' => $p['code'] ?? $p['id'], 'field' => $field, 'from' => $current, 'to' => $url];
                $products[$i][$field] = $url;
                if ($field === 'fullsheetUrl') {
                    $products[$i]['fullsheet'] = true;
                } else {
                    $products[$i]['threeD'] = true;
                }
            }
        } elseif (is_string($current) && strpos($current, '/uploads/') === 0
                  && !is_file($dir . '/' . basename($current))) {
            // Points at a file the deploy destroyed and nothing replaced it.
            $cleared[] = ['code' => $p['code'] ?? $p['id'], 'field' => $field, 'was' => $current];
            $products[$i][$field] = null;
            if ($field === 'fullsheetUrl') {
                $products[$i]['fullsheet'] = false;
            } else {
                $products[$i]['threeD'] = false;
            }
        }
    }
}

if ($apply && ($changes || $cleared)) {
    copy($dataFile, $dataFile . '.bak-' . time());
    file_put_contents($dataFile, json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

echo json_encode([
    'mode'           => $apply ? 'APPLIED' : 'dry-run (add ?apply=1 to write)',
    'files_in_store' => count($byKey),
    'relinked'       => count($changes),
    'cleared_dead'   => count($cleared),
    'relinked_detail'=> array_slice($changes, 0, 60),
    'cleared_detail' => array_slice($cleared, 0, 60),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
