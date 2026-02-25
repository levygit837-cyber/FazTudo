import { describe, it, expect, vi } from "vitest";

// Mock Redis connection
vi.mock("../src/queues/connection", () => ({
  getRedisConnection: vi.fn(() => ({
    call: vi.fn().mockResolvedValue("OK"),
  })),
}));

// Mock logger
vi.mock("../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock env
vi.mock("../src/config/env", () => ({
  env: {
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 500,
    AUTH_RATE_LIMIT_WINDOW_MS: 900000,
    AUTH_RATE_LIMIT_MAX_REQUESTS: 10,
    SENSITIVE_RATE_LIMIT_MAX: 5,
    FINANCIAL_RATE_LIMIT_MAX: 3,
    WEBHOOK_RATE_LIMIT_MAX: 100,
    MFA_RATE_LIMIT_MAX: 5,
  },
}));

describe("MFA Rate Limiter", () => {
  it("exports mfaLimiter", async () => {
    const { mfaLimiter } = await import("../src/middleware/rateLimiter");
    expect(mfaLimiter).toBeDefined();
    expect(typeof mfaLimiter).toBe("function");
  });

  it("mfaLimiter is a valid Express middleware", async () => {
    const { mfaLimiter } = await import("../src/middleware/rateLimiter");
    // Express middleware has arity 3 (req, res, next)
    expect(mfaLimiter.length).toBeLessThanOrEqual(3);
  });

  it("exports all rate limiters including mfa", async () => {
    const mod = await import("../src/middleware/rateLimiter");
    const expected = [
      "generalLimiter",
      "authLimiter",
      "sensitiveLimiter",
      "financialLimiter",
      "createUserRateLimiter",
      "userFinancialLimiter",
      "userSensitiveLimiter",
      "webhookLimiter",
      "mfaLimiter",
    ];
    for (const name of expected) {
      expect((mod as any)[name], `Missing export: ${name}`).toBeDefined();
    }
  });
});
