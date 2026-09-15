// One vocabulary for System Health.
//
// backend/api/health.php reports exactly what each check proved. `deployed`
// and `configured` are healthy resting states that prove less than
// `operational` - an endpoint that exists, a protection that is set up - and
// must never be shown as failures. The interface used a binary
// operational/degraded/else-Down ternary, which rendered every honest resting
// state as Down.
//
// Every label and tone comes from this table. The label text always states the
// status, so colour only reinforces it and is never the sole signal.

export type HealthStatus = "operational" | "deployed" | "configured" | "degraded" | "unavailable" | "down" | "unknown";

/** Visual group: positive, informational (healthy but less proven), warning, error, neutral. */
export type HealthTone = "positive" | "informational" | "warning" | "error" | "neutral";

const STATUSES: Record<HealthStatus, { label: string; tone: HealthTone }> = {
  operational: { label: "Operational", tone: "positive" },
  deployed: { label: "Deployed", tone: "informational" },
  configured: { label: "Configured", tone: "informational" },
  degraded: { label: "Degraded", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "error" },
  down: { label: "Down", tone: "error" },
  unknown: { label: "Unknown", tone: "neutral" },
};

/**
 * Resolves whatever the endpoint sent. A missing or unrecognised value is
 * Unknown: an interface that cannot read a status must not report an outage.
 */
export function healthStatus(value: unknown): { status: HealthStatus; label: string; tone: HealthTone } {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  const status: HealthStatus = Object.hasOwn(STATUSES, key) ? key as HealthStatus : "unknown";
  return { status, ...STATUSES[status] };
}
