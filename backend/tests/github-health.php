<?php
declare(strict_types=1);

/**
 * Deterministic coverage for the GitHub readiness probe.
 *
 * No network and no real credential. Fixture tokens below are obviously fake
 * and exist only to prove header construction and environment isolation.
 *
 * Run: php backend/tests/github-health.php
 */

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/health-probe.php';

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

echo "probe decision - authenticated environment\n";
$ok = githubHealthDecision(0, 200, true);
check('a successful authenticated probe is operational', $ok['status'] === 'operational');
check('a successful authenticated probe reports authenticated', $ok['authenticated'] === true);
check('the authenticated detail says so', $ok['detail'] === 'Authenticated API reachable');

$rejected401 = githubHealthDecision(0, 401, true);
check('a rejected credential is not authenticated', $rejected401['authenticated'] === false);
check('a rejected credential degrades the service', $rejected401['status'] === 'degraded');
check('a rejected credential is named as such', $rejected401['detail'] === 'GitHub rejected the configured credential');

$rejected403 = githubHealthDecision(0, 403, true);
check('a forbidden authenticated response is not authenticated', $rejected403['authenticated'] === false);
check('a forbidden authenticated response degrades the service', $rejected403['status'] === 'degraded');

echo "\nprobe decision - no credential configured\n";
$anonymous = githubHealthDecision(0, 200, false);
check('an anonymous success is operational', $anonymous['status'] === 'operational');
check('an anonymous success is not authenticated', $anonymous['authenticated'] === false);
check('the anonymous detail says public', $anonymous['detail'] === 'Public API reachable');

// This is the regression the release exists for: an anonymous rate limit is
// GitHub throttling an unauthenticated caller, not a broken credential, and it
// must never be reported as a rejected one.
$anonymousRateLimited = githubHealthDecision(0, 403, false);
check('an anonymous rate limit still proves reachability', $anonymousRateLimited['status'] === 'operational');
check('an anonymous rate limit is not a credential rejection', $anonymousRateLimited['detail'] !== 'GitHub rejected the configured credential');
check('an anonymous rate limit reports no authentication', $anonymousRateLimited['authenticated'] === false);

echo "\nprobe decision - upstream trouble\n";
$timeout = githubHealthDecision(28, 0, true);
check('a transport failure degrades the service', $timeout['status'] === 'degraded');
check('a transport failure does not blame the credential', $timeout['authenticated'] === true);
check('a transport failure is reported as unavailable upstream', $timeout['detail'] === 'Upstream check unavailable');

$serverError = githubHealthDecision(0, 503, true);
check('a 5xx degrades the service', $serverError['status'] === 'degraded');
check('a 5xx does not blame the credential', $serverError['authenticated'] === true);

$noResponse = githubHealthDecision(0, 0, false);
check('no response at all degrades the service', $noResponse['status'] === 'degraded');
check('no response reports no authentication', $noResponse['authenticated'] === false);

echo "\nrequest headers\n";
$anonymousHeaders = githubProbeHeaders(null);
$authenticatedHeaders = githubProbeHeaders('fixture-token-not-a-credential');
$hasAuthorization = static fn(array $headers): bool => (bool) array_filter($headers, static fn(string $header): bool => str_starts_with($header, 'Authorization: '));

check('an anonymous probe sends no Authorization header', !$hasAuthorization($anonymousHeaders));
check('a configured probe sends an Authorization header', $hasAuthorization($authenticatedHeaders));
check('the Authorization header uses the bearer convention', (bool) array_filter($authenticatedHeaders, static fn(string $h): bool => str_starts_with($h, 'Authorization: Bearer ')));
check('an empty token is treated as no token', !$hasAuthorization(githubProbeHeaders('   ')));
foreach (['Accept: application/vnd.github+json', 'User-Agent: osameh-portfolio-health', 'X-GitHub-Api-Version: 2022-11-28'] as $required) {
    check("the probe preserves the header: {$required}", in_array($required, $authenticatedHeaders, true));
}

echo "\nenvironment token isolation\n";
$fixtures = sys_get_temp_dir() . '/osameh-health-fixtures-' . getmypid();
@mkdir($fixtures, 0700, true);
$productionFile = $fixtures . '/production.php';
$stagingFile = $fixtures . '/staging.php';
file_put_contents($productionFile, "<?php return ['GITHUB_TOKEN' => 'fixture-production-token'];\n");
file_put_contents($stagingFile, "<?php return ['GITHUB_TOKEN' => 'fixture-staging-token'];\n");

$fromProduction = portfolioGithubToken($productionFile);
$fromStaging = portfolioGithubToken($stagingFile);
$environmentOverride = getenv('GITHUB_TOKEN');

check('each environment file yields its own token', (bool) $environmentOverride || $fromProduction !== $fromStaging);
check('a missing file yields no token', (bool) $environmentOverride || portfolioGithubToken($fixtures . '/absent.php') === null);
check('a probe built from one environment carries only that token', (bool) $environmentOverride
    || (in_array('Authorization: Bearer ' . $fromStaging, githubProbeHeaders($fromStaging), true)
        && !in_array('Authorization: Bearer ' . $fromProduction, githubProbeHeaders($fromStaging), true)));

array_map('unlink', array_filter(glob($fixtures . '/*') ?: [], 'is_file'));
@rmdir($fixtures);

echo "\nno credential leakage\n";
$rendered = json_encode(['status' => $ok['status'], 'authenticated' => $ok['authenticated'], 'detail' => $ok['detail']]);
check('the decision carries no credential material', !preg_match('/token|bearer|authorization/i', (string) $rendered));

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All GitHub health checks passed.\n";
