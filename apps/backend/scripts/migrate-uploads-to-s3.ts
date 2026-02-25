#!/usr/bin/env npx tsx
/**
 * migrate-uploads-to-s3.ts
 *
 * Migrates files from local disk (apps/backend/uploads/) to the configured S3-compatible
 * object storage. Updates File records in the database to point to the new keys.
 *
 * Usage:
 *   npx tsx scripts/migrate-uploads-to-s3.ts [--dry-run] [--dir=uploads]
 *
 * Options:
 *   --dry-run   Show what would be uploaded without actually uploading
 *   --dir=PATH  Override the uploads directory (default: uploads)
 *
 * Prerequisites:
 *   - S3 env vars configured (S3_BUCKET, S3_REGION, S3_ENDPOINT, etc.)
 *   - STORAGE_PROVIDER=s3
 *   - Database running with Prisma schema applied
 */

import path from "path";
import fs from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

// Load env
import "../src/config/env";
import { env } from "../src/config/env";
import { createLogger } from "../src/lib/logger";

const log = createLogger("migrate-uploads");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirArg = args.find((a) => a.startsWith("--dir="));
const uploadsDir = path.resolve(process.cwd(), dirArg?.split("=")[1] || "uploads");

interface MigrationStats {
  scanned: number;
  uploaded: number;
  skipped: number;
  failed: number;
  dbUpdated: number;
}

async function main() {
  log.info({ uploadsDir, dryRun }, "Starting upload migration");

  if (env.STORAGE_PROVIDER !== "s3") {
    log.error("STORAGE_PROVIDER must be 's3' to run this migration. Aborting.");
    process.exit(1);
  }

  if (!fs.existsSync(uploadsDir)) {
    log.warn({ uploadsDir }, "Uploads directory not found — nothing to migrate");
    process.exit(0);
  }

  const s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: !!env.S3_ENDPOINT, // Required for MinIO/DigitalOcean Spaces
  });

  const prisma = new PrismaClient();
  const stats: MigrationStats = {
    scanned: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    dbUpdated: 0,
  };

  try {
    // Walk the uploads directory recursively
    const files = walkDir(uploadsDir);
    stats.scanned = files.length;
    log.info({ count: files.length }, "Found local files to migrate");

    for (const filePath of files) {
      const relativePath = path.relative(uploadsDir, filePath);
      // Normalize to forward slashes for S3 keys
      const key = relativePath.replace(/\\/g, "/");

      if (dryRun) {
        log.info({ filePath, key }, "[DRY RUN] Would upload");
        stats.uploaded++;
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = guessContentType(filePath);

        await s3.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
          }),
        );

        stats.uploaded++;
        log.info({ key, size: fileBuffer.length }, "Uploaded to S3");
      } catch (err) {
        stats.failed++;
        log.error({ err, filePath, key }, "Failed to upload file");
      }
    }

    // Update File records in the database to use S3 keys
    if (!dryRun) {
      const dbFiles = await prisma.file.findMany({
        where: {
          url: { startsWith: "/uploads/" },
        },
      });

      for (const file of dbFiles) {
        const oldUrl = file.url;
        // Convert /uploads/chat/42/abc.jpg -> chat/42/abc.jpg
        const newKey = oldUrl.replace(/^\/uploads\//, "");

        try {
          await prisma.file.update({
            where: { id: file.id },
            data: { url: newKey },
          });
          stats.dbUpdated++;
          log.info({ fileId: file.id, oldUrl, newKey }, "Updated DB record");
        } catch (err) {
          log.error({ err, fileId: file.id }, "Failed to update DB record");
        }
      }
    }

    log.info(
      {
        ...stats,
        dryRun,
      },
      "Migration complete",
    );
  } finally {
    await prisma.$disconnect();
  }
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
  };
  return types[ext] || "application/octet-stream";
}

main().catch((err) => {
  log.error({ err }, "Migration failed");
  process.exit(1);
});
