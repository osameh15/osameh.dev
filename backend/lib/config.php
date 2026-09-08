<?php
declare(strict_types=1);

/**
 * Environment and private-configuration resolution.
 *
 * This file defines functions only. It performs no work when requested
 * directly, and `.htaccess` refuses it over the web.
 *
 * ---------------------------------------------------------------------------
 * THE ISOLATION CONTRACT
 * ---------------------------------------------------------------------------
 * Production and staging run from separate document roots, so the private
 * directory beside each root is already environment-local:
 *
 *   production   .../osameh.dev/public_html          -> .../osameh.dev/private
 *   staging      .../osameh.dev/subdomains/staging   -> .../osameh.dev/subdomains/private
 *
 * Exactly ONE candidate path is ever consulted: dirname(DOCUMENT_ROOT)/private.
 * There is deliberately no second candidate, no parent-directory walk and no
 * $HOME fallback. Both environments run as the same OS user, so a $HOME path
 * would be shared between them - one environment could then read the other's
 * credentials, which is precisely what separate document roots exist to
 * prevent. An environment that cannot load its own configuration fails closed.
 *
 * Nothing here echoes, logs or returns a secret value.
 */

/** Environment for a served hostname. Unknown is null - never production. */
function portfolioEnvironment(?string $host = null): ?string
{
    $value = strtolower(trim((string) ($host ?? ($_SERVER['HTTP_HOST'] ?? ''))));
    if ($value === '') return null;
    if (str_contains($value, ':')) $value = (string) strstr($value, ':', true);

    return match ($value) {
        'osameh.dev', 'www.osameh.dev' => 'production',
        'staging.osameh.dev' => 'staging',
        default => null,
    };
}

/** The hostname an environment's reCAPTCHA responses must report. */
function portfolioExpectedHostname(string $environment): ?string
{
    return match ($environment) {
        'production' => 'osameh.dev',
        'staging' => 'staging.osameh.dev',
        default => null,
    };
}

/** The one environment-local private directory, or null when unresolvable. */
function portfolioPrivateDirectory(?string $documentRoot = null): ?string
{
    $root = realpath((string) ($documentRoot ?? ($_SERVER['DOCUMENT_ROOT'] ?? '')));
    if ($root === false) return null;
    return dirname($root) . '/private';
}

/** The one environment-local secrets file, or null when unresolvable. */
function portfolioSecretsPath(?string $documentRoot = null): ?string
{
    $directory = portfolioPrivateDirectory($documentRoot);
    return $directory === null ? null : $directory . '/osameh-portfolio-secrets.php';
}

/**
 * Loads the environment-local private configuration.
 *
 * Returns an empty array for every failure - missing file, unreadable file, a
 * file that does not return an array, or a file that raises. Callers then fail
 * closed on their own terms. A missing or malformed file must never surface a
 * PHP warning: `require` on an absent path prints the absolute filesystem path
 * into the response body, so the file is checked and included defensively.
 *
 * @param string|null $path Overridden only by tests, with a fixture.
 */
function portfolioSecrets(?string $path = null): array
{
    static $cache = [];
    $resolved = $path ?? portfolioSecretsPath();
    if ($resolved === null) return [];
    if (array_key_exists($resolved, $cache)) return $cache[$resolved];

    $loaded = [];
    if (is_file($resolved) && is_readable($resolved)) {
        try {
            $value = @include $resolved;
            if (is_array($value)) $loaded = $value;
            else error_log('config: private configuration did not return an array');
        } catch (Throwable) {
            // The message could carry a path; only the fact is recorded.
            error_log('config: private configuration could not be evaluated');
            $loaded = [];
        }
    } else {
        error_log('config: no environment-local private configuration is readable');
    }

    $cache[$resolved] = $loaded;
    return $loaded;
}

/** The environment's GitHub token, or null. Never falls back to another environment. */
function portfolioGithubToken(?string $path = null): ?string
{
    $fromEnvironment = trim((string) getenv('GITHUB_TOKEN'));
    if ($fromEnvironment !== '') return $fromEnvironment;

    $secrets = portfolioSecrets($path);
    $token = $secrets['GITHUB_TOKEN'] ?? null;
    return is_string($token) && trim($token) !== '' ? trim($token) : null;
}

/**
 * The private reCAPTCHA entry for one environment, or an empty array.
 *
 * Only the environment's OWN block is read. A request served as staging can
 * never reach the production block, and vice versa.
 */
function portfolioRecaptchaEntry(string $environment, ?string $path = null): array
{
    $fromEnvironment = trim((string) getenv('RECAPTCHA_SECRET_' . strtoupper($environment)));
    if ($fromEnvironment !== '') return ['secret' => $fromEnvironment];

    $secrets = portfolioSecrets($path);
    $entry = $secrets['RECAPTCHA'][$environment] ?? null;
    if (!is_array($entry) || !is_string($entry['secret'] ?? null) || trim((string) $entry['secret']) === '') return [];
    return $entry;
}
