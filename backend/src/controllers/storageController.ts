import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
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

  if (!config) {
    res.status(400).json({ success: false, message: "Invalid upload context" });
    return;
  }

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
