<?php
/**
 * status  GET                                    -> { hasPassword, loggedIn }
 * setup   POST { action:'setup',  password }      -> works once: refused once a password exists
 * login   POST { action:'login',  password }      -> rate limited, generic error on failure
 * logout  POST { action:'logout' }
 * change  POST { action:'change', oldPassword, newPassword } -> requires being logged in
 */

require_once __DIR__ . '/cors.php';
cors_send_headers();

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/ratelimit.php';

$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true);
$input  = is_array($input) ? $input : [];
$action = isset($input['action']) ? $input['action'] : '';

if ($method === 'GET') {
    echo json_encode([
        'success'     => true,
        'hasPassword' => auth_is_set(),
        'loggedIn'    => auth_is_logged_in(),
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

if ($action === 'setup') {
    // Works only while no password exists, so this cannot be used to take over an
    // account that already has one - it is a first-run flow, not a reset.
    if (auth_is_set()) {
        http_response_code(403);
        echo json_encode(['error' => 'A password is already set']);
        exit;
    }
    $password = isset($input['password']) ? (string) $input['password'] : '';
    if (strlen($password) < 10) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 10 characters']);
        exit;
    }
    auth_set_password($password);
    auth_login($password);
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'login') {
    $clientIp = rl_client_key();

    // Check if this IP is currently locked out (10 failed attempts = 1 hour jail)
    $lockRemaining = login_is_locked($clientIp);
    if ($lockRemaining > 0) {
        $mins = max(1, (int) ceil($lockRemaining / 60));
        http_response_code(429);
        header('Retry-After: ' . $lockRemaining);
        echo json_encode([
            'error'       => "Too many failed attempts. This IP is temporarily blocked for {$mins} more minute(s).",
            'retry_after' => $lockRemaining,
        ]);
        exit;
    }

    // General burst rate limit (20 attempts/minute) to prevent CPU starvation on bcrypt
    rate_limit('login-burst', 20, 60);

    $password = isset($input['password']) ? (string) $input['password'] : '';
    if (auth_login($password)) {
        // Successful login: reset failed attempts counter for this IP
        login_record_success($clientIp);
        echo json_encode(['success' => true]);
    } else {
        // Incorrect password: increment failed strikes; 10 strikes = 1 hour lockout
        $jailed = login_record_failure($clientIp, 10, 3600);
        if ($jailed) {
            http_response_code(429);
            header('Retry-After: 3600');
            echo json_encode([
                'error'       => 'Too many failed attempts. This IP has been blocked for 1 hour.',
                'retry_after' => 3600,
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Incorrect password']);
        }
    }
    exit;
}

if ($action === 'logout') {
    auth_logout();
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'change') {
    auth_require();
    $old = isset($input['oldPassword']) ? (string) $input['oldPassword'] : '';
    $new = isset($input['newPassword']) ? (string) $input['newPassword'] : '';

    if (!auth_check_password($old)) {
        http_response_code(401);
        echo json_encode(['error' => 'Current password is incorrect']);
        exit;
    }
    if (strlen($new) < 10) {
        http_response_code(400);
        echo json_encode(['error' => 'New password must be at least 10 characters']);
        exit;
    }
    auth_set_password($new);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action']);
