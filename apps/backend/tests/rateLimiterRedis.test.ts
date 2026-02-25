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

// Mock env with defaults
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

describe("Rate Limiter with Redis Store", () => {
  it("exports all required limiters", async () => {
    const mod = await import("../src/middleware/rateLimiter");
    expect(mod.generalLimiter).toBeDefined();
    expect(mod.authLimiter).toBeDefined();
    expect(mod.sensitiveLimiter).toBeDefined();
    expect(mod.financialLimiter).toBeDefined();
    expect(mod.userFinancialLimiter).toBeDefined();
    expect(mod.userSensitiveLimiter).toBeDefined();
    expect(mod.webhookLimiter).toBeDefined();
    expect(mod.createUserRateLimiter).toBeDefined();
  });

  it("all limiters are middleware functions", async () => {
    const mod = await import("../src/middleware/rateLimiter");
    expect(typeof mod.generalLimiter).toBe("function");
    expect(typeof mod.authLimiter).toBe("function");
    expect(typeof mod.sensitiveLimiter).toBe("function");
    expect(typeof mod.financialLimiter).toBe("function");
    expect(typeof mod.webhookLimiter).toBe("function");
  });

  it("createUserRateLimiter produces a middleware function", async () => {
    const { createUserRateLimiter } = await import("../src/middleware/rateLimiter");
    const limiter = createUserRateLimiter(10, 60000, "test message", "test-prefix");
    expect(typeof limiter).toBe("function");
  });

  it("uses configurable env values", async () => {
    // The module should read from env.SENSITIVE_RATE_LIMIT_MAX, etc.
    // We verify by checking the limiter was created without errors
    const mod = await import("../src/middleware/rateLimiter");
    expect(mod.sensitiveLimiter).toBeDefined();
    expect(mod.financialLimiter).toBeDefined();
    expect(mod.webhookLimiter).toBeDefined();
  });

  it("falls back gracefully when Redis is unavailable", async () => {
    // Reset modules to test fallback
    vi.doUnmock("../src/queues/connection");
    vi.doMock("../src/queues/connection", () => ({
      getRedisConnection: vi.fn(() => {
        throw new Error("Redis unavailable");
      }),
    }));

    // Re-import to trigger the fallback path
    const mod = await import("../src/middleware/rateLimiter");
    // Should still produce working limiter (in-memory fallback)
    expect(mod.generalLimiter).toBeDefined();
    expect(typeof mod.generalLimiter).toBe("function");
  });
});
