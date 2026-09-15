<?php
/**
 * Password protection for the admin and the write endpoints.
 *
 * The catalogue, upload and category APIs have taken any request from anyone since they
 * were built - deliberately deferred earlier in this project's life, now closed. One
 * shared password protects them all, hashed with bcrypt in asiatic-data/auth.json,
 * outside the web root like the catalogue itself. There is no user table: everyone who
 * needs access uses the same password, which matches how the admin is actually used.
 *
 * Reads are never gated here. Galleries, tours and the home page stay public - only the
 * admin page and the endpoints that change something ask for the password.
 */

require_once __DIR__ . '/storage.php';

function auth_file()
{
    $base = storage_dir();
    return $base === false ? false : $base . '/auth.json';
}

function auth_start_session()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $lifetime = 30 * 24 * 60 * 60;   // 30 days: long enough to be invisible in normal use
    ini_set('session.gc_maxlifetime', (string) $lifetime);

    // Store sessions in asiatic-data/sessions so default OS cron in /tmp cannot purge them early
    $base = storage_dir();
    if ($base !== false) {
        $sessDir = $base . '/sessions';
        if (!is_dir($sessDir) && !@mkdir($sessDir, 0700, true) && !is_dir($sessDir)) {
            // fallback to system session directory if unwritable
        } elseif (is_dir($sessDir) && is_writable($sessDir)) {
            session_save_path($sessDir);
        }
    }

    $secure = !empty($_SERVER['HTTPS']) || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name('fsv_admin');
    session_start();
}

/** Whether a password has ever been set. Gates the one-time setup flow. */
function auth_is_set()
{
    $f = auth_file();
    return $f !== false && is_file($f);
}

function auth_read()
{
    $f = auth_file();
    if ($f === false || !is_file($f)) {
        return null;
    }
    $data = json_decode(file_get_contents($f), true);
    return is_array($data) ? $data : null;
}

function auth_set_password($password)
{
    $f = auth_file();
    if ($f === false) {
        return false;
    }
    $data = ['hash' => password_hash($password, PASSWORD_BCRYPT), 'updatedAt' => time()];
    $ok = file_put_contents($f, json_encode($data), LOCK_EX) !== false;
    @chmod($f, 0600);
    return $ok;
}

function auth_check_password($password)
{
    $data = auth_read();
    if ($data === null || !isset($data['hash']) || $password === '') {
        return false;
    }
    return password_verify($password, $data['hash']);
}

function auth_is_logged_in()
{
    auth_start_session();
    return !empty($_SESSION['fsv_authed']);
}

/** Ends the request with 401 unless a valid session is present. */
function auth_require()
{
    auth_start_session();
    if (empty($_SESSION['fsv_authed'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Sign in required']);
        exit;
    }
}

function auth_login($password)
{
    auth_start_session();
    if (!auth_check_password($password)) {
        return false;
    }
    // A new session id on every successful login, so a session fixed before login
    // cannot be reused after it.
    session_regenerate_id(true);
    $_SESSION['fsv_authed']     = true;
    $_SESSION['fsv_login_time'] = time();
    return true;
}

function auth_logout()
{
    auth_start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
