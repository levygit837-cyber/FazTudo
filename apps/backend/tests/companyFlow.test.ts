import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

// Helper: remove all test data tied to the test CNPJ / email
async function cleanup() {
  const existing = await prisma.companyProfile.findFirst({ where: { cnpj: "99999999000199" } });
  if (existing) {
    await prisma.companyMember.deleteMany({ where: { companyId: existing.id } });
    await prisma.companyRole.deleteMany({ where: { companyId: existing.id } });
    await prisma.companyProfile.delete({ where: { id: existing.id } });
  }
  await prisma.user.deleteMany({ where: { email: "empresa-flow@faztudo.com" } });
}

describe("Company Flow Integration", () => {
  let companyToken: string;
  let companyId: number;
  let roleId: number;

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  // ─── Registration ──────────────────────────────────────────────────────────

  it("should register a company with CNPJ", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Empresa Flow Test Ltda",
      email: "empresa-flow@faztudo.com",
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Empresa Flow Test Ltda",
      cnpj: "99999999000199",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("COMPANY");
  });

  it("should reject COMPANY registration without CNPJ", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Empresa Sem CNPJ",
      email: "empresa-nocnpj@faztudo.com",
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Empresa Sem CNPJ",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  it("should login as company after activation", async () => {
    // Users start as PENDING; activate directly in DB to simulate email verification
    await prisma.user.update({
      where: { email: "empresa-flow@faztudo.com" },
      data: { status: "ACTIVE", emailVerified: true },
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "empresa-flow@faztudo.com",
      password: "Teste@123",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    companyToken = res.body.data.token;
  });

  // ─── Profile ───────────────────────────────────────────────────────────────

  it("should get company profile", async () => {
    const res = await request(app)
      .get("/api/company/profile")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cnpj).toBe("99999999000199");
    companyId = res.body.data.id;
  });

  it("should update company profile", async () => {
    const res = await request(app)
      .put("/api/company/profile")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({
        description: "Empresa de teste atualizada",
        industry: "Serviços Gerais",
        website: "https://empresa-flow-test.com",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.description).toBe("Empresa de teste atualizada");
    expect(res.body.data.industry).toBe("Serviços Gerais");
  });

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  it("should get company dashboard stats", async () => {
    const res = await request(app)
      .get("/api/company/dashboard")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("totalOrders");
    expect(res.body.data).toHaveProperty("totalMembers");
    expect(res.body.data).toHaveProperty("availableBalance");
    // Freshly created company has zero activity
    expect(res.body.data.totalOrders).toBe(0);
    expect(res.body.data.totalMembers).toBe(0);
  });

  // ─── Roles ─────────────────────────────────────────────────────────────────

  it("should create a company role", async () => {
    const res = await request(app)
      .post("/api/company/members/roles")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({
        name: "Operacional Teste",
        level: 3,
        permissions: {
          metrics: { view: false, viewTeam: false },
          chat: { view: true, respond: true, manage: false },
          orders: { view: true, assign: false, manage: false },
          finance: { view: false, transfer: false, salary: false },
          team: { view: false, invite: false, manage: false },
          catalog: { edit: false },
          company: { settings: false, roles: false },
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Operacional Teste");
    expect(res.body.data.level).toBe(3);
    roleId = res.body.data.id;
  });

  it("should list company roles", async () => {
    const res = await request(app)
      .get("/api/company/members/roles")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const names = res.body.data.map((r: { name: string }) => r.name);
    expect(names).toContain("Operacional Teste");
  });

  // ─── Members ───────────────────────────────────────────────────────────────

  it("should list company members (empty for new company)", async () => {
    const res = await request(app)
      .get("/api/company/members")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ─── Storefront (public) ───────────────────────────────────────────────────

  it("should get public storefront", async () => {
    const res = await request(app).get(`/api/company/storefront/${companyId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyName).toBe("Empresa Flow Test Ltda");
    expect(res.body.data.cnpj).toBe("99999999000199");
  });

  it("should return 404 for non-existent storefront", async () => {
    const res = await request(app).get("/api/company/storefront/999999");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── Authorization guards ─────────────────────────────────────────────────

  it("should reject profile access without token", async () => {
    const res = await request(app).get("/api/company/profile");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should reject profile access with non-COMPANY token", async () => {
    // Register and activate a CLIENT to test role guard
    const clientEmail = "empresa-flow-client@faztudo.com";
    await prisma.user.deleteMany({ where: { email: clientEmail } });

    await request(app).post("/api/auth/register").send({
      name: "Cliente Teste Flow",
      email: clientEmail,
      password: "Teste@123",
      role: "CLIENT",
    });
    await prisma.user.update({
      where: { email: clientEmail },
      data: { status: "ACTIVE", emailVerified: true },
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: clientEmail,
      password: "Teste@123",
    });
    const clientToken = loginRes.body.data.token;

    const res = await request(app)
      .get("/api/company/profile")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    await prisma.user.deleteMany({ where: { email: clientEmail } });
  });
});
