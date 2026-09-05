<?php
declare(strict_types=1);

const OWNER = 'osameh15';
const GH_API = '2022-11-28';

function token(): ?string {
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

function gh(string $url): ?array {
    $headers = ['Accept: application/vnd.github+json', 'User-Agent: osameh-portfolio-social', 'X-GitHub-Api-Version: ' . GH_API];
    $t = token(); if ($t) $headers[] = 'Authorization: Bearer ' . $t;
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>4, CURLOPT_TIMEOUT=>8, CURLOPT_HTTPHEADER=>$headers, CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2]);
    $body = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $error = curl_errno($ch); curl_close($ch);
    if ($error !== 0 || $status < 200 || $status >= 300 || !is_string($body)) return null;
    $data = json_decode($body, true); return is_array($data) ? $data : null;
}

function cacheDir(): ?string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $dir = $root !== false ? dirname($root) . '/private/osameh-portfolio-social-cache' : rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-social-cache';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return null;
    return is_writable($dir) ? $dir : null;
}

function repoList(): array {
    $dir = cacheDir(); $path = $dir ? $dir . '/repos.json' : null;
    if ($path && is_file($path) && time() - (int)filemtime($path) < 900) {
        $data = json_decode((string)file_get_contents($path), true); if (is_array($data)) return $data;
    }
    $data = gh('https://api.github.com/users/' . OWNER . '/repos?per_page=100&type=owner&sort=updated') ?? [];
    $repos = array_values(array_filter($data, static fn($r): bool => is_array($r) && empty($r['archived']) && strcasecmp((string)($r['name'] ?? ''), OWNER) !== 0));
    if ($path) { @file_put_contents($path, json_encode($repos, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE), LOCK_EX); @chmod($path, 0600); }
    return $repos;
}

function findRepo(string $name): ?array {
    foreach (repoList() as $repo) if (is_array($repo) && strcasecmp((string)($repo['name'] ?? ''), $name) === 0) return $repo;
    return null;
}

function portfolioMeta(array $repo): ?array {
    $name = (string)($repo['name'] ?? ''); $branch = (string)($repo['default_branch'] ?? 'main');
    if ($name === '') return null;
    $dir = cacheDir(); $path = $dir ? $dir . '/meta-' . hash('sha256', strtolower($name . ':' . $branch)) . '.json' : null;
    if ($path && is_file($path) && time() - (int)filemtime($path) < 21600) {
        $cached = json_decode((string)file_get_contents($path), true); if (is_array($cached)) return $cached;
    }
    $payload = gh('https://api.github.com/repos/' . rawurlencode(OWNER) . '/' . rawurlencode($name) . '/contents/portfolio.json?ref=' . rawurlencode($branch));
    if (!is_array($payload) || ($payload['encoding'] ?? '') !== 'base64' || !is_string($payload['content'] ?? null)) return null;
    $decoded = base64_decode(str_replace(["\r", "\n"], '', $payload['content']), true);
    $meta = is_string($decoded) ? json_decode($decoded, true) : null;
    if (!is_array($meta)) return null;
    if ($path) { @file_put_contents($path, json_encode($meta, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE), LOCK_EX); @chmod($path, 0600); }
    return $meta;
}

function projectImage(array $repo): string {
    $name = (string)($repo['name'] ?? ''); $branch = (string)($repo['default_branch'] ?? 'main');
    if ($name === '') return 'https://osameh.dev/og-cover-social.jpg';
    $dir = cacheDir(); $cache = $dir ? $dir . '/image-' . hash('sha256', strtolower($name)) . '.txt' : null;
    if ($cache && is_file($cache) && time() - (int)filemtime($cache) < 21600) return trim((string)file_get_contents($cache)) ?: 'https://osameh.dev/og-cover-social.jpg';
    $tree = gh('https://api.github.com/repos/' . rawurlencode(OWNER) . '/' . rawurlencode($name) . '/git/trees/' . rawurlencode($branch) . '?recursive=1');
    $candidates = [];
    foreach (is_array($tree['tree'] ?? null) ? $tree['tree'] : [] as $item) {
        if (!is_array($item) || ($item['type'] ?? '') !== 'blob') continue;
        $path = (string)($item['path'] ?? '');
        if (!preg_match('#(^|/)(images?|docs?|screenshots?|media)(/|$)#i', $path) || !preg_match('/\.(?:png|jpe?g|webp|avif)$/i', $path)) continue;
        if (preg_match('/(?:badge|icon|logo|avatar|license)/i', $path)) continue;
        $priority = preg_match('/(?:cover|preview|screenshot|main|splash|dashboard|home)/i', $path) ? 0 : 1;
        $candidates[] = [$priority, $path];
    }
    usort($candidates, static fn($a,$b): int => $a[0] <=> $b[0] ?: strnatcasecmp($a[1], $b[1]));
    $image = 'https://osameh.dev/og-cover-social.jpg';
    if ($candidates) {
        $segments = array_map('rawurlencode', array_values(array_filter(explode('/', $candidates[0][1]), static fn($x): bool => $x !== '')));
        $image = 'https://raw.githubusercontent.com/' . rawurlencode(OWNER) . '/' . rawurlencode($name) . '/' . rawurlencode($branch) . '/' . implode('/', $segments);
    }
    if ($cache) { @file_put_contents($cache, $image, LOCK_EX); @chmod($cache, 0600); }
    return $image;
}

function replaceMeta(string $html, string $property, string $value, bool $name = false): string {
    $attr = $name ? 'name' : 'property'; $escaped = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $pattern = '~<meta\s+' . $attr . '=["\']' . preg_quote($property, '~') . '["\']\s+content=["\'][^"\']*["\']\s*/?>~i';
    $replacement = '<meta ' . $attr . '="' . $property . '" content="' . $escaped . '" />';
    return preg_replace($pattern, $replacement, $html, 1) ?: $html;
}

$requested = trim((string)($_GET['repo'] ?? ''));
if (!preg_match('/^[A-Za-z0-9._-]{1,100}$/', $requested)) { $requested = ''; }
$repo = $requested !== '' ? findRepo($requested) : null;
$index = __DIR__ . '/index.html';
if (!is_file($index)) { http_response_code(500); echo 'Missing index.html'; exit; }
$html = (string)file_get_contents($index);
if ($repo === null) {
    // A real 404 status with our own IDE-style shell as the body. The edge is
    // configured to pass origin errors through, so the browser keeps the original
    // URL and React renders the 404 workspace from window.location.pathname.
    http_response_code(404);
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Portfolio-Route-Status: 404');
    header('Cache-Control: no-store, max-age=0');
    $html = preg_replace('~<title>.*?</title>~is', '<title>404 — Project not found | Osameh Irandoust</title>', $html, 1) ?: $html;
    $html = preg_replace('/<link\s+rel=["\']canonical["\'][^>]*>/i', '', $html) ?: $html;
    $html = preg_replace('/<meta\s+property=["\']og:url["\'][^>]*>/i', '', $html) ?: $html;
    $html = preg_replace('/<meta\s+name=["\']robots["\'][^>]*>/i', '<meta name="robots" content="noindex,nofollow">', $html) ?: $html;
    echo $html;
    exit;
}

$name = (string)$repo['name'];
$meta = portfolioMeta($repo);
$metaProject = is_array($meta['project'] ?? null) ? $meta['project'] : [];
$metaSeo = is_array($meta['seo'] ?? null) ? $meta['seo'] : [];
$projectName = trim((string)($metaProject['name'] ?? '')) ?: $name;
$description = trim((string)($metaSeo['description'] ?? $metaProject['summary'] ?? $repo['description'] ?? '')) ?: 'Explore source, architecture, README, and project visuals on Osameh Irandoust’s software engineering portfolio.';
$title = trim((string)($metaSeo['title'] ?? '')) ?: ($projectName . ' — Osameh Irandoust');
$url = 'https://osameh.dev/projects/' . rawurlencode($name);
$image = 'https://osameh.dev/og/projects/' . rawurlencode($name) . '.jpg';
$html = preg_replace('~<title>.*?</title>~is', '<title>' . htmlspecialchars($title, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '</title>', $html, 1) ?: $html;
$html = replaceMeta($html, 'description', $description, true);
$html = replaceMeta($html, 'og:type', 'article');
$html = replaceMeta($html, 'og:title', $title);
$html = replaceMeta($html, 'og:description', $description);
$html = replaceMeta($html, 'og:url', $url);
$html = replaceMeta($html, 'og:image', $image);
$html = replaceMeta($html, 'og:image:url', $image);
$html = replaceMeta($html, 'og:image:secure_url', $image);
$mime = 'image/jpeg';
$html = replaceMeta($html, 'og:image:type', $mime);
$html = replaceMeta($html, 'og:image:alt', $projectName . ' project preview');
$html = replaceMeta($html, 'twitter:image:alt', $projectName . ' project preview', true);

$html = replaceMeta($html, 'twitter:title', $title, true);
$html = replaceMeta($html, 'twitter:description', $description, true);
$html = replaceMeta($html, 'twitter:image', $image, true);
$html = preg_replace('~<link\s+rel=["\']canonical["\']\s+href=["\'][^"\']*["\']\s*/?>~i', '<link rel="canonical" href="' . htmlspecialchars($url, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '" />', $html, 1) ?: $html;

$metaStack = is_array($meta['stack'] ?? null) ? $meta['stack'] : [];
$metaLinks = is_array($meta['links'] ?? null) ? $meta['links'] : [];
$languages = array_values(array_unique(array_filter(array_map('strval', is_array($metaStack['languages'] ?? null) ? $metaStack['languages'] : [($repo['language'] ?? '')]))));
$keywords = [];
foreach (['languages','frameworks','libraries','platforms','databases','tooling','concepts'] as $stackKey) {
    foreach (is_array($metaStack[$stackKey] ?? null) ? $metaStack[$stackKey] : [] as $value) if (is_scalar($value)) $keywords[] = (string)$value;
}
foreach (is_array($metaSeo['keywords'] ?? null) ? $metaSeo['keywords'] : [] as $value) if (is_scalar($value)) $keywords[] = (string)$value;
$repoUrl = trim((string)($metaLinks['repository'] ?? '')) ?: ('https://github.com/' . OWNER . '/' . rawurlencode($name));
$liveUrl = trim((string)($metaLinks['live'] ?? $metaLinks['demo'] ?? ''));
$structured = [
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => ['SoftwareSourceCode', 'SoftwareApplication'],
            '@id' => $url . '#software',
            'name' => $projectName,
            'headline' => $projectName,
            'description' => $description,
            'url' => $url,
            'codeRepository' => $repoUrl,
            'programmingLanguage' => $languages,
            'keywords' => array_values(array_unique($keywords)),
            'applicationCategory' => trim((string)($metaProject['type'] ?? '')) ?: 'DeveloperApplication',
            'author' => ['@type' => 'Person', '@id' => 'https://osameh.dev/#person', 'name' => 'Osameh Irandoust'],
            'dateCreated' => substr((string)($repo['created_at'] ?? ''), 0, 10),
            'dateModified' => substr((string)($repo['updated_at'] ?? ''), 0, 10),
            'image' => $image,
            'isAccessibleForFree' => true,
        ],
        [
            '@type' => 'BreadcrumbList',
            'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => 'https://osameh.dev/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => 'Projects', 'item' => 'https://osameh.dev/projects'],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $projectName, 'item' => $url],
            ],
        ],
    ],
];
if ($liveUrl !== '') $structured['@graph'][0]['sameAs'] = [$liveUrl, $repoUrl];
if (is_array($repo['license'] ?? null) && trim((string)($repo['license']['spdx_id'] ?? '')) !== '') $structured['@graph'][0]['license'] = (string)$repo['license']['spdx_id'];
$json = json_encode($structured, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
if (is_string($json)) $html = str_replace('</head>', '<script type="application/ld+json" id="project-structured-data">' . $json . '</script></head>', $html);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
header('Vary: Accept-Encoding');
echo $html;
