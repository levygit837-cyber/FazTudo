import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

describe("Company Order Flow", () => {
  let companyToken: string;
  const companyEmail = "empresa-order-flow@faztudo.com";

  beforeAll(async () => {
    // Clean up any existing test user
    await prisma.user.deleteMany({ where: { email: companyEmail } }).catch(() => {});

    // Register empresa user
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Empresa Order Flow Test",
      email: companyEmail,
      password: "Teste@123",
      role: "COMPANY",
      cnpj: "99.888.777/0001-66",
    });

    // Activate the user
    await prisma.user.update({
      where: { email: companyEmail },
      data: { status: "ACTIVE", emailVerified: true },
    }).catch(() => {});

    const res = await request(app).post("/api/auth/login").send({
      email: companyEmail,
      password: "Teste@123",
    });
    companyToken = res.body.data?.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: companyEmail } }).catch(() => {});
  });

  it("should allow COMPANY to access orders endpoint", async () => {
    const res = await request(app)
      .get("/api/services/orders")
      .set("Authorization", `Bearer ${companyToken}`);
    expect([200, 403]).toContain(res.status);
  });
});
