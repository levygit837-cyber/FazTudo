import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

const TEST_EMAIL = "storefront-test@faztudo.com";
const TEST_CNPJ = "88888888000188";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) {
    const company = await prisma.companyProfile.findUnique({ where: { userId: user.id } });
    if (company) {
      await prisma.companyStorefrontItem.deleteMany({
        where: { section: { companyId: company.id } },
      });
      await prisma.companyStorefrontSection.deleteMany({ where: { companyId: company.id } });
      await prisma.companyStorefrontBlock.deleteMany({ where: { companyId: company.id } });
      await prisma.companyPinnedTestimonial.deleteMany({ where: { companyId: company.id } });
      await prisma.companyProfile.delete({ where: { id: company.id } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }
}

describe("Company Storefront Integration", () => {
  let token: string;
  let companyId: number;
  let sectionId: number;

  beforeAll(async () => {
    await cleanup();

    // Register company
    await request(app).post("/api/auth/register").send({
      name: "Storefront Test Company",
      email: TEST_EMAIL,
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Storefront Test Ltda",
      cnpj: TEST_CNPJ,
    });

    // Activate
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { status: "ACTIVE", emailVerified: true },
    });

    // Login
    const loginRes = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "Teste@123",
    });
    token = loginRes.body.data.token;

    // Get company profile
    const profileRes = await request(app)
      .get("/api/company/profile")
      .set("Authorization", `Bearer ${token}`);
    companyId = profileRes.body.data.id ?? profileRes.body.data.company?.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  // ─── Public Storefront ─────────────────────────────────────────────────────

  it("should return 404 for unknown company ID", async () => {
    const res = await request(app).get("/api/storefront/9999999");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("should return 400 for non-numeric company ID", async () => {
    const res = await request(app).get("/api/storefront/notanumber");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Editor (requires auth) ────────────────────────────────────────────────

  it("should return 401 for editor endpoint without token", async () => {
    const res = await request(app).get("/api/company/storefront/editor");
    expect(res.status).toBe(401);
  });

  it("should return editor data for authenticated company member", async () => {
    const res = await request(app)
      .get("/api/company/storefront/editor")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  // ─── Sections CRUD ─────────────────────────────────────────────────────────

  it("should create a storefront section", async () => {
    const res = await request(app)
      .post("/api/company/storefront/sections")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Limpeza Residencial", order: 0 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Limpeza Residencial");
    sectionId = res.body.data.id;
  });

  it("should reject section creation with missing title", async () => {
    const res = await request(app)
      .post("/api/company/storefront/sections")
      .set("Authorization", `Bearer ${token}`)
      .send({ order: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should update a storefront section", async () => {
    const res = await request(app)
      .patch(`/api/company/storefront/sections/${sectionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Limpeza Profissional" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Limpeza Profissional");
  });

  it("should return 404 when updating a non-existent section", async () => {
    const res = await request(app)
      .patch("/api/company/storefront/sections/9999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Should fail" });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // ─── Block upsert idempotency ──────────────────────────────────────────────

  it("should create a HERO block", async () => {
    const res = await request(app)
      .put("/api/company/storefront/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "HERO",
        order: 0,
        isActive: true,
        content: { headline: "Bem-vindo", subtext: "Nossa empresa" },
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe("HERO");
  });

  it("should update (upsert) the same HERO block idempotently", async () => {
    const res = await request(app)
      .put("/api/company/storefront/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "HERO",
        order: 0,
        isActive: true,
        content: { headline: "Bem-vindo v2", subtext: "Atualizado" },
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect((res.body.data.content as any).headline).toBe("Bem-vindo v2");

    // Verify there's only one HERO block (no duplicate)
    const editorRes = await request(app)
      .get("/api/company/storefront/editor")
      .set("Authorization", `Bearer ${token}`);
    const blocks = editorRes.body.data.storefrontBlocks ?? [];
    const heroBlocks = blocks.filter((b: any) => b.type === "HERO");
    expect(heroBlocks.length).toBe(1);
  });

  // ─── Section delete ────────────────────────────────────────────────────────

  it("should delete a storefront section", async () => {
    const res = await request(app)
      .delete(`/api/company/storefront/sections/${sectionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
