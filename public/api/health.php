<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');

function nowMs(): float { return microtime(true) * 1000; }
function check(string $id, string $label, string $status, ?float $latencyMs = null, string $detail = ''): array {
    return [
        'id' => $id,
        'label' => $label,
        'status' => $status,
        'latencyMs' => $latencyMs !== null ? round($latencyMs, 1) : null,
        'detail' => $detail,
    ];
}

function healthCacheFile(): ?string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $base = $root !== false ? dirname($root) . '/private' : sys_get_temp_dir();
    if (!is_dir($base) && !@mkdir($base, 0700, true)) return null;
    if (!is_writable($base)) return null;
    return rtrim($base, '/') . '/osameh-health-github.json';
}

function githubHealth(): array {
    $cache = healthCacheFile();
    if ($cache && is_file($cache) && time() - (int)filemtime($cache) < 60) {
        $cached = json_decode((string)file_get_contents($cache), true);
        if (is_array($cached)) return $cached;
    }
    if (!function_exists('curl_init')) return check('github', 'GitHub upstream', 'degraded', null, 'cURL unavailable');
    $started = nowMs();
    $ch = curl_init('https://api.github.com/rate_limit');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => [
            'Accept: application/vnd.github+json',
            'User-Agent: osameh-portfolio-health',
            'X-GitHub-Api-Version: 2022-11-28',
        ],
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    curl_exec($ch);
    $statusCode = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_errno($ch);
    curl_close($ch);
    $latency = nowMs() - $started;
    $result = ($error !== 0 || $statusCode < 200 || $statusCode >= 500)
        ? check('github', 'GitHub upstream', 'degraded', $latency, 'Upstream check unavailable')
        : check('github', 'GitHub upstream', 'operational', $latency, 'Public API reachable');
    if ($cache) { @file_put_contents($cache, json_encode($result, JSON_UNESCAPED_SLASHES), LOCK_EX); @chmod($cache, 0600); }
    return $result;
}

$docRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: dirname(__DIR__);
$buildPath = rtrim($docRoot, '/') . '/build-info.json';
$build = ['version' => 'unknown', 'buildId' => 'unknown', 'builtAt' => null, 'environment' => 'production'];
if (is_file($buildPath)) {
    $decoded = json_decode((string)file_get_contents($buildPath), true);
    if (is_array($decoded)) $build = array_merge($build, $decoded);
}

$privateDir = dirname($docRoot) . '/private';
$cacheStatus = 'operational';
$cacheDetail = 'Private cache directory available';
if (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true)) {
    $cacheStatus = 'degraded';
    $cacheDetail = 'Private cache directory unavailable';
} elseif (!is_writable($privateDir)) {
    $cacheStatus = 'degraded';
    $cacheDetail = 'Private directory is not writable';
}

$notesPath = rtrim($docRoot, '/') . '/notes-index.json';
$notesOk = is_file($notesPath) && is_readable($notesPath) && is_array(json_decode((string)file_get_contents($notesPath), true));
$contactPath = __DIR__ . '/contact.php';
$githubProxyPath = __DIR__ . '/github.php';

$checks = [
    check('origin', 'Portfolio origin', 'operational', null, 'PHP runtime responding'),
    githubHealth(),
    check('github-proxy', 'GitHub proxy', is_file($githubProxyPath) ? 'operational' : 'down', null, is_file($githubProxyPath) ? 'Endpoint deployed' : 'Endpoint missing'),
    check('contact', 'Contact API', is_file($contactPath) ? 'operational' : 'down', null, is_file($contactPath) ? 'Endpoint deployed' : 'Endpoint missing'),
    check('notes', 'Engineering Notes', $notesOk ? 'operational' : 'degraded', null, $notesOk ? 'Manifest readable' : 'Notes manifest unavailable'),
    check('cache', 'Private cache', $cacheStatus, null, $cacheDetail),
    check('build', 'Build metadata', is_file($buildPath) ? 'operational' : 'degraded', null, is_file($buildPath) ? 'Build fingerprint available' : 'build-info.json missing'),
];

$overall = 'operational';
foreach ($checks as $item) {
    if ($item['status'] === 'down') { $overall = 'degraded'; break; }
    if ($item['status'] === 'degraded') $overall = 'degraded';
}

http_response_code(200);
echo json_encode([
    'status' => $overall,
    'generatedAt' => gmdate('c'),
    'build' => [
        'version' => (string)($build['version'] ?? 'unknown'),
        'buildId' => (string)($build['buildId'] ?? 'unknown'),
        'builtAt' => $build['builtAt'] ?? null,
        'environment' => (string)($build['environment'] ?? 'production'),
    ],
    'checks' => $checks,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
