import type { Response } from "express";
import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";
import { mfaValidationsTotal } from "../lib/metrics";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const log = createLogger("mfaController");

const APP_NAME = "FazTudo";
const BACKUP_CODES_COUNT = 8;

// ==================== ENCRYPTION ====================

function encryptSecret(plaintext: string): string {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, "hex").subarray(0, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Invalid encrypted secret format");
  }
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, "hex").subarray(0, 32);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * POST /api/auth/mfa/setup — Generate TOTP secret and QR code
 */
export const setupMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    // Check if MFA already set up
    const existing = await prisma.userMFA.findUnique({
      where: { userId: req.user.id },
    });

    if (existing?.isEnabled) {
      res.status(400).json({ success: false, message: "MFA is already enabled. Disable it first to reconfigure." });
      return;
    }

    // Generate new secret
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: APP_NAME, label: req.user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Encrypt and store (not yet enabled — needs verification)
    const encryptedSecret = encryptSecret(secret);

    await prisma.userMFA.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        secret: encryptedSecret,
        isEnabled: false,
        isVerified: false,
      },
      update: {
        secret: encryptedSecret,
        isEnabled: false,
        isVerified: false,
      },
    });

    log.info({ userId: req.user.id }, "MFA setup initiated");

    res.json({
      success: true,
      message: "Scan the QR code with your authenticator app",
      data: {
        qrCode: qrCodeDataUrl,
        secret, // Allow manual entry
        otpauthUrl,
      },
    });
  } catch (error) {
    log.error({ err: error }, "MFA setup error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/auth/mfa/verify-setup — Confirm first TOTP code and enable MFA
 */
export const verifyMFASetup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ success: false, message: "TOTP code is required" });
      return;
    }

    const userMfa = await prisma.userMFA.findUnique({
      where: { userId: req.user.id },
    });

    if (!userMfa) {
      res.status(400).json({ success: false, message: "MFA not set up. Call /setup first." });
      return;
    }

    if (userMfa.isEnabled) {
      res.status(400).json({ success: false, message: "MFA is already enabled." });
      return;
    }

    // Verify the TOTP code
    const decrypted = decryptSecret(userMfa.secret);
    const isValid = verifySync({ token: code, secret: decrypted }).valid;

    if (!isValid) {
      res.status(403).json({ success: false, message: "Invalid TOTP code. Please try again." });
      return;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);

    // Enable MFA
    await prisma.userMFA.update({
      where: { userId: req.user.id },
      data: {
        isEnabled: true,
        isVerified: true,
        backupCodes: JSON.stringify(hashedCodes),
        lastUsedAt: new Date(),
      },
    });

    log.info({ userId: req.user.id }, "MFA enabled successfully");

    res.json({
      success: true,
      message: "MFA enabled successfully. Save your backup codes.",
      data: {
        backupCodes, // Show once, never again
      },
    });
  } catch (error) {
    log.error({ err: error }, "MFA verify setup error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/auth/mfa/validate — Validate MFA code during login
 */
export const validateMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mfaToken, code } = req.body;

    if (!mfaToken || !code) {
      res.status(400).json({ success: false, message: "MFA token and code are required" });
      return;
    }

    // Verify the temporary MFA token
    let tokenPayload: any;
    try {
      tokenPayload = jwt.verify(mfaToken, env.JWT_ACCESS_SECRET);
    } catch {
      res.status(401).json({ success: false, message: "MFA token expired or invalid" });
      return;
    }

    if (tokenPayload.type !== "mfa-challenge") {
      res.status(401).json({ success: false, message: "Invalid token type" });
      return;
    }

    const userId = tokenPayload.id;
    const userMfa = await prisma.userMFA.findUnique({
      where: { userId },
    });

    if (!userMfa?.isEnabled) {
      res.status(400).json({ success: false, message: "MFA is not enabled for this user" });
      return;
    }

    const decrypted = decryptSecret(userMfa.secret);
    let isValid = verifySync({ token: code, secret: decrypted }).valid;

    // Try backup codes if TOTP fails
    if (!isValid && userMfa.backupCodes) {
      const hashedCodes: string[] = JSON.parse(userMfa.backupCodes);
      for (let i = 0; i < hashedCodes.length; i++) {
        const codeStr = hashedCodes[i];
        if (!codeStr || codeStr === "USED") continue;
        const match = await bcrypt.compare(code.toUpperCase(), codeStr);
        if (match) {
          isValid = true;
          // Invalidate used backup code
          hashedCodes[i] = "USED";
          await prisma.userMFA.update({
            where: { userId },
            data: {
              backupCodes: JSON.stringify(hashedCodes),
              backupCodesUsed: { increment: 1 },
            },
          });
          log.info({ userId }, "Backup code used for MFA");
          mfaValidationsTotal.inc({ result: "backup_used" });
          break;
        }
      }
    }

    if (!isValid) {
      mfaValidationsTotal.inc({ result: "failure" });
      res.status(403).json({ success: false, message: "Invalid MFA code" });
      return;
    }

    // Update last used
    await prisma.userMFA.update({
      where: { userId },
      data: { lastUsedAt: new Date() },
    });

    mfaValidationsTotal.inc({ result: "success" });

    // Fetch user and issue real tokens
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any },
    );

    const refreshToken = jwt.sign(
      { id: user.id, tokenVersion: user.tokenVersion },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any },
    );

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Set HTTP-only cookies
    const isProduction = env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? "strict" : "lax") as "strict" | "lax",
      path: "/",
    };

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1h
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    log.info({ userId }, "MFA validation successful, tokens issued");

    res.json({
      success: true,
      message: "MFA validated successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: user.isVerified,
          profileImage: user.profileImage,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    log.error({ err: error }, "MFA validate error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/auth/mfa/disable — Disable MFA (requires current code)
 */
export const disableMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: "Current MFA code is required to disable" });
      return;
    }

    const userMfa = await prisma.userMFA.findUnique({
      where: { userId: req.user.id },
    });

    if (!userMfa?.isEnabled) {
      res.status(400).json({ success: false, message: "MFA is not enabled" });
      return;
    }

    // Verify code before disabling
    const decrypted = decryptSecret(userMfa.secret);
    const isValid = verifySync({ token: code, secret: decrypted }).valid;

    if (!isValid) {
      res.status(403).json({ success: false, message: "Invalid MFA code" });
      return;
    }

    // Admin users cannot disable MFA
    if (req.user.role === "ADMIN") {
      res.status(403).json({ success: false, message: "Administrators cannot disable MFA" });
      return;
    }

    await prisma.userMFA.delete({ where: { userId: req.user.id } });

    log.info({ userId: req.user.id }, "MFA disabled");

    res.json({ success: true, message: "MFA has been disabled" });
  } catch (error) {
    log.error({ err: error }, "MFA disable error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/auth/mfa/backup-codes/regenerate — Generate new backup codes
 */
export const regenerateBackupCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const { code } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: "Current MFA code is required" });
      return;
    }

    const userMfa = await prisma.userMFA.findUnique({
      where: { userId: req.user.id },
    });

    if (!userMfa?.isEnabled) {
      res.status(400).json({ success: false, message: "MFA is not enabled" });
      return;
    }

    const decrypted = decryptSecret(userMfa.secret);
    const isValid = verifySync({ token: code, secret: decrypted }).valid;

    if (!isValid) {
      res.status(403).json({ success: false, message: "Invalid MFA code" });
      return;
    }

    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);

    await prisma.userMFA.update({
      where: { userId: req.user.id },
      data: {
        backupCodes: JSON.stringify(hashedCodes),
        backupCodesUsed: 0,
      },
    });

    log.info({ userId: req.user.id }, "Backup codes regenerated");

    res.json({
      success: true,
      message: "New backup codes generated. Save them securely.",
      data: { backupCodes },
    });
  } catch (error) {
    log.error({ err: error }, "Regenerate backup codes error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Export decrypt for use in middleware
export { decryptSecret };
