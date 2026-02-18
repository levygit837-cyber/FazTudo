import { describe, it, expect } from "vitest";

// These are the fields that must NEVER appear in any API response
const FORBIDDEN_USER_FIELDS = [
  "password",
  "refreshToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "emailVerifyToken",
  "emailVerifyExpires",
  "tokenVersion",
];

describe("Data Leak Prevention", () => {
  describe("Safe user select pattern", () => {
    it("SAFE_USER_SELECT must not include forbidden fields", async () => {
      const { SAFE_USER_SELECT } = await import("../../src/lib/safeSelect");
      for (const field of FORBIDDEN_USER_FIELDS) {
        expect(SAFE_USER_SELECT).not.toHaveProperty(field);
      }
    });

    it("SAFE_USER_SELECT must include necessary public fields", async () => {
      const { SAFE_USER_SELECT } = await import("../../src/lib/safeSelect");
      expect(SAFE_USER_SELECT).toHaveProperty("id", true);
      expect(SAFE_USER_SELECT).toHaveProperty("name", true);
      expect(SAFE_USER_SELECT).toHaveProperty("email", true);
      expect(SAFE_USER_SELECT).toHaveProperty("role", true);
    });

    it("SAFE_USER_SELECT_MINIMAL must not include forbidden fields", async () => {
      const { SAFE_USER_SELECT_MINIMAL } = await import("../../src/lib/safeSelect");
      for (const field of FORBIDDEN_USER_FIELDS) {
        expect(SAFE_USER_SELECT_MINIMAL).not.toHaveProperty(field);
      }
    });

    it("SAFE_USER_SELECT_SELF must not include forbidden fields", async () => {
      const { SAFE_USER_SELECT_SELF } = await import("../../src/lib/safeSelect");
      for (const field of FORBIDDEN_USER_FIELDS) {
        expect(SAFE_USER_SELECT_SELF).not.toHaveProperty(field);
      }
    });

    it("SAFE_USER_SELECT_SELF must include self-only fields", async () => {
      const { SAFE_USER_SELECT_SELF } = await import("../../src/lib/safeSelect");
      expect(SAFE_USER_SELECT_SELF).toHaveProperty("document", true);
      expect(SAFE_USER_SELECT_SELF).toHaveProperty("balance", true);
      expect(SAFE_USER_SELECT_SELF).toHaveProperty("emailVerified", true);
    });
  });
});
