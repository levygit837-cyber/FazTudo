import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

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
 * In production, these should be sent to an external logging service.
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

      const logLine = `[AUDIT] ${action} | user=${entry.userId} role=${entry.userRole} | ${entry.method} ${entry.path} | status=${entry.statusCode} | ip=${entry.ip} | ${entry.duration}ms`;

      if (res.statusCode >= 400) {
        log.warn({ audit: entry }, "Audit log (error)");
      } else {
        log.info({ audit: entry }, "Audit log");
      }

      // TODO: Em produção, enviar para serviço externo (Sentry, CloudWatch, etc.)
    });

    next();
  };
};
