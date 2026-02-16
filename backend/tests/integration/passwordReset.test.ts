import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import app from "../../src/index";
import prisma from "../../src/lib/prisma";
import { hashPassword } from "../../src/middleware/auth";
import crypto from "crypto";
import supertest from "supertest";

const request = supertest(app);

describe("Password Reset Flow", () => {
  const testEmail = "resettest@teste.com";
  const testPassword = "Teste@123";

  beforeAll(async () => {
    // Create test user
    const hashed = await hashPassword(testPassword);
    await prisma.user.upsert({
      where: { email: testEmail },
      update: { password: hashed },
      create: {
        email: testEmail,
        name: "Reset Test User",
        password: hashed,
        role: "CLIENT",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should return success even for non-existent email (timing-safe)", async () => {
      const res = await request
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@teste.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should generate a reset token for existing user", async () => {
      const res = await request
        .post("/api/auth/forgot-password")
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be saved to database
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { resetPasswordToken: true, resetPasswordExpires: true },
      });

      expect(user?.resetPasswordToken).toBeTruthy();
      expect(user?.resetPasswordExpires).toBeTruthy();
      expect(new Date(user!.resetPasswordExpires!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("POST /api/auth/reset-password", () => {
    let resetToken: string;

    beforeEach(async () => {
      // Directly set a known token in the DB (avoids rate limiter)
      resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

      await prisma.user.update({
        where: { email: testEmail },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
        },
      });
    });

    it("should reject invalid token", async () => {
      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: "invalidtoken123", newPassword: "NewPassword@123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject expired token", async () => {
      const expiredToken = crypto.randomBytes(32).toString("hex");
      const hashedExpired = crypto.createHash("sha256").update(expiredToken).digest("hex");

      await prisma.user.update({
        where: { email: testEmail },
        data: {
          resetPasswordToken: hashedExpired,
          resetPasswordExpires: new Date(Date.now() - 1000), // expired
        },
      });

      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: expiredToken, newPassword: "NewPassword@123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reset password with valid token", async () => {
      const newPassword = "NewPassword@123";

      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: resetToken, newPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be cleared
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { resetPasswordToken: true, resetPasswordExpires: true },
      });
      expect(user?.resetPasswordToken).toBeNull();
      expect(user?.resetPasswordExpires).toBeNull();

      // Should be able to login with new password
      const loginRes = await request
        .post("/api/auth/login")
        .send({ email: testEmail, password: newPassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });
  });
});
