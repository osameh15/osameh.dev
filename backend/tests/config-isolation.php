<?php
declare(strict_types=1);

/**
 * Deterministic coverage for environment-scoped private configuration.
 *
 * No network, no real secret, no email. Fixtures below contain obviously fake
 * values and exist only to prove the isolation and fail-closed contracts.
 *
 * Run: php backend/tests/config-isolation.php
 */

require_once __DIR__ . '/../lib/config.php';
require_once __DIR__ . '/../lib/recaptcha.php';

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

$fixtures = sys_get_temp_dir() . '/osameh-config-fixtures-' . getmypid();
@mkdir($fixtures, 0700, true);
$write = static function (string $name, string $body) use ($fixtures): string {
    $path = $fixtures . '/' . $name;
    file_put_contents($path, $body);
    return $path;
};

$productionOnly = $write('production-only.php', "<?php return [\n"
    . "  'GITHUB_TOKEN' => 'fixture-production-token',\n"
    . "  'RECAPTCHA' => ['production' => ['secret' => 'fixture-production-secret', 'hostname' => 'osameh.dev', 'min_score' => 0.5]],\n"
    . "];\n");

$stagingOnly = $write('staging-only.php', "<?php return [\n"
    . "  'GITHUB_TOKEN' => 'fixture-staging-token',\n"
    . "  'RECAPTCHA' => ['staging' => ['secret' => 'fixture-staging-secret', 'hostname' => 'staging.osameh.dev', 'min_score' => 0.7]],\n"
    . "];\n");

$malformed = $write('malformed.php', "<?php return 'not an array';\n");
$empty = $write('empty.php', "<?php return [];\n");
$missing = $fixtures . '/does-not-exist.php';

echo "environment resolution\n";
check('osameh.dev is production', portfolioEnvironment('osameh.dev') === 'production');
check('www.osameh.dev is production', portfolioEnvironment('www.osameh.dev') === 'production');
check('staging.osameh.dev is staging', portfolioEnvironment('staging.osameh.dev') === 'staging');
check('a port does not defeat resolution', portfolioEnvironment('staging.osameh.dev:8443') === 'staging');
check('localhost resolves to nothing', portfolioEnvironment('localhost') === null);
check('an unknown host does not become production', portfolioEnvironment('osameh.dev.attacker.example') === null);
check('an empty host resolves to nothing', portfolioEnvironment('') === null);

echo "\nprivate path resolution\n";
check('the private directory sits beside the document root', portfolioPrivateDirectory(sys_get_temp_dir()) === dirname(realpath(sys_get_temp_dir())) . '/private');
check('the secrets file sits in that directory', portfolioSecretsPath(sys_get_temp_dir()) === dirname(realpath(sys_get_temp_dir())) . '/private/osameh-portfolio-secrets.php');
check('an unresolvable document root yields no path', portfolioSecretsPath('/definitely/not/a/real/document/root') === null);

echo "\ncross-environment isolation\n";
check('a production file exposes no staging secret', portfolioRecaptchaEntry('staging', $productionOnly) === []);
check('a staging file exposes no production secret', portfolioRecaptchaEntry('production', $stagingOnly) === []);
check('a production file exposes its own secret', (portfolioRecaptchaEntry('production', $productionOnly)['secret'] ?? '') !== '');
check('a staging file exposes its own secret', (portfolioRecaptchaEntry('staging', $stagingOnly)['secret'] ?? '') !== '');
check('an unknown environment gets nothing from a production file', portfolioRecaptchaEntry('development', $productionOnly) === []);
check('an unknown environment has no reCAPTCHA configuration', recaptchaConfig('development', $productionOnly) === null);
check('staging config is null against a production-only file', recaptchaConfig('staging', $productionOnly) === null);
check('production config is null against a staging-only file', recaptchaConfig('production', $stagingOnly) === null);

echo "\nconfiguration is honoured for the matching environment\n";
$stagingConfig = recaptchaConfig('staging', $stagingOnly);
check('staging resolves its own configuration', is_array($stagingConfig));
check('staging expects its own hostname', ($stagingConfig['hostname'] ?? '') === 'staging.osameh.dev');
check('staging uses the shared action constant', ($stagingConfig['action'] ?? '') === RECAPTCHA_ACTION);
check('a configured minimum score is honoured', ($stagingConfig['minimum_score'] ?? 0.0) === 0.7);
check('the resolved secret is never the other environment secret', ($stagingConfig['secret'] ?? '') !== 'fixture-production-secret');

echo "\nfail-closed configuration\n";
check('a missing file yields no configuration', portfolioSecrets($missing) === []);
check('a missing file yields no token', portfolioGithubToken($missing) === null || getenv('GITHUB_TOKEN'));
check('a missing file yields no reCAPTCHA config', recaptchaConfig('production', $missing) === null);
check('a malformed file yields no configuration', portfolioSecrets($malformed) === []);
check('a malformed file yields no reCAPTCHA config', recaptchaConfig('production', $malformed) === null);
check('an empty file yields no reCAPTCHA config', recaptchaConfig('production', $empty) === null);
check('an empty file yields no entry', portfolioRecaptchaEntry('production', $empty) === []);

echo "\ntoken isolation\n";
$productionToken = portfolioGithubToken($productionOnly);
$stagingToken = portfolioGithubToken($stagingOnly);
check('each environment file yields its own token', getenv('GITHUB_TOKEN') ? true : ($productionToken !== $stagingToken));

echo "\nno path leakage\n";
ob_start();
portfolioSecrets($missing);
portfolioSecrets($malformed);
$printed = (string) ob_get_clean();
check('loading a missing or malformed file prints nothing', $printed === '');
check('no filesystem path is printed', !str_contains($printed, $fixtures));

array_map('unlink', array_filter(glob($fixtures . '/*') ?: [], 'is_file'));
@rmdir($fixtures);

echo "\n{$checks} checks\n";
if ($failures) {
    echo count($failures) . " FAILED\n";
    exit(1);
}
echo "All configuration isolation checks passed.\n";
