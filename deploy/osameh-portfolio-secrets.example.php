<?php
// Preferred fallback when the shared host has no UI for arbitrary environment variables.
// Place OUTSIDE public_html, for example:
// /home/USERNAME/domains/osameh.dev/private/osameh-portfolio-secrets.php
//
// This file is never committed, never copied into dist/, and never packaged
// into a deploy artifact. Production and staging keep separate document roots,
// so each environment has its own copy holding only its own secret.
//
// Only the SECRETS are read from here. The expected hostname and the verified
// action are code constants in public/api/recaptcha.php: they are the security
// boundary, so an environment block copied to the wrong server cannot move it.
// A mismatch is logged as a safe diagnostic and the code constant still wins.
// 'min_score' is honoured when it is between 0.1 and 1.0, so a deployment may
// raise the threshold but never disable scoring.
//
// The public reCAPTCHA SITE keys are not here. They are public by design and
// live in src/recaptchaConfig.ts, selected by exact hostname.

return [
    'GITHUB_TOKEN' => 'github_pat_REPLACE_ME',

    'RECAPTCHA' => [
        'production' => [
            'secret' => 'PUT_PRODUCTION_RECAPTCHA_SECRET_HERE',
            'hostname' => 'osameh.dev',
            'min_score' => 0.5,
            'action' => 'contact_submit',
        ],

        'staging' => [
            'secret' => 'PUT_STAGING_RECAPTCHA_SECRET_HERE',
            'hostname' => 'staging.osameh.dev',
            'min_score' => 0.5,
            'action' => 'contact_submit',
        ],
    ],
];
