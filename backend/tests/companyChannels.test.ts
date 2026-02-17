import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

describe("Company Channels", () => {
  let companyToken: string;
  let channelId: number;

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

  it("should create a channel", async () => {
    const res = await request(app)
      .post("/api/company/channels")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({ name: "Limpeza Residencial", description: "Canal para serviços de limpeza" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Limpeza Residencial");
    channelId = res.body.data.id;
  });

  it("should list channels", async () => {
    const res = await request(app)
      .get("/api/company/channels")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should reject creation without name", async () => {
    const res = await request(app)
      .post("/api/company/channels")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({ description: "no name" });
    expect(res.status).toBe(400);
  });

  it("should reject unauthenticated access", async () => {
    const res = await request(app)
      .get("/api/company/channels");
    expect(res.status).toBe(401);
  });

  it("should deactivate a channel", async () => {
    if (!channelId) return;
    const res = await request(app)
      .delete(`/api/company/channels/${channelId}`)
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
  });

  afterAll(async () => {
    if (channelId) {
      await prisma.companyChannelMember.deleteMany({ where: { channelId } }).catch(() => {});
      await prisma.companyChannel.delete({ where: { id: channelId } }).catch(() => {});
    }
  });
});
