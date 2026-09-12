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
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP'] as $h) {
        if (!empty($_SERVER[$h])) {
            $parts = explode(',', $_SERVER[$h]);
            $ip = trim($parts[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
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
