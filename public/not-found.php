<?php
declare(strict_types=1);

// A genuine 404 status carrying our own IDE-style shell as the body. The edge
// passes origin errors through, so the browser keeps the original URL and React
// renders the 404 workspace from window.location.pathname. Unknown routes are
// never cached: they are invalid by definition and may become valid later.
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
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
