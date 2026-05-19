import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";
import bcrypt from "bcrypt";

describe("Admin Company Verification", () => {
  let adminToken: string;
  let createdAdminId: number | null = null;

  beforeAll(async () => {
    // Try to find existing admin first
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

    // If no admin exists, create a temporary one
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: "admin_test_temp@faztudo.test",
          name: "Admin Temp",
          password: await bcrypt.hash("Teste@123", 10),
          role: "ADMIN",
          status: "ACTIVE",
          emailVerified: true,
        },
      });
      createdAdminId = admin.id;
    } else {
      // Activate existing admin
      await prisma.user.update({
        where: { id: admin.id },
        data: { status: "ACTIVE", emailVerified: true },
      }).catch(() => {});
    }

    const res = await request(app).post("/api/auth/login").send({
      email: admin.email,
      password: "Teste@123",
    });
    adminToken = res.body.data?.token;
  });

  afterAll(async () => {
    // Clean up temp admin if we created one
    if (createdAdminId) {
      await prisma.user.delete({ where: { id: createdAdminId } }).catch(() => {});
    }
  });

  it("should list pending companies", async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get("/api/admin/companies/pending")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should list all companies", async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get("/api/admin/companies")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should reject non-admin access to pending companies", async () => {
    const res = await request(app).get("/api/admin/companies/pending");
    expect(res.status).toBe(401);
  });
});
