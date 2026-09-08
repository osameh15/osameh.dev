<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Google reCAPTCHA v3 server-side verification.
 *
 * This file defines functions only. It performs no work when requested
 * directly and is included by the endpoints that need it.
 *
 * Layout:
 *   recaptchaEnvironment()      which environment this request belongs to
 *   recaptchaConfig()           private secret + expected contract, fail-closed
 *   recaptchaDecision()         PURE decision over a Google response
 *   recaptchaVerifyToken()      network call, then recaptchaDecision()
 *
 * The decision function is deliberately separated from networking so the
 * security contract can be tested deterministically without contacting Google
 * and without any secret being present. See tests/php/recaptcha-decision.php.
 *
 * Nothing in this file logs, echoes or returns the secret or the token.
 */

/** The single action name. Must match RECAPTCHA_ACTION in src/recaptchaConfig.ts. */
const RECAPTCHA_ACTION = 'contact_submit';

/** The single minimum-score default. Never duplicate this literal elsewhere. */
const RECAPTCHA_MINIMUM_SCORE = 0.5;

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_CONNECT_TIMEOUT = 4;
const RECAPTCHA_TOTAL_TIMEOUT = 8;

/**
 * Environment for the current request, derived from the served hostname.
 *
 * An unrecognised host resolves to null. It is never treated as production:
 * a host we do not own must not be able to select the production secret.
 */
function recaptchaEnvironment(?string $host = null): ?string
{
    return portfolioEnvironment($host);
}

/** The hostname Google is expected to report for an environment. */
function recaptchaExpectedHostname(string $environment): ?string
{
    return portfolioExpectedHostname($environment);
}

/**
 * Private configuration for the current environment, or null when it cannot be
 * resolved. Loading mirrors the existing GITHUB_TOKEN pattern: the private
 * secrets file lives outside the document root, is never committed, and never
 * reaches the build.
 *
 * The private file is keyed by environment, matching deploy/
 * osameh-portfolio-secrets.example.php:
 *
 *   ['RECAPTCHA' => ['production' => ['secret' => '...', 'min_score' => 0.5], ...]]
 *
 * The expected hostname and the action are CODE constants, never read from the
 * file: they are the security boundary, and a miscopied environment block must
 * not be able to move it. The file may raise the minimum score, and a value
 * outside 0.1-1.0 is ignored in favour of the default rather than trusted.
 */
function recaptchaConfig(?string $environment = null, ?string $path = null): ?array
{
    $environment ??= recaptchaEnvironment();
    if ($environment === null) return null;
    $expectedHostname = recaptchaExpectedHostname($environment);
    if ($expectedHostname === null) return null;

    $private = recaptchaPrivateEntry($environment, $path);
    $secret = is_string($private['secret'] ?? null) ? trim((string) $private['secret']) : '';
    if ($secret === '') return null;

    return [
        'secret' => $secret,
        'environment' => $environment,
        'hostname' => $expectedHostname,
        'action' => RECAPTCHA_ACTION,
        'minimum_score' => recaptchaMinimumScore($private),
    ];
}

/**
 * The configured minimum score, clamped to a sane band.
 *
 * A private file may raise the threshold. It may not disable scoring: anything
 * outside 0.1-1.0, or anything non-numeric, falls back to the code default.
 */
function recaptchaMinimumScore(array $private): float
{
    $configured = $private['min_score'] ?? null;
    if (!is_int($configured) && !is_float($configured)) return RECAPTCHA_MINIMUM_SCORE;
    $value = (float) $configured;
    if ($value < 0.1 || $value > 1.0) return RECAPTCHA_MINIMUM_SCORE;
    return $value;
}

/**
 * The environment's private entry, read through the one configuration
 * resolver so the isolation contract is defined in a single place.
 *
 * The file may document the hostname and action it was written for. Neither is
 * trusted as configuration - a disagreement means the file was copied between
 * environments, which is worth a safe diagnostic and nothing more, because code
 * already owns both values.
 */
function recaptchaPrivateEntry(string $environment, ?string $path = null): array
{
    $entry = portfolioRecaptchaEntry($environment, $path);
    if (!$entry) return [];

    $declaredHost = is_string($entry['hostname'] ?? null) ? strtolower(trim($entry['hostname'])) : '';
    if ($declaredHost !== '' && $declaredHost !== portfolioExpectedHostname($environment)) {
        error_log('recaptcha: private ' . $environment . ' entry declares a different hostname; using the code constant');
    }
    $declaredAction = is_string($entry['action'] ?? null) ? trim($entry['action']) : '';
    if ($declaredAction !== '' && $declaredAction !== RECAPTCHA_ACTION) {
        error_log('recaptcha: private ' . $environment . ' entry declares a different action; the verified action is the code constant');
    }
    return $entry;
}

/**
 * PURE decision over a decoded Google verification response.
 *
 * Every branch fails closed. The caller may only continue to the mail stage
 * when this returns ok = true.
 *
 * @param mixed $response Decoded JSON from Google, or anything malformed.
 * @return array{ok: bool, reason: string}
 */
function recaptchaDecision(mixed $response, array $config): array
{
    if (!is_array($response)) return ['ok' => false, 'reason' => 'malformed_response'];
    if (($response['success'] ?? null) !== true) return ['ok' => false, 'reason' => 'verification_failed'];

    $action = $response['action'] ?? null;
    if (!is_string($action) || !hash_equals((string) $config['action'], $action)) {
        return ['ok' => false, 'reason' => 'wrong_action'];
    }

    $hostname = $response['hostname'] ?? null;
    if (!is_string($hostname) || strtolower($hostname) !== strtolower((string) $config['hostname'])) {
        return ['ok' => false, 'reason' => 'wrong_hostname'];
    }

    // A v3 response without a numeric score is not a v3 response we can trust.
    $score = $response['score'] ?? null;
    if (!is_int($score) && !is_float($score)) return ['ok' => false, 'reason' => 'missing_score'];
    if ((float) $score < (float) $config['minimum_score']) return ['ok' => false, 'reason' => 'low_score'];

    return ['ok' => true, 'reason' => 'accepted'];
}

/**
 * Verifies a token with Google and returns the decision.
 *
 * Timeouts are finite and TLS verification is never disabled, so an unreachable
 * Google cannot hang a contact request and cannot be bypassed by a downgraded
 * connection. Any transport failure is 'verification_unavailable', which is a
 * closed door, not an open one.
 *
 * @return array{ok: bool, reason: string}
 */
function recaptchaVerifyToken(string $token, array $config): array
{
    $token = trim($token);
    if ($token === '') return ['ok' => false, 'reason' => 'missing_token'];
    if (strlen($token) > 4096) return ['ok' => false, 'reason' => 'malformed_token'];

    $fields = http_build_query([
        'secret' => $config['secret'],
        'response' => $token,
        'remoteip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    ]);

    $body = null;
    if (function_exists('curl_init')) {
        $ch = curl_init(RECAPTCHA_VERIFY_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $fields,
            CURLOPT_CONNECTTIMEOUT => RECAPTCHA_CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT => RECAPTCHA_TOTAL_TIMEOUT,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'User-Agent: osameh-portfolio'],
        ]);
        $result = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $failed = curl_errno($ch) !== 0;
        curl_close($ch);
        if ($failed || $status < 200 || $status >= 300 || !is_string($result)) {
            return ['ok' => false, 'reason' => 'verification_unavailable'];
        }
        $body = $result;
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: osameh-portfolio",
                'content' => $fields,
                'timeout' => RECAPTCHA_TOTAL_TIMEOUT,
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $result = @file_get_contents(RECAPTCHA_VERIFY_URL, false, $context);
        if (!is_string($result)) return ['ok' => false, 'reason' => 'verification_unavailable'];
        $body = $result;
    }

    return recaptchaDecision(json_decode($body, true), $config);
}
