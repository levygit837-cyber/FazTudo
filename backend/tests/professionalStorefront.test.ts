import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

describe("Professional Storefront", () => {
  let professionalUserId: number;

  beforeAll(async () => {
    const prof = await prisma.user.findFirst({ where: { email: "profissional@teste.com" } });
    professionalUserId = prof?.id ?? 0;
  });

  it("should return professional storefront publicly (no auth)", async () => {
    if (!professionalUserId) return;
    const res = await request(app)
      .get(`/api/services/professional/${professionalUserId}/storefront`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data).toHaveProperty("services");
  });

  it("should return 404 for non-existent professional", async () => {
    const res = await request(app).get("/api/services/professional/999999/storefront");
    expect(res.status).toBe(404);
  });

  it("should return 400 for non-professional userId", async () => {
    const client = await prisma.user.findFirst({ where: { email: "cliente@teste.com" } });
    if (!client) return;
    const res = await request(app).get(`/api/services/professional/${client.id}/storefront`);
    expect(res.status).toBe(400);
  });
});
