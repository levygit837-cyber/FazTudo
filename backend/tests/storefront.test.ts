import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

/**
 * Storefront Integration Tests
 *
 * Tests the complete storefront lifecycle:
 * 1. Registration & authentication
 * 2. Storefront CRUD
 * 3. Category CRUD + reorder
 * 4. Service CRUD + toggle availability
 * 5. Option CRUD
 * 6. Publishing
 * 7. Public listing & slug lookup
 * 8. Cart checkout (client)
 */

const PROF_EMAIL = "storefront-test-prof@faztudo.com";
const CLIENT_EMAIL = "storefront-test-client@faztudo.com";
const PASSWORD = "Teste@123";

describe("Storefront Integration", () => {
  let profToken: string;
  let clientToken: string;
  let storefrontSlug: string;
  let categoryId: number;
  let serviceId: number;
  let optionId: number;

  // ── Setup & Teardown ──────────────────────────────────

  async function cleanup() {
    // Delete storefronts for test user
    const users = await prisma.user.findMany({
      where: { email: { in: [PROF_EMAIL, CLIENT_EMAIL] } },
    });

    // First delete any service orders and their items created by test users
    for (const u of users) {
      const orders = await prisma.serviceOrder.findMany({
        where: { clientId: u.id },
        select: { id: true },
      });
      for (const order of orders) {
        await prisma.serviceOrderItem.deleteMany({
          where: { serviceOrderId: order.id },
        });
      }
      await prisma.serviceOrder.deleteMany({ where: { clientId: u.id } });
    }

    for (const u of users) {
      const sf = await prisma.storefront.findUnique({ where: { userId: u.id } });
      if (sf) {
        // Options → services → categories → storefront
        await prisma.storefrontServiceOption.deleteMany({
          where: { service: { category: { storefrontId: sf.id } } },
        });
        await prisma.storefrontService.deleteMany({
          where: { category: { storefrontId: sf.id } },
        });
        await prisma.storefrontCategory.deleteMany({
          where: { storefrontId: sf.id },
        });
        await prisma.storefront.delete({ where: { id: sf.id } });
      }
    }
    await prisma.user.deleteMany({
      where: { email: { in: [PROF_EMAIL, CLIENT_EMAIL] } },
    });
  }

  beforeAll(async () => {
    await cleanup();

    // Register professional
    await request(app).post("/api/auth/register").send({
      name: "Storefront Test Prof",
      email: PROF_EMAIL,
      password: PASSWORD,
      role: "PROFESSIONAL",
    });
    await prisma.user.update({
      where: { email: PROF_EMAIL },
      data: { status: "ACTIVE", emailVerified: true, isVerified: true },
    });
    const profLogin = await request(app).post("/api/auth/login").send({
      email: PROF_EMAIL,
      password: PASSWORD,
    });
    profToken = profLogin.body.data.token;

    // Register client
    await request(app).post("/api/auth/register").send({
      name: "Storefront Test Client",
      email: CLIENT_EMAIL,
      password: PASSWORD,
      role: "CLIENT",
    });
    await prisma.user.update({
      where: { email: CLIENT_EMAIL },
      data: { status: "ACTIVE", emailVerified: true, isVerified: true },
    });
    const clientLogin = await request(app).post("/api/auth/login").send({
      email: CLIENT_EMAIL,
      password: PASSWORD,
    });
    clientToken = clientLogin.body.data.token;
  });

  afterAll(async () => {
    await cleanup();
  });

  // ── 1. Storefront Creation ────────────────────────────

  it("should reject storefront creation without auth", async () => {
    const res = await request(app).post("/api/storefronts").send({
      name: "Test Vitrine",
    });
    expect(res.status).toBe(401);
  });

  it("should reject storefront creation by CLIENT role", async () => {
    const res = await request(app)
      .post("/api/storefronts")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ name: "Client Vitrine" });
    expect(res.status).toBe(403);
  });

  it("should create a storefront for professional", async () => {
    const res = await request(app)
      .post("/api/storefronts")
      .set("Authorization", `Bearer ${profToken}`)
      .send({
        name: "Vitrine do Teste",
        description: "Descricao de teste",
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Vitrine do Teste");
    expect(res.body.data.slug).toBeTruthy();
    storefrontSlug = res.body.data.slug;
  });

  it("should reject duplicate storefront creation", async () => {
    const res = await request(app)
      .post("/api/storefronts")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Outra Vitrine" });
    expect(res.status).toBe(409);
  });

  // ── 2. Get My Storefront ──────────────────────────────

  it("should return own storefront with categories", async () => {
    const res = await request(app)
      .get("/api/storefronts/mine")
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Vitrine do Teste");
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.categories).toBeInstanceOf(Array);
  });

  // ── 3. Update Storefront ──────────────────────────────

  it("should update storefront name and description", async () => {
    const res = await request(app)
      .put("/api/storefronts/mine")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Vitrine Atualizada", description: "Nova desc" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Vitrine Atualizada");
  });

  // ── 4. Category CRUD ──────────────────────────────────

  it("should create a category", async () => {
    const res = await request(app)
      .post("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Instalacoes" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Instalacoes");
    categoryId = res.body.data.id;
  });

  it("should create a second category", async () => {
    const res = await request(app)
      .post("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Manutencao" });
    expect(res.status).toBe(201);
  });

  it("should list categories ordered", async () => {
    const res = await request(app)
      .get("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe("Instalacoes");
    expect(res.body.data[1].name).toBe("Manutencao");
  });

  it("should update a category name", async () => {
    const res = await request(app)
      .put(`/api/storefronts/mine/categories/${categoryId}`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Instalacoes Eletricas" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Instalacoes Eletricas");
  });

  it("should reorder categories", async () => {
    const listRes = await request(app)
      .get("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`);
    const cats = listRes.body.data;

    // Swap order
    const res = await request(app)
      .put("/api/storefronts/mine/categories/reorder")
      .set("Authorization", `Bearer ${profToken}`)
      .send({
        order: [
          { id: cats[1].id, order: 0 },
          { id: cats[0].id, order: 1 },
        ],
      });
    expect(res.status).toBe(200);
  });

  // ── 5. Service CRUD ───────────────────────────────────

  it("should create a service in category", async () => {
    const res = await request(app)
      .post("/api/storefronts/mine/services")
      .set("Authorization", `Bearer ${profToken}`)
      .send({
        categoryId,
        title: "Troca de Disjuntor",
        description: "Troca simples de disjuntor",
        price: 80,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Troca de Disjuntor");
    expect(res.body.data.price).toBe(80);
    serviceId = res.body.data.id;
  });

  it("should reject service creation without required fields", async () => {
    const res = await request(app)
      .post("/api/storefronts/mine/services")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ categoryId }); // missing title and price
    expect(res.status).toBe(400);
  });

  it("should update service price", async () => {
    const res = await request(app)
      .put(`/api/storefronts/mine/services/${serviceId}`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ price: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(100);
  });

  it("should toggle service availability", async () => {
    const res = await request(app)
      .put(`/api/storefronts/mine/services/${serviceId}`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);

    // Toggle back
    await request(app)
      .put(`/api/storefronts/mine/services/${serviceId}`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isAvailable: true });
  });

  it("should list services", async () => {
    const res = await request(app)
      .get("/api/storefronts/mine/services")
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ── 6. Option CRUD ────────────────────────────────────

  it("should create an option for service", async () => {
    const res = await request(app)
      .post(`/api/storefronts/mine/services/${serviceId}/options`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Com fiacao nova", price: 30 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Com fiacao nova");
    expect(res.body.data.price).toBe(30);
    optionId = res.body.data.id;
  });

  it("should create a free option", async () => {
    const res = await request(app)
      .post(`/api/storefronts/mine/services/${serviceId}/options`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Descarte do antigo", isDefault: true });
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBeNull();
    expect(res.body.data.isDefault).toBe(true);
  });

  it("should update option price", async () => {
    const res = await request(app)
      .put(`/api/storefronts/mine/options/${optionId}`)
      .set("Authorization", `Bearer ${profToken}`)
      .send({ price: 40 });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(40);
  });

  it("should delete option", async () => {
    const res = await request(app)
      .delete(`/api/storefronts/mine/options/${optionId}`)
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
  });

  // ── 7. Publishing ─────────────────────────────────────

  it("should publish storefront when it has services", async () => {
    const res = await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
  });

  it("should unpublish storefront", async () => {
    const res = await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(false);
  });

  it("should republish for public listing tests", async () => {
    await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: true });
  });

  // ── 8. Public Listing ─────────────────────────────────

  it("should list published storefronts (no auth)", async () => {
    const res = await request(app).get("/api/storefronts");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeInstanceOf(Array);
    // Our test storefront should appear
    const found = res.body.data.items.find(
      (s: any) => s.slug === storefrontSlug,
    );
    expect(found).toBeTruthy();
  });

  it("should support search in listing", async () => {
    const res = await request(app)
      .get("/api/storefronts")
      .query({ search: "Atualizada" });
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  // ── 9. Get Storefront by Slug (Public) ────────────────

  it("should get storefront by slug with categories and services", async () => {
    const res = await request(app).get(`/api/storefronts/${storefrontSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Vitrine Atualizada");
    expect(res.body.data.categories).toBeInstanceOf(Array);
    expect(res.body.data.categories.length).toBeGreaterThanOrEqual(1);
    // Should include services
    const catWithServices = res.body.data.categories.find(
      (c: any) => c.services && c.services.length > 0,
    );
    expect(catWithServices).toBeTruthy();
  });

  it("should return 404 for non-existent slug", async () => {
    const res = await request(app).get(
      "/api/storefronts/non-existent-slug-xyz-123",
    );
    expect(res.status).toBe(404);
  });

  // ── 10. Delete Service & Category ─────────────────────
  // (Test delete with a fresh service that has no order references)

  let deletableServiceId: number;
  let deletableCategoryId: number;

  it("should create a deletable category and service", async () => {
    const catRes = await request(app)
      .post("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ name: "Temp Category" });
    deletableCategoryId = catRes.body.data.id;

    const svcRes = await request(app)
      .post("/api/storefronts/mine/services")
      .set("Authorization", `Bearer ${profToken}`)
      .send({
        categoryId: deletableCategoryId,
        title: "Deletable Service",
        price: 10,
      });
    deletableServiceId = svcRes.body.data.id;
  });

  it("should delete a service", async () => {
    const res = await request(app)
      .delete(`/api/storefronts/mine/services/${deletableServiceId}`)
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
  });

  it("should delete a category", async () => {
    const res = await request(app)
      .delete(`/api/storefronts/mine/categories/${deletableCategoryId}`)
      .set("Authorization", `Bearer ${profToken}`);
    expect(res.status).toBe(200);
  });

  // ── 11. Publish Validation ────────────────────────────

  it("should reject publish when no available services", async () => {
    // First unpublish
    await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: false });

    // Disable all remaining services (instead of deleting, to avoid FK issues)
    const catRes = await request(app)
      .get("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`);
    for (const cat of catRes.body.data) {
      for (const svc of cat.services || []) {
        await request(app)
          .put(`/api/storefronts/mine/services/${svc.id}`)
          .set("Authorization", `Bearer ${profToken}`)
          .send({ isAvailable: false });
      }
    }

    // Try publishing with no available services
    const res = await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("servico");
  });

  // Re-enable services for cart checkout test
  it("should re-enable services for cart test", async () => {
    const catRes = await request(app)
      .get("/api/storefronts/mine/categories")
      .set("Authorization", `Bearer ${profToken}`);
    for (const cat of catRes.body.data) {
      for (const svc of cat.services || []) {
        await request(app)
          .put(`/api/storefronts/mine/services/${svc.id}`)
          .set("Authorization", `Bearer ${profToken}`)
          .send({ isAvailable: true });
      }
    }
    // Republish
    const res = await request(app)
      .put("/api/storefronts/mine/publish")
      .set("Authorization", `Bearer ${profToken}`)
      .send({ isPublished: true });
    expect(res.status).toBe(200);
  });

  // ── 12. Cart Checkout ─────────────────────────────────

  it("should reject cart checkout without auth", async () => {
    const res = await request(app)
      .post("/api/services/orders/from-cart")
      .send({
        storefrontId: 1,
        items: [{ serviceId, quantity: 1 }],
      });
    expect(res.status).toBe(401);
  });

  it("should reject cart checkout by professional", async () => {
    // Get storefront ID
    const sfRes = await request(app)
      .get("/api/storefronts/mine")
      .set("Authorization", `Bearer ${profToken}`);
    const storefrontId = sfRes.body.data.id;

    const res = await request(app)
      .post("/api/services/orders/from-cart")
      .set("Authorization", `Bearer ${profToken}`)
      .send({
        storefrontId,
        items: [{ serviceId, quantity: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it("should create order from cart (client)", async () => {
    // Get storefront ID
    const sfRes = await request(app).get(`/api/storefronts/${storefrontSlug}`);
    const storefrontId = sfRes.body.data.id;

    // Get a service from the storefront
    const svc = sfRes.body.data.categories
      .flatMap((c: any) => c.services)
      .find((s: any) => s.isAvailable);

    if (!svc) {
      // Skip if no available services
      return;
    }

    const res = await request(app)
      .post("/api/services/orders/from-cart")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        storefrontId,
        items: [{ serviceId: svc.id, quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("items");
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].quantity).toBe(2);
  });
});
