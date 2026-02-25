import { describe, it, expect, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";

// Mock emailService antes de importar o app
vi.mock("../../src/services/emailService", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  default: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
    sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import app from "../../src/index";
import prisma from "../../src/lib/prisma";
import { sendVerificationEmail, sendWelcomeEmail } from "../../src/services/emailService";

describe("Email Verification Flow", () => {
  const testEmail = `emailverify_${Date.now()}@test.com`;
  const testPassword = "TestPassword123!";

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: "emailverify_" } },
    });
  });

  it("should send verification email on registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        name: "Test Verify User",
        role: "CLIENT",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verificar que sendVerificationEmail foi chamado
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      testEmail,
      "Test Verify User",
      expect.stringContaining("/verify-email/")
    );

    // Verificar que user foi criado com emailVerified = false
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.emailVerified).toBe(false);
    expect(user?.emailVerifyToken).toBeTruthy();
    expect(user?.emailVerifyExpires).toBeTruthy();
  });

  it("should verify email with valid token", async () => {
    // Precisamos do token original (não hasheado) — para o teste,
    // vamos gerar um novo token e salvar o hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.user.update({
      where: { email: testEmail },
      data: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verificar que emailVerified = true
    const updatedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(updatedUser?.emailVerified).toBe(true);
    expect(updatedUser?.emailVerifyToken).toBeNull();
    expect(updatedUser?.emailVerifyExpires).toBeNull();

    // Verificar que email de boas-vindas foi enviado
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      testEmail,
      expect.any(String),
      expect.stringContaining("/login")
    );
  });

  it("should reject expired verification token", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Criar novo user com token expirado
    const expiredEmail = `emailverify_expired_${Date.now()}@test.com`;
    await prisma.user.create({
      data: {
        email: expiredEmail,
        password: "hashed",
        name: "Expired User",
        role: "CLIENT",
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() - 1000), // expirado
      },
    });

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should reject invalid verification token", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "invalid-token-12345" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should register professional with document field", async () => {
    const proEmail = `emailverify_pro_${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: proEmail,
        password: "TestPassword123!",
        name: "Professional User",
        role: "PROFESSIONAL",
        document: "12345678901",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.document).toBe("12345678901");

    // Cleanup
    await prisma.user.deleteMany({ where: { email: proEmail } });
  });

  it("should register client without optional fields", async () => {
    const clientEmail = `emailverify_client_${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: clientEmail,
        password: "TestPassword123!",
        name: "Client User",
        role: "CLIENT",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("CLIENT");

    // Cleanup
    await prisma.user.deleteMany({ where: { email: clientEmail } });
  });

  it("should reject registration with weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "weakpw@test.com",
        password: "Abc12",  // Too short (5 chars, min is 8)
        name: "Weak Password User",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
