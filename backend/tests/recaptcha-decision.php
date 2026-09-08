<?php
declare(strict_types=1);

/**
 * Deterministic coverage for the reCAPTCHA server-side decision contract.
 *
 * No network, no secret, no email. This file only exercises the pure functions
 * in backend/lib/recaptcha.php, which is where the fail-closed rules live.
 *
 * Run: php backend/tests/recaptcha-decision.php
 */

require_once __DIR__ . '/../lib/recaptcha.php';

$failures = [];
$checks = 0;

function check(string $name, bool $condition): void
{
    global $failures, $checks;
    $checks++;
    if ($condition) {
        echo "  ok   {$name}\n";
        return;
    }
    $failures[] = $name;
    echo "  FAIL {$name}\n";
}

// A configuration fixture. The secret is irrelevant here and deliberately not
// a real value: the decision function never looks at it.
$config = [
    'secret' => 'test-only-not-a-secret',
    'environment' => 'production',
    'hostname' => 'osameh.dev',
    'action' => RECAPTCHA_ACTION,
    'minimum_score' => RECAPTCHA_MINIMUM_SCORE,
];

$valid = ['success' => true, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.9];

echo "recaptcha decision contract\n";

check('accepts a valid response', recaptchaDecision($valid, $config)['ok'] === true);
check('accepts a score exactly at the minimum', recaptchaDecision(['success' => true, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.5], $config)['ok'] === true);
check('accepts case-insensitive hostname', recaptchaDecision(['success' => true, 'action' => 'contact_submit', 'hostname' => 'OSAMEH.DEV', 'score' => 0.7], $config)['ok'] === true);

$cases = [
    'rejects success=false' => [['success' => false, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.9], 'verification_failed'],
    'rejects a missing success flag' => [['action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.9], 'verification_failed'],
    'rejects a truthy non-boolean success' => [['success' => 1, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.9], 'verification_failed'],
    'rejects a wrong action' => [['success' => true, 'action' => 'newsletter_submit', 'hostname' => 'osameh.dev', 'score' => 0.9], 'wrong_action'],
    'rejects a missing action' => [['success' => true, 'hostname' => 'osameh.dev', 'score' => 0.9], 'wrong_action'],
    'rejects a wrong hostname' => [['success' => true, 'action' => 'contact_submit', 'hostname' => 'attacker.example', 'score' => 0.9], 'wrong_hostname'],
    'rejects a staging hostname against production config' => [['success' => true, 'action' => 'contact_submit', 'hostname' => 'staging.osameh.dev', 'score' => 0.9], 'wrong_hostname'],
    'rejects a missing hostname' => [['success' => true, 'action' => 'contact_submit', 'score' => 0.9], 'wrong_hostname'],
    'rejects a score below the minimum' => [['success' => true, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 0.3], 'low_score'],
    'rejects a missing score' => [['success' => true, 'action' => 'contact_submit', 'hostname' => 'osameh.dev'], 'missing_score'],
    'rejects a non-numeric score' => [['success' => true, 'action' => 'contact_submit', 'hostname' => 'osameh.dev', 'score' => 'high'], 'missing_score'],
    'rejects a null response' => [null, 'malformed_response'],
    'rejects a string response' => ['not json', 'malformed_response'],
    'rejects an empty response' => [[], 'verification_failed'],
];

foreach ($cases as $name => [$response, $expectedReason]) {
    $decision = recaptchaDecision($response, $config);
    check($name, $decision['ok'] === false && $decision['reason'] === $expectedReason);
}

echo "\nrecaptcha environment selection\n";
check('osameh.dev selects production', recaptchaEnvironment('osameh.dev') === 'production');
check('www.osameh.dev selects production', recaptchaEnvironment('www.osameh.dev') === 'production');
check('staging.osameh.dev selects staging', recaptchaEnvironment('staging.osameh.dev') === 'staging');
check('a host with a port still resolves', recaptchaEnvironment('staging.osameh.dev:443') === 'staging');
check('localhost selects nothing', recaptchaEnvironment('localhost') === null);
check('127.0.0.1 selects nothing', recaptchaEnvironment('127.0.0.1') === null);
check('an unknown host does not fall back to production', recaptchaEnvironment('osameh.dev.attacker.example') === null);
check('an empty host selects nothing', recaptchaEnvironment('') === null);

check('production expects the apex hostname', recaptchaExpectedHostname('production') === 'osameh.dev');
check('staging expects the staging hostname', recaptchaExpectedHostname('staging') === 'staging.osameh.dev');
check('an unknown environment has no expected hostname', recaptchaExpectedHostname('development') === null);
check('an unknown environment has no configuration', recaptchaConfig('development') === null);

echo "\nminimum score resolution\n";
check('an unset min_score uses the default', recaptchaMinimumScore([]) === RECAPTCHA_MINIMUM_SCORE);
check('a private file may raise the threshold', recaptchaMinimumScore(['min_score' => 0.8]) === 0.8);
check('an integer threshold is accepted', recaptchaMinimumScore(['min_score' => 1]) === 1.0);
check('a zero threshold cannot disable scoring', recaptchaMinimumScore(['min_score' => 0.0]) === RECAPTCHA_MINIMUM_SCORE);
check('a negative threshold falls back to the default', recaptchaMinimumScore(['min_score' => -3]) === RECAPTCHA_MINIMUM_SCORE);
check('an impossible threshold falls back to the default', recaptchaMinimumScore(['min_score' => 5]) === RECAPTCHA_MINIMUM_SCORE);
check('a non-numeric threshold falls back to the default', recaptchaMinimumScore(['min_score' => 'high']) === RECAPTCHA_MINIMUM_SCORE);

echo "\nrecaptcha token guards\n";
$emptyToken = recaptchaVerifyToken('   ', $config);
check('an empty token is rejected without a network call', $emptyToken['ok'] === false && $emptyToken['reason'] === 'missing_token');
$hugeToken = recaptchaVerifyToken(str_repeat('a', 4097), $config);
check('an oversized token is rejected without a network call', $hugeToken['ok'] === false && $hugeToken['reason'] === 'malformed_token');

echo "\nshared contract\n";
check('the action name is contact_submit', RECAPTCHA_ACTION === 'contact_submit');
check('the minimum score is a single 0.5 constant', RECAPTCHA_MINIMUM_SCORE === 0.5);

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All reCAPTCHA decision checks passed.\n";
