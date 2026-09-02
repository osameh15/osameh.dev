<?php
declare(strict_types=1);

function caseReplaceMeta(string $html, string $property, string $value, bool $name = false): string {
    $attr = $name ? 'name' : 'property';
    $escaped = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $pattern = '~<meta\s+' . $attr . '=["\']' . preg_quote($property, '~') . '["\']\s+content=["\'][^"\']*["\']\s*/?>~i';
    return preg_replace($pattern, '<meta ' . $attr . '="' . $property . '" content="' . $escaped . '" />', $html, 1) ?: $html;
}

$id = trim((string)($_GET['id'] ?? ''));
if (!preg_match('/^[a-z0-9-]{1,100}$/', $id)) $id = '';
$indexPath = __DIR__ . '/case-studies-index.json';
$appPath = __DIR__ . '/index.html';
if (!is_file($appPath)) { http_response_code(500); echo 'Missing index.html'; exit; }
$html = (string)file_get_contents($appPath);
$items = is_file($indexPath) ? json_decode((string)file_get_contents($indexPath), true) : [];
$study = null;
foreach (is_array($items) ? $items : [] as $item) {
    if (is_array($item) && (string)($item['id'] ?? '') === $id) { $study = $item; break; }
}

if (!is_array($study)) {
    http_response_code(200);
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Portfolio-Route-Status: 404');
    header('Cache-Control: no-cache, must-revalidate');
    $html = preg_replace('~<title>.*?</title>~is', '<title>404 — Case study not found | Osameh Irandoust</title>', $html, 1) ?: $html;
    $html = preg_replace('/<link\s+rel=["\']canonical["\'][^>]*>/i', '', $html) ?: $html;
    $html = preg_replace('/<meta\s+name=["\']robots["\'][^>]*>/i', '<meta name="robots" content="noindex,nofollow">', $html) ?: $html;
    echo $html;
    exit;
}

$title = (string)$study['title'];
$description = (string)$study['summary'];
$url = 'https://osameh.dev/case-studies/' . rawurlencode($id);
$image = 'https://osameh.dev/og-cover-social.jpg';
$html = preg_replace('~<title>.*?</title>~is', '<title>' . htmlspecialchars($title . ' — Case Study | Osameh Irandoust', ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '</title>', $html, 1) ?: $html;
$html = caseReplaceMeta($html, 'description', $description, true);
$html = caseReplaceMeta($html, 'og:type', 'article');
$html = caseReplaceMeta($html, 'og:title', $title);
$html = caseReplaceMeta($html, 'og:description', $description);
$html = caseReplaceMeta($html, 'og:url', $url);
$html = caseReplaceMeta($html, 'og:image', $image);
$html = caseReplaceMeta($html, 'twitter:title', $title, true);
$html = caseReplaceMeta($html, 'twitter:description', $description, true);
$html = caseReplaceMeta($html, 'twitter:image', $image, true);
$html = preg_replace('~<link\s+rel=["\']canonical["\']\s+href=["\'][^"\']*["\']\s*/?>~i', '<link rel="canonical" href="' . htmlspecialchars($url, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8') . '" />', $html, 1) ?: $html;

$structured = [
    '@context' => 'https://schema.org',
    '@graph' => [
        [
            '@type' => 'Article',
            '@id' => $url . '#case-study',
            'headline' => $title,
            'description' => $description,
            'url' => $url,
            'author' => ['@type' => 'Person', '@id' => 'https://osameh.dev/#person', 'name' => 'Osameh Irandoust'],
            'about' => (string)($study['industry'] ?? 'Software engineering'),
            'keywords' => array_values(is_array($study['stack'] ?? null) ? $study['stack'] : []),
            'inLanguage' => 'en',
        ],
        [
            '@type' => 'BreadcrumbList',
            'itemListElement' => [
                ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => 'https://osameh.dev/'],
                ['@type' => 'ListItem', 'position' => 2, 'name' => 'Case Studies', 'item' => 'https://osameh.dev/case-studies'],
                ['@type' => 'ListItem', 'position' => 3, 'name' => $title, 'item' => $url],
            ],
        ],
    ],
];
$json = json_encode($structured, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$html = str_replace('</head>', '<script type="application/ld+json" id="case-study-structured-data">' . $json . '</script></head>', $html);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=3600');
header('Vary: Accept-Encoding');
echo $html;
