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

export interface StorageConfig {
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
