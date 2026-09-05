// Executes public/sw.js against a minimal Service Worker environment.
//
// The worker only registers over HTTPS, so a local Playwright run never loads
// it. These checks cover the failure that shipped in v5.1.0: the response clone
// was taken lazily inside the caches.open() callback, by which time the body had
// already been handed to the browser, so clone() threw "Response body is already
// used" as an unhandled rejection.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { pathToFileURL } from "node:url";

export function verifyServiceWorker() {
  const failures = [];
  const source = readFileSync(resolve("public/sw.js"), "utf8");

  const makeResponse = (ok = true) => {
    let bodyUsed = false;
    return {
      ok,
      type: "basic",
      get bodyUsed() { return bodyUsed; },
      consume() { bodyUsed = true; },
      clone() {
        if (bodyUsed) throw new TypeError("Failed to execute 'clone' on 'Response': Response body is already used");
        return makeResponse(ok);
      },
    };
  };

  const run = ({ pathname, mode = "no-cors", cachePutRejects = false, consumeImmediately = true }) => {
    const listeners = {};
    const putCalls = [];
    const rejections = [];
    const network = makeResponse(true);
    const context = {
      self: {
        addEventListener: (type, fn) => { listeners[type] = fn; },
        location: { origin: "https://example.test" },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() },
      },
      caches: {
        // Opening a cache is real IO. Resolving on a later task, rather than a
        // microtask, reproduces the browser ordering where the response body is
        // already being read by the time the cache write runs. A worker that
        // clones inside this callback throws here, exactly as it did in v5.1.0.
        open: () => new Promise(done => setTimeout(() => done({
          put: (request, response) => {
            putCalls.push({ request, bodyUsed: response.bodyUsed });
            return cachePutRejects ? Promise.reject(new Error("quota")) : Promise.resolve();
          },
          addAll: () => Promise.resolve(),
        }), 0)),
        keys: () => Promise.resolve([]),
        delete: () => Promise.resolve(true),
        match: () => Promise.resolve(undefined),
      },
      fetch: () => Promise.resolve(network),
      URL,
      Promise,
      Set,
      TypeError,
      console,
    };
    context.self.caches = context.caches;
    runInNewContext(source, context);

    let responded = null;
    listeners.fetch?.({
      request: { method: "GET", url: `https://example.test${pathname}`, mode },
      respondWith: value => { responded = value; },
    });

    // The browser starts reading the body as soon as respondWith resolves.
    const settled = Promise.resolve(responded).then(response => {
      if (consumeImmediately && response && typeof response.consume === "function") response.consume();
      return response;
    });
    return { settled, putCalls, rejections, network };
  };

  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);

  // 1. An asset request must clone before the body is consumed.
  const asset = run({ pathname: "/assets/index-abc.js" });
  return asset.settled
    .then(() => new Promise(r => setTimeout(r, 10)))
    .then(() => {
      if (!asset.putCalls.length) failures.push("Service worker did not cache a successful asset response");
      else if (asset.putCalls[0].bodyUsed) failures.push("Service worker cached a response whose body was already consumed");

      // 2. A rejected cache write must not surface as an unhandled rejection.
      const failing = run({ pathname: "/assets/index-def.js", cachePutRejects: true });
      return failing.settled.then(() => new Promise(r => setTimeout(r, 10)));
    })
    .then(() => {
      // 3. API requests must never be intercepted at all.
      const api = run({ pathname: "/api/github/file/repo" });
      return api.settled.then(response => {
        if (response !== null && response !== undefined) failures.push("Service worker intercepted an /api/ request instead of leaving it to the network");
        if (api.putCalls.length) failures.push("Service worker cached an /api/ response");
      });
    })
    .then(() => new Promise(r => setTimeout(r, 30)))
    .then(() => {
      process.off("unhandledRejection", onUnhandled);
      for (const reason of unhandled) failures.push(`Service worker produced an unhandled rejection: ${reason && reason.message ? reason.message : reason}`);
      if (!/\/api\//.test(source) || !/startsWith\("\/api\/"\)/.test(source)) failures.push("Service worker no longer bypasses /api/ explicitly");
      return failures;
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = await verifyServiceWorker();
  for (const failure of failures) console.error(`✗ ${failure}`);
  if (failures.length) { console.error(`\nService worker verification failed (${failures.length}).`); process.exit(1); }
  console.log("✓ Service worker clones before body consumption, survives cache failures, and bypasses /api/");
}
