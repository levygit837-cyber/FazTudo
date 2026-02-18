import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/index";
import prisma from "../src/lib/prisma";

const TEST_EMAIL = "empresa-channels@faztudo.com";
const TEST_CNPJ = "88888888000188";

async function cleanup() {
  const existing = await prisma.companyProfile.findFirst({ where: { cnpj: TEST_CNPJ } });
  if (existing) {
    await prisma.companyChannelMember.deleteMany({ where: { channel: { companyId: existing.id } } }).catch(() => {});
    await prisma.companyChannel.deleteMany({ where: { companyId: existing.id } }).catch(() => {});
    await prisma.companyMember.deleteMany({ where: { companyId: existing.id } }).catch(() => {});
    await prisma.companyRole.deleteMany({ where: { companyId: existing.id } }).catch(() => {});
    await prisma.companyProfile.delete({ where: { id: existing.id } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe("Company Channels", () => {
  let companyToken: string;
  let channelId: number;

  beforeAll(async () => {
    await cleanup();

    // Register a company user
    await request(app).post("/api/auth/register").send({
      name: "Empresa Channels Test",
      email: TEST_EMAIL,
      password: "Teste@123",
      role: "COMPANY",
      cnpj: TEST_CNPJ,
    });

    // Activate directly in DB
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { status: "ACTIVE", emailVerified: true },
    });

    const res = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
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
    await cleanup();
  });
});
