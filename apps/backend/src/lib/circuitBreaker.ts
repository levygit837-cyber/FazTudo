import CircuitBreaker from "opossum";
import { createLogger } from "./logger";
import { circuitBreakerState } from "./metrics";

const log = createLogger("circuitBreaker");

export interface CircuitBreakerOptions {
  /** Timeout in ms for each request (default: 10000) */
  timeout?: number;
  /** Error percentage threshold to trip the breaker (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms to wait before trying again after opening (default: 30000) */
  resetTimeout?: number;
  /** Min number of requests before evaluating error percentage (default: 5) */
  volumeThreshold?: number;
}

/**
 * Creates a circuit breaker wrapping an async function.
 * When the function fails too frequently, the breaker opens and
 * rejects requests immediately, preventing cascade failures.
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  name: string,
  options?: CircuitBreakerOptions,
): CircuitBreaker<TArgs, TResult> {
  const breaker = new CircuitBreaker<TArgs, TResult>(fn, {
    timeout: options?.timeout ?? 10000,
    errorThresholdPercentage: options?.errorThresholdPercentage ?? 50,
    resetTimeout: options?.resetTimeout ?? 30000,
    volumeThreshold: options?.volumeThreshold ?? 5,
  });

  breaker.on("open", () => {
    log.warn({ name }, "Circuit breaker OPENED — requests will be rejected");
    circuitBreakerState.set({ name }, 2);
  });
  breaker.on("halfOpen", () => {
    log.info({ name }, "Circuit breaker HALF-OPEN — testing with next request");
    circuitBreakerState.set({ name }, 1);
  });
  breaker.on("close", () => {
    log.info({ name }, "Circuit breaker CLOSED — back to normal");
    circuitBreakerState.set({ name }, 0);
  });
  breaker.on("fallback", () =>
    log.warn({ name }, "Circuit breaker fallback triggered"),
  );

  return breaker;
}
