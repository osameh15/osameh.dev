<?php
declare(strict_types=1);

const OG_OWNER = 'osameh15';
const OG_API = '2022-11-28';
const OG_W = 1200;
const OG_H = 630;

function ogToken(): ?string {
    $env = trim((string)getenv('GITHUB_TOKEN'));
    if ($env !== '') return $env;
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $paths = [];
    if ($root !== false) $paths[] = dirname($root) . '/private/osameh-portfolio-secrets.php';
    $home = trim((string)getenv('HOME'));
    if ($home !== '') $paths[] = rtrim($home, '/') . '/.config/osameh-portfolio/secrets.php';
    foreach ($paths as $path) {
        if (!is_file($path) || !is_readable($path)) continue;
        $cfg = require $path;
        if (is_array($cfg) && is_string($cfg['GITHUB_TOKEN'] ?? null) && trim($cfg['GITHUB_TOKEN']) !== '') return trim($cfg['GITHUB_TOKEN']);
    }
    return null;
}

function ogGh(string $url): ?array {
    if (!function_exists('curl_init')) return null;
    $headers = ['Accept: application/vnd.github+json', 'User-Agent: osameh-portfolio-og', 'X-GitHub-Api-Version: ' . OG_API];
    $token = ogToken();
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_errno($ch);
    curl_close($ch);
    if ($error !== 0 || $status < 200 || $status >= 300 || !is_string($body)) return null;
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function ogCacheDir(): ?string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $dir = $root !== false ? dirname($root) . '/private/osameh-portfolio-og-cache' : rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-og-cache';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return null;
    if (!is_writable($dir)) return null;
    @chmod($dir, 0700);
    return $dir;
}

function ogRepoList(): array {
    $dir = ogCacheDir();
    $path = $dir ? $dir . '/repos.json' : null;
    if ($path && is_file($path) && time() - (int)filemtime($path) < 900) {
        $data = json_decode((string)file_get_contents($path), true);
        if (is_array($data)) return $data;
    }
    $data = ogGh('https://api.github.com/users/' . OG_OWNER . '/repos?per_page=100&type=owner&sort=updated') ?? [];
    $repos = array_values(array_filter($data, static fn($r): bool => is_array($r) && empty($r['archived']) && strcasecmp((string)($r['name'] ?? ''), OG_OWNER) !== 0));
    if ($path) { @file_put_contents($path, json_encode($repos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX); @chmod($path, 0600); }
    return $repos;
}

function ogFindRepo(string $name): ?array {
    foreach (ogRepoList() as $repo) if (is_array($repo) && strcasecmp((string)($repo['name'] ?? ''), $name) === 0) return $repo;
    return null;
}

function ogProjectImage(array $repo): ?string {
    $name = (string)($repo['name'] ?? '');
    $branch = (string)($repo['default_branch'] ?? 'main');
    if ($name === '') return null;
    $tree = ogGh('https://api.github.com/repos/' . rawurlencode(OG_OWNER) . '/' . rawurlencode($name) . '/git/trees/' . rawurlencode($branch) . '?recursive=1');
    if (!is_array($tree)) return null;
    $candidates = [];
    foreach (is_array($tree['tree'] ?? null) ? $tree['tree'] : [] as $item) {
        if (!is_array($item) || ($item['type'] ?? '') !== 'blob') continue;
        $path = (string)($item['path'] ?? '');
        if (!preg_match('#(^|/)(images?|docs?|screenshots?|media)(/|$)#i', $path) || !preg_match('/\.(?:png|jpe?g|webp)$/i', $path)) continue;
        if (preg_match('/(?:badge|icon|logo|avatar|license)/i', $path)) continue;
        $priority = preg_match('/(?:cover|preview|screenshot|main|splash|dashboard|home)/i', $path) ? 0 : 1;
        $candidates[] = [$priority, $path];
    }
    if (!$candidates) return null;
    usort($candidates, static fn($a, $b): int => $a[0] <=> $b[0] ?: strnatcasecmp($a[1], $b[1]));
    $segments = array_map('rawurlencode', array_values(array_filter(explode('/', $candidates[0][1]), static fn($x): bool => $x !== '')));
    return 'https://raw.githubusercontent.com/' . rawurlencode(OG_OWNER) . '/' . rawurlencode($name) . '/' . rawurlencode($branch) . '/' . implode('/', $segments);
}

function ogFetchImage(string $url): ?string {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT => 'osameh-portfolio-og-image',
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $type = strtolower((string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE));
    $error = curl_errno($ch);
    curl_close($ch);
    if ($error !== 0 || $status < 200 || $status >= 300 || !is_string($body) || strlen($body) > 8 * 1024 * 1024) return null;
    if ($type !== '' && !str_starts_with($type, 'image/')) return null;
    return $body;
}

function ogSafeText(string $text, int $max = 80): string {
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    return mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
}

function ogFallback(): never {
    header('Location: /og-cover-social.jpg', true, 302);
    header('Cache-Control: public, max-age=900');
    exit;
}

$requested = trim((string)($_GET['repo'] ?? ''));
if (!preg_match('/^[A-Za-z0-9._-]{1,100}$/', $requested)) { http_response_code(404); exit; }
$repo = ogFindRepo($requested);
if ($repo === null) { http_response_code(404); exit; }

// Social crawlers prefer raster images. If GD is unavailable, fall back cleanly
// to the main JPEG cover rather than returning a broken image endpoint.
if (!extension_loaded('gd') || !function_exists('imagecreatetruecolor') || !function_exists('imagejpeg')) ogFallback();

$cacheDir = ogCacheDir();
$cachePath = $cacheDir ? $cacheDir . '/card-' . hash('sha256', strtolower($requested)) . '.jpg' : null;
if ($cachePath && is_file($cachePath) && time() - (int)filemtime($cachePath) < 21600) {
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=21600, stale-while-revalidate=86400');
    header('X-Content-Type-Options: nosniff');
    readfile($cachePath);
    exit;
}

$canvas = imagecreatetruecolor(OG_W, OG_H);
if ($canvas === false) ogFallback();
imagealphablending($canvas, true);
$bg = imagecolorallocate($canvas, 7, 11, 9);
$panel = imagecolorallocate($canvas, 15, 21, 18);
$grid = imagecolorallocate($canvas, 27, 35, 31);
$white = imagecolorallocate($canvas, 244, 247, 245);
$muted = imagecolorallocate($canvas, 166, 177, 170);
$green = imagecolorallocate($canvas, 181, 255, 76);
$dark = imagecolorallocate($canvas, 5, 8, 7);
imagefilledrectangle($canvas, 0, 0, OG_W, OG_H, $bg);

// Subtle IDE grid.
for ($x = 0; $x < OG_W; $x += 40) imageline($canvas, $x, 0, $x, OG_H, $grid);
for ($y = 0; $y < OG_H; $y += 40) imageline($canvas, 0, $y, OG_W, $y, $grid);
imagefilledrectangle($canvas, 54, 54, 530, 576, $panel);
imagefilledrectangle($canvas, 54, 54, 530, 62, $green);

// Try to compose a real project visual from GitHub on the left.
$previewUrl = ogProjectImage($repo);
$previewBody = $previewUrl ? ogFetchImage($previewUrl) : null;
if ($previewBody !== null && function_exists('imagecreatefromstring')) {
    $src = @imagecreatefromstring($previewBody);
    if ($src !== false) {
        $sw = imagesx($src); $sh = imagesy($src);
        $dw = 430; $dh = 410;
        $scale = max($dw / max(1, $sw), $dh / max(1, $sh));
        $cropW = (int)round($dw / $scale); $cropH = (int)round($dh / $scale);
        $sx = max(0, (int)(($sw - $cropW) / 2)); $sy = max(0, (int)(($sh - $cropH) / 2));
        imagecopyresampled($canvas, $src, 77, 88, $sx, $sy, $dw, $dh, $cropW, $cropH);
        imagedestroy($src);
        imagefilledrectangle($canvas, 77, 500, 507, 552, $dark);
        imagestring($canvas, 3, 91, 518, 'PROJECT VISUAL / GITHUB', $green);
    }
} else {
    imagefilledrectangle($canvas, 77, 88, 507, 552, $dark);
    imagestring($canvas, 5, 104, 260, '<' . strtoupper(substr((string)($repo['language'] ?? 'CODE'), 0, 18)) . ' />', $green);
    imagestring($canvas, 3, 104, 300, 'public repository preview', $muted);
}

$name = ogSafeText((string)($repo['name'] ?? 'Project'), 42);
$description = ogSafeText((string)($repo['description'] ?? 'Software engineering project'), 120);
$language = ogSafeText((string)($repo['language'] ?? 'Software'), 30);
$topics = array_values(array_filter(array_map('strval', is_array($repo['topics'] ?? null) ? $repo['topics'] : [])));
$stack = implode('  ·  ', array_slice(array_unique(array_filter([$language, ...$topics])), 0, 4));

imagestring($canvas, 3, 592, 118, 'OSAMEH IRANDOUST / PROJECT', $green);
// Built-in GD fonts are intentionally used so the endpoint has no font-file dependency.
imagestring($canvas, 5, 592, 164, $name, $white);
imagestring($canvas, 4, 592, 220, $stack !== '' ? ogSafeText($stack, 72) : 'Software Engineering', $green);

// Wrap the description to fit the right column.
$words = preg_split('/\s+/u', $description) ?: [];
$lines = []; $line = '';
foreach ($words as $word) {
    $candidate = trim($line . ' ' . $word);
    if (mb_strlen($candidate) > 58 && $line !== '') { $lines[] = $line; $line = $word; }
    else $line = $candidate;
}
if ($line !== '') $lines[] = $line;
$y = 284;
foreach (array_slice($lines, 0, 4) as $text) { imagestring($canvas, 3, 592, $y, $text, $muted); $y += 28; }

imagefilledrectangle($canvas, 592, 438, 1124, 440, $grid);
imagestring($canvas, 3, 592, 474, 'github.com/' . OG_OWNER . '/' . ogSafeText($name, 35), $white);
imagestring($canvas, 4, 592, 526, '>_ osameh.dev/projects/' . ogSafeText($name, 28), $green);

ob_start();
imagejpeg($canvas, null, 88);
$jpeg = (string)ob_get_clean();
imagedestroy($canvas);
if ($jpeg === '') ogFallback();
if ($cachePath) { @file_put_contents($cachePath, $jpeg, LOCK_EX); @chmod($cachePath, 0600); }
header('Content-Type: image/jpeg');
header('Content-Length: ' . strlen($jpeg));
header('Cache-Control: public, max-age=21600, stale-while-revalidate=86400');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
echo $jpeg;
