import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage module
vi.mock("../src/lib/storage", () => ({
  getStorage: vi.fn(() => ({
    getUploadUrl: vi.fn().mockResolvedValue({
      url: "https://s3.example.com/presigned-upload",
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
    }),
    getDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned-download"),
    getPublicUrl: vi.fn().mockReturnValue("https://cdn.example.com/listings/test.jpg"),
    deleteObject: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock prisma
vi.mock("../src/lib/prisma", () => ({
  default: {
    file: {
      create: vi.fn().mockResolvedValue({
        id: 1,
        filename: "abc123.jpg",
        originalName: "photo.jpg",
        mimeType: "image/jpeg",
        size: 500000,
        url: "chat/42/abc123.jpg",
        userId: 1,
        serviceOrderId: 42,
      }),
    },
  },
}));

// Mock logger
vi.mock("../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { presignUpload, confirmUpload } from "../src/controllers/storageController";

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body,
    user: { id: 1 },
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    _json: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res._json = data;
      return res;
    },
  };
  return res;
}

describe("Storage Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("presignUpload", () => {
    it("returns presigned URL for valid chat upload", async () => {
      const req = createMockReq({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        context: "chat",
        contextId: "42",
        fileSize: 500000,
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.uploadUrl).toBe("https://s3.example.com/presigned-upload");
      expect(res._json.data.method).toBe("PUT");
      expect(res._json.data.key).toMatch(/^chat\/42\//);
      expect(res._json.data.key).toMatch(/\.jpg$/);
    });

    it("returns presigned URL for listing upload", async () => {
      const req = createMockReq({
        filename: "listing.png",
        contentType: "image/png",
        context: "listing",
        fileSize: 1000000,
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.key).toMatch(/^listings\//);
    });

    it("rejects invalid context", async () => {
      const req = createMockReq({
        filename: "file.txt",
        contentType: "text/plain",
        context: "invalid_context",
        fileSize: 100,
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toContain("Invalid upload context");
    });

    it("rejects file exceeding max size for context", async () => {
      const req = createMockReq({
        filename: "huge.jpg",
        contentType: "image/jpeg",
        context: "profile",
        fileSize: 5 * 1024 * 1024, // 5MB, profile allows only 2MB
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toContain("File too large");
    });

    it("rejects disallowed content type for context", async () => {
      const req = createMockReq({
        filename: "spreadsheet.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        context: "profile", // profile only allows image/jpeg, image/png, image/webp
        fileSize: 100000,
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toContain("not allowed");
    });

    it("generates unique filename with correct extension", async () => {
      const req = createMockReq({
        filename: "My Photo (1).jpeg",
        contentType: "image/jpeg",
        context: "listing",
        fileSize: 100000,
      });
      const res = createMockRes();

      await presignUpload(req, res);

      expect(res._json.data.key).toMatch(/^listings\/[a-f0-9-]+\.jpeg$/);
    });
  });

  describe("confirmUpload", () => {
    it("creates File record for chat context", async () => {
      const req = createMockReq({
        key: "chat/42/abc123.jpg",
        originalName: "photo.jpg",
        mimeType: "image/jpeg",
        size: 500000,
        context: "chat",
        contextId: "42",
      });
      const res = createMockRes();

      await confirmUpload(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.file).toBeDefined();
      expect(res._json.data.file.downloadUrl).toBe("https://s3.example.com/presigned-download");
    });

    it("returns public URL for listing context", async () => {
      const req = createMockReq({
        key: "listings/abc123.jpg",
        originalName: "listing.jpg",
        mimeType: "image/jpeg",
        size: 100000,
        context: "listing",
      });
      const res = createMockRes();

      await confirmUpload(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.url).toBe("https://cdn.example.com/listings/test.jpg");
      expect(res._json.data.key).toBe("listings/abc123.jpg");
    });

    it("rejects invalid context on confirm", async () => {
      const req = createMockReq({
        key: "some/key.jpg",
        originalName: "file.jpg",
        mimeType: "image/jpeg",
        size: 100,
        context: "bogus",
      });
      const res = createMockRes();

      await confirmUpload(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
    });
  });
});
