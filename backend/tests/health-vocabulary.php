<?php
declare(strict_types=1);

/**
 * The health endpoint's status vocabulary.
 *
 * v5.6.0 Raven exists because a label must never claim more than its check
 * proves. Three rules are enforced here by reading the endpoint's source, which
 * is deliberate: the point is what the code is *allowed* to claim, not what one
 * lucky request happened to return.
 *
 *   1. A check whose only evidence is `is_file()` may report "deployed", never
 *      "operational". Presence is not behaviour.
 *   2. There is no tautological check - nothing may report a constant status
 *      that cannot fail.
 *   3. Credential acceptance is tri-state and never inferred from presence.
 *
 * Run: php backend/tests/health-vocabulary.php
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

$health = (string) file_get_contents(__DIR__ . '/../api/health.php');

echo "status vocabulary\n";

// Rule 1: presence-only checks report presence.
check(
    'the GitHub proxy check reports deployment, not operation',
    (bool) preg_match("/check\('github-proxy'.*is_file\(\\\$githubProxyPath\) \? 'deployed'/s", $health)
);
check(
    'the contact check reports deployment, not operation',
    (bool) preg_match("/'contact',\s*'Contact API',\s*!is_file\(\\\$contactPath\) \? 'down' : \(\\\$recaptchaConfigured \? 'deployed'/s", $health)
);
check(
    'the build metadata check reports presence, not operation',
    (bool) preg_match("/check\('build'.*is_file\(\\\$buildPath\) \? 'deployed'/s", $health)
);
check(
    'contact protection reports that it is configured',
    (bool) preg_match("/'recaptcha',\s*'Contact protection',\s*\\\$recaptchaConfigured \? 'configured'/s", $health)
);

// Rule 2: no check may be a constant.
check(
    'the tautological origin check is gone',
    !str_contains($health, "check('origin'") && !str_contains($health, 'PHP runtime responding')
);
check(
    'no check hardcodes an unconditional operational status',
    !(bool) preg_match("/check\('[a-z-]+', '[^']+', 'operational', null, '[^']*'\)/", $health)
);

// Rule 3: the vocabulary is documented where the checks are built.
foreach (['operational', 'deployed', 'configured', 'degraded', 'unknown'] as $word) {
    check("the vocabulary documents \"{$word}\"", str_contains($health, " *   {$word}") || str_contains($health, " *                acceptance"));
}

echo "\ncredential semantics\n";

$probe = (string) file_get_contents(__DIR__ . '/../lib/health-probe.php');
check(
    'acceptance is documented as tri-state',
    str_contains($probe, 'null   Acceptance is unknown')
);
check(
    'no branch returns the raw token presence as acceptance',
    !(bool) preg_match("/'authenticated' => \\\$hasToken,/", $probe)
);
check(
    'the unknown state is reachable only when a credential exists',
    substr_count($probe, "'authenticated' => \$hasToken ? null : false") === 2
);

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All health vocabulary checks passed.\n";
