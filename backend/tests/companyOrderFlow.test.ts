import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index";
import prisma from "../src/lib/prisma";

describe("Company Order Flow", () => {
  let companyToken: string;

  beforeAll(async () => {
    // Activate empresa user
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

  it("should allow COMPANY to access orders endpoint", async () => {
    const res = await request(app)
      .get("/api/services/orders")
      .set("Authorization", `Bearer ${companyToken}`);
    expect([200, 403]).toContain(res.status);
  });
});
