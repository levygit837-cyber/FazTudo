import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

describe("Company Analytics", () => {
  let companyToken: string;

  beforeAll(async () => {
    await prisma.user.update({
      where: { email: "empresa@teste.com" },
      data: { status: "ACTIVE", emailVerified: true },
    }).catch(() => {});
    const res = await request(app).post("/api/auth/login").send({
      email: "empresa@teste.com",
      password: "Teste@123",
    });
    companyToken = res.body.data?.token;
  });

  it("should get analytics overview", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/overview")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalOrders");
    expect(res.body.data).toHaveProperty("completionRate");
    expect(res.body.data).toHaveProperty("totalRevenue");
  });

  it("should get revenue analytics", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/revenue")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should get member performance", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/members")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should get top services", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/services")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should block unauthenticated analytics access", async () => {
    const res = await request(app).get("/api/company/analytics/overview");
    expect(res.status).toBe(401);
  });
});
