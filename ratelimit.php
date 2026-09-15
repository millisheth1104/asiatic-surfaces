<?php
/**
 * Per-IP rate limiting for the write endpoints.
 *
 * The write endpoints take no authentication, so anyone who knows the address can call
 * them as fast as they like. That is not a theoretical problem: a single machine looping
 * on /api/upload can fill the disk in an afternoon, which takes the site down without
 * needing anything as elaborate as a distributed attack.
 *
 * Reads are deliberately not limited. Visitors browsing the galleries must never be
 * throttled, and a GET costs almost nothing.
 *
 * This does not stop a genuine distributed flood - thousands of machines each staying
 * under the limit - which has to be absorbed before it reaches the server. It stops the
 * cheap version, which is the realistic one.
 */

require_once __DIR__ . '/storage.php';

/**
 * The caller's address, as best it can be known behind Hostinger's edge.
 *
 * REMOTE_ADDR is the edge server when a CDN is in front, so every visitor would share
 * one bucket. The forwarded headers carry the original address; the leftmost entry is
 * the client. These headers are attacker-supplied, so this is not an identity - it is
 * only a bucket key, and the worst a forged one does is give that request its own
 * allowance rather than someone else's.
 */
function rl_client_key()
{
    // Cloudflare edge securely sets CF-Connecting-IP
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = trim($_SERVER['HTTP_CF_CONNECTING_IP']);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }

    // Direct server connection
    if (!empty($_SERVER['REMOTE_ADDR'])) {
        return $_SERVER['REMOTE_ADDR'];
    }

    // Secondary proxy fallbacks
    foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
        if (!empty($_SERVER[$h])) {
            $parts = explode(',', $_SERVER[$h]);
            $ip = trim($parts[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }

    return 'unknown';
}

function rl_dir()
{
    $base = storage_dir();
    if ($base === false) {
        return false;
    }
    $dir = $base . '/ratelimit';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        return false;
    }
    return $dir;
}

/**
 * Occasionally clear out counters nobody is using, so the directory cannot grow without
 * bound. Done on roughly one request in fifty rather than every time, since it is
 * housekeeping and not worth the disk read on a normal request.
 */
function rl_sweep($dir, $window)
{
    if (random_int(1, 50) !== 1) {
        return;
    }
    $cutoff = time() - ($window * 4);
    foreach (glob($dir . '/*.json') ?: [] as $f) {
        if (@filemtime($f) < $cutoff) {
            @unlink($f);
        }
    }
}

/**
 * Allows $max requests per $window seconds for this caller and bucket.
 *
 * Sends 429 and stops the request when the allowance is spent, so an over-limit caller
 * costs a file read rather than a decode and a disk write.
 *
 * A fixed window, not a sliding one: a caller can in theory spend two allowances across
 * a window boundary. That is a burst of 2x for one moment, which does not matter here,
 * and it avoids keeping a timestamp per request.
 */
function rate_limit($bucket, $max, $window = 60)
{
    $dir = rl_dir();
    if ($dir === false) {
        return;   // Storage unavailable: never block a legitimate request over bookkeeping.
    }

    rl_sweep($dir, $window);

    $key  = preg_replace('/[^a-z0-9_-]/i', '', (string) $bucket);
    $file = $dir . '/' . $key . '-' . md5(rl_client_key()) . '.json';
    $now  = time();

    $state = ['start' => $now, 'count' => 0];
    if (is_file($file)) {
        $parsed = json_decode(@file_get_contents($file), true);
        if (is_array($parsed) && isset($parsed['start'], $parsed['count'])) {
            $state = $parsed;
        }
    }

    if ($now - $state['start'] >= $window) {
        $state = ['start' => $now, 'count' => 0];
    }

    $state['count']++;

    // Written before the verdict, so a refused request still counts against the caller
    // and hammering cannot reset the window.
    @file_put_contents($file, json_encode($state), LOCK_EX);

    if ($state['count'] > $max) {
        $retry = max(1, $window - ($now - $state['start']));
        http_response_code(429);
        header('Retry-After: ' . $retry);
        echo json_encode([
            'error'       => 'Too many requests. Please wait a moment and try again.',
            'retry_after' => $retry,
        ]);
        exit;
    }
}

/**
 * Checks if an IP is currently locked out from login attempts.
 * Returns the number of seconds remaining in the lockout, or 0 if not locked.
 */
function login_is_locked($ip)
{
    $dir = rl_dir();
    if ($dir === false) {
        return 0;
    }
    $file = $dir . '/jail-' . md5((string) $ip) . '.json';
    if (!is_file($file)) {
        return 0;
    }
    $data = json_decode(@file_get_contents($file), true);
    if (!is_array($data) || empty($data['locked_until'])) {
        return 0;
    }
    $now = time();
    if ($now < $data['locked_until']) {
        return (int) ($data['locked_until'] - $now);
    }
    // Expired lockout
    @unlink($file);
    return 0;
}

/**
 * Records a failed login attempt for this IP.
 * If consecutive failed attempts reach $maxFailures (default 10) within $window (default 1 hour),
 * locks the IP out for $jailDuration (default 3600 seconds / 1 hour).
 * Returns true if this attempt triggered a lockout, false otherwise.
 */
function login_record_failure($ip, $maxFailures = 10, $jailDuration = 3600, $window = 3600)
{
    $dir = rl_dir();
    if ($dir === false) {
        return false;
    }
    $file = $dir . '/fail-' . md5((string) $ip) . '.json';
    $now = time();
    $state = ['start' => $now, 'count' => 0];

    if (is_file($file)) {
        $parsed = json_decode(@file_get_contents($file), true);
        if (is_array($parsed) && isset($parsed['start'], $parsed['count'])) {
            $state = $parsed;
        }
    }

    if ($now - $state['start'] >= $window) {
        $state = ['start' => $now, 'count' => 0];
    }

    $state['count']++;
    @file_put_contents($file, json_encode($state), LOCK_EX);

    if ($state['count'] >= $maxFailures) {
        $jailFile = $dir . '/jail-' . md5((string) $ip) . '.json';
        $jailData = ['locked_until' => $now + $jailDuration, 'jailed_at' => $now];
        @file_put_contents($jailFile, json_encode($jailData), LOCK_EX);
        @unlink($file);
        return true;
    }

    return false;
}

/**
 * Clears failed attempts and jail records on a successful login.
 */
function login_record_success($ip)
{
    $dir = rl_dir();
    if ($dir === false) {
        return;
    }
    $failFile = $dir . '/fail-' . md5((string) $ip) . '.json';
    $jailFile = $dir . '/jail-' . md5((string) $ip) . '.json';
    if (is_file($failFile)) {
        @unlink($failFile);
    }
    if (is_file($jailFile)) {
        @unlink($jailFile);
    }
}

