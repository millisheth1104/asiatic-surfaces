<?php
/**
 * Same-origin CORS policy for the JSON endpoints.
 *
 * These endpoints previously answered Access-Control-Allow-Origin: * , so any site on
 * the internet could drive them from a visitor's browser. They accept unauthenticated
 * writes, so the wildcard widened a hole rather than opening one - but there is no
 * reason for another origin to reach them at all: only this site's own pages call them.
 */

function cors_send_headers()
{
    $allowed = [
        'https://fullsheetview.in',
        'https://www.fullsheetview.in',
        'http://localhost:8123',
        'http://127.0.0.1:8123',
    ];

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    // A same-origin fetch sends no Origin header and needs no CORS header at all,
    // so an unlisted origin simply gets none and the browser blocks it.

    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
