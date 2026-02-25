import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

const OWNER_EMAIL = "invite-owner@faztudo.com";
const OWNER_CNPJ = "77777777000177";
const JOINER_EMAIL = "invite-joiner@faztudo.com";

async function cleanup() {
  // Clean up joiner first (no company association)
  const joiner = await prisma.user.findUnique({ where: { email: JOINER_EMAIL } });
  if (joiner) {
    // Remove any company memberships for the joiner before deleting the user
    await prisma.companyMember.deleteMany({ where: { userId: joiner.id } });
    await prisma.user.delete({ where: { id: joiner.id } });
  }

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
  let joinerToken: string;
  let companyId: number;

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

    // Activate owner
    await prisma.user.update({
      where: { email: OWNER_EMAIL },
      data: { status: "ACTIVE", emailVerified: true },
    });

    // Login owner
    const loginRes = await request(app).post("/api/auth/login").send({
      email: OWNER_EMAIL,
      password: "Teste@123",
    });
    ownerToken = loginRes.body.data.token;

    // Get the company ID and create a default role so acceptInvite can resolve it
    const ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    const company = await prisma.companyProfile.findUnique({ where: { userId: ownerUser!.id } });
    companyId = company!.id;

    await prisma.companyRole.create({
      data: {
        companyId,
        name: "MEMBER",
        level: 10,
        permissions: [],
      },
    });

    // Register a joiner user
    await request(app).post("/api/auth/register").send({
      name: "Invite Joiner",
      email: JOINER_EMAIL,
      password: "Teste@123",
      role: "CLIENT",
    });
    await prisma.user.update({
      where: { email: JOINER_EMAIL },
      data: { status: "ACTIVE", emailVerified: true },
    });
    const joinerLoginRes = await request(app).post("/api/auth/login").send({
      email: JOINER_EMAIL,
      password: "Teste@123",
    });
    joinerToken = joinerLoginRes.body.data.token;
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

  // ─── Accept invite ─────────────────────────────────────────────────────────

  it("should return 401 when accepting without auth", async () => {
    // Generate a fresh token
    const genRes = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    const token = genRes.body.data.token;

    const res = await request(app).post(`/api/company/invite/${token}/accept`);
    expect(res.status).toBe(401);
  });

  it("should accept a valid invite and make joiner a member", async () => {
    // Generate a fresh token
    const genRes = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    expect(genRes.status).toBe(201);
    const token = genRes.body.data.token;

    const res = await request(app)
      .post(`/api/company/invite/${token}/accept`)
      .set("Authorization", `Bearer ${joinerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyId).toBe(companyId);
    expect(res.body.data.member).toBeDefined();
    expect(res.body.data.member.role).toBeDefined();
  });

  it("should return 410 when accepting an already-used token", async () => {
    // Generate a fresh token and let the joiner accept it
    const genRes = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    const token = genRes.body.data.token;

    // First accept (joiner is already a member from the previous test, so this will 409)
    // Use a second fresh approach: create a token directly and mark it used
    const ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    const usedToken = await prisma.companyInviteToken.create({
      data: {
        companyId,
        token: "already-used-token-xyz999",
        role: "MEMBER",
        createdById: ownerUser!.id,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        usedAt: new Date(),
        usedById: ownerUser!.id,
      },
    });

    const res = await request(app)
      .post(`/api/company/invite/${usedToken.token}/accept`)
      .set("Authorization", `Bearer ${joinerToken}`);
    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });

  it("should return 409 when accepting an invite but user is already a member", async () => {
    // Generate a fresh token
    const genRes = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "MEMBER" });
    const token = genRes.body.data.token;

    // The joiner accepted an invite in the earlier test, so they are already a member
    const res = await request(app)
      .post(`/api/company/invite/${token}/accept`)
      .set("Authorization", `Bearer ${joinerToken}`);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});
