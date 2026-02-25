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

// Import AFTER mocks
import { getSecret, preloadSecrets, reloadSecrets, getSecretsProvider } from "../../src/config/secrets";

// ============================================
// TESTS
// ============================================

describe("secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSecretsProvider", () => {
    it("should default to 'env' provider", () => {
      expect(getSecretsProvider()).toBe("env");
    });
  });

  describe("getSecret", () => {
    it("should return value from process.env", async () => {
      process.env.TEST_SECRET_KEY = "test-value-123";

      const value = await getSecret("TEST_SECRET_KEY");

      expect(value).toBe("test-value-123");

      delete process.env.TEST_SECRET_KEY;
    });

    it("should return empty string for missing env vars", async () => {
      const value = await getSecret("NONEXISTENT_SECRET_KEY_XYZ");

      expect(value).toBe("");
    });

    it("should cache values and return from cache on second call", async () => {
      process.env.CACHED_SECRET = "cached-value";

      const first = await getSecret("CACHED_SECRET");
      process.env.CACHED_SECRET = "changed-value";
      const second = await getSecret("CACHED_SECRET");

      // Second call should return cached value
      expect(first).toBe("cached-value");
      expect(second).toBe("cached-value");

      delete process.env.CACHED_SECRET;
    });
  });

  describe("preloadSecrets", () => {
    it("should not throw when secrets are missing", async () => {
      // preloadSecrets loads managed keys — some may not be set in test env
      await expect(preloadSecrets()).resolves.not.toThrow();
    });
  });

  describe("reloadSecrets", () => {
    it("should clear cache and reload", async () => {
      process.env.RELOAD_TEST = "original";
      await getSecret("RELOAD_TEST");

      process.env.RELOAD_TEST = "updated";
      await reloadSecrets();
      const value = await getSecret("RELOAD_TEST");

      expect(value).toBe("updated");

      delete process.env.RELOAD_TEST;
    });
  });
});
