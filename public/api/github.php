<?php
declare(strict_types=1);

const GITHUB_USER = 'osameh15';
const API_VERSION = '2022-11-28';
const REPOSITORY_CACHE_KEY = 'repos-v8';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    respondJson(['error' => 'Method not allowed'], 405);
}

$imagesRepo = isset($_GET['images']) ? trim((string) $_GET['images']) : '';
if ($imagesRepo !== '') serveImages($imagesRepo);

$activity = isset($_GET['activity']) ? trim((string) $_GET['activity']) : '';
if ($activity !== '') serveActivity();

$repo = isset($_GET['repo']) ? trim((string) $_GET['repo']) : '';
if ($repo !== '') serveReadme($repo);
serveRepositories();

function serveActivity(): never
{
    $cacheKey = 'activity-v8';
    $fresh = cacheRead($cacheKey, 900);
    if ($fresh !== null) {
        $decoded = json_decode($fresh, true);
        if (is_array($decoded)) respondJson($decoded, 200);
    }

    $result = githubRequest('https://api.github.com/users/' . rawurlencode(GITHUB_USER) . '/events/public?per_page=30', 'application/vnd.github+json');
    if ($result['ok']) {
        $decoded = json_decode($result['body'], true);
        $items = [];
        if (is_array($decoded)) {
            foreach ($decoded as $event) {
                if (!is_array($event)) continue;
                $repoName = (string)($event['repo']['name'] ?? '');
                if ($repoName === '' || !str_starts_with(strtolower($repoName), strtolower(GITHUB_USER) . '/')) continue;
                $short = substr($repoName, strlen(GITHUB_USER) + 1);
                $type = (string)($event['type'] ?? 'Activity');
                $payload = is_array($event['payload'] ?? null) ? $event['payload'] : [];
                $message = match ($type) {
                    'PushEvent' => 'Pushed ' . max(1, count(is_array($payload['commits'] ?? null) ? $payload['commits'] : [])) . ' commit(s)',
                    'CreateEvent' => 'Created ' . ((string)($payload['ref_type'] ?? 'repository item')) . (($payload['ref'] ?? null) ? ': ' . (string)$payload['ref'] : ''),
                    'ReleaseEvent' => 'Published a release',
                    'PullRequestEvent' => ucfirst((string)($payload['action'] ?? 'updated')) . ' a pull request',
                    'IssuesEvent' => ucfirst((string)($payload['action'] ?? 'updated')) . ' an issue',
                    'WatchEvent' => 'Starred the repository',
                    default => preg_replace('/Event$/', '', $type) ?: 'Repository activity',
                };
                $items[] = [
                    'id' => (string)($event['id'] ?? hash('sha256', $repoName . ($event['created_at'] ?? ''))),
                    'type' => $type,
                    'repo' => $short,
                    'message' => $message,
                    'created_at' => (string)($event['created_at'] ?? ''),
                    'url' => 'https://github.com/' . rawurlencode(GITHUB_USER) . '/' . rawurlencode($short),
                ];
                if (count($items) >= 8) break;
            }
        }
        $body = json_encode($items, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (is_string($body)) cacheWrite($cacheKey, $body);
        respondJson($items, 200);
    }

    $stale = cacheRead($cacheKey, 86400 * 7);
    if ($stale !== null) {
        $decoded = json_decode($stale, true);
        if (is_array($decoded)) respondJson($decoded, 200);
    }
    respondJson([], 200);
}

function serveRepositories(): never
{
    respondJson(repositoryList(), 200);
}

function serveReadme(string $repo): never
{
    if (!preg_match('/^[A-Za-z0-9._-]{1,100}$/', $repo)) {
        respondRaw('', 'text/plain; charset=utf-8', 400);
    }

    // Only proxy READMEs belonging to the public repositories exposed by this portfolio.
    // This prevents arbitrary repo-name requests from burning the authenticated GitHub rate limit.
    $canonicalName = allowedRepositoryName($repo);
    if ($canonicalName === null) {
        respondRaw('', 'text/plain; charset=utf-8', 404);
    }

    $cacheKey = 'readme-v5-' . strtolower($canonicalName);
    $fresh = cacheRead($cacheKey, 21600); // 6 hours
    if ($fresh !== null) respondRaw($fresh, 'text/markdown; charset=utf-8', 200);

    // Request JSON and decode base64 ourselves; this is predictable on shared-host proxies.
    $url = 'https://api.github.com/repos/' . rawurlencode(GITHUB_USER) . '/' . rawurlencode($canonicalName) . '/readme';
    $result = githubRequest($url, 'application/vnd.github+json');
    if ($result['ok']) {
        $payload = json_decode($result['body'], true);
        if (is_array($payload)) {
            $markdown = '';
            if (($payload['encoding'] ?? '') === 'base64' && is_string($payload['content'] ?? null)) {
                $decoded = base64_decode(str_replace(["\r", "\n"], '', $payload['content']), true);
                if (is_string($decoded)) $markdown = $decoded;
            }
            if ($markdown === '' && is_string($payload['download_url'] ?? null) && str_starts_with($payload['download_url'], 'https://raw.githubusercontent.com/')) {
                $raw = githubRequest($payload['download_url'], 'text/plain');
                if ($raw['ok']) $markdown = $raw['body'];
            }
            if ($markdown !== '') {
                cacheWrite($cacheKey, $markdown);
                respondRaw($markdown, 'text/markdown; charset=utf-8', 200);
            }
        }
    }

    // A stale README is preferable to a broken project view during a GitHub outage/rate-limit event.
    $stale = cacheRead($cacheKey, 86400 * 30);
    if ($stale !== null) respondRaw($stale, 'text/markdown; charset=utf-8', 200);

    respondRaw('', 'text/markdown; charset=utf-8', 404);
}

function serveImages(string $repo): never
{
    if (!preg_match('/^[A-Za-z0-9._-]{1,100}$/', $repo)) {
        respondJson([], 400);
    }

    $repository = repositoryRecord($repo);
    if ($repository === null) {
        respondJson([], 404);
    }

    $canonicalName = (string) ($repository['name'] ?? '');
    $defaultBranch = (string) ($repository['default_branch'] ?? 'main');
    if ($canonicalName === '' || $defaultBranch === '') {
        respondJson([], 404);
    }

    $cacheKey = 'images-v5-' . strtolower($canonicalName) . '-' . strtolower($defaultBranch);
    $fresh = cacheRead($cacheKey, 21600); // 6 hours
    if ($fresh !== null) {
        $decoded = json_decode($fresh, true);
        if (is_array($decoded)) respondJson($decoded, 200);
    }

    // One recursive Git tree request discovers gallery assets without walking folders one-by-one.
    $url = 'https://api.github.com/repos/' . rawurlencode(GITHUB_USER) . '/' . rawurlencode($canonicalName)
        . '/git/trees/' . rawurlencode($defaultBranch) . '?recursive=1';
    $result = githubRequest($url, 'application/vnd.github+json');
    if ($result['ok']) {
        $payload = json_decode($result['body'], true);
        $tree = is_array($payload) && is_array($payload['tree'] ?? null) ? $payload['tree'] : [];
        $images = [];

        foreach ($tree as $item) {
            if (!is_array($item) || ($item['type'] ?? '') !== 'blob') continue;
            $path = (string) ($item['path'] ?? '');
            if ($path === '' || !isGalleryImagePath($path)) continue;

            $images[] = [
                'path' => $path,
                'name' => basename($path),
                'url' => rawRepositoryUrl($canonicalName, $defaultBranch, $path),
                'source' => 'repository',
            ];
        }

        usort($images, static fn(array $a, array $b): int => strnatcasecmp((string) $a['path'], (string) $b['path']));
        $body = json_encode($images, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (is_string($body)) cacheWrite($cacheKey, $body);
        respondJson($images, 200);
    }

    $stale = cacheRead($cacheKey, 86400 * 30);
    if ($stale !== null) {
        $decoded = json_decode($stale, true);
        if (is_array($decoded)) respondJson($decoded, 200);
    }

    respondJson([], 200);
}

function isGalleryImagePath(string $path): bool
{
    $normalized = str_replace('\\', '/', $path);
    // Keep the gallery focused on project visuals rather than application icon packs and build assets.
    if (!preg_match('#(^|/)(images?|docs?|screenshots?|media)(/|$)#i', $normalized)) return false;
    return (bool) preg_match('/\.(?:png|jpe?g|webp|gif|avif|svg|bmp)$/i', $normalized);
}

function rawRepositoryUrl(string $repo, string $branch, string $path): string
{
    $segments = array_values(array_filter(explode('/', str_replace('\\', '/', $path)), static fn(string $part): bool => $part !== ''));
    $encodedPath = implode('/', array_map('rawurlencode', $segments));
    return 'https://raw.githubusercontent.com/' . rawurlencode(GITHUB_USER) . '/' . rawurlencode($repo) . '/' . rawurlencode($branch) . '/' . $encodedPath;
}

/** @return array<int, array<string, mixed>> */
function repositoryList(): array
{
    $fresh = cacheRead(REPOSITORY_CACHE_KEY, 900); // 15 minutes
    if ($fresh !== null) {
        $decoded = json_decode($fresh, true);
        if (is_array($decoded)) return $decoded;
    }

    $repositories = fetchRepositoriesFromGithub();
    if ($repositories !== null) {
        $body = json_encode($repositories, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (is_string($body)) cacheWrite(REPOSITORY_CACHE_KEY, $body);
        return $repositories;
    }

    $stale = cacheRead(REPOSITORY_CACHE_KEY, 86400 * 7);
    if ($stale !== null) {
        $decoded = json_decode($stale, true);
        if (is_array($decoded)) return $decoded;
    }

    return fallbackRepositories();
}

/** @return array<int, array<string, mixed>>|null */
function fetchRepositoriesFromGithub(): ?array
{
    $result = githubRequest(
        'https://api.github.com/users/' . rawurlencode(GITHUB_USER) . '/repos?per_page=100&sort=updated&type=owner',
        'application/vnd.github+json'
    );
    if (!$result['ok']) return null;

    $decoded = json_decode($result['body'], true);
    if (!is_array($decoded)) return null;

    $repositories = [];
    foreach ($decoded as $item) {
        if (!is_array($item)) continue;
        $name = (string) ($item['name'] ?? '');
        if ($name === '' || strcasecmp($name, GITHUB_USER) === 0 || !empty($item['archived'])) continue;
        $repositories[] = [
            'id' => (int) ($item['id'] ?? 0),
            'name' => $name,
            'description' => isset($item['description']) ? (string) $item['description'] : null,
            'language' => isset($item['language']) ? (string) $item['language'] : null,
            'topics' => array_values(array_filter(array_map('strval', is_array($item['topics'] ?? null) ? $item['topics'] : []))),
            'stargazers_count' => (int) ($item['stargazers_count'] ?? 0),
            'forks_count' => (int) ($item['forks_count'] ?? 0),
            'archived' => false,
            'updated_at' => (string) ($item['updated_at'] ?? ''),
            'fork' => (bool) ($item['fork'] ?? false),
            'default_branch' => (string) ($item['default_branch'] ?? 'main'),
        ];
    }

    usort($repositories, static fn(array $a, array $b): int => strcmp((string) $b['updated_at'], (string) $a['updated_at']));
    return $repositories;
}

/** @return array<string, mixed>|null */
function repositoryRecord(string $requested): ?array
{
    foreach (repositoryList() as $repository) {
        if (!is_array($repository)) continue;
        $name = (string) ($repository['name'] ?? '');
        if ($name !== '' && strcasecmp($name, $requested) === 0) return $repository;
    }
    return null;
}

function allowedRepositoryName(string $requested): ?string
{
    $repository = repositoryRecord($requested);
    return $repository !== null ? (string) ($repository['name'] ?? '') : null;
}

/** @return array{ok: bool, status: int, body: string} */
function githubRequest(string $url, string $accept): array
{
    $headers = [
        'Accept: ' . $accept,
        'User-Agent: osameh-portfolio',
        'X-GitHub-Api-Version: ' . API_VERSION,
    ];
    $token = githubToken();
    if ($token !== null) $headers[] = 'Authorization: Bearer ' . $token;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_errno($ch);
        curl_close($ch);
        return ['ok' => $error === 0 && $status >= 200 && $status < 300 && is_string($body), 'status' => $status, 'body' => is_string($body) ? $body : ''];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $headers),
            'timeout' => 12,
            'ignore_errors' => true,
        ],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $body = @file_get_contents($url, false, $context);
    $status = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match)) $status = (int) $match[1];
    }
    return ['ok' => $status >= 200 && $status < 300 && is_string($body), 'status' => $status, 'body' => is_string($body) ? $body : ''];
}

function githubToken(): ?string
{
    $environment = trim((string) getenv('GITHUB_TOKEN'));
    if ($environment !== '') return $environment;

    $candidates = [];
    $home = trim((string) getenv('HOME'));
    if ($home !== '') $candidates[] = rtrim($home, '/') . '/.config/osameh-portfolio/secrets.php';
    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($documentRoot !== false) $candidates[] = dirname($documentRoot) . '/private/osameh-portfolio-secrets.php';

    foreach (array_unique($candidates) as $path) {
        if (!is_file($path) || !is_readable($path)) continue;
        $config = require $path;
        if (is_array($config) && isset($config['GITHUB_TOKEN']) && is_string($config['GITHUB_TOKEN'])) {
            $token = trim($config['GITHUB_TOKEN']);
            if ($token !== '') return $token;
        }
    }
    return null;
}

function cacheDirectory(): ?string
{
    static $resolved = false;
    static $directory = null;
    if ($resolved) return $directory;
    $resolved = true;

    $candidates = [];
    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($documentRoot !== false) $candidates[] = dirname($documentRoot) . '/private/osameh-portfolio-cache';
    $candidates[] = rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-cache';

    foreach ($candidates as $candidate) {
        if (!is_dir($candidate) && !@mkdir($candidate, 0700, true) && !is_dir($candidate)) continue;
        if (is_writable($candidate)) {
            @chmod($candidate, 0700);
            $directory = $candidate;
            return $directory;
        }
    }
    return null;
}

function cacheRead(string $key, int $maxAge): ?string
{
    $directory = cacheDirectory();
    if ($directory === null) return null;
    $path = $directory . '/' . hash('sha256', $key) . '.cache';
    if (!is_file($path) || (time() - (int) @filemtime($path)) > $maxAge) return null;
    $body = @file_get_contents($path);
    return is_string($body) ? $body : null;
}

function cacheWrite(string $key, string $body): void
{
    $directory = cacheDirectory();
    if ($directory === null) return;
    $path = $directory . '/' . hash('sha256', $key) . '.cache';
    try { $temp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp'; }
    catch (Throwable) { $temp = $path . '.' . uniqid('', true) . '.tmp'; }
    if (@file_put_contents($temp, $body, LOCK_EX) !== false) {
        @chmod($temp, 0600);
        @rename($temp, $path);
    }
    @unlink($temp);
}

function respondJson(array $payload, int $status): never
{
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    respondRaw(is_string($body) ? $body : '{}', 'application/json; charset=utf-8', $status);
}

function respondRaw(string $body, string $contentType, int $status): never
{
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    // Origin cache is handled server-side. Explicitly prevent browser/CDN storage of API responses.
    header('Cache-Control: private, no-store, max-age=0');
    header('CDN-Cache-Control: no-store');
    header('Surrogate-Control: no-store');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex');
    header('Vary: Accept, Accept-Encoding');
    echo $body;
    exit;
}

/** @return array<int, array<string, mixed>> */
function fallbackRepositories(): array
{
    return [
        ['id'=>101,'name'=>'toast-notifications','description'=>'A beautiful, zero-dependency toast notification module for Nuxt 3 and 4.','language'=>'Vue','topics'=>['nuxt','vue','typescript'],'stargazers_count'=>1,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>102,'name'=>'confirm-dialogs','description'=>'Promise-based confirmation dialogs for Nuxt 3 and 4 with accessible RTL support.','language'=>'Vue','topics'=>['nuxt','vue','typescript'],'stargazers_count'=>2,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>103,'name'=>'input-dialog','description'=>'A clean input prompt module for fast user interactions in Nuxt applications.','language'=>'Vue','topics'=>['nuxt','vue','typescript'],'stargazers_count'=>2,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>107,'name'=>'Form-Management','description'=>'A zero-dependency drag-and-drop form builder and renderer for Nuxt 3 and Nuxt 4.','language'=>'TypeScript','topics'=>['nuxt','vue','typescript','form-builder'],'stargazers_count'=>0,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-08-01T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>104,'name'=>'Mizekar','description'=>'A modern fullscreen Windows folder manager with full Persian language support.','language'=>'C#','topics'=>['dotnet','wpf','windows'],'stargazers_count'=>2,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>108,'name'=>'YariZan','description'=>'A modern Persian launcher for educational mini-games for grades 1–6.','language'=>'C#','topics'=>['dotnet','education','games'],'stargazers_count'=>0,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-07-01T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>105,'name'=>'Dialysis','description'=>'An Android application that helps dialysis patients with monitoring and reminders.','language'=>'Java','topics'=>['android','health'],'stargazers_count'=>2,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'master'],
        ['id'=>106,'name'=>'ArappMain','description'=>'An Android rating and review application.','language'=>'Kotlin','topics'=>['android','kotlin'],'stargazers_count'=>2,'forks_count'=>1,'archived'=>false,'updated_at'=>'2026-04-30T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>109,'name'=>'ArappMainBack-End','description'=>'The backend and supporting web application for the Arapp platform.','language'=>'PHP','topics'=>['php','backend','web'],'stargazers_count'=>0,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-03-01T00:00:00Z','fork'=>false,'default_branch'=>'main'],
        ['id'=>110,'name'=>'ArappOfficialSite','description'=>'The official web experience for the Arapp project.','language'=>'PHP','topics'=>['php','web'],'stargazers_count'=>0,'forks_count'=>0,'archived'=>false,'updated_at'=>'2026-03-01T00:00:00Z','fork'=>false,'default_branch'=>'master'],
    ];
}
