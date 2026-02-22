import { describe, it, expect } from "vitest";
import * as metrics from "../src/lib/metrics";

describe("Prometheus Metrics Instrumentation", () => {
  describe("HTTP Metrics", () => {
    it("exports httpRequestDuration histogram", () => {
      expect(metrics.httpRequestDuration).toBeDefined();
      expect(typeof metrics.httpRequestDuration.observe).toBe("function");
    });

    it("exports httpRequestTotal counter", () => {
      expect(metrics.httpRequestTotal).toBeDefined();
      expect(typeof metrics.httpRequestTotal.inc).toBe("function");
    });
  });

  describe("Queue Metrics", () => {
    it("exports queueJobsTotal counter", () => {
      expect(metrics.queueJobsTotal).toBeDefined();
      expect(typeof metrics.queueJobsTotal.inc).toBe("function");
    });

    it("exports queueJobDuration histogram", () => {
      expect(metrics.queueJobDuration).toBeDefined();
      expect(typeof metrics.queueJobDuration.observe).toBe("function");
    });
  });

  describe("Payment Metrics", () => {
    it("exports paymentEventsTotal counter", () => {
      expect(metrics.paymentEventsTotal).toBeDefined();
      expect(typeof metrics.paymentEventsTotal.inc).toBe("function");
    });

    it("exports paymentTransitionsTotal counter", () => {
      expect(metrics.paymentTransitionsTotal).toBeDefined();
      expect(typeof metrics.paymentTransitionsTotal.inc).toBe("function");
    });
  });

  describe("Circuit Breaker Metrics", () => {
    it("exports circuitBreakerState gauge", () => {
      expect(metrics.circuitBreakerState).toBeDefined();
      expect(typeof metrics.circuitBreakerState.set).toBe("function");
    });
  });

  describe("MFA Metrics", () => {
    it("exports mfaValidationsTotal counter", () => {
      expect(metrics.mfaValidationsTotal).toBeDefined();
      expect(typeof metrics.mfaValidationsTotal.inc).toBe("function");
    });
  });

  describe("Registry", () => {
    it("exports registry for /metrics endpoint", () => {
      expect(metrics.register).toBeDefined();
      expect(typeof metrics.register.metrics).toBe("function");
    });

    it("registry produces Prometheus text format output", async () => {
      const output = await metrics.register.metrics();
      expect(output).toContain("http_request_duration_seconds");
      expect(output).toContain("queue_jobs_total");
      expect(output).toContain("payment_transitions_total");
      expect(output).toContain("circuit_breaker_state");
      expect(output).toContain("mfa_validations_total");
    });
  });
});
