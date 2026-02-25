import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStorageService } from "../../src/lib/storage";

// Mock env to avoid loading real env config during tests
vi.mock("../../src/config/env", () => ({
  env: {
    STORAGE_PROVIDER: "local",
    S3_BUCKET: "test-bucket",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "",
    S3_ACCESS_KEY_ID: "",
    S3_SECRET_ACCESS_KEY: "",
    S3_PUBLIC_URL: "",
    UPLOAD_PRESIGN_EXPIRY_SECONDS: 300,
    DOWNLOAD_PRESIGN_EXPIRY_SECONDS: 3600,
  },
}));

// Mock logger
vi.mock("../../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("StorageService", () => {
  describe("local provider", () => {
    it("generates upload URL pointing to local endpoint", async () => {
      const storage = createStorageService({ provider: "local" });
      const result = await storage.getUploadUrl({
        key: "chat/abc123.pdf",
        contentType: "application/pdf",
        maxSizeBytes: 10 * 1024 * 1024,
      });
      expect(result.url).toContain("/api/storage/upload");
      expect(result.method).toBe("POST");
      expect(result.key).toBe("chat/abc123.pdf");
    });

    it("generates download URL for local files", async () => {
      const storage = createStorageService({ provider: "local" });
      const url = await storage.getDownloadUrl("chat/abc123.pdf");
      expect(url).toContain("/uploads/chat/abc123.pdf");
    });

    it("generates public URL for listing images", () => {
      const storage = createStorageService({ provider: "local" });
      const url = storage.getPublicUrl("listings/img-001.jpg");
      expect(url).toContain("/uploads/listings/img-001.jpg");
    });

    it("does not throw when deleting nonexistent file", async () => {
      const storage = createStorageService({ provider: "local" });
      await expect(storage.deleteObject("nonexistent/file.txt")).resolves.not.toThrow();
    });
  });

  describe("s3 provider", () => {
    it("generates presigned upload URL", async () => {
      const storage = createStorageService({
        provider: "s3",
        bucket: "test-bucket",
        region: "us-east-1",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });
      const result = await storage.getUploadUrl({
        key: "chat/abc123.pdf",
        contentType: "application/pdf",
        maxSizeBytes: 10 * 1024 * 1024,
      });
      expect(result.url).toContain("test-bucket");
      expect(result.method).toBe("PUT");
    });

    it("generates presigned download URL with expiry", async () => {
      const storage = createStorageService({
        provider: "s3",
        bucket: "test-bucket",
        region: "us-east-1",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      });
      const url = await storage.getDownloadUrl("chat/abc123.pdf", 3600);
      expect(url).toContain("X-Amz-Expires");
    });

    it("generates public URL from publicUrl config", () => {
      const storage = createStorageService({
        provider: "s3",
        publicUrl: "https://cdn.faztudo.com.br",
      });
      const url = storage.getPublicUrl("listings/img-001.jpg");
      expect(url).toBe("https://cdn.faztudo.com.br/listings/img-001.jpg");
    });

    it("generates default S3 public URL when no publicUrl", () => {
      const storage = createStorageService({
        provider: "s3",
        bucket: "my-bucket",
        region: "sa-east-1",
        publicUrl: "",
      });
      const url = storage.getPublicUrl("listings/img-001.jpg");
      expect(url).toBe("https://my-bucket.s3.sa-east-1.amazonaws.com/listings/img-001.jpg");
    });
  });
});
