<?php
declare(strict_types=1);

const OWNER = 'osameh15';
function xmlEscape(string $value): string { return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8'); }
function cachePath(): string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $base = $root !== false ? dirname($root) . '/private' : sys_get_temp_dir();
    if (!is_dir($base)) @mkdir($base, 0700, true);
    return rtrim($base, '/') . '/osameh-sitemap-repos.json';
}
function repos(): array {
    $path = cachePath();
    if (is_file($path) && time() - (int)filemtime($path) < 3600) {
        $cached = json_decode((string)file_get_contents($path), true);
        if (is_array($cached)) return $cached;
    }
    if (!function_exists('curl_init')) return [];
    $ch = curl_init('https://api.github.com/users/' . OWNER . '/repos?per_page=100&type=owner&sort=updated');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>3, CURLOPT_TIMEOUT=>6, CURLOPT_HTTPHEADER=>['Accept: application/vnd.github+json','User-Agent: osameh-portfolio-sitemap','X-GitHub-Api-Version: 2022-11-28'], CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER=>true, CURLOPT_SSL_VERIFYHOST=>2]);
    $body = curl_exec($ch); $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if (!is_string($body) || $status < 200 || $status >= 300) return [];
    $data = json_decode($body, true); if (!is_array($data)) return [];
    $out = [];
    foreach ($data as $repo) {
        if (!is_array($repo) || !empty($repo['archived']) || strcasecmp((string)($repo['name'] ?? ''), OWNER) === 0) continue;
        $out[] = ['name'=>(string)$repo['name'], 'updated_at'=>(string)($repo['updated_at'] ?? '')];
    }
    @file_put_contents($path, json_encode($out, JSON_UNESCAPED_SLASHES), LOCK_EX); @chmod($path, 0600);
    return $out;
}

$urls = [
    ['https://osameh.dev/', 'weekly', '1.0', ''],
    ['https://osameh.dev/about', 'monthly', '0.7', ''],
    ['https://osameh.dev/projects', 'weekly', '0.9', ''],
    ['https://osameh.dev/experience', 'monthly', '0.7', ''],
    ['https://osameh.dev/now', 'monthly', '0.7', ''],
    ['https://osameh.dev/changelog', 'monthly', '0.6', ''],
    ['https://osameh.dev/notes', 'weekly', '0.8', ''],
    ['https://osameh.dev/contact', 'monthly', '0.6', ''],
    ['https://osameh.dev/resume', 'monthly', '0.8', ''],
];
$repoItems = repos();
if (!$repoItems) {
    $repoItems = array_map(static fn(string $name): array => ['name' => $name, 'updated_at' => ''], [
        'osameh.dev','Mizekar','Dialysis','YariZan','Form-Management','toast-notifications','confirm-dialogs','input-dialog','ArappMain','ArappMainBack-End','ArappOfficialSite'
    ]);
}
foreach ($repoItems as $repo) {
    $name = (string)($repo['name'] ?? ''); if ($name === '') continue;
    $urls[] = ['https://osameh.dev/projects/' . rawurlencode($name), 'weekly', '0.8', (string)($repo['updated_at'] ?? '')];
}
$notesPath = __DIR__ . '/notes-index.json';
$notes = is_file($notesPath) ? json_decode((string)file_get_contents($notesPath), true) : [];
foreach (is_array($notes) ? $notes : [] as $note) {
    if (!is_array($note) || !preg_match('/^[a-z0-9-]+$/', (string)($note['slug'] ?? ''))) continue;
    $urls[] = ['https://osameh.dev/notes/' . rawurlencode((string)$note['slug']), 'monthly', '0.7', (string)($note['updatedAt'] ?? '')];
}

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
foreach ($urls as [$loc,$freq,$priority,$lastmod]) {
    echo '  <url><loc>' . xmlEscape($loc) . '</loc><changefreq>' . $freq . '</changefreq><priority>' . $priority . '</priority>';
    if ($lastmod !== '') echo '<lastmod>' . xmlEscape(substr($lastmod, 0, 10)) . '</lastmod>';
    echo "</url>\n";
}
echo "</urlset>\n";
