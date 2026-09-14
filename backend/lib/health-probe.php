<?php
declare(strict_types=1);

/**
 * GitHub readiness probe.
 *
 * This file defines functions only. It performs no work when requested
 * directly, and `.htaccess` refuses it over the web.
 *
 * Why this exists as its own unit: the probe used to call GitHub anonymously
 * while the application itself calls it with the environment's token. That made
 * `authenticated` mean nothing more than "a token string is present in
 * configuration" - a revoked or expired token still reported true while every
 * real GitHub feature was failing. The probe now uses the same credential the
 * GitHub proxy uses, so `authenticated` means GitHub actually accepted it.
 *
 * The decision is separated from the network call so the contract can be tested
 * without contacting GitHub and without a credential of any kind.
 */

const GITHUB_HEALTH_URL = 'https://api.github.com/rate_limit';
const GITHUB_HEALTH_CONNECT_TIMEOUT = 3;
const GITHUB_HEALTH_TIMEOUT = 5;

/**
 * Request headers for the probe.
 *
 * The Authorization header is added only when this environment has its own
 * token. The value is never logged or returned; only its presence is asserted
 * by tests.
 *
 * @return string[]
 */
function githubProbeHeaders(?string $token): array
{
    $headers = [
        'Accept: application/vnd.github+json',
        'User-Agent: osameh-portfolio-health',
        'X-GitHub-Api-Version: 2022-11-28',
    ];
    if ($token !== null && trim($token) !== '') $headers[] = 'Authorization: Bearer ' . trim($token);
    return $headers;
}

/**
 * PURE interpretation of a probe result.
 *
 * Three separate facts are reported rather than conflated:
 *   - is a credential configured for this environment
 *   - did GitHub accept it
 *   - is GitHub reachable at all
 *
 * `authenticated` is deliberately tri-state, because "we asked and GitHub
 * accepted" and "we never got an answer" are different facts and only one of
 * them is authentication:
 *
 *   true   GitHub accepted this environment's credential.
 *   false  There is no credential, or GitHub explicitly rejected it.
 *   null   Acceptance is unknown - transport failure, timeout or upstream 5xx.
 *
 * Reporting the token's mere presence as `true` while the probe never
 * completed is the same class of error this file was created to remove: it
 * asserts an acceptance nothing verified.
 *
 * @param int  $errno    cURL error number, 0 when the transport succeeded.
 * @param int  $status   HTTP status, 0 when there was no response.
 * @param bool $hasToken Whether this environment supplied a credential.
 * @return array{status: string, authenticated: bool|null, detail: string}
 */
function githubHealthDecision(int $errno, int $status, bool $hasToken): array
{
    // Transport failure says nothing about the credential, only about reach.
    // Without a credential there is nothing to accept, so that stays false;
    // with one, acceptance is simply unknown.
    if ($errno !== 0) {
        return ['status' => 'degraded', 'authenticated' => $hasToken ? null : false, 'detail' => 'Upstream check unavailable'];
    }

    // A credential that GitHub refuses is the case worth shouting about: the
    // application's own GitHub traffic is failing even though a token exists.
    if ($hasToken && ($status === 401 || $status === 403)) {
        return ['status' => 'degraded', 'authenticated' => false, 'detail' => 'GitHub rejected the configured credential'];
    }

    // GitHub answered with a fault, or did not answer at all. Reachability is
    // degraded and the credential was never judged.
    if ($status < 200 || $status >= 500) {
        return ['status' => 'degraded', 'authenticated' => $hasToken ? null : false, 'detail' => 'Upstream check unavailable'];
    }

    // Without a token an anonymous 403 is GitHub's unauthenticated rate limit,
    // not a rejection. GitHub answered, so it is reachable.
    return [
        'status' => 'operational',
        'authenticated' => $hasToken,
        'detail' => $hasToken ? 'Authenticated API reachable' : 'Public API reachable',
    ];
}

/**
 * Performs the probe and interprets it.
 *
 * Timeouts stay finite and TLS verification stays on, so a slow or hostile
 * upstream can neither hang the health endpoint nor be downgraded.
 *
 * @return array{status: string, authenticated: bool, detail: string, latencyMs: float|null}
 */
function githubProbe(?string $token): array
{
    if (!function_exists('curl_init')) {
        // No probe was performed at all, so acceptance is unknown, not true.
        return ['status' => 'degraded', 'authenticated' => ($token !== null && trim($token) !== '') ? null : false, 'detail' => 'cURL unavailable', 'latencyMs' => null];
    }

    $started = microtime(true) * 1000;
    $ch = curl_init(GITHUB_HEALTH_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_NOBODY => true,
        CURLOPT_CONNECTTIMEOUT => GITHUB_HEALTH_CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT => GITHUB_HEALTH_TIMEOUT,
        CURLOPT_HTTPHEADER => githubProbeHeaders($token),
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);
    curl_close($ch);

    $decision = githubHealthDecision($errno, $status, $token !== null && trim($token) !== '');
    $decision['latencyMs'] = (microtime(true) * 1000) - $started;
    return $decision;
}
