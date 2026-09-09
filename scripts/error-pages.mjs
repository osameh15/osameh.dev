// The branded HTTP error experience.
//
// One table and one template are the single source of truth for every error
// document. They are rendered into dist/errors/ by ensure-deploy-files.mjs, the
// same post-build assembly step that publishes .htaccess and the service worker,
// and are verified by quality-gates, verify-dist, verify-env and Playwright.
//
// These documents are deliberately static: no React, no bundle, no API call and
// no JavaScript at all. They have to render when the application runtime is the
// thing that failed. The one external reference is /errors/error.css, which the
// strict Content-Security-Policy allows (style-src 'self') and an inline <style>
// block would not.

/**
 * Status → document identity. `reason` is the HTTP reason phrase and `message`
 * is the visitor-facing sentence. Nothing here may describe why the server made
 * the decision: no rule, no path, no software version, no exception text.
 */
export const ERROR_STATUSES = [
  { status: 400, reason: "Bad Request", message: "The server could not understand this request." },
  { status: 401, reason: "Authentication Required", message: "This resource requires authentication." },
  { status: 403, reason: "Forbidden", message: "You don't have permission to access this resource." },
  { status: 404, reason: "Not Found", message: "This route does not exist on osameh.dev." },
  { status: 405, reason: "Method Not Allowed", message: "This resource does not accept that request method." },
  { status: 408, reason: "Request Timeout", message: "The request took too long to arrive. Please try again." },
  { status: 429, reason: "Too Many Requests", message: "Too many requests from this connection. Please try again later." },
  { status: 500, reason: "Internal Server Error", message: "The server ran into an unexpected problem." },
  { status: 502, reason: "Bad Gateway", message: "An upstream service returned an invalid response." },
  { status: 503, reason: "Service Unavailable", message: "The service is temporarily unavailable. Please try again shortly." },
  { status: 504, reason: "Gateway Timeout", message: "An upstream service did not respond in time." },
];

export const ERROR_ROBOTS = "noindex,nofollow,noarchive";

/** The editor tab identity. C++ is the portfolio's default workspace language. */
export const errorTabName = status => `error_${status}.cpp`;

export function renderErrorPage({ status, reason, message }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="${ERROR_ROBOTS}" />
<meta name="color-scheme" content="dark light" />
<meta name="theme-color" content="#090c0a" />
<title>${status} — ${reason} | osameh.dev</title>
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
<link rel="stylesheet" href="/errors/error.css" />
</head>
<body>
<div class="shell">
  <header class="topbar">
    <span class="brand"><img src="/icons/icon-32x32.png" alt="" width="20" height="20" /> osameh.dev</span>
    <span class="env">Cyber Noir</span>
  </header>
  <div class="tabs"><span class="tab" aria-current="page">${errorTabName(status)}</span></div>
  <main class="editor">
    <h1><span class="status">${status}</span> <span class="reason">${reason}</span></h1>
    <pre class="source"><code><span class="c">// ${reason.toLowerCase()}</span>
<span class="k">constexpr int</span> status_code = <span class="n">${status}</span>;
<span class="k">constexpr auto</span> reason = <span class="s">"${reason}"</span>;</code></pre>
    <p class="message">${message}</p>
    <nav class="actions" aria-label="Recovery">
      <a class="action primary" href="/">Go Home</a>
      <a class="action" href="/projects">Back to Portfolio</a>
    </nav>
  </main>
  <footer class="statusbar"><span>osameh.dev</span><span>HTTP ${status}</span></footer>
</div>
</body>
</html>
`;
}

/**
 * One small stylesheet for all eleven documents. Self-contained by design: it
 * imports nothing, loads no font file and shares no build output with the
 * application, so it still renders when the bundle does not.
 */
export const ERROR_CSS = `:root{
  --ink:#e7e9e7;--muted:#8d948e;--green:#b7f264;--line:#262b27;--black:#090c0a;--panel:#0d110f;
  --ui-font:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --code-font:ui-monospace,"SFMono-Regular",Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme: light){
  :root{--ink:#17251c;--muted:#4a5c50;--green:#245f38;--line:#bdcabe;--black:#f3f6f3;--panel:#fff}
}
*{box-sizing:border-box}
html{background:var(--black)}
body{margin:0;min-height:100vh;background:var(--black);color:var(--ink);font-family:var(--ui-font);line-height:1.5}
.shell{min-height:100vh;display:flex;flex-direction:column;max-width:960px;margin:0 auto;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel)}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:.02em}
.brand img{display:block;border-radius:4px}
.env{color:var(--muted);font-family:var(--code-font);font-size:12px}
.tabs{display:flex;border-bottom:1px solid var(--line);background:var(--panel)}
.tab{padding:9px 16px;font-family:var(--code-font);font-size:13px;color:var(--ink);background:var(--black);border-right:1px solid var(--line);border-top:2px solid var(--green)}
.editor{flex:1;padding:40px 20px 48px;display:flex;flex-direction:column;gap:20px;align-items:flex-start}
h1{margin:0;font-size:clamp(28px,7vw,44px);line-height:1.15;display:flex;flex-wrap:wrap;align-items:baseline;gap:12px}
.status{font-family:var(--code-font);color:var(--green)}
.reason{font-weight:600}
.source{margin:0;width:100%;overflow-x:auto;padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);font-family:var(--code-font);font-size:14px;line-height:1.7}
.source .c{color:var(--muted)}
.source .k{color:var(--green)}
.source .n,.source .s{color:var(--ink)}
.message{margin:0;max-width:60ch;color:var(--muted);font-size:16px}
.actions{display:flex;flex-wrap:wrap;gap:12px}
.action{display:inline-flex;align-items:center;min-height:44px;padding:10px 20px;border:1px solid var(--line);border-radius:8px;color:var(--ink);text-decoration:none;font-size:15px;font-weight:500}
.action.primary{border-color:var(--green);color:var(--green)}
.action:hover{border-color:var(--green)}
.action:focus-visible,a:focus-visible{outline:2px solid var(--green);outline-offset:3px}
.statusbar{display:flex;justify-content:space-between;gap:12px;padding:8px 16px;border-top:1px solid var(--line);background:var(--panel);color:var(--muted);font-family:var(--code-font);font-size:12px}
@media (max-width:420px){
  .shell{border-left:0;border-right:0}
  .editor{padding:28px 16px 36px}
}
`;

/** [relative dist path, contents] for every file the error experience ships. */
export function errorPageFiles() {
  return [
    ...ERROR_STATUSES.map(entry => [`errors/${entry.status}.html`, renderErrorPage(entry)]),
    ["errors/error.css", ERROR_CSS],
  ];
}
