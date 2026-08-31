<?php
declare(strict_types=1);

function jsonResponse(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store, max-age=0');
    header('CDN-Cache-Control: no-store');
    header('Surrogate-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function csrfToken(bool $rotate = false): string {
    if ($rotate || !isset($_SESSION['portfolio_csrf']) || !is_string($_SESSION['portfolio_csrf'])) {
        $_SESSION['portfolio_csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['portfolio_csrf'];
}

function rateDirectory(): ?string {
    $root = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $candidates = [];
    if ($root !== false) $candidates[] = dirname($root) . '/private/osameh-portfolio-contact-rate';
    $candidates[] = rtrim(sys_get_temp_dir(), '/') . '/osameh-portfolio-contact-rate';
    foreach ($candidates as $directory) {
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) continue;
        if (is_writable($directory)) { @chmod($directory, 0700); return $directory; }
    }
    return null;
}

function rateAllowed(): bool {
    $directory = rateDirectory();
    if ($directory === null) return true;
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', 'contact|' . $ip);
    $path = $directory . '/' . $key . '.json';
    $now = time();
    $window = 3600;
    $limit = 4;
    $entries = [];
    if (is_file($path)) {
        $decoded = json_decode((string)@file_get_contents($path), true);
        if (is_array($decoded)) $entries = array_values(array_filter(array_map('intval', $decoded), static fn(int $ts): bool => $now - $ts < $window));
    }
    if (count($entries) >= $limit) return false;
    $entries[] = $now;
    @file_put_contents($path, json_encode($entries), LOCK_EX);
    @chmod($path, 0600);
    return true;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'GET') jsonResponse(['csrf' => csrfToken()]);
if ($method !== 'POST') { header('Allow: GET, POST'); jsonResponse(['success' => false, 'message' => 'Method not allowed.'], 405); }

$origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
if ($origin !== '' && !in_array($origin, ['https://osameh.dev', 'https://www.osameh.dev'], true)) {
    jsonResponse(['success' => false, 'message' => 'Origin rejected.'], 403);
}

$raw = (string)file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) jsonResponse(['success' => false, 'message' => 'Invalid request body.'], 400);

$csrf = (string)($payload['csrf'] ?? '');
if ($csrf === '' || !hash_equals(csrfToken(), $csrf)) jsonResponse(['success' => false, 'message' => 'Your form session expired. Refresh and try again.'], 419);

if (trim((string)($payload['website'] ?? '')) !== '') jsonResponse(['success' => true, 'message' => 'Message accepted.', 'csrf' => csrfToken(true)]);
if (!rateAllowed()) jsonResponse(['success' => false, 'message' => 'Too many messages from this connection. Please try again later.'], 429);

$name = trim((string)($payload['name'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));
$subject = trim((string)($payload['subject'] ?? ''));
$message = trim((string)($payload['message'] ?? ''));

if (mb_strlen($name) < 2 || mb_strlen($name) > 80) jsonResponse(['success' => false, 'message' => 'Please enter a valid name.'], 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) jsonResponse(['success' => false, 'message' => 'Please enter a valid email address.'], 422);
if (mb_strlen($subject) < 3 || mb_strlen($subject) > 120) jsonResponse(['success' => false, 'message' => 'Please enter a short subject.'], 422);
if (mb_strlen($message) < 20 || mb_strlen($message) > 5000) jsonResponse(['success' => false, 'message' => 'Message must be between 20 and 5000 characters.'], 422);

$clean = static fn(string $value): string => str_replace(["\r", "\n"], ' ', $value);
$mailSubject = '[osameh.dev] ' . $clean($subject);
$body = "New portfolio message\n\nName: {$name}\nEmail: {$email}\nSubject: {$subject}\n\n{$message}\n\n---\nSent from osameh.dev";
$headers = [
    'From: osameh.dev <support@osameh.dev>',
    'Reply-To: ' . $clean($name) . ' <' . $clean($email) . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: osameh.dev portfolio',
];

$sent = @mail('osirandoust@gmail.com', $mailSubject, $body, implode("\r\n", $headers));
if (!$sent) jsonResponse(['success' => false, 'message' => 'The server could not hand the message to the mail service. You can still email osirandoust@gmail.com directly.'], 503);

jsonResponse(['success' => true, 'message' => 'Message sent.', 'csrf' => csrfToken(true)]);
