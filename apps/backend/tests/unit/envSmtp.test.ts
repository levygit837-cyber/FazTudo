import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("SMTP Environment Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should have SMTP fields in config interface", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");

    expect(env).toHaveProperty("SMTP_HOST");
    expect(env).toHaveProperty("SMTP_PORT");
    expect(env).toHaveProperty("SMTP_USER");
    expect(env).toHaveProperty("SMTP_PASS");
    expect(env).toHaveProperty("SMTP_FROM_NAME");
    expect(env).toHaveProperty("SMTP_FROM_EMAIL");
  });

  it("should default SMTP_PORT to 587", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");
    expect(env.SMTP_PORT).toBe(587);
  });

  it("should default SMTP_FROM_NAME to FazTudo", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");
    expect(env.SMTP_FROM_NAME).toBe("FazTudo");
  });
});
