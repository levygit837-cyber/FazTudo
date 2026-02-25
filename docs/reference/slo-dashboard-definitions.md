# SLO Dashboard Definitions

> **Purpose**: PromQL queries for Grafana dashboards monitoring FazTudo SLOs.
> **Data source**: Prometheus scraping `/metrics` endpoint.

---

## SLO 1: HTTP Error Rate < 1% per Route

**Target**: Less than 1% of requests per route result in 5xx errors.

### Panel: Error Rate by Route (%)

```promql
100 * rate(http_errors_total[5m]) / rate(http_requests_total[5m])
```

### Alert Rule

```yaml
- alert: HighErrorRate
  expr: >
    (rate(http_errors_total[5m]) / rate(http_requests_total[5m])) > 0.01
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Error rate > 1% on {{ $labels.route }}"
```

---

## SLO 2: HTTP Latency p95 < 500ms, p99 < 2s

**Target**: 95th percentile response time under 500ms, 99th under 2s.

### Panel: p95 Latency by Route

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

### Panel: p99 Latency by Route

```promql
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))
```

### Alert Rule

```yaml
- alert: HighLatencyP95
  expr: >
    histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "p95 latency > 500ms on {{ $labels.route }}"

- alert: HighLatencyP99
  expr: >
    histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) > 2
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "p99 latency > 2s on {{ $labels.route }}"
```

---

## SLO 3: Payment Success Rate > 95%

**Target**: More than 95% of payment attempts result in success.

### Panel: Payment Success Rate (%)

```promql
100 * rate(payment_outcomes_total{outcome="success"}[1h]) / rate(payment_outcomes_total[1h])
```

### Panel: Payment Outcomes Breakdown

```promql
sum(rate(payment_outcomes_total[1h])) by (outcome)
```

### Alert Rule

```yaml
- alert: LowPaymentSuccessRate
  expr: >
    (rate(payment_outcomes_total{outcome="success"}[1h]) / rate(payment_outcomes_total[1h])) < 0.95
  for: 15m
  labels:
    severity: critical
  annotations:
    summary: "Payment success rate below 95%"
```

---

## SLO 4: Queue Wait Time p95 < 30s

**Target**: 95th percentile of time jobs spend waiting in queue before processing starts is under 30 seconds.

### Panel: Queue Wait Time p95

```promql
histogram_quantile(0.95, sum(rate(queue_wait_duration_seconds_bucket[5m])) by (le, queue))
```

### Panel: Queue Processing Duration p95

```promql
histogram_quantile(0.95, sum(rate(queue_job_duration_seconds_bucket[5m])) by (le, queue))
```

### Alert Rule

```yaml
- alert: HighQueueWaitTime
  expr: >
    histogram_quantile(0.95, sum(rate(queue_wait_duration_seconds_bucket[5m])) by (le, queue)) > 30
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Queue {{ $labels.queue }} p95 wait time > 30s"
```

---

## SLO 5: Upload Presign Latency p95 < 500ms

**Target**: Presigned URL generation completes within 500ms at p95.

### Panel: Upload Presign Latency p95

```promql
histogram_quantile(0.95, sum(rate(upload_presign_duration_seconds_bucket[5m])) by (le, context))
```

### Alert Rule

```yaml
- alert: HighUploadPresignLatency
  expr: >
    histogram_quantile(0.95, sum(rate(upload_presign_duration_seconds_bucket[5m])) by (le, context)) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Upload presign latency p95 > 500ms for {{ $labels.context }}"
```

---

## SLO 6: Circuit Breaker (MercadoPago)

**Target**: Circuit breaker should be closed (state=0) >99.9% of the time.

### Panel: Circuit Breaker State

```promql
circuit_breaker_state
```

### Alert Rule

```yaml
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker {{ $labels.name }} is {{ if eq $value 2.0 }}OPEN{{ else }}HALF-OPEN{{ end }}"
```

---

## Operational Panels

### Request Rate

```promql
sum(rate(http_requests_total[5m])) by (method)
```

### Queue Job Throughput

```promql
sum(rate(queue_jobs_total[5m])) by (queue, status)
```

### MFA Validation Rate

```promql
sum(rate(mfa_validations_total[5m])) by (result)
```

### Payment Transitions

```promql
sum(rate(payment_transitions_total[5m])) by (from_status, to_status)
```
