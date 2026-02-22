# Infrastructure Hardening: Object Storage, Health Probes & Trust Proxy

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate file uploads to S3-compatible object storage with signed URLs, split health/metrics into Kubernetes-ready probes with real SLO metrics, and make trust proxy + rate limiting production-safe.

**Architecture:** Three independent modules that can be implemented in parallel. Upload migration uses a storage abstraction layer (local disk ↔ S3) to maintain dev simplicity. Health probes are split into liveness/readiness/startup following K8s conventions. Trust proxy becomes env-configurable with IP allowlist validation.

**Tech Stack:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (S3-compatible — works with MinIO, R2, DigitalOcean Spaces), `prom-client` (already installed), `express-rate-limit` (already installed, adding Redis store), `rate-limit-redis`.

---

## Module A: Object Storage Migration (Uploads)

### Current State

- **Two upload pipelines**: Chat files (10MB, auth-protected, tracked in `File` table) and Listing images (5MB × 8, public, no DB tracking)
- **Storage**: `multer.diskStorage` → `backend/uploads/chat/` and `backend/uploads/listings/`
- **Serving**: `express.static` — chat requires JWT, listings are public
- **Problems**: Files lost on container restart, can't horizontally scale, no CDN, orphaned listing files never cleaned up
- **Frontend**: `ServiceChat.tsx`, `CreateService.tsx`, `EditService.tsx` construct URLs as `${VITE_API_URL}/uploads/...`

### Target State

- Frontend requests a **presigned upload URL** from backend
- Frontend uploads **directly to S3** (no backend file proxy)
- Backend stores only **metadata + object key** in DB
- Serving via **presigned download URLs** (chat, time-limited) or **public bucket URLs** (listings)
- Async antivirus scan via BullMQ for sensitive attachments (chat files)
- **Local dev** still works with MinIO or disk fallback

---

### Task A1: Storage Abstraction Layer

**Files:**
- Create: `backend/src/lib/storage.ts`
- Create: `backend/src/lib/storage.test.ts`
- Modify: `backend/src/config/env.ts` — add storage env vars

**Step 1: Add env vars to `env.ts`**

Add to `EnvConfig` interface and `getEnvConfig()`:

```typescript
// In EnvConfig interface, after MFA_ENCRYPTION_KEY:
// Object Storage
STORAGE_PROVIDER: 'local' | 's3';
S3_BUCKET: string;
S3_REGION: string;
S3_ENDPOINT: string;
S3_ACCESS_KEY_ID: string;
S3_SECRET_ACCESS_KEY: string;
S3_PUBLIC_URL: string; // CDN or bucket public URL for listing images
UPLOAD_PRESIGN_EXPIRY_SECONDS: number;
DOWNLOAD_PRESIGN_EXPIRY_SECONDS: number;
```

```typescript
// In getEnvConfig(), after MFA_ENCRYPTION_KEY:
STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER as 'local' | 's3') || 'local',
S3_BUCKET: process.env.S3_BUCKET || 'faztudo-uploads',
S3_REGION: process.env.S3_REGION || 'us-east-1',
S3_ENDPOINT: process.env.S3_ENDPOINT || '',
S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
S3_PUBLIC_URL: process.env.S3_PUBLIC_URL || '',
UPLOAD_PRESIGN_EXPIRY_SECONDS: parseInt(process.env.UPLOAD_PRESIGN_EXPIRY_SECONDS || '300', 10),
DOWNLOAD_PRESIGN_EXPIRY_SECONDS: parseInt(process.env.DOWNLOAD_PRESIGN_EXPIRY_SECONDS || '3600', 10),
```

**Step 2: Write failing tests for storage abstraction**

```typescript
// backend/src/lib/storage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    });

    it("generates download URL for local files", async () => {
      const storage = createStorageService({ provider: "local" });
      const url = await storage.getDownloadUrl("chat/abc123.pdf");
      expect(url).toContain("/uploads/chat/abc123.pdf");
    });

    it("generates public URL for listing images", async () => {
      const storage = createStorageService({ provider: "local" });
      const url = storage.getPublicUrl("listings/img-001.jpg");
      expect(url).toContain("/uploads/listings/img-001.jpg");
    });

    it("deletes file from local disk", async () => {
      const storage = createStorageService({ provider: "local" });
      // Will test with actual file in integration
      await expect(storage.deleteObject("nonexistent/file.txt")).resolves.not.toThrow();
    });
  });

  describe("s3 provider", () => {
    it("generates presigned upload URL", async () => {
      const storage = createStorageService({
        provider: "s3",
        bucket: "test-bucket",
        region: "us-east-1",
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
      });
      const url = await storage.getDownloadUrl("chat/abc123.pdf", 3600);
      expect(url).toContain("X-Amz-Expires");
    });

    it("generates public URL from S3_PUBLIC_URL config", async () => {
      const storage = createStorageService({
        provider: "s3",
        publicUrl: "https://cdn.faztudo.com.br",
      });
      const url = storage.getPublicUrl("listings/img-001.jpg");
      expect(url).toBe("https://cdn.faztudo.com.br/listings/img-001.jpg");
    });
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `createStorageService` not defined

**Step 4: Implement storage abstraction**

```typescript
// backend/src/lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import fs from "fs/promises";
import { createLogger } from "./logger";
import { env } from "../config/env";

const log = createLogger("storage");

export interface UploadUrlRequest {
  key: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface UploadUrlResponse {
  url: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  key: string;
}

export interface StorageService {
  getUploadUrl(req: UploadUrlRequest): Promise<UploadUrlResponse>;
  getDownloadUrl(key: string, expirySeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
  deleteObject(key: string): Promise<void>;
}

interface StorageConfig {
  provider: "local" | "s3";
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  uploadExpiry?: number;
  downloadExpiry?: number;
}

function createLocalStorage(): StorageService {
  const uploadsDir = path.join(process.cwd(), "uploads");

  return {
    async getUploadUrl(req) {
      return {
        url: `/api/storage/upload?key=${encodeURIComponent(req.key)}&contentType=${encodeURIComponent(req.contentType)}`,
        method: "POST",
        headers: { "Content-Type": "multipart/form-data" },
        key: req.key,
      };
    },

    async getDownloadUrl(key) {
      return `/uploads/${key}`;
    },

    getPublicUrl(key) {
      return `/uploads/${key}`;
    },

    async deleteObject(key) {
      const filePath = path.join(uploadsDir, key);
      try {
        await fs.unlink(filePath);
        log.info({ key }, "Local file deleted");
      } catch (err: any) {
        if (err.code !== "ENOENT") throw err;
        log.debug({ key }, "File already deleted or not found");
      }
    },
  };
}

function createS3Storage(config: StorageConfig): StorageService {
  const client = new S3Client({
    region: config.region || "us-east-1",
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
      : {}),
  });

  const bucket = config.bucket!;
  const uploadExpiry = config.uploadExpiry || 300;
  const downloadExpiry = config.downloadExpiry || 3600;

  return {
    async getUploadUrl(req) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: req.key,
        ContentType: req.contentType,
        ContentLength: req.maxSizeBytes,
      });
      const url = await getSignedUrl(client, command, { expiresIn: uploadExpiry });
      return {
        url,
        method: "PUT",
        headers: { "Content-Type": req.contentType },
        key: req.key,
      };
    },

    async getDownloadUrl(key, expiry) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn: expiry || downloadExpiry });
    },

    getPublicUrl(key) {
      if (config.publicUrl) {
        return `${config.publicUrl}/${key}`;
      }
      return `https://${bucket}.s3.${config.region}.amazonaws.com/${key}`;
    },

    async deleteObject(key) {
      const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
      await client.send(command);
      log.info({ key, bucket }, "S3 object deleted");
    },
  };
}

export function createStorageService(overrides?: Partial<StorageConfig>): StorageService {
  const config: StorageConfig = {
    provider: overrides?.provider ?? env.STORAGE_PROVIDER,
    bucket: overrides?.bucket ?? env.S3_BUCKET,
    region: overrides?.region ?? env.S3_REGION,
    endpoint: overrides?.endpoint ?? env.S3_ENDPOINT,
    accessKeyId: overrides?.accessKeyId ?? env.S3_ACCESS_KEY_ID,
    secretAccessKey: overrides?.secretAccessKey ?? env.S3_SECRET_ACCESS_KEY,
    publicUrl: overrides?.publicUrl ?? env.S3_PUBLIC_URL,
    uploadExpiry: overrides?.uploadExpiry ?? env.UPLOAD_PRESIGN_EXPIRY_SECONDS,
    downloadExpiry: overrides?.downloadExpiry ?? env.DOWNLOAD_PRESIGN_EXPIRY_SECONDS,
  };

  if (config.provider === "s3") {
    log.info({ bucket: config.bucket, region: config.region }, "Using S3 storage provider");
    return createS3Storage(config);
  }

  log.info("Using local disk storage provider");
  return createLocalStorage();
}

// Singleton for app-wide use
let _storage: StorageService | null = null;
export function getStorage(): StorageService {
  if (!_storage) {
    _storage = createStorageService();
  }
  return _storage;
}
```

**Step 5: Run tests — verify they pass**

Run: `cd backend && npx vitest run src/lib/storage.test.ts`
Expected: PASS

**Step 6: Install S3 SDK dependencies**

Run: `cd backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

**Step 7: Commit**

```bash
git add backend/src/lib/storage.ts backend/src/lib/storage.test.ts backend/src/config/env.ts backend/package.json backend/package-lock.json
git commit -m "feat: add storage abstraction layer with local/S3 providers"
```

---

### Task A2: Presigned Upload Endpoint (Backend)

**Files:**
- Create: `backend/src/routes/storageRoutes.ts`
- Create: `backend/src/controllers/storageController.ts`
- Modify: `backend/src/index.ts` — register new routes
- Modify: `backend/src/middleware/validation.ts` — add upload request schema

**Step 1: Write upload request Zod schema**

Add to `backend/src/middleware/validation.ts`:

```typescript
export const presignUploadSchema = z.object({
  body: z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().min(1).max(100),
    context: z.enum(["chat", "listing", "profile", "dispute"]),
    contextId: z.string().optional(), // orderId for chat, listingId for listing
    fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  }),
});
```

**Step 2: Write failing test for presign controller**

Create `backend/tests/storage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Storage Controller", () => {
  describe("POST /api/storage/presign-upload", () => {
    it("returns presigned URL for chat file upload", async () => {
      // Test: authenticated user gets a presigned URL with correct key prefix
    });

    it("rejects unauthenticated requests", async () => {
      // Test: returns 401 without JWT
    });

    it("rejects files exceeding size limit for context", async () => {
      // Test: chat allows 10MB, listing allows 5MB
    });

    it("rejects disallowed content types for context", async () => {
      // Test: listing only allows images, chat allows images + docs
    });

    it("generates correct key prefix by context", async () => {
      // Test: chat → "chat/<orderId>/<uuid>.<ext>"
      //       listing → "listings/<uuid>.<ext>"
    });
  });

  describe("POST /api/storage/confirm-upload", () => {
    it("creates File record in DB after successful upload", async () => {
      // Test: chat upload confirmation creates File row
    });

    it("returns public URL for listing images", async () => {
      // Test: listing confirmation returns permanent URL
    });
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/storage.test.ts`
Expected: FAIL

**Step 4: Implement storage controller**

```typescript
// backend/src/controllers/storageController.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { getStorage } from "../lib/storage";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import crypto from "crypto";
import path from "path";

const log = createLogger("storageController");

const CONTEXT_CONFIG = {
  chat: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/plain",
    ],
    keyPrefix: (contextId: string) => `chat/${contextId}`,
    isPublic: false,
  },
  listing: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    keyPrefix: (_contextId: string) => "listings",
    isPublic: true,
  },
  profile: {
    maxSize: 2 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: (_contextId: string) => "profiles",
    isPublic: true,
  },
  dispute: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf", "text/plain",
    ],
    keyPrefix: (contextId: string) => `disputes/${contextId}`,
    isPublic: false,
  },
} as const;

type UploadContext = keyof typeof CONTEXT_CONFIG;

export async function presignUpload(req: AuthRequest, res: Response): Promise<void> {
  const { filename, contentType, context, contextId, fileSize } = req.body;
  const userId = req.user!.id;

  const config = CONTEXT_CONFIG[context as UploadContext];
  if (!config) {
    res.status(400).json({ success: false, message: "Invalid upload context" });
    return;
  }

  if (fileSize > config.maxSize) {
    res.status(400).json({
      success: false,
      message: `File too large for ${context}. Max: ${config.maxSize / (1024 * 1024)}MB`,
    });
    return;
  }

  if (!config.allowedTypes.includes(contentType)) {
    res.status(400).json({
      success: false,
      message: `Content type ${contentType} not allowed for ${context}`,
    });
    return;
  }

  const ext = path.extname(filename).toLowerCase() || ".bin";
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const prefix = config.keyPrefix(contextId || "");
  const key = `${prefix}/${uniqueName}`;

  try {
    const storage = getStorage();
    const presigned = await storage.getUploadUrl({
      key,
      contentType,
      maxSizeBytes: fileSize,
    });

    log.info({ userId, context, key, contentType, fileSize }, "Presigned upload URL generated");

    res.json({
      success: true,
      data: {
        uploadUrl: presigned.url,
        method: presigned.method,
        headers: presigned.headers,
        key,
      },
    });
  } catch (err) {
    log.error({ err, userId, context }, "Failed to generate presigned URL");
    res.status(500).json({ success: false, message: "Failed to generate upload URL" });
  }
}

export async function confirmUpload(req: AuthRequest, res: Response): Promise<void> {
  const { key, originalName, mimeType, size, context, contextId } = req.body;
  const userId = req.user!.id;
  const config = CONTEXT_CONFIG[context as UploadContext];

  try {
    const storage = getStorage();

    if (context === "chat" && contextId) {
      // Create File record for auditable chat uploads
      const file = await prisma.file.create({
        data: {
          filename: path.basename(key),
          originalName,
          mimeType,
          size,
          url: key, // Store the object key, not a URL
          userId,
          serviceOrderId: parseInt(contextId, 10),
        },
      });

      // Enqueue antivirus scan for sensitive files
      // TODO: Uncomment when antivirus worker is ready
      // await enqueueAntivirusScan({ fileId: file.id, key });

      const downloadUrl = await storage.getDownloadUrl(key);
      res.json({
        success: true,
        data: {
          file: { ...file, downloadUrl },
        },
      });
      return;
    }

    // For public contexts (listing, profile), return permanent URL
    const publicUrl = config.isPublic
      ? storage.getPublicUrl(key)
      : await storage.getDownloadUrl(key);

    log.info({ userId, context, key }, "Upload confirmed");

    res.json({
      success: true,
      data: {
        url: publicUrl,
        key,
      },
    });
  } catch (err) {
    log.error({ err, userId, context, key }, "Failed to confirm upload");
    res.status(500).json({ success: false, message: "Failed to confirm upload" });
  }
}
```

**Step 5: Create routes file**

```typescript
// backend/src/routes/storageRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { presignUploadSchema } from "../middleware/validation";
import { presignUpload, confirmUpload } from "../controllers/storageController";

const router = Router();

router.post("/presign-upload", verifyToken, validateBody(presignUploadSchema.shape.body), presignUpload);
router.post("/confirm-upload", verifyToken, confirmUpload);

export default router;
```

**Step 6: Register route in `index.ts`**

Add after existing route registrations:

```typescript
import storageRoutes from "./routes/storageRoutes";
// ...
app.use("/api/storage", storageRoutes);
```

**Step 7: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/storage.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add backend/src/controllers/storageController.ts backend/src/routes/storageRoutes.ts backend/src/middleware/validation.ts backend/src/index.ts
git commit -m "feat: add presigned upload/confirm endpoints for object storage"
```

---

### Task A3: Frontend Upload Service Refactor

**Files:**
- Create: `frontend/src/services/storageService.ts`
- Modify: `frontend/src/services/serviceService.ts` — deprecate old upload functions
- Modify: `frontend/src/pages/services/ServiceChat.tsx` — use new upload flow
- Modify: `frontend/src/pages/professional/CreateService.tsx` — use new upload flow
- Modify: `frontend/src/pages/professional/EditService.tsx` — use new upload flow

**Step 1: Create storage service**

```typescript
// frontend/src/services/storageService.ts
import api from "./api";

interface PresignResponse {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  key: string;
}

interface ConfirmResponse {
  url?: string;
  key: string;
  file?: {
    id: number;
    downloadUrl: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
}

export async function uploadFile(
  file: File,
  context: "chat" | "listing" | "profile" | "dispute",
  contextId?: string
): Promise<ConfirmResponse> {
  // Step 1: Get presigned URL from backend
  const { data: presignData } = await api.post<{ success: boolean; data: PresignResponse }>(
    "/api/storage/presign-upload",
    {
      filename: file.name,
      contentType: file.type,
      context,
      contextId,
      fileSize: file.size,
    }
  );

  const { uploadUrl, method, headers, key } = presignData.data;

  // Step 2: Upload directly to storage (S3 or local)
  if (method === "PUT") {
    // S3 presigned PUT
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type, ...headers },
      body: file,
    });
  } else {
    // Local fallback — POST multipart to backend
    const formData = new FormData();
    formData.append("file", file);
    await api.post(uploadUrl, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  // Step 3: Confirm upload with backend
  const { data: confirmData } = await api.post<{ success: boolean; data: ConfirmResponse }>(
    "/api/storage/confirm-upload",
    {
      key,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      context,
      contextId,
    }
  );

  return confirmData.data;
}

export async function uploadFiles(
  files: File[],
  context: "chat" | "listing" | "profile" | "dispute",
  contextId?: string
): Promise<ConfirmResponse[]> {
  return Promise.all(files.map((f) => uploadFile(f, context, contextId)));
}
```

**Step 2: Update ServiceChat.tsx**

Replace the `uploadChatFile` + `sendMessage` flow with the new `uploadFile("chat", orderId)` call. The response returns `file.downloadUrl` instead of constructing `${API_BASE}${url}`.

Key change: Remove `import { uploadChatFile } from "../../services/serviceService"` and add `import { uploadFile } from "../../services/storageService"`.

**Step 3: Update CreateService.tsx and EditService.tsx**

Replace `uploadListingImages(files)` with `uploadFiles(files, "listing")`. The response returns `url` (public URL) directly instead of a relative path.

Key change: Remove `import { uploadListingImages } from "../../services/serviceService"` and add `import { uploadFiles } from "../../services/storageService"`.

Image preview URLs no longer need `${BACKEND_URL}` prefix — they come as full URLs (or relative URLs that work as-is for local).

**Step 4: Commit**

```bash
git add frontend/src/services/storageService.ts frontend/src/pages/services/ServiceChat.tsx frontend/src/pages/professional/CreateService.tsx frontend/src/pages/professional/EditService.tsx
git commit -m "feat: frontend upload refactor to use presigned URLs"
```

---

### Task A4: Backward Compatibility & Migration

**Files:**
- Modify: `backend/src/index.ts` — keep static serving as fallback for existing URLs
- Create: `backend/src/scripts/migrate-uploads-to-s3.ts` — one-time migration script

**Step 1: Keep static file serving as fallback**

The existing `/uploads/...` express.static middleware stays **unchanged**. Old URLs in the DB continue to work. New uploads go through object storage. Over time, the migration script moves old files to S3.

**Step 2: Write migration script**

```typescript
// backend/src/scripts/migrate-uploads-to-s3.ts
// One-time script: reads all File records + ServiceListing.images,
// uploads each local file to S3, updates DB URLs.
// Run: npx tsx src/scripts/migrate-uploads-to-s3.ts --dry-run
// Run: npx tsx src/scripts/migrate-uploads-to-s3.ts --execute
```

The script should:
1. Find all `File` records where `url` starts with `/uploads/`
2. For each, upload the local file to S3 with matching key
3. Update the `url` field to the new object key
4. Find all `ServiceListing` records, parse `images` JSON array
5. For each URL starting with `/uploads/listings/`, upload to S3 and update
6. Support `--dry-run` (list what would be migrated) and `--execute` modes
7. Log progress with Pino

**Step 3: Commit**

```bash
git add backend/src/scripts/migrate-uploads-to-s3.ts
git commit -m "feat: add upload migration script for S3"
```

---

## Module B: Health Probes & SLO Metrics

### Current State

- `/health` and `/metrics` are **localhost-only** (`localOnlyMiddleware` returns 404 to non-local IPs)
- `/health` checks DB + Redis only; queues and circuit breaker are informational
- 8 custom Prometheus metrics are **defined but never instrumented** (zero `.inc()` or `.observe()` calls)
- No liveness/readiness/startup probe separation
- No SLOs defined anywhere
- 3 of 6 queues missing from health check (RECONCILIATION, ANTI_FRAUD, ESCROW)
- `/metrics` requests are logged by pino-http (noisy in prod)

### Target State

- Three probes: `/health/live`, `/health/ready`, `/health/startup`
- Auth via internal network token (`HEALTH_AUTH_TOKEN` env var) or VPC-restricted access
- All 8 custom metrics actually instrumented
- SLO metrics: p95/p99 latency, error rate by route, queue processing time, payment success rate
- All 6 queues checked in readiness
- `/metrics` silenced in request logger

---

### Task B1: Split Health Probes

**Files:**
- Modify: `backend/src/index.ts` — replace single `/health` with 3 probes
- Modify: `backend/src/config/env.ts` — add `HEALTH_AUTH_TOKEN`, `TRUST_PROXY`
- Create: `backend/tests/health-probes.test.ts`

**Step 1: Add env vars**

```typescript
// In EnvConfig:
HEALTH_AUTH_TOKEN: string;

// In getEnvConfig():
HEALTH_AUTH_TOKEN: process.env.HEALTH_AUTH_TOKEN || '',
```

**Step 2: Write failing tests**

```typescript
// backend/tests/health-probes.test.ts
import { describe, it, expect } from "vitest";

describe("Health Probes", () => {
  describe("GET /health/live", () => {
    it("returns 200 if process is alive (no dependency checks)", () => {
      // Liveness: only checks that Express can respond
    });
  });

  describe("GET /health/ready", () => {
    it("returns 200 when DB + Redis + all queues are healthy", () => {
      // Readiness: full dependency check
    });

    it("returns 503 when DB is down", () => {
      // Readiness: DB failure
    });

    it("returns 503 when Redis is down", () => {
      // Readiness: Redis failure
    });

    it("includes all 6 queue statuses", () => {
      // Readiness: NOTIFICATION, EMAIL, PAYMENT, RECONCILIATION, ANTI_FRAUD, ESCROW
    });
  });

  describe("GET /health/startup", () => {
    it("returns 200 once initial DB connection is established", () => {
      // Startup: one-time check on boot
    });
  });

  describe("Authentication", () => {
    it("returns 200 for requests with valid HEALTH_AUTH_TOKEN", () => {
      // Header: Authorization: Bearer <token>
    });

    it("returns 200 for localhost requests without token", () => {
      // Backward compat: localhost always allowed
    });

    it("returns 404 for external requests without token", () => {
      // External without token: hidden (404)
    });
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/health-probes.test.ts`
Expected: FAIL

**Step 4: Replace `localOnlyMiddleware` with `healthAuthMiddleware`**

Replace in `index.ts`:

```typescript
const healthAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

  if (isLocal) {
    next();
    return;
  }

  // Allow with auth token (for VPC/internal access)
  if (env.HEALTH_AUTH_TOKEN) {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${env.HEALTH_AUTH_TOKEN}`) {
      next();
      return;
    }
  }

  res.status(404).json({ success: false, message: "Not found" });
};
```

**Step 5: Implement three probes**

Replace `/health` route in `index.ts` with:

```typescript
// Liveness — is the process alive? No dependency checks.
app.get("/health/live", healthAuthMiddleware, (_req, res) => {
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

// Readiness — can the service handle traffic?
app.get("/health/ready", healthAuthMiddleware, async (_req, res) => {
  const checks: Record<string, any> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis
  try {
    const healthy = await isRedisHealthy();
    checks.redis = healthy ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  // All 6 queues
  try {
    const queueNames: QueueName[] = [
      "NOTIFICATION", "EMAIL", "PAYMENT",
      "RECONCILIATION", "ANTI_FRAUD", "ESCROW",
    ];
    const queueStatuses = await Promise.all(
      queueNames.map(async (name) => {
        try {
          return await getQueueStatus(name);
        } catch {
          return { name, error: true };
        }
      })
    );
    checks.queues = Object.fromEntries(
      queueStatuses.map((s) => [s.name, s])
    );
  } catch {
    checks.queues = "error";
  }

  // Circuit breaker
  try {
    checks.circuitBreaker = getCircuitBreakerStatus();
  } catch {
    checks.circuitBreaker = "unknown";
  }

  const isReady = checks.database === "ok" && checks.redis === "ok";

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    ...checks,
    timestamp: new Date().toISOString(),
  });
});

// Startup — has initial setup completed? (checked once on boot)
let startupComplete = false;
app.get("/health/startup", healthAuthMiddleware, async (_req, res) => {
  if (startupComplete) {
    res.json({ status: "started", timestamp: new Date().toISOString() });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    startupComplete = true;
    res.json({ status: "started", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "starting", timestamp: new Date().toISOString() });
  }
});

// Keep /health as alias for readiness (backward compat)
app.get("/health", healthAuthMiddleware, async (req, res) => {
  // Redirect to readiness internally
  req.url = "/health/ready";
  app.handle(req, res);
});
```

**Step 6: Silence `/metrics` and `/health/*` in request logger**

In `middleware/requestLog.ts`, update the ignore function:

```typescript
ignore: (req) => {
  const url = req.url || "";
  return url === "/" || url.startsWith("/health") || url === "/metrics";
},
```

**Step 7: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/health-probes.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add backend/src/index.ts backend/src/config/env.ts backend/src/middleware/requestLog.ts backend/tests/health-probes.test.ts
git commit -m "feat: split health into liveness/readiness/startup probes with token auth"
```

---

### Task B2: Instrument All Prometheus Metrics

**Files:**
- Modify: `backend/src/middleware/requestLog.ts` — instrument HTTP metrics
- Modify: `backend/src/workers/*.ts` — instrument queue metrics
- Modify: `backend/src/lib/paymentStateMachine.ts` — instrument payment metrics
- Modify: `backend/src/lib/circuitBreaker.ts` — instrument circuit breaker gauge
- Modify: `backend/src/controllers/mfaController.ts` — instrument MFA metrics

**Step 1: Instrument HTTP request metrics**

In `requestLog.ts`, add after pino-http creation:

```typescript
import { httpRequestDuration, httpRequestTotal } from "../lib/metrics";

// Add response hook to pino-http:
// After the existing requestLogger definition, wrap or add:
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalize route: replace numeric IDs with :id
    const route = req.route?.path || req.path.replace(/\/\d+/g, "/:id");
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestTotal.inc(labels);
  });

  next();
}
```

Register `httpMetricsMiddleware` in `index.ts` right after `requestLogger`.

**Step 2: Instrument queue job metrics**

In each worker file (`workers/notificationWorker.ts`, `workers/emailWorker.ts`, `workers/paymentWorker.ts`, `workers/reconciliationWorker.ts`, `workers/antiFraudWorker.ts`), add:

```typescript
import { queueJobsTotal, queueJobDuration } from "../lib/metrics";

// In the worker processor, wrap the existing logic:
const start = Date.now();
try {
  // ... existing job processing ...
  queueJobsTotal.inc({ queue: "QUEUE_NAME", status: "completed" });
} catch (err) {
  queueJobsTotal.inc({ queue: "QUEUE_NAME", status: "failed" });
  throw err;
} finally {
  const durationSec = (Date.now() - start) / 1000;
  queueJobDuration.observe({ queue: "QUEUE_NAME" }, durationSec);
}
```

**Step 3: Instrument payment state transitions**

In `lib/paymentStateMachine.ts`, in the `transitionPaymentStatus` function, after a successful transition:

```typescript
import { paymentTransitionsTotal, paymentEventsTotal } from "./metrics";

// After successful transition:
paymentTransitionsTotal.inc({ from_status: currentStatus, to_status: newStatus });
paymentEventsTotal.inc({ event_type: "transition", source: "state_machine" });
```

**Step 4: Instrument circuit breaker state**

In `lib/circuitBreaker.ts` or `services/mercadopagoService.ts`, after creating the breaker:

```typescript
import { circuitBreakerState } from "../lib/metrics";

// Listen to state changes:
mpBreaker.on("open", () => circuitBreakerState.set({ name: "mercadopago" }, 2));
mpBreaker.on("halfOpen", () => circuitBreakerState.set({ name: "mercadopago" }, 1));
mpBreaker.on("close", () => circuitBreakerState.set({ name: "mercadopago" }, 0));
```

**Step 5: Instrument MFA validations**

In `controllers/mfaController.ts`, in the verify function:

```typescript
import { mfaValidationsTotal } from "../lib/metrics";

// On success:
mfaValidationsTotal.inc({ result: "success" });
// On failure:
mfaValidationsTotal.inc({ result: "failure" });
// On backup code used:
mfaValidationsTotal.inc({ result: "backup_used" });
```

**Step 6: Commit**

```bash
git add backend/src/middleware/requestLog.ts backend/src/workers/ backend/src/lib/paymentStateMachine.ts backend/src/lib/circuitBreaker.ts backend/src/controllers/mfaController.ts backend/src/services/mercadopagoService.ts backend/src/index.ts
git commit -m "feat: instrument all 8 Prometheus metrics across codebase"
```

---

### Task B3: SLO Metrics & Dashboard Definitions

**Files:**
- Modify: `backend/src/lib/metrics.ts` — add SLO-specific metrics
- Create: `docs/slos.md` — SLO definitions document

**Step 1: Add SLO metrics to `metrics.ts`**

```typescript
// --- SLO Metrics ---

// API Latency SLO: p95 < 500ms, p99 < 2s
// Already covered by httpRequestDuration histogram — quantiles computed at query time

// Error Rate SLO: < 1% of requests result in 5xx per 5min window
export const httpErrorsTotal = new client.Counter({
  name: "http_errors_total",
  help: "Total HTTP 5xx errors",
  labelNames: ["method", "route"],
});

// Queue Processing Time SLO: p95 < 30s for all queues
// Already covered by queueJobDuration histogram

// Queue Failure Rate SLO: < 0.1% of jobs fail
export const queueFailureRate = new client.Gauge({
  name: "queue_failure_rate",
  help: "Current failure rate per queue (failed / total)",
  labelNames: ["queue"],
});

// Payment Success Rate SLO: > 99% of payment attempts succeed
export const paymentSuccessRate = new client.Gauge({
  name: "payment_success_rate",
  help: "Payment success rate over rolling window",
  labelNames: ["payment_method"],
});

// Uptime SLO: 99.9% availability (< 43.8min downtime/month)
// Measured externally via health probe monitoring
```

**Step 2: Create SLO definitions document**

```markdown
// docs/slos.md

# FazTudo — Service Level Objectives

## API Latency
- **SLI**: `histogram_quantile(0.95, http_request_duration_seconds)`
- **SLO**: p95 < 500ms, p99 < 2s
- **Alert**: p95 > 500ms for 5 minutes

## Error Rate
- **SLI**: `rate(http_errors_total[5m]) / rate(http_requests_total[5m])`
- **SLO**: < 1% 5xx errors per 5-minute window
- **Alert**: Error rate > 1% for 3 minutes

## Queue Processing Time
- **SLI**: `histogram_quantile(0.95, queue_job_duration_seconds)`
- **SLO**: p95 < 30s for all queues
- **Alert**: p95 > 30s for any queue for 5 minutes

## Payment Success Rate
- **SLI**: Successful payment transitions / total payment attempts
- **SLO**: > 99% success rate over rolling 1h window
- **Alert**: Success rate < 99% for 10 minutes

## Availability
- **SLI**: Health probe success rate (external monitor)
- **SLO**: 99.9% uptime (< 43.8min downtime/month)
- **Alert**: 3 consecutive /health/ready failures
```

**Step 3: Commit**

```bash
git add backend/src/lib/metrics.ts docs/slos.md
git commit -m "feat: add SLO metrics definitions and documentation"
```

---

## Module C: Trust Proxy & Rate Limiting Hardening

### Current State

- `app.set('trust proxy', 1)` — hardcoded, no env var
- Rate limiting uses **in-memory store** (resets on restart, no cross-instance sharing)
- 7 rate limiters: 5 IP-based, 2 user-based (via JWT id)
- No fingerprinting beyond IP/userId
- MFA routes lack dedicated rate limiting
- `sensitiveLimiter` and `financialLimiter` have hardcoded limits (not configurable via env)
- `userSensitiveLimiter` is defined but unused

### Target State

- `TRUST_PROXY` env var: `0`, `1`, `2`, `loopback`, `uniquelocal`, or specific CIDR
- Rate limiting backed by **Redis store** (shared state across instances)
- MFA routes get dedicated rate limiting
- `userSensitiveLimiter` applied to MFA verification
- All rate limiter windows/maxes configurable via env vars
- Request fingerprinting: IP + userId (no User-Agent — too easy to spoof, adds privacy concerns)

---

### Task C1: Parameterize Trust Proxy

**Files:**
- Modify: `backend/src/config/env.ts` — add `TRUST_PROXY`
- Modify: `backend/src/index.ts` — use env var
- Create: `backend/tests/trust-proxy.test.ts`

**Step 1: Add env var**

```typescript
// In EnvConfig:
TRUST_PROXY: string | number | boolean;

// In getEnvConfig():
TRUST_PROXY: (() => {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return nodeEnv === 'production' ? 0 : 1;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = parseInt(raw, 10);
  if (!isNaN(num)) return num;
  return raw; // 'loopback', 'uniquelocal', or CIDR like '10.0.0.0/8'
})(),
```

**Step 2: Write test**

```typescript
// backend/tests/trust-proxy.test.ts
import { describe, it, expect } from "vitest";

describe("Trust Proxy Config", () => {
  it("defaults to 1 in development", () => {
    // Set NODE_ENV=development, unset TRUST_PROXY
    // Expect: 1
  });

  it("defaults to 0 (disabled) in production when not set", () => {
    // Set NODE_ENV=production, unset TRUST_PROXY
    // Expect: 0 (safe default — requires explicit opt-in)
  });

  it("parses numeric values", () => {
    // TRUST_PROXY=2 → 2
  });

  it("parses boolean values", () => {
    // TRUST_PROXY=true → true
    // TRUST_PROXY=false → false
  });

  it("passes through string values (loopback, CIDR)", () => {
    // TRUST_PROXY=loopback → 'loopback'
    // TRUST_PROXY=10.0.0.0/8 → '10.0.0.0/8'
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/trust-proxy.test.ts`
Expected: FAIL

**Step 4: Update `index.ts`**

Replace:
```typescript
app.set('trust proxy', 1);
```
With:
```typescript
app.set('trust proxy', env.TRUST_PROXY);
log.info({ trustProxy: env.TRUST_PROXY }, "Trust proxy configured");
```

**Step 5: Add startup warning for production**

```typescript
// In index.ts, after setting trust proxy:
if (isProduction && env.TRUST_PROXY === 0) {
  log.warn(
    "TRUST_PROXY is 0 in production. If behind a load balancer/reverse proxy, " +
    "set TRUST_PROXY to the number of proxy hops or a specific CIDR. " +
    "Without this, rate limiting uses proxy IP instead of client IP."
  );
}
```

**Step 6: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/trust-proxy.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/config/env.ts backend/src/index.ts backend/tests/trust-proxy.test.ts
git commit -m "feat: make trust proxy configurable via TRUST_PROXY env var"
```

---

### Task C2: Redis-Backed Rate Limiting

**Files:**
- Modify: `backend/src/middleware/rateLimiter.ts` — add Redis store
- Modify: `backend/package.json` — add `rate-limit-redis`
- Create: `backend/tests/rate-limiter-redis.test.ts`

**Step 1: Install dependency**

Run: `cd backend && npm install rate-limit-redis`

**Step 2: Write failing test**

```typescript
// backend/tests/rate-limiter-redis.test.ts
import { describe, it, expect } from "vitest";

describe("Rate Limiter with Redis Store", () => {
  it("uses Redis store when REDIS_URL is configured", () => {
    // Verify store type is RedisStore
  });

  it("falls back to memory store when Redis unavailable", () => {
    // Verify graceful degradation
  });

  it("shares state across simulated instances", () => {
    // Two calls with same key should share counter
  });
});
```

**Step 3: Run tests — verify they fail**

Run: `cd backend && npx vitest run tests/rate-limiter-redis.test.ts`
Expected: FAIL

**Step 4: Add Redis store to rate limiters**

Modify `rateLimiter.ts`:

```typescript
import { RedisStore } from "rate-limit-redis";
import { getRedisConnection } from "../queues/connection";
import { createLogger } from "../lib/logger";

const log = createLogger("rateLimiter");

function createRedisStore(prefix: string): RedisStore | undefined {
  try {
    const conn = getRedisConnection();
    return new RedisStore({
      sendCommand: (...args: string[]) => conn.call(...args) as any,
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    log.warn({ err }, "Redis unavailable for rate limiting — falling back to in-memory store");
    return undefined;
  }
}

// Then in each rate limiter, add `store`:
export const generalLimiter = rateLimit({
  store: createRedisStore("general"),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

// Apply same pattern to authLimiter, sensitiveLimiter, financialLimiter, webhookLimiter
```

**Step 5: Make hardcoded limits configurable**

Add to `env.ts`:

```typescript
// In EnvConfig:
SENSITIVE_RATE_LIMIT_MAX: number;
FINANCIAL_RATE_LIMIT_MAX: number;
WEBHOOK_RATE_LIMIT_MAX: number;
MFA_RATE_LIMIT_MAX: number;

// In getEnvConfig():
SENSITIVE_RATE_LIMIT_MAX: parseInt(process.env.SENSITIVE_RATE_LIMIT_MAX || '5', 10),
FINANCIAL_RATE_LIMIT_MAX: parseInt(process.env.FINANCIAL_RATE_LIMIT_MAX || '3', 10),
WEBHOOK_RATE_LIMIT_MAX: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '100', 10),
MFA_RATE_LIMIT_MAX: parseInt(process.env.MFA_RATE_LIMIT_MAX || '5', 10),
```

Update `rateLimiter.ts` to use these instead of hardcoded values.

**Step 6: Run tests — verify they pass**

Run: `cd backend && npx vitest run tests/rate-limiter-redis.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/config/env.ts backend/package.json backend/package-lock.json backend/tests/rate-limiter-redis.test.ts
git commit -m "feat: add Redis-backed rate limiting with env-configurable limits"
```

---

### Task C3: MFA Rate Limiting & Unused Limiter Wiring

**Files:**
- Modify: `backend/src/routes/authRoutes.ts` — add MFA rate limiter
- Modify: `backend/src/middleware/rateLimiter.ts` — create MFA-specific limiter

**Step 1: Create MFA rate limiter**

In `rateLimiter.ts`:

```typescript
export const mfaLimiter = rateLimit({
  store: createRedisStore("mfa"),
  windowMs: 15 * 60 * 1000,
  max: env.MFA_RATE_LIMIT_MAX, // default: 5
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Muitas tentativas de MFA. Tente novamente em 15 minutos." },
});

// Also wire userSensitiveLimiter to MFA routes:
export const mfaUserLimiter = createUserRateLimiter(
  env.MFA_RATE_LIMIT_MAX,
  15 * 60 * 1000,
  "Muitas tentativas de verificação MFA. Tente novamente em 15 minutos."
);
```

**Step 2: Apply to MFA routes**

In `authRoutes.ts`, find MFA-related routes and add:

```typescript
import { mfaLimiter, mfaUserLimiter } from "../middleware/rateLimiter";

// On MFA verification endpoints:
router.post("/mfa/verify", verifyToken, mfaLimiter, mfaUserLimiter, verifyMFA);
router.post("/mfa/setup/verify", verifyToken, mfaLimiter, mfaUserLimiter, verifyMFASetup);
```

**Step 3: Write test**

```typescript
// In existing MFA tests, add:
it("rate limits MFA verification attempts", async () => {
  // Send 6 MFA verification requests rapidly
  // 6th should return 429
});
```

**Step 4: Run tests**

Run: `cd backend && npx vitest run tests/middleware/mfa.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/routes/authRoutes.ts
git commit -m "feat: add dedicated MFA rate limiting (IP + user-based)"
```

---

## Module D: Update `.env.example` & CLAUDE.md

### Task D1: Update Environment Examples

**Files:**
- Modify: `backend/.env.example` — add new env vars
- Modify: `CLAUDE.md` — update environment variables section

**Step 1: Add to `.env.example`**

```bash
# Object Storage
STORAGE_PROVIDER=local                    # local | s3
S3_BUCKET=faztudo-uploads
S3_REGION=us-east-1
S3_ENDPOINT=                              # Empty for AWS, set for MinIO/R2/DO Spaces
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_URL=                            # CDN URL for public files
UPLOAD_PRESIGN_EXPIRY_SECONDS=300
DOWNLOAD_PRESIGN_EXPIRY_SECONDS=3600

# Health & Metrics
HEALTH_AUTH_TOKEN=                         # Token for non-localhost health probe access

# Trust Proxy
TRUST_PROXY=1                             # 0 | 1 | 2 | true | false | loopback | CIDR

# Rate Limiting (additional)
SENSITIVE_RATE_LIMIT_MAX=5
FINANCIAL_RATE_LIMIT_MAX=3
WEBHOOK_RATE_LIMIT_MAX=100
MFA_RATE_LIMIT_MAX=5
```

**Step 2: Update CLAUDE.md**

Add the new env vars to the "Variaveis de Ambiente" section. Update the "Arquitetura" section to mention object storage. Add storage routes to the API routes table.

**Step 3: Commit**

```bash
git add backend/.env.example CLAUDE.md
git commit -m "docs: update env examples and CLAUDE.md for infra changes"
```

---

## Summary — Dependency Graph

```
Module A (Uploads)          Module B (Health)          Module C (Trust Proxy)
├── A1: Storage Layer       ├── B1: Split Probes       ├── C1: Parameterize Trust Proxy
├── A2: Presign Endpoints   ├── B2: Instrument Metrics ├── C2: Redis Rate Limiting
├── A3: Frontend Refactor   └── B3: SLO Definitions    └── C3: MFA Rate Limiting
└── A4: Migration Script
                                                        Module D (Docs)
                                                        └── D1: Update .env.example & CLAUDE.md
```

**Modules A, B, C are fully independent** — can be implemented in parallel by different agents/sessions.

Module D depends on all three being complete.

**Estimated tasks:** 11 (A1–A4, B1–B3, C1–C3, D1)
**Estimated commits:** 11
