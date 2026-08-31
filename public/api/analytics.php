<?php
declare(strict_types=1);

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'POST')) !== 'POST') {
    http_response_code(405); header('Allow: POST'); exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$payload = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($payload)) { http_response_code(204); exit; }
$event = strtolower(trim((string)($payload['event'] ?? '')));
$allowed = ['page_view','project_open','project_share','project_share_copy','project_compare','contact_submit','resume_open','pwa_installed','pwa_install_accept'];
if (!in_array($event, $allowed, true)) { http_response_code(204); exit; }
$label = preg_replace('/[^A-Za-z0-9 ._+\-\/]/u', '', (string)($payload['label'] ?? '')) ?: '';
$label = mb_substr($label, 0, 80);
$pathLabel = preg_replace('/[^A-Za-z0-9 ._+\-\/]/u', '', (string)($payload['path'] ?? '/')) ?: '/';
$pathLabel = mb_substr($pathLabel, 0, 120);

$root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
$directory = $root !== false ? dirname($root) . '/private/osameh-portfolio-analytics' : rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-analytics';
if (!is_dir($directory)) @mkdir($directory, 0700, true);
if (is_dir($directory) && is_writable($directory)) {
    @chmod($directory, 0700);
    $file = $directory . '/' . gmdate('Y-m-d') . '.json';
    $fp = @fopen($file, 'c+');
    if ($fp) {
        flock($fp, LOCK_EX);
        $existing = stream_get_contents($fp);
        $data = json_decode(is_string($existing) ? $existing : '', true);
        if (!is_array($data)) $data = ['events' => [], 'paths' => [], 'labels' => []];
        $data['events'][$event] = (int)($data['events'][$event] ?? 0) + 1;
        $data['paths'][$pathLabel] = (int)($data['paths'][$pathLabel] ?? 0) + 1;
        if ($label !== '') $data['labels'][$event . ':' . $label] = (int)($data['labels'][$event . ':' . $label] ?? 0) + 1;
        ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
        @chmod($file, 0600);
    }
}
http_response_code(204);
