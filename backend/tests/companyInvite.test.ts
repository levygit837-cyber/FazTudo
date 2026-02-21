import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

const OWNER_EMAIL = "invite-owner@faztudo.com";
const OWNER_CNPJ = "77777777000177";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (user) {
    const company = await prisma.companyProfile.findUnique({ where: { userId: user.id } });
    if (company) {
      await prisma.companyInviteToken.deleteMany({ where: { companyId: company.id } });
      await prisma.companyMember.deleteMany({ where: { companyId: company.id } });
      await prisma.companyRole.deleteMany({ where: { companyId: company.id } });
      await prisma.companyProfile.delete({ where: { id: company.id } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }
}

describe("Company Invite By Link Integration", () => {
  let ownerToken: string;

  beforeAll(async () => {
    await cleanup();

    // Register company owner
    await request(app).post("/api/auth/register").send({
      name: "Invite Owner",
      email: OWNER_EMAIL,
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Invite Test Ltda",
      cnpj: OWNER_CNPJ,
    });

    // Activate
    await prisma.user.update({
      where: { email: OWNER_EMAIL },
      data: { status: "ACTIVE", emailVerified: true },
    });

    // Login
    const loginRes = await request(app).post("/api/auth/login").send({
      email: OWNER_EMAIL,
      password: "Teste@123",
    });
    ownerToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await cleanup();
  });

  // ─── Generate invite link ──────────────────────────────────────────────────

  it("should return 401 for unauthenticated generate request", async () => {
    const res = await request(app).post("/api/company/invite/generate");
    expect(res.status).toBe(401);
  });

  it("should generate invite link for company owner", async () => {
    const res = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.link).toContain("/invite/");
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  // ─── Validate token ────────────────────────────────────────────────────────

  it("should return 404 for unknown token", async () => {
    const res = await request(app).get("/api/company/invite/totally-invalid-token-xyz");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("should validate a valid generated token", async () => {
    // Generate a fresh token first
    const genRes = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    const token = genRes.body.data.token;

    const res = await request(app).get(`/api/company/invite/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.company).toBeDefined();
    expect(res.body.data.role).toBeTruthy();
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it("should return 410 for expired token", async () => {
    // Manually create an expired token in DB
    const user = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    const company = await prisma.companyProfile.findUnique({ where: { userId: user!.id } });
    const expiredToken = await prisma.companyInviteToken.create({
      data: {
        companyId: company!.id,
        token: "expired-test-token-abc123",
        role: "MEMBER",
        createdById: user!.id,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    });

    const res = await request(app).get(`/api/company/invite/${expiredToken.token}`);
    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });
});
