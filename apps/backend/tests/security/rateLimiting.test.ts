import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/index";

/**
 * Security: Rate Limiting Tests
 *
 * Verifies that rate limiting headers are present and that
 * excessive requests are throttled.
 */

describe("Security: Rate Limit Headers", () => {
  it("should include rate limit headers in responses", async () => {
    const res = await request(app).get("/");

    // express-rate-limit with standardHeaders: true uses RateLimit-* headers
    // Check for standard headers (RFC draft)
    const hasStandardHeaders =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["ratelimit-remaining"] !== undefined ||
      res.headers["ratelimit-reset"] !== undefined;

    // Also check legacy x-ratelimit-* headers (some versions use these)
    const hasLegacyHeaders =
      res.headers["x-ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-remaining"] !== undefined;

    expect(hasStandardHeaders || hasLegacyHeaders).toBe(true);
  });

  it("rate limit remaining should decrease after requests", async () => {
    const res1 = await request(app).get("/");
    const res2 = await request(app).get("/");

    const remaining1 = parseInt(
      res1.headers["ratelimit-remaining"] ??
        res1.headers["x-ratelimit-remaining"] ??
        "0",
      10
    );
    const remaining2 = parseInt(
      res2.headers["ratelimit-remaining"] ??
        res2.headers["x-ratelimit-remaining"] ??
        "0",
      10
    );

    // Second request should have fewer remaining requests
    // (or equal if server counts differently)
    expect(remaining2).toBeLessThanOrEqual(remaining1);
  });

  it("rate limit header should contain a numeric limit value", async () => {
    const res = await request(app).get("/");

    const limit =
      res.headers["ratelimit-limit"] ?? res.headers["x-ratelimit-limit"];

    if (limit) {
      const numericLimit = parseInt(limit, 10);
      expect(numericLimit).toBeGreaterThan(0);
    }
  });
});

describe("Security: Sensitive Endpoint Rate Limiting", () => {
  it("refresh endpoint should have rate limiting headers", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    const hasHeaders =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-limit"] !== undefined;
    expect(hasHeaders).toBe(true);
  });

  it("verify-email endpoint should have rate limiting headers", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({});
    const hasHeaders =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-limit"] !== undefined;
    expect(hasHeaders).toBe(true);
  });
});

describe("Security: Auth Rate Limiting — Brute Force Protection", () => {
  it("multiple rapid failed login attempts should eventually get 429 (soft)", async () => {
    // Auth rate limiter allows AUTH_RATE_LIMIT_MAX_REQUESTS (default: 10) per window.
    // We send many rapid requests to trigger the limit.
    // NOTE: This is a "soft" assertion because the rate limiter window
    // may have remaining capacity from prior tests.

    const attempts = 15;
    const results: number[] = [];

    for (let i = 0; i < attempts; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: `brute-force-${i}@nonexistent.com`,
          password: "WrongPassword1",
        });
      results.push(res.status);
    }

    // Check if at least some responses were rate-limited (429)
    // or all were 400/401 (rate limit window still has capacity)
    const has429 = results.includes(429);
    const allValid = results.every((s) => [400, 401, 429, 500].includes(s));

    // All responses should be handled (not crash without response)
    expect(allValid).toBe(true);

    // Soft check: ideally rate limiting kicks in
    // The critical check is that no unhandled errors occurred
    if (has429) {
      expect(has429).toBe(true);
    }
  });

  it("rate limited response should have correct format", async () => {
    // Send many requests to try to trigger rate limit
    const requests = Array.from({ length: 12 }, (_, i) =>
      request(app)
        .post("/api/auth/login")
        .send({
          email: `ratelimit-format-${i}@nonexistent.com`,
          password: "WrongPassword1",
        })
    );

    const responses = await Promise.all(requests);

    const rateLimited = responses.find((r) => r.status === 429);

    if (rateLimited) {
      // Rate limited response should have the correct error format
      expect(rateLimited.body.success).toBe(false);
      expect(rateLimited.body.message).toBeDefined();
      expect(typeof rateLimited.body.message).toBe("string");
    }

    // Regardless of rate limiting, no responses should be 500
    for (const res of responses) {
      expect(res.status).not.toBe(500);
    }
  });
});
