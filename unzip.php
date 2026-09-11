<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');

echo "<h2>Enabling Global Product Saving on Hostinger...</h2>";

$baseDir = __DIR__;

// 1. Create uploads folder for images
$uploadsDir = $baseDir . '/uploads';
if (!is_dir($uploadsDir)) {
    mkdir($uploadsDir, 0777, true);
}
@chmod($uploadsDir, 0777);
echo "<p>✅ <b>uploads/</b> directory ready for 360° image uploads.</p>";

// 2. Write products-api.php
$productsApi = <<<'PHP'
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataFile = __DIR__ . '/products.json';

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
    @chmod($dataFile, 0666);
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
    @chmod($dataFile, 0666);
    echo json_encode(['success' => true, 'products' => $current]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
PHP;

file_put_contents($baseDir . '/products-api.php', $productsApi);
@chmod($baseDir . '/products-api.php', 0666);
echo "<p>✅ <b>products-api.php</b> written successfully.</p>";

// 3. Write upload-api.php
$uploadApi = <<<'PHP'
<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['base64Data'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing base64Data']);
        exit;
    }

    $base64Data = $input['base64Data'];
    $filename = !empty($input['filename']) ? preg_replace('/[^a-zA-Z0-9.-]/', '_', $input['filename']) : 'asset-' . time() . '.jpg';

    if (strpos($base64Data, ';base64,') !== false) {
        $parts = explode(';base64,', $base64Data);
        $base64Data = $parts[1];
    }

    $decoded = base64_decode($base64Data);
    if ($decoded === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Base64 decode failed']);
        exit;
    }

    $uploadDir = __DIR__ . '/uploads';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $targetFile = $uploadDir . '/' . time() . '-' . $filename;
    file_put_contents($targetFile, $decoded);
    @chmod($targetFile, 0666);

    $relativeUrl = '/uploads/' . basename($targetFile);
    echo json_encode(['success' => true, 'url' => $relativeUrl]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Upload failed', 'details' => $e->getMessage()]);
}
PHP;

file_put_contents($baseDir . '/upload-api.php', $uploadApi);
@chmod($baseDir . '/upload-api.php', 0666);
echo "<p>✅ <b>upload-api.php</b> written successfully.</p>";

// 4. Update .htaccess for routing
$htaccess = <<<'HTACCESS'
RewriteEngine On
RewriteBase /

# 1. Route API calls to PHP backend (root-level handlers)
RewriteRule ^api/products/?$ /products-api.php [L,QSA]
RewriteRule ^api/upload/?$ /upload-api.php [L,QSA]

# 2. Route category product slugs to tour.html
RewriteRule ^(45-degree|wooden|digital|laminates|stone|louvers|edge-bands|edgebands|texture)/[a-zA-Z0-9_-]+/?$ /tour.html [L,QSA]

# 3. Redirect /home to /index.html
RewriteRule ^home/?$ /index.html [L]

<IfModule mod_mime.c>
    AddType application/javascript .js
    AddType text/css .css
    AddType image/webp .webp
    AddType image/jpeg .jpeg .jpg
    AddType image/png .png
    AddType font/woff2 .woff2
</IfModule>
HTACCESS;

file_put_contents($baseDir . '/.htaccess', $htaccess);
@chmod($baseDir . '/.htaccess', 0666);
echo "<p>✅ <b>.htaccess</b> updated with clean API and product routing.</p>";

// 5. Initialize products.json
$jsonFile = $baseDir . '/products.json';
if (!file_exists($jsonFile)) {
    file_put_contents($jsonFile, '[]');
    @chmod($jsonFile, 0666);
}
echo "<p style='color:green; font-size:18px;'><b>🎉 SUCCESS: Global Server Storage is now ACTIVE!</b></p>";
echo "<p>Any products you add or edit in <a href='/products.html'><b>products.html</b></a> will now be saved permanently across all devices!</p>";
