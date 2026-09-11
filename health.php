<?php
/**
 * Deploy sanity check. Confirms the catalogue and uploads survived the last deploy.
 * Visit /health.php after any deploy.
 */

require_once __DIR__ . '/storage.php';
header('Content-Type: application/json; charset=utf-8');

$dir       = storage_dir();
$uploads   = storage_uploads_dir();
$dataFile  = storage_products_file();
$products  = ($dataFile && is_file($dataFile)) ? json_decode(file_get_contents($dataFile), true) : [];

echo json_encode([
    'storage_dir'        => $dir === false ? null : $dir,
    'deploy_safe'        => storage_is_persistent(),
    'products_file'      => $dataFile === false ? null : $dataFile,
    'product_count'      => is_array($products) ? count($products) : 0,
    'uploads_dir'        => $uploads === false ? null : $uploads,
    'uploaded_files'     => $uploads === false ? 0 : count(array_filter(glob($uploads . '/*') ?: [], 'is_file')),
    'php_version'        => PHP_VERSION,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
