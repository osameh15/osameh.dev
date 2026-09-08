// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, Mail, Send, ShieldCheck } from "lucide-react";
import { notify } from "../../lib/toast";
import { trackEvent } from "../../lib/analytics";
import { executeRecaptcha, loadRecaptcha, recaptchaSiteKey } from "../../config/recaptchaConfig";

export function ContactForm({ fileName = "send-message.ts" }: { fileName?: string }) {
  const [csrf, setCsrf] = useState("");
  // "verifying" covers the reCAPTCHA round trip, "sending" the actual POST, so
  // the two waits are distinguishable to a screen reader and on the button.
  const [state, setState] = useState<"idle" | "verifying" | "sending" | "success" | "error">("idle");
  const [securityState, setSecurityState] = useState<"loading" | "ready" | "fallback">("loading");
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  // Exact-hostname public key. null on an unknown host - never production.
  const siteKey = useMemo(() => recaptchaSiteKey(), []);

  const loadCsrf = async () => {
    try {
      const response = await fetch("/api/contact", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("csrf-bootstrap");
      const data = await response.json();
      const token = String(data.csrf || "");
      setCsrf(token);
      setSecurityState(token ? "ready" : "fallback");
      return token;
    } catch {
      setSecurityState("fallback");
      return "";
    }
  };

  useEffect(() => { void loadCsrf(); }, []);

  // Lazy: the Google script is requested the first time a visitor touches the
  // form, never during initial page load. A warm-up failure is not surfaced
  // here - submission is where the outcome actually matters.
  const warmRecaptcha = () => { if (siteKey) void loadRecaptcha(siteKey).catch(() => undefined); };

  const fail = (message: string) => { setState("error"); setStatus({ tone: "error", message }); notify(message, "error", 4800); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "verifying" || state === "sending") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const subject = String(form.get("subject") || "").trim();
    const bodyMessage = String(form.get("message") || "").trim();
    if (name.length < 2) { fail("Please enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail("Please enter a valid email address."); return; }
    if (subject.length < 3) { fail("Please enter a subject with at least 3 characters."); return; }
    if (bodyMessage.length < 20) { fail("Please write a message with at least 20 characters."); return; }
    if (!siteKey) { fail("Message verification is not configured for this host. Please email osirandoust@gmail.com directly."); return; }

    setStatus(null);
    setState("verifying");
    let recaptchaToken = "";
    try {
      recaptchaToken = await executeRecaptcha(siteKey);
    } catch {
      // Google's own failure detail stays internal; the visitor gets a stable,
      // retryable message.
      fail("Verification could not be completed. Please try again.");
      return;
    }

    setState("sending");
    const token = csrf || await loadCsrf();
    const payload = {
      name,
      email,
      subject,
      message: bodyMessage,
      website: String(form.get("website") || ""),
      csrf: token,
      recaptchaToken,
    };
    try {
      const postMessage = async (body: typeof payload) => {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      };

      let result = await postMessage(payload);
      if (result.response.status === 419 && result.data.csrf) {
        // A rotated CSRF token is retried with the SAME reCAPTCHA token: the
        // first attempt was rejected before verification, so it was not spent.
        const refreshed = String(result.data.csrf);
        setCsrf(refreshed);
        setSecurityState("ready");
        result = await postMessage({ ...payload, csrf: refreshed });
      }

      if (result.data.csrf) { setCsrf(String(result.data.csrf)); setSecurityState("ready"); }
      if (!result.response.ok || !result.data.success) throw new Error(result.data.message || "Message could not be sent right now. Please try again shortly.");
      setState("success");
      setStatus({ tone: "success", message: "Message sent successfully. I will get back to you as soon as I can." });
      notify("Message sent successfully. I will get back to you as soon as I can.", "success", 4200);
      formElement.reset();
      trackEvent("contact_submit", payload.subject || "general");
    } catch (error) {
      fail(error instanceof Error ? error.message : "Message could not be sent right now. Please try again shortly.");
    }
  };

  const securityLabel = securityState === "ready"
    ? "same-origin · CSRF · reCAPTCHA v3 · rate limited"
    : securityState === "loading"
      ? "preparing secure channel…"
      : "same-origin · origin checked · reCAPTCHA v3 · rate limited";
  const pending = state === "verifying" || state === "sending";

  return <form className="contact-form" onSubmit={submit} onFocusCapture={warmRecaptcha} noValidate>
    <div className="contact-form-head"><div><Mail size={17} /><span>{fileName}</span></div><small>{securityLabel}</small></div>
    <div className="contact-form-grid"><label>Name<input name="name" required minLength={2} maxLength={80} autoComplete="name" /></label><label>Email<input name="email" type="email" required maxLength={160} autoComplete="email" /></label></div>
    <label>Subject<input name="subject" required minLength={3} maxLength={120} /></label>
    <label>Message<textarea name="message" required minLength={20} maxLength={5000} rows={6} /></label>
    <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="contact-form-actions">
      <button type="submit" className="primary-btn" disabled={pending}>{state === "verifying" ? <><ShieldCheck size={16} /> Verifying…</> : state === "sending" ? <><LoaderCircle className="spin" size={16} /> Sending…</> : <><Send size={16} /> Send message</>}</button>
      <p className={status ? `form-message ${status.tone}` : "form-message"} data-contact-status={state} role="status" aria-live="polite">{status?.message || (pending ? (state === "verifying" ? "Verifying this submission…" : "Sending your message…") : "")}</p>
    </div>
    <p className="contact-recaptcha-note">Protected by reCAPTCHA. Google&rsquo;s <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.</p>
  </form>;
}
