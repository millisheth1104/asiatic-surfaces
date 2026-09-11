<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/products.json';

// Initialize with default if not exists
if (!file_exists($dataFile)) {
    $defaultProducts = [
        [
            "id" => "prod-4006",
            "code" => "#4006",
            "slug" => "4006",
            "name" => "Bedroom Interior Laminate #4006",
            "category" => "Laminates",
            "pitch" => 23,
            "yaw" => 0,
            "fullsheet" => true,
            "fullsheetUrl" => "src/Fullsheet/Fullsheet1.jpeg",
            "threeD" => false,
            "threeDUrl" => null,
            "description" => "Featured premium laminate finish in the 360° virtual bedroom tour."
        ]
    ];
    file_put_contents($dataFile, json_encode($defaultProducts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $content = file_get_contents($dataFile);
    $products = json_decode($content, true) ?: [];
    echo json_encode(['success' => true, 'products' => $products]);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $content = file_get_contents($dataFile);
    $current = json_decode($content, true) ?: [];

    if (isset($input['products']) && is_array($input['products'])) {
        $current = $input['products'];
    } elseif (isset($input['product']) && isset($input['product']['id'])) {
        $p = $input['product'];
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
        $current = array_values(array_filter($current, function($item) use ($input) {
            return $item['id'] !== $input['id'];
        }));
    }

    file_put_contents($dataFile, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    echo json_encode(['success' => true, 'products' => $current]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
