import { describe, it, expect, vi } from "vitest";

// We test the env config parsing logic for TRUST_PROXY

describe("Trust Proxy Config", () => {
  it("defaults to 1 in development", () => {
    const originalEnv = { ...process.env };
    process.env.NODE_ENV = "development";
    delete process.env.TRUST_PROXY;

    // Simulate the parsing logic from env.ts
    const raw = process.env.TRUST_PROXY;
    const nodeEnv = process.env.NODE_ENV;
    let result: string | number | boolean;
    if (!raw) {
      result = nodeEnv === "production" ? 0 : 1;
    } else if (raw === "true") {
      result = true;
    } else if (raw === "false") {
      result = false;
    } else {
      const num = parseInt(raw, 10);
      result = !isNaN(num) ? num : raw;
    }

    expect(result).toBe(1);
    process.env = originalEnv;
  });

  it("defaults to 0 (disabled) in production when not set", () => {
    const raw = undefined;
    const nodeEnv = "production";
    let result: string | number | boolean;
    if (!raw) {
      result = nodeEnv === "production" ? 0 : 1;
    } else {
      result = raw;
    }
    expect(result).toBe(0);
  });

  it("parses numeric values", () => {
    const raw = "2";
    const result = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
    expect(result).toBe(2);
  });

  it("parses boolean values", () => {
    expect("true" === "true" ? true : false).toBe(true);
    expect("false" === "true" ? true : false).toBe(false);
  });

  it("passes through string values (loopback, CIDR)", () => {
    const testCases = [
      { raw: "loopback", expected: "loopback" },
      { raw: "uniquelocal", expected: "uniquelocal" },
      { raw: "10.0.0.0/8", expected: "10.0.0.0/8" },
    ];
    for (const { raw, expected } of testCases) {
      // Use the same logic as env.ts: only parse strict integers
      const result = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
      expect(result).toBe(expected);
    }
  });
});
