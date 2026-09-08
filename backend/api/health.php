<?php
declare(strict_types=1);

// The backend library lives beside this file once deployed, and under
// backend/lib/ in the repository. Resolving both keeps one include correct in
// either tree, and a missing library fails closed instead of raising.
foreach ([__DIR__ . '/config.php', __DIR__ . '/../lib/config.php', __DIR__ . '/api/config.php'] as $portfolioConfigCandidate) {
    if (is_file($portfolioConfigCandidate)) { require_once $portfolioConfigCandidate; break; }
}
foreach ([__DIR__ . '/recaptcha.php', __DIR__ . '/../lib/recaptcha.php', __DIR__ . '/api/recaptcha.php'] as $portfolioRecaptchaCandidate) {
    if (is_file($portfolioRecaptchaCandidate)) { require_once $portfolioRecaptchaCandidate; break; }
}
foreach ([__DIR__ . '/health-probe.php', __DIR__ . '/../lib/health-probe.php', __DIR__ . '/api/health-probe.php'] as $portfolioProbeCandidate) {
    if (is_file($portfolioProbeCandidate)) { require_once $portfolioProbeCandidate; break; }
}

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
    $base = portfolioPrivateDirectory() ?? sys_get_temp_dir();
    if (!is_dir($base) && !@mkdir($base, 0700, true)) return null;
    if (!is_writable($base)) return null;
    return rtrim($base, '/') . '/osameh-health-github.json';
}

function githubHealth(?string $token): array {
    $hasToken = $token !== null && trim($token) !== '';
    $cache = healthCacheFile();
    // The cached verdict is only reusable while the credential state is the
    // same; a token that appeared or was removed changes what the probe means.
    if ($cache && is_file($cache) && time() - (int)filemtime($cache) < 60) {
        $cached = json_decode((string)file_get_contents($cache), true);
        if (is_array($cached) && ($cached['probedWithToken'] ?? null) === $hasToken) {
            unset($cached['probedWithToken']);
            return $cached;
        }
    }

    $probe = githubProbe($token);
    $result = check('github', 'GitHub upstream', $probe['status'], $probe['latencyMs'], $probe['detail']);
    $result['authenticated'] = $probe['authenticated'];

    if ($cache) {
        @file_put_contents($cache, json_encode($result + ['probedWithToken' => $hasToken], JSON_UNESCAPED_SLASHES), LOCK_EX);
        @chmod($cache, 0600);
    }
    return $result;
}

$docRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: dirname(__DIR__);
$buildPath = rtrim($docRoot, '/') . '/build-info.json';
$build = ['version' => 'unknown', 'buildId' => 'unknown', 'builtAt' => null, 'environment' => 'production'];
if (is_file($buildPath)) {
    $decoded = json_decode((string)file_get_contents($buildPath), true);
    if (is_array($decoded)) $build = array_merge($build, $decoded);
}

$privateDir = portfolioPrivateDirectory() ?? (rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-private');
$cacheStatus = 'operational';
$cacheDetail = 'Private cache directory available';
if (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true)) {
    $cacheStatus = 'degraded';
    $cacheDetail = 'Private cache directory unavailable';
} elseif (!is_writable($privateDir)) {
    $cacheStatus = 'degraded';
    $cacheDetail = 'Private directory is not writable';
}

// Contact fails closed without verification, so an unconfigured environment
// means the contact path is genuinely unavailable - reporting it operational
// was a false positive. Only a boolean is derived here; no secret is read into
// a variable that could reach the response.
$recaptchaEnvironment = function_exists('portfolioEnvironment') ? portfolioEnvironment() : null;
$recaptchaConfigured = $recaptchaEnvironment !== null
    && function_exists('recaptchaConfig')
    && recaptchaConfig($recaptchaEnvironment) !== null;
$githubToken = function_exists('portfolioGithubToken') ? portfolioGithubToken() : null;
$githubCheck = githubHealth($githubToken);
// Authenticated now means GitHub accepted this environment's credential, not
// merely that one is configured.
$githubAuthenticated = (bool) ($githubCheck['authenticated'] ?? false);

$notesPath = rtrim($docRoot, '/') . '/notes-index.json';
$notesOk = is_file($notesPath) && is_readable($notesPath) && is_array(json_decode((string)file_get_contents($notesPath), true));
$contactPath = __DIR__ . '/contact.php';
$githubProxyPath = __DIR__ . '/github.php';

$checks = [
    check('origin', 'Portfolio origin', 'operational', null, 'PHP runtime responding'),
    $githubCheck,
    check('github-proxy', 'GitHub proxy', is_file($githubProxyPath) ? 'operational' : 'down', null, is_file($githubProxyPath) ? 'Endpoint deployed' : 'Endpoint missing'),
    check(
        'contact',
        'Contact API',
        !is_file($contactPath) ? 'down' : ($recaptchaConfigured ? 'operational' : 'down'),
        null,
        !is_file($contactPath) ? 'Endpoint missing' : ($recaptchaConfigured ? 'Endpoint deployed' : 'Submission verification is unavailable')
    ),
    check(
        'recaptcha',
        'Contact protection',
        $recaptchaConfigured ? 'operational' : 'down',
        null,
        $recaptchaConfigured ? 'Verification configured for this environment' : 'No verification configuration for this environment'
    ),
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
$serviceStatus = static function (string $id) use ($checks): string {
    foreach ($checks as $item) if ($item['id'] === $id) return (string) $item['status'];
    return 'down';
};

echo json_encode([
    'status' => $overall,
    'environment' => (string)($build['environment'] ?? 'unknown'),
    'generatedAt' => gmdate('c'),
    // Deployment gates read this; the UI still reads checks[].
    'services' => [
        'contact' => ['status' => $serviceStatus('contact')],
        'recaptcha' => ['configured' => $recaptchaConfigured, 'status' => $serviceStatus('recaptcha')],
        'github' => ['status' => $serviceStatus('github'), 'authenticated' => $githubAuthenticated],
    ],
    'build' => [
        'version' => (string)($build['version'] ?? 'unknown'),
        'buildId' => (string)($build['buildId'] ?? 'unknown'),
        'builtAt' => $build['builtAt'] ?? null,
        'environment' => (string)($build['environment'] ?? 'production'),
    ],
    'checks' => $checks,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
