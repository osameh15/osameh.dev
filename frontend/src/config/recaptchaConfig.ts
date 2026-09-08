/**
 * Google reCAPTCHA v3 public configuration.
 *
 * Site keys are public by design and belong in the frontend bundle. The private
 * secrets never appear here, in any VITE_* variable, or anywhere else the build
 * can reach - they live only in the server-side private secrets file.
 *
 * Selection is exact-hostname. An unknown host - localhost, a preview server, a
 * CI browser, a copied bundle - resolves to no configuration at all rather than
 * quietly borrowing production. UNKNOWN IS NOT PRODUCTION: falling back would
 * send development traffic through the production key and score it as real.
 */

/** The single action name. Frontend and backend must agree on this exact string. */
export const RECAPTCHA_ACTION = "contact_submit";

const SITE_KEYS: Record<string, string> = {
  "osameh.dev": "6LcTG64tAAAAAHrVYba_6oMEyxsfS5ESImlUsmlV",
  "staging.osameh.dev": "6LeD0K8tAAAAAFyi7Hzk0hbFlyDZvoghaEGhQkv0",
};

/** Public site key for a hostname, or null when the host has no configuration. */
export function recaptchaSiteKey(hostname?: string): string | null {
  const host = (hostname ?? (typeof window === "undefined" ? "" : window.location.hostname)).trim().toLowerCase();
  return SITE_KEYS[host] ?? null;
}

type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window { grecaptcha?: Grecaptcha }
}

const SCRIPT_ID = "recaptcha-v3";
const READY_TIMEOUT_MS = 8000;
let loader: Promise<Grecaptcha> | null = null;

/**
 * Loads the reCAPTCHA script on demand and resolves once the API is ready.
 *
 * Nothing here runs at page load: the script is requested when the visitor
 * first touches the contact form, so the portfolio's initial render carries no
 * third-party request. The promise is memoized, so repeated calls reuse one
 * script tag. A blocked or unreachable script rejects on a finite timeout
 * instead of leaving a submission pending forever.
 */
export function loadRecaptcha(siteKey: string): Promise<Grecaptcha> {
  if (loader) return loader;
  loader = new Promise<Grecaptcha>((resolve, reject) => {
    const settle = () => {
      const api = window.grecaptcha;
      if (!api) { reject(new Error("recaptcha-unavailable")); return; }
      api.ready(() => resolve(api));
    };
    if (window.grecaptcha) { settle(); return; }
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
    }
    const timer = window.setTimeout(() => reject(new Error("recaptcha-timeout")), READY_TIMEOUT_MS);
    script.addEventListener("load", () => { window.clearTimeout(timer); settle(); }, { once: true });
    script.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("recaptcha-unavailable")); }, { once: true });
    if (!existing) document.head.appendChild(script);
  }).catch(error => { loader = null; throw error; });
  return loader;
}

/**
 * Fresh token for one submission attempt.
 *
 * A token is generated at the moment of the protected action and is never
 * stored, reused after a send, or replayed after a failure - each retry asks
 * Google for a new one.
 */
export async function executeRecaptcha(siteKey: string): Promise<string> {
  const api = await loadRecaptcha(siteKey);
  const token = await api.execute(siteKey, { action: RECAPTCHA_ACTION });
  if (!token) throw new Error("recaptcha-empty-token");
  return token;
}
