<?php
declare(strict_types=1);

http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Robots-Tag: noindex, nofollow');

$index = __DIR__ . '/index.html';
if (!is_file($index)) {
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>404 — osameh.dev</title><body><h1>404</h1><p>Route not found.</p></body></html>';
    exit;
}

$html = (string)file_get_contents($index);
// Avoid advertising the root canonical URL from a real 404 response.
$html = preg_replace('/<link\s+rel=["\']canonical["\'][^>]*>/i', '', $html) ?? $html;
$html = preg_replace('/<meta\s+property=["\']og:url["\'][^>]*>/i', '', $html) ?? $html;
$html = preg_replace('/<meta\s+name=["\']robots["\'][^>]*>/i', '<meta name="robots" content="noindex,nofollow">', $html) ?? $html;
echo $html;
