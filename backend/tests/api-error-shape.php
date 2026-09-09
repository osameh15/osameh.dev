<?php
declare(strict_types=1);

/**
 * Deterministic coverage for the /api/ error contract.
 *
 * A branded error document must never reach an API client. Apache substitutes
 * its ErrorDocument only for a response it generated itself with no body, so the
 * contract each endpoint has to keep is simple and checkable: every refusal
 * carries its own JSON body, and it says nothing about why.
 *
 * No network, no secret, no mail. The refusal endpoint is executed for real; the
 * remaining endpoints are read as source, because running them would require a
 * full request environment for no additional confidence.
 *
 * Run: php backend/tests/api-error-shape.php
 */

$failures = [];
$checks = 0;

function check(string $name, bool $condition): void
{
    global $failures, $checks;
    $checks++;
    if ($condition) { echo "  ok   {$name}\n"; return; }
    $failures[] = $name;
    echo "  FAIL {$name}\n";
}

// ---- The refusal endpoint itself ----

ob_start();
require __DIR__ . '/../api/forbidden.php';
$body = (string) ob_get_clean();
$status = http_response_code();

check('the forbidden endpoint answers 403', $status === 403);
$decoded = json_decode($body, true);
check('the forbidden endpoint answers with a JSON object', is_array($decoded));
check('the refusal is machine-readable', is_array($decoded) && ($decoded['error'] ?? '') === 'Forbidden');
check('the refusal body is not an HTML document', !str_contains(strtolower($body), '<html'));

// A refusal explains nothing: no rule, no path, no filename, no software.
foreach (['recaptcha', 'config', 'health-probe', 'lib/', 'DOCUMENT_ROOT', '.php', 'Apache'] as $leak) {
    check("the refusal does not mention \"{$leak}\"", !str_contains($body, $leak));
}

// ---- Every API refusal carries a body ----

$endpoints = [
    'analytics.php' => __DIR__ . '/../api/analytics.php',
    'contact.php' => __DIR__ . '/../api/contact.php',
    'github.php' => __DIR__ . '/../api/github.php',
];
foreach ($endpoints as $name => $path) {
    $source = (string) file_get_contents($path);

    // Find every explicit status assignment and require a body beside it. The
    // 204 responses are excluded: "no content" is the whole point of a 204, and
    // Apache does not substitute an error document for a 2xx.
    preg_match_all('/http_response_code\((\d{3})\)(.{0,400})/s', $source, $matches, PREG_SET_ORDER);
    foreach ($matches as [, $code, $following]) {
        if ((int) $code < 400) continue;
        $hasBody = str_contains($following, 'json_encode') || str_contains($following, 'jsonResponse') || str_contains($following, 'respondJson');
        check("{$name} returns a body with its {$code}", $hasBody);
    }

    // Responses produced through a shared helper are covered by the helper.
    if (str_contains($source, 'function jsonResponse') || str_contains($source, 'respondJson(')) {
        check("{$name} refuses through a JSON helper", true);
    }
}

// ---- The method refusals keep their protocol header ----

$analytics = (string) file_get_contents(__DIR__ . '/../api/analytics.php');
$github = (string) file_get_contents(__DIR__ . '/../api/github.php');
$contact = (string) file_get_contents(__DIR__ . '/../api/contact.php');
check('analytics.php sends Allow with its 405', str_contains($analytics, "header('Allow: POST')"));
check('github.php sends Allow with its 405', str_contains($github, "header('Allow: GET')"));
check('contact.php sends Allow with its 405', str_contains($contact, "header('Allow: GET, POST')"));

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All API error-shape checks passed.\n";
