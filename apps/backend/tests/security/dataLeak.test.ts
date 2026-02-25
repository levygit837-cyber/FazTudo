import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../src/index";

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

describe("API Response Data Leak Prevention", () => {
  let clientToken: string | null = null;

  beforeAll(async () => {
    try {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "cliente@teste.com", password: "Teste@123" });
      clientToken = loginRes.body.data?.token || null;
    } catch {
      // Seed data may not be present
    }
  });

  it("login response should not contain password or tokens", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "cliente@teste.com", password: "Teste@123" });

    if (res.status === 200) {
      const user = res.body.data?.user;
      if (user) {
        expect(user).not.toHaveProperty("password");
        expect(user).not.toHaveProperty("resetPasswordToken");
        expect(user).not.toHaveProperty("emailVerifyToken");
        expect(user).not.toHaveProperty("tokenVersion");
      }
    }
  });

  it("profile response should not contain sensitive fields", async () => {
    if (!clientToken) return;

    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${clientToken}`);

    if (res.status === 200) {
      const user = res.body.data;
      if (user) {
        expect(user).not.toHaveProperty("password");
        expect(user).not.toHaveProperty("refreshToken");
        expect(user).not.toHaveProperty("resetPasswordToken");
        expect(user).not.toHaveProperty("emailVerifyToken");
      }
    }
  });

  it("register response should not contain tokenVersion", async () => {
    const uniqueEmail = `test-leak-${Date.now()}@test.com`;
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Leak Prevention",
      email: uniqueEmail,
      password: "TestLeak@123",
      role: "CLIENT",
    });

    if (res.status === 201) {
      const user = res.body.data?.user;
      if (user) {
        expect(user).not.toHaveProperty("tokenVersion");
        expect(user).not.toHaveProperty("password");
      }
    }
  });
});
