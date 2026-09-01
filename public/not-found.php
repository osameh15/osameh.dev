<?php
declare(strict_types=1);

// ParsPack CDN replaces upstream 404 bodies with its own error document.
// Return 200 so the SPA shell reaches the browser, while explicit noindex
// headers/meta keep unknown routes out of search indexes. React still renders
// the IDE-style 404 workspace based on window.location.pathname.
http_response_code(200);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('X-Robots-Tag: noindex, nofollow');
header('X-Portfolio-Route-Status: 404');

$index = __DIR__ . '/index.html';
if (!is_file($index)) {
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>404 — osameh.dev</title><body><h1>404</h1><p>Route not found.</p></body></html>';
    exit;
}

$html = (string)file_get_contents($index);
$html = preg_replace('/<title>.*?<\/title>/is', '<title>404 — Route not found | Osameh Irandoust</title>', $html, 1) ?? $html;
// Avoid advertising the root canonical URL from an unknown-route response.
$html = preg_replace('/<link\s+rel=["\']canonical["\'][^>]*>/i', '', $html) ?? $html;
$html = preg_replace('/<meta\s+property=["\']og:url["\'][^>]*>/i', '', $html) ?? $html;
$html = preg_replace('/<meta\s+name=["\']robots["\'][^>]*>/i', '<meta name="robots" content="noindex,nofollow">', $html) ?? $html;
echo $html;
