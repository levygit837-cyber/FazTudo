import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import prisma from "../lib/prisma";
import { verifySync } from "otplib";
import { decryptSecret } from "../controllers/mfaController";
import { createLogger } from "../lib/logger";

const log = createLogger("mfa");

/**
 * Middleware that requires MFA verification for critical actions.
 * Checks X-MFA-Code header against the user's TOTP secret.
 *
 * - If user has MFA enabled: requires valid TOTP code in header
 * - If user is ADMIN without MFA: blocks and requires MFA setup
 * - If user doesn't have MFA: allows through (except admins)
 */
export const requireMFA = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  const mfaCode = req.headers["x-mfa-code"] as string;
  const userMfa = await prisma.userMFA.findUnique({
    where: { userId: req.user.id },
  });

  // If MFA is not configured
  if (!userMfa?.isEnabled) {
    if (req.user.role === "ADMIN") {
      res.status(403).json({
        success: false,
        message: "MFA obrigatório para administradores. Configure em Configurações.",
        mfaRequired: true,
        mfaSetupRequired: true,
      });
      return;
    }
    // Non-admin without MFA — allow through
    next();
    return;
  }

  // MFA is enabled — code is required
  if (!mfaCode) {
    res.status(403).json({
      success: false,
      message: "Código MFA necessário",
      mfaRequired: true,
    });
    return;
  }

  // Verify TOTP
  try {
    const decrypted = decryptSecret(userMfa.secret);
    const isValid = verifySync({ token: mfaCode, secret: decrypted }).valid;

    if (!isValid) {
      log.warn({ userId: req.user.id }, "Invalid MFA code for critical action");
      res.status(403).json({ success: false, message: "Código MFA inválido" });
      return;
    }

    // Update lastUsedAt
    await prisma.userMFA.update({
      where: { userId: req.user.id },
      data: { lastUsedAt: new Date() },
    });

    next();
  } catch (err) {
    log.error({ err, userId: req.user.id }, "MFA verification error");
    res.status(500).json({ success: false, message: "MFA verification error" });
  }
};
