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
// Storage bounds. The endpoint is unauthenticated, so both the key length and
// the number of distinct keys per daily file are capped; anything past a cap is
// folded into a single overflow bucket so totals stay correct while the file
// cannot grow without limit.
const MAX_PATH_LENGTH = 120;
const MAX_LABEL_LENGTH = 80;
const MAX_DISTINCT_PATHS = 200;
const MAX_DISTINCT_LABELS = 500;
const OVERFLOW_KEY = '__other';

$label = preg_replace('/[^A-Za-z0-9 ._+\-\/]/u', '', (string)($payload['label'] ?? '')) ?: '';
$label = mb_substr($label, 0, MAX_LABEL_LENGTH);

// Only the internal route is counted. Query strings and fragments are dropped
// before storage: they carry no analytics value here and are the part of the
// path an outside caller can vary without limit.
$rawPath = (string)($payload['path'] ?? '/');
$rawPath = (string)preg_replace('/[?#].*$/', '', $rawPath);
$pathLabel = preg_replace('/[^A-Za-z0-9 ._+\-\/]/u', '', $rawPath) ?: '/';
$pathLabel = '/' . ltrim(mb_substr($pathLabel, 0, MAX_PATH_LENGTH), '/');

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
        if (!is_array($data['events'] ?? null)) $data['events'] = [];
        if (!is_array($data['paths'] ?? null)) $data['paths'] = [];
        if (!is_array($data['labels'] ?? null)) $data['labels'] = [];

        // $event is already restricted to the fixed allow-list above, so only
        // the caller-supplied path and label keys need a distinct-key cap.
        $data['events'][$event] = (int)($data['events'][$event] ?? 0) + 1;

        $pathKey = (isset($data['paths'][$pathLabel]) || count($data['paths']) < MAX_DISTINCT_PATHS) ? $pathLabel : OVERFLOW_KEY;
        $data['paths'][$pathKey] = (int)($data['paths'][$pathKey] ?? 0) + 1;

        if ($label !== '') {
            $labelKey = $event . ':' . $label;
            if (!isset($data['labels'][$labelKey]) && count($data['labels']) >= MAX_DISTINCT_LABELS) $labelKey = OVERFLOW_KEY;
            $data['labels'][$labelKey] = (int)($data['labels'][$labelKey] ?? 0) + 1;
        }
        ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
        @chmod($file, 0600);
    }
}
http_response_code(204);
