/**
 * The section 9.9 metrics, declared once and exported by every process.
 *
 * All twelve are registered everywhere, not only where they are written: a
 * dashboard that asks for `rr_revenue_minor_total` should find the series
 * whichever target answered, and a metric family with no observations costs
 * two lines of text. Each process increments the ones it owns.
 */
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
  type MetricObjectWithValues,
  type MetricValue,
} from 'prom-client';

export const registry = new Registry();

// Section 20.2 dashboards read process memory, the event loop and GC from the
// same scrape, so the Node.js defaults go into the same registry.
collectDefaultMetrics({ register: registry });

/** Seconds; the same buckets for every latency in the system. */
const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export const httpRequestsTotal = new Counter({
  name: 'rr_http_requests_total',
  help: 'HTTP requests served, by route template and status.',
  labelNames: ['route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'rr_http_request_duration_seconds',
  help: 'How long an HTTP request took to serve, in seconds.',
  labelNames: ['route', 'status'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const paymentsEventsTotal = new Counter({
  name: 'rr_payments_events_total',
  help: 'Provider webhook events received, by provider, event type and outcome.',
  labelNames: ['provider', 'type', 'result'] as const,
  registers: [registry],
});

export const invoicesTotal = new Counter({
  name: 'rr_invoices_total',
  help: 'Invoices that reached a status, by provider.',
  labelNames: ['provider', 'status'] as const,
  registers: [registry],
});

export const revenueMinorTotal = new Counter({
  name: 'rr_revenue_minor_total',
  help: 'Revenue recognised, in minor units, by provider.',
  labelNames: ['provider'] as const,
  registers: [registry],
});

export const panelRequestsTotal = new Counter({
  name: 'rr_panel_requests_total',
  help: 'Requests to the Remnawave panel, by operation and HTTP status.',
  labelNames: ['op', 'status'] as const,
  registers: [registry],
});

export const panelRequestDuration = new Histogram({
  name: 'rr_panel_request_duration_seconds',
  help: 'How long a panel request took, in seconds.',
  labelNames: ['op'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const queueJobs = new Gauge({
  name: 'rr_queue_jobs',
  help: 'Jobs in each queue, by state.',
  labelNames: ['queue', 'state'] as const,
  registers: [registry],
});

export const botUpdatesTotal = new Counter({
  name: 'rr_bot_updates_total',
  help: 'Telegram updates handled, by update type.',
  labelNames: ['type'] as const,
  registers: [registry],
});

export const notificationsTotal = new Counter({
  name: 'rr_notifications_total',
  help: 'Notifications attempted, by event and delivery status.',
  labelNames: ['event', 'status'] as const,
  registers: [registry],
});

export const tlsCertExpirySeconds = new Gauge({
  name: 'rr_tls_cert_expiry_seconds',
  help: 'Seconds until the served certificate expires; negative once it has.',
  registers: [registry],
});

export const ledgerAuditMismatchTotal = new Counter({
  name: 'rr_ledger_audit_mismatch_total',
  help: 'Ledger audits that found the accounts and the entries disagreeing.',
  registers: [registry],
});

/**
 * Section 9.8: v1 keeps no table of outgoing webhook deliveries, only the log
 * and this count of failed attempts, a retried one counted each time.
 */
export const outgoingWebhookFailuresTotal = new Counter({
  name: 'rr_outgoing_webhook_failures_total',
  help: 'Outgoing webhook delivery attempts that did not end in a 2xx answer.',
  registers: [registry],
});

/** The names section 9.9 lists, in its order. */
export const SECTION_9_9_METRICS = [
  'rr_http_requests_total',
  'rr_http_request_duration_seconds',
  'rr_payments_events_total',
  'rr_invoices_total',
  'rr_revenue_minor_total',
  'rr_panel_requests_total',
  'rr_panel_request_duration_seconds',
  'rr_queue_jobs',
  'rr_bot_updates_total',
  'rr_notifications_total',
  'rr_tls_cert_expiry_seconds',
  'rr_ledger_audit_mismatch_total',
] as const;

export const metricsContentType = registry.contentType;

export function metricsText(): Promise<string> {
  return registry.metrics();
}

/** For tests: what the registry currently holds, without rendering it. */
export function metricValues(): Promise<MetricObjectWithValues<MetricValue<string>>[]> {
  return registry.getMetricsAsJSON();
}

/**
 * Seconds from now until `expiresAt`, which is what section 9.9 asks for. A
 * certificate that has already expired reads negative rather than zero, so an
 * alert can tell "expired" from "never measured".
 */
export function recordTlsExpiry(expiresAt: Date | string | null): void {
  if (expiresAt === null) return;
  const at = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(at.getTime())) return;
  tlsCertExpirySeconds.set((at.getTime() - Date.now()) / 1000);
}

/**
 * A route template, not the path that was requested: `/admin/users/123` and
 * `/admin/users/456` are one series, and an unbounded label set is how a
 * metrics endpoint becomes the thing that falls over.
 */
export function observeHttpRequest(route: string, status: number, seconds: number): void {
  const labels = { route, status: String(status) };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, seconds);
}
