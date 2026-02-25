import client from "prom-client";

// Collect default Node.js metrics (event loop lag, memory, GC, etc.)
client.collectDefaultMetrics();

// ============================================
// HTTP Metrics
// ============================================

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// ============================================
// Queue Metrics
// ============================================

export const queueJobsTotal = new client.Counter({
  name: "queue_jobs_total",
  help: "Total number of queue jobs processed",
  labelNames: ["queue", "status"],
});

export const queueJobDuration = new client.Histogram({
  name: "queue_job_duration_seconds",
  help: "Duration of queue job processing in seconds",
  labelNames: ["queue"],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
});

// ============================================
// Payment Metrics
// ============================================

export const paymentEventsTotal = new client.Counter({
  name: "payment_events_total",
  help: "Total number of payment events",
  labelNames: ["event_type", "source"],
});

export const paymentTransitionsTotal = new client.Counter({
  name: "payment_transitions_total",
  help: "Total number of payment status transitions",
  labelNames: ["from_status", "to_status"],
});

// ============================================
// Circuit Breaker Metrics
// ============================================

export const circuitBreakerState = new client.Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
  labelNames: ["name"],
});

// ============================================
// MFA Metrics
// ============================================

export const mfaValidationsTotal = new client.Counter({
  name: "mfa_validations_total",
  help: "Total number of MFA validation attempts",
  labelNames: ["result"], // success, failure, backup_used
});

// ============================================
// SLO Metrics
// ============================================

/**
 * HTTP error rate by route — for SLO: error rate < 1% per route.
 * Use with: rate(http_errors_total[5m]) / rate(http_requests_total[5m])
 */
export const httpErrorsTotal = new client.Counter({
  name: "http_errors_total",
  help: "Total HTTP 5xx errors (server errors)",
  labelNames: ["method", "route"],
});

/**
 * Payment success rate — for SLO: payment success > 95%.
 * Use with: rate(payment_outcomes_total{outcome="success"}[1h]) / rate(payment_outcomes_total[1h])
 */
export const paymentOutcomesTotal = new client.Counter({
  name: "payment_outcomes_total",
  help: "Payment outcomes (success, failure, timeout)",
  labelNames: ["outcome"], // success, failure, timeout
});

/**
 * Queue wait time (time from enqueue to processing start).
 * For SLO: p95 queue wait < 30s.
 */
export const queueWaitDuration = new client.Histogram({
  name: "queue_wait_duration_seconds",
  help: "Time a job waited in queue before processing started",
  labelNames: ["queue"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
});

/**
 * Upload duration — tracks presigned upload flow latency.
 * For SLO: p95 upload presign latency < 500ms.
 */
export const uploadDuration = new client.Histogram({
  name: "upload_presign_duration_seconds",
  help: "Duration of presigned URL generation",
  labelNames: ["context"], // chat, listing, profile, dispute
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

// Export the registry for the /metrics endpoint
export const register = client.register;
