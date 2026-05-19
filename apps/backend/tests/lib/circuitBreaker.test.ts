import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCKS
// ============================================

vi.mock("../../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// We test the circuit breaker in isolation by creating a breaker
// around a simple function, without actually calling MercadoPago.
import { createCircuitBreaker } from "../../src/lib/circuitBreaker";

// ============================================
// TESTS
// ============================================

describe("circuitBreaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass through successful calls", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const breaker = createCircuitBreaker(fn, "test-success");

    const result = await breaker.fire();

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should propagate errors from the wrapped function", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("API error"));
    const breaker = createCircuitBreaker(fn, "test-error", {
      volumeThreshold: 1,
      errorThresholdPercentage: 1,
    });

    await expect(breaker.fire()).rejects.toThrow("API error");
  });

  it("should open after reaching error threshold", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.reject(new Error(`Error ${callCount}`));
    });

    const breaker = createCircuitBreaker(fn, "test-open", {
      volumeThreshold: 2,
      errorThresholdPercentage: 50,
      resetTimeout: 60000,
    });

    // Fire enough to trigger the breaker
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.fire();
      } catch {
        // expected
      }
    }

    // After enough failures, breaker should be open
    expect(breaker.opened).toBe(true);
  });

  it("should report opened state correctly", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const breaker = createCircuitBreaker(fn, "test-state");

    // Initially closed
    expect(breaker.opened).toBe(false);

    await breaker.fire();
    expect(breaker.opened).toBe(false);
  });

  it("should handle functions with arguments", async () => {
    const fn = vi.fn().mockImplementation((a: number, b: number) =>
      Promise.resolve(a + b),
    );
    const breaker = createCircuitBreaker(fn, "test-args");

    const result = await breaker.fire(3, 7);

    expect(result).toBe(10);
    expect(fn).toHaveBeenCalledWith(3, 7);
  });

  it("should respect timeout option", async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );
    const breaker = createCircuitBreaker(fn, "test-timeout", {
      timeout: 100, // 100ms timeout
    });

    await expect(breaker.fire()).rejects.toThrow();
  });
});
