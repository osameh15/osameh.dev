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
 *   2. No check may be a tautology - nothing may report a constant status that
 *      cannot fail.
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
$probe = (string) file_get_contents(__DIR__ . '/../lib/health-probe.php');

echo "status vocabulary\n";

// Rule 1: a presence-only check reports presence.
check(
    'the GitHub proxy check reports deployment, not operation',
    str_contains($health, "is_file(\$githubProxyPath) ? 'deployed' : 'down'")
);
check(
    'the contact check reports deployment, not operation',
    str_contains($health, "!is_file(\$contactPath) ? 'down' : (\$recaptchaConfigured ? 'deployed' : 'down')")
);
check(
    'the build metadata check reports presence, not operation',
    str_contains($health, "is_file(\$buildPath) ? 'deployed' : 'degraded'")
);
check(
    'contact protection reports that it is configured',
    str_contains($health, "\$recaptchaConfigured ? 'configured' : 'down'")
);
check(
    'no presence check claims to be operational',
    !str_contains($health, "is_file(\$githubProxyPath) ? 'operational'")
        && !str_contains($health, "is_file(\$buildPath) ? 'operational'")
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

// The vocabulary is documented beside the checks it governs. Each word must be
// defined on its own line: an earlier version of this loop carried an `||`
// fallback that was always true, which made every one of these pass
// unconditionally - a test that cannot fail is the very thing Raven removes.
foreach (['operational', 'deployed', 'configured', 'degraded', 'unavailable', 'unknown'] as $word) {
    check("the vocabulary defines \"{$word}\"", str_contains($health, " *   {$word}"));
}

echo "\ncredential semantics\n";

// Rule 3: acceptance is tri-state, and never the mere presence of a token.
check(
    'acceptance is documented as tri-state',
    str_contains($probe, 'null   Acceptance is unknown')
);
// A 2xx answer with a credential *is* acceptance, so that branch legitimately
// reports $hasToken. What must never happen is an unverified branch doing the
// same: every "Upstream check unavailable" return has to resolve to null or
// false, never to the bare presence of a token.
check(
    'an unverified branch never reports the raw token presence',
    !str_contains($probe, "'authenticated' => \$hasToken, 'detail' => 'Upstream check unavailable'")
);
check(
    'both unavailable branches resolve to unknown or false',
    substr_count($probe, "'authenticated' => \$hasToken ? null : false") === 2
);
check(
    'an explicit rejection is a definite false',
    str_contains($probe, "'authenticated' => false, 'detail' => 'GitHub rejected the configured credential'")
);
check(
    'a probe that never ran does not claim acceptance',
    str_contains($probe, "'detail' => 'cURL unavailable'")
        && !str_contains($probe, "'authenticated' => \$token !== null, 'detail' => 'cURL unavailable'")
);

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All health vocabulary checks passed.\n";
