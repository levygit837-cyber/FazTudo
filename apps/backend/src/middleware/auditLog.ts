import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("auditLog");

interface AuditEntry {
  timestamp: string;
  userId: number | null;
  userRole: string | null;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  statusCode?: number;
  duration?: number;
}

/**
 * Middleware that logs sensitive operations for audit trail.
 * Persists to AuditLog table for authenticated users, falls back to log-only.
 */
export const auditLog = (action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      userId: req.user?.id ?? null,
      userRole: req.user?.role ?? null,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.get("user-agent") || "unknown",
    };

    res.on("finish", () => {
      entry.statusCode = res.statusCode;
      entry.duration = Date.now() - startTime;

      if (res.statusCode >= 400) {
        log.warn({ audit: entry, action }, "Audit log (error)");
      } else {
        log.info({ audit: entry, action }, "Audit log");
      }

      // Persist to DB for authenticated users (fire-and-forget)
      if (entry.userId) {
        const targetId = extractTargetId(req);
        const targetType = extractTargetType(req);

        persistAuditLog({
          action,
          actorId: entry.userId,
          targetType,
          targetId,
          metadata: {
            method: entry.method,
            path: entry.path,
            statusCode: entry.statusCode,
            duration: entry.duration,
            body: sanitizeBody(req.body),
          },
          ipAddress: entry.ip,
          userAgent: entry.userAgent,
        }).catch((err) => {
          log.warn({ err, action }, "Failed to persist audit log (non-fatal)");
        });
      }
    });

    next();
  };
};

/**
 * Create an audit log entry directly (for use outside middleware).
 */
export async function createAuditLog(params: {
  actorId: number;
  action: string;
  targetType: string;
  targetId: number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata
          ? JSON.parse(JSON.stringify(params.metadata))
          : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
    log.info(
      {
        action: params.action,
        actorId: params.actorId,
        targetType: params.targetType,
        targetId: params.targetId,
      },
      "Audit log created",
    );
  } catch (err) {
    log.error({ err, params }, "Failed to create audit log");
  }
}

// ============================================
// HELPERS
// ============================================

async function persistAuditLog(data: {
  action: string;
  actorId: number;
  targetType: string;
  targetId: number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      ...data,
      metadata: data.metadata
        ? JSON.parse(JSON.stringify(data.metadata))
        : undefined,
    },
  });
}

/**
 * Extract the target ID from the request params.
 * Falls back to 0 for routes without an explicit target.
 */
function extractTargetId(req: AuthRequest): number {
  const raw =
    req.params.id ||
    req.params.companyId ||
    req.params.userId ||
    req.params.orderId;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return id ? parseInt(id, 10) || 0 : 0;
}

/**
 * Infer the target type from the request path.
 */
function extractTargetType(req: AuthRequest): string {
  const path = req.originalUrl.toLowerCase();
  if (path.includes("/users")) return "User";
  if (path.includes("/companies") || path.includes("/company")) return "Company";
  if (path.includes("/verifications")) return "Verification";
  if (path.includes("/disputes")) return "Dispute";
  if (path.includes("/config")) return "PlatformConfig";
  if (path.includes("/wallet") || path.includes("/withdraw")) return "Wallet";
  if (path.includes("/payments") || path.includes("/payment")) return "Payment";
  if (path.includes("/orders")) return "Order";
  if (path.includes("/mfa")) return "MFA";
  return "Unknown";
}

/**
 * Remove sensitive fields from request body before storing in audit log.
 */
function sanitizeBody(body: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;

  const sensitiveKeys = new Set([
    "password",
    "currentPassword",
    "newPassword",
    "token",
    "secret",
    "mfaToken",
    "code",
    "accessToken",
    "refreshToken",
    "creditCard",
    "cardNumber",
    "cvv",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveKeys.has(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
