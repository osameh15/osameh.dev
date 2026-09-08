// Privacy-preserving event counter. Same-origin only, no third party.
export function trackEvent(event: string, label = "") {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ event, label: label.slice(0, 120), path: window.location.pathname });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}
