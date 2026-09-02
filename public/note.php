<?php
declare(strict_types=1);

function replaceMeta(string $html, string $property, string $value, bool $name = false): string {
    $attr = $name ? 'name' : 'property';
    $escaped = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $pattern = '~<meta\s+' . $attr . '=["\']' . preg_quote($property, '~') . '["\']\s+content=["\'][^"\']*["\']\s*/?>~i';
    return preg_replace($pattern, '<meta ' . $attr . '="' . $property . '" content="' . $escaped . '" />', $html, 1) ?: $html;
}

$slug = trim((string)($_GET['slug'] ?? ''));
if (!preg_match('/^[a-z0-9-]{1,100}$/', $slug)) $slug = '';
$indexPath = __DIR__ . '/notes-index.json';
$appPath = __DIR__ . '/index.html';
if (!is_file($appPath)) { http_response_code(500); echo 'Missing index.html'; exit; }
$html = (string)file_get_contents($appPath);
$notes = is_file($indexPath) ? json_decode((string)file_get_contents($indexPath), true) : [];
$note = null;
foreach (is_array($notes) ? $notes : [] as $item) {
    if (is_array($item) && (string)($item['slug'] ?? '') === $slug) { $note = $item; break; }
}

if (!is_array($note)) {
    http_response_code(200);
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Portfolio-Route-Status: 404');
    header('Cache-Control: no-cache, must-revalidate');
    $html = preg_replace('~<title>.*?</title>~is', '<title>404 — Note not found | Osameh Irandoust</title>', $html, 1) ?: $html;
    $html = preg_replace('/<link\s+rel=["\']canonical["\'][^>]*>/i', '', $html) ?: $html;
    $html = preg_replace('/<meta\s+name=["\']robots["\'][^>]*>/i', '<meta name="robots" content="noindex,nofollow">', $html) ?: $html;
    echo $html;
    exit;
}

$title = (string)$note['title'];
$description = (string)$note['summary'];
$url = 'https://osameh.dev/notes/' . rawurlencode($slug);
$image = 'https://osameh.dev/og-cover-social.jpg';
$html = preg_replace('~<title>.*?</title>~is', '<title>' . htmlspecialchars($title . ' — Osameh Irandoust', ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '</title>', $html, 1) ?: $html;
$html = replaceMeta($html, 'description', $description, true);
$html = replaceMeta($html, 'og:type', 'article');
$html = replaceMeta($html, 'og:title', $title);
$html = replaceMeta($html, 'og:description', $description);
$html = replaceMeta($html, 'og:url', $url);
$html = replaceMeta($html, 'og:image', $image);
$html = replaceMeta($html, 'twitter:title', $title, true);
$html = replaceMeta($html, 'twitter:description', $description, true);
$html = replaceMeta($html, 'twitter:image', $image, true);
$html = preg_replace('~<link\s+rel=["\']canonical["\']\s+href=["\'][^"\']*["\']\s*/?>~i', '<link rel="canonical" href="' . htmlspecialchars($url, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '" />', $html, 1) ?: $html;

$structured = [
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'TechArticle',
            '@id' => $url . '#article',
            'headline' => $title,
            'description' => $description,
            'url' => $url,
            'datePublished' => (string)($note['publishedAt'] ?? ''),
            'dateModified' => (string)($note['updatedAt'] ?? $note['publishedAt'] ?? ''),
            'author' => ['@type' => 'Person', '@id' => 'https://osameh.dev/#person', 'name' => 'Osameh Irandoust'],
            'keywords' => array_values(is_array($note['tags'] ?? null) ? $note['tags'] : []),
            'inLanguage' => 'en',
        ],
        [
            '@type' => 'BreadcrumbList',
            'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => 'https://osameh.dev/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => 'Engineering Notes', 'item' => 'https://osameh.dev/notes'],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $title, 'item' => $url],
            ],
        ],
    ],
];
$json = json_encode($structured, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$html = str_replace('</head>', '<script type="application/ld+json" id="note-structured-data">' . $json . '</script></head>', $html);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
header('Vary: Accept-Encoding');
echo $html;
