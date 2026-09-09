<?php
declare(strict_types=1);

// Every /api/ path that is not an endpoint is answered here.
//
// Backend library includes are required by an entrypoint over the filesystem and
// are never reachable over the web. Refusing them through this file instead of
// through Apache keeps one contract true: a client of /api/ always receives a
// machine-readable JSON body, never a branded HTML error document. The refusal
// itself is unchanged - the include is not executed and not served.
//
// The response says only that access is refused. No path, no rule, no reason.

http_response_code(403);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
echo json_encode(['error' => 'Forbidden'], JSON_UNESCAPED_SLASHES);
