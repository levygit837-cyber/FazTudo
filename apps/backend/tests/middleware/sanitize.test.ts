import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { xssSanitizer } from "../../src/middleware/sanitize";

describe("xssSanitizer middleware (Express 5)", () => {
  const app = express();
  app.use(express.json());
  app.use(xssSanitizer);

  app.get("/test", (req, res) => {
    res.json({ query: req.query, success: true });
  });

  app.post("/test", (req, res) => {
    res.json({ body: req.body, success: true });
  });

  it("should not crash on GET with query params", async () => {
    const res = await request(app).get("/test?search=hello&page=1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should sanitize XSS in body", async () => {
    const res = await request(app)
      .post("/test")
      .send({ name: '<script>alert("xss")</script>' });
    expect(res.status).toBe(200);
    expect(res.body.body.name).not.toContain("<script>");
  });

  it("should handle query strings without throwing", async () => {
    const res = await request(app).get('/test?q=<img src=x onerror=alert(1)>');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
