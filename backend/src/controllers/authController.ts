import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import {
  generateToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  AuthRequest,
} from "../middleware/auth";
import { env } from "../config/env";
import { VerificationType } from "@prisma/client";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService";

import { createLogger } from "../lib/logger";

const log = createLogger("authController");


// Types for request bodies
interface RegisterBody {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CLIENT" | "PROFESSIONAL" | "COMPANY";
  document?: string;
  cnpj?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface UpdateProfileBody {
  name?: string;
  phone?: string;
  bio?: string;
  document?: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface SubmitDocumentVerificationBody {
  documentType?: string;
  documentNumber?: string;
  documentImageUrl?: string;
  metadata?: Record<string, unknown>;
}

interface SubmitFacialVerificationBody {
  selfieImageUrl?: string;
  livenessScore?: number;
  metadata?: Record<string, unknown>;
}

// Utility response formatter
const successResponse = (data: any, message: string = "Success") => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false,
  message,
  statusCode,
});

// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email,
      password,
      name,
      phone,
      role = "CLIENT",
      document,
      cnpj,
    }: RegisterBody = req.body;

    // Basic validation
    if (!email || !password || !name) {
      res
        .status(400)
        .json(errorResponse("Email, password and name are required"));
      return;
    }

    // Validate email format (simple)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json(errorResponse("Invalid email format"));
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res
        .status(409)
        .json(errorResponse("User with this email already exists"));
      return;
    }

    // Validate role
    const validRoles = ["CLIENT", "PROFESSIONAL", "COMPANY"];
    if (role && !validRoles.includes(role)) {
      res.status(400).json(errorResponse("Invalid role"));
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        role,
        document: document || null,
        status: "PENDING", // Default status
        isVerified: false,
        balance: 0.0,
        ratingAverage: 0.0,
        totalReviews: 0,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        document: true,
        isVerified: true,
        profileImage: true,
        bio: true,
        ratingAverage: true,
        totalReviews: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: 0, // newly created user always starts at version 0
    });

    // Generate refresh token
    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    // If registering as COMPANY, create the CompanyProfile
    if (role === "COMPANY") {
      await prisma.companyProfile.create({
        data: {
          userId: user.id,
          companyName: name,
          cnpj: cnpj!,
        },
      });
    }

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedVerifyToken = crypto
      .createHash("sha256")
      .update(verifyToken)
      .digest("hex");

    // Save hashed token + 24h expiration + refresh token (single DB write)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedVerifyToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        refreshToken,
      },
    });

    // Send verification email (fire and forget — don't block registration)
    const { env: envConfig } = await import("../config/env");
    const verifyUrl = `${envConfig.FRONTEND_URL}/verify-email/${verifyToken}`;

    sendVerificationEmail(user.email, user.name, verifyUrl).catch((err) => {
      log.error({ err, email: user.email }, "Failed to send verification email");
    });

    res.status(201).json(
      successResponse(
        {
          user,
          token,
          refreshToken,
        },
        "User registered successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Registration error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginBody = req.body;

    if (!email || !password) {
      res.status(400).json(errorResponse("Email and password are required"));
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        document: true,
        isVerified: true,
        profileImage: true,
        bio: true,
        ratingAverage: true,
        totalReviews: true,
        tokenVersion: true,
        refreshToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // Timing-safe: still hash compare to prevent timing attacks
      // that could reveal whether an email exists in the system
      await comparePassword(password, "$2b$12$KIXTlzGhEO6tpMkLFdsrCuSaKDF.ISsnGrmFEvG5TuAyangKGr3PK");
      res.status(401).json(errorResponse("Invalid credentials"));
      return;
    }

    // Check account status
    if (user.status !== "ACTIVE") {
      res.status(403).json(errorResponse("Account is not active"));
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json(errorResponse("Invalid credentials"));
      return;
    }

    // Remove password, tokenVersion and refreshToken from response
    const { password: _, tokenVersion: _tv, refreshToken: _rt, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    });

    // Generate refresh token
    const newRefreshToken = generateRefreshToken(user);

    // Store refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.status(200).json(
      successResponse(
        {
          user: userWithoutPassword,
          token,
          refreshToken: newRefreshToken,
        },
        "Login successful",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Login error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Get current user profile
export const getProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        document: true,
        isVerified: true,
        profileImage: true,
        bio: true,
        ratingAverage: true,
        totalReviews: true,
        createdAt: true,
        updatedAt: true,
        // Include related data based on role
        categories: {
          include: {
            category: true,
          },
        },
        serviceListings: {
          where: { isAvailable: true },
          include: {
            category: true,
          },
        },
        certifications: true,
        addresses: true,
      },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found"));
      return;
    }

    res
      .status(200)
      .json(successResponse({ user }, "Profile retrieved successfully"));
  } catch (error) {
    log.error({ err: error }, "Get profile error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Update user profile
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { name, phone, bio, document }: UpdateProfileBody = req.body;

    // Build update data object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (document !== undefined) updateData.document = document;

    // If no fields to update
    if (Object.keys(updateData).length === 0) {
      res.status(400).json(errorResponse("No fields to update"));
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        document: true,
        isVerified: true,
        profileImage: true,
        bio: true,
        ratingAverage: true,
        totalReviews: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res
      .status(200)
      .json(
        successResponse({ user: updatedUser }, "Profile updated successfully"),
      );
  } catch (error) {
    log.error({ err: error }, "Update profile error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Change password
export const changePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { currentPassword, newPassword }: ChangePasswordBody = req.body;

    // Validation is handled by validateBody(changePasswordSchema) middleware
    // which enforces 8+ chars with uppercase, lowercase, and number

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found"));
      return;
    }

    // Verify current password
    const isValidPassword = await comparePassword(
      currentPassword,
      user.password,
    );
    if (!isValidPassword) {
      res.status(401).json(errorResponse("Current password is incorrect"));
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    // Update password and increment tokenVersion to invalidate existing tokens
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        refreshToken: null, // Revoke refresh token on password change
      },
    });

    res
      .status(200)
      .json(successResponse(null, "Password changed successfully"));
  } catch (error) {
    log.error({ err: error }, "Change password error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Forgot password (initiate reset)
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json(errorResponse("Email is required"));
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      // Generate cryptographically secure reset token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hash the token before storing (so a DB leak doesn't expose tokens)
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Save hashed token + expiration (1 hour) to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Build reset URL
      const { env } = await import("../config/env");
      const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;

      // Send password reset email
      sendPasswordResetEmail(user.email, user.name || "Usuário", resetUrl).catch((err) => {
        log.error({ err, email: user.email }, "Failed to send password reset email");
      });

      // Never log password reset tokens, even in development
    } else {
      // Timing-safe: perform a dummy hash to prevent timing attacks
      await hashPassword("dummy-password-for-timing-safety");
    }

    // Always return success (don't reveal if email exists)
    res
      .status(200)
      .json(
        successResponse(
          null,
          "If an account exists with this email, you will receive a password reset link",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Forgot password error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Reset password with token
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res
        .status(400)
        .json(errorResponse("Token and new password are required"));
      return;
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with matching token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res
        .status(400)
        .json(errorResponse("Invalid or expired reset token"));
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password, clear reset token, increment tokenVersion (invalidates existing JWTs)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        tokenVersion: { increment: 1 },
      },
    });

    log.info({ userId: user.id }, "Password reset successful");

    res
      .status(200)
      .json(
        successResponse(
          null,
          "Password has been reset successfully. Please login with your new password.",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Reset password error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Verify email
export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json(errorResponse("Verification token is required"));
      return;
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with this token and check expiration
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: { gt: new Date() },
      },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res.status(400).json(errorResponse("Invalid or expired verification token"));
      return;
    }

    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        status: "ACTIVE", // Ativar conta após verificação
      },
    });

    // Send welcome email (fire and forget)
    const { env: envConfig } = await import("../config/env");
    const loginUrl = `${envConfig.FRONTEND_URL}/login`;

    sendWelcomeEmail(user.email, user.name, loginUrl).catch((err) => {
      log.error({ err, email: user.email }, "Failed to send welcome email");
    });

    log.info({ userId: user.id, email: user.email }, "Email verified successfully");

    res.status(200).json(
      successResponse(null, "Email verificado com sucesso! Sua conta está ativa.")
    );
  } catch (error) {
    log.error({ err: error }, "Verify email error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Resend verification email
export const resendVerificationEmail = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json(errorResponse("Authentication required", 401));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found", 404));
      return;
    }

    if (user.emailVerified) {
      res.status(400).json(errorResponse("Email already verified"));
      return;
    }

    // Generate new token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(verifyToken)
      .digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const { env: envConfig } = await import("../config/env");
    const verifyUrl = `${envConfig.FRONTEND_URL}/verify-email/${verifyToken}`;

    const result = await sendVerificationEmail(user.email, user.name, verifyUrl);

    if (result.success) {
      res.status(200).json(
        successResponse(null, "Verification email sent. Check your inbox.")
      );
    } else {
      res.status(500).json(errorResponse("Failed to send verification email", 500));
    }
  } catch (error) {
    log.error({ err: error }, "Resend verification email error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Submeter verificação documental
export const submitDocumentVerification = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { documentType, documentNumber, documentImageUrl, metadata } =
      req.body as SubmitDocumentVerificationBody;

    if (!documentType) {
      res
        .status(400)
        .json(errorResponse("documentType is required (CPF or CNPJ)"));
      return;
    }

    if (!documentImageUrl && !metadata) {
      res
        .status(400)
        .json(errorResponse("documentImageUrl or metadata is required"));
      return;
    }

    // SECURITY: Whitelist metadata fields to prevent prototype pollution / field injection
    const safeMetadata = metadata
      ? {
          deviceInfo: typeof metadata.deviceInfo === "string" ? metadata.deviceInfo.slice(0, 200) : undefined,
          submittedFrom: typeof metadata.submittedFrom === "string" ? metadata.submittedFrom.slice(0, 100) : undefined,
        }
      : {};

    const submissionMetadata = {
      documentType,
      documentNumber: documentNumber || null,
      documentImageUrl: documentImageUrl || null,
      ...safeMetadata,
    };

    const [submission] = await prisma.$transaction([
      prisma.verificationSubmission.create({
        data: {
          userId: req.user.id,
          type: VerificationType.DOCUMENT,
          status: "PENDING",
          metadata: submissionMetadata,
        },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          document: documentNumber || undefined,
        },
      }),
    ]);

    res.status(201).json(
      successResponse(
        { submission },
        "Document verification submitted successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Submit document verification error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Submeter verificação facial
export const submitFacialVerification = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { selfieImageUrl, livenessScore, metadata } =
      req.body as SubmitFacialVerificationBody;

    if (!selfieImageUrl && !metadata) {
      res
        .status(400)
        .json(errorResponse("selfieImageUrl or metadata is required"));
      return;
    }

    // SECURITY: Whitelist metadata fields to prevent prototype pollution / field injection
    const safeFacialMetadata = metadata
      ? {
          deviceInfo: typeof metadata.deviceInfo === "string" ? metadata.deviceInfo.slice(0, 200) : undefined,
          submittedFrom: typeof metadata.submittedFrom === "string" ? metadata.submittedFrom.slice(0, 100) : undefined,
        }
      : {};

    const submission = await prisma.verificationSubmission.create({
      data: {
        userId: req.user.id,
        type: VerificationType.FACIAL,
        status: "PENDING",
        metadata: {
          selfieImageUrl: selfieImageUrl || null,
          livenessScore: livenessScore ?? null,
          ...safeFacialMetadata,
        },
      },
    });

    res.status(201).json(
      successResponse(
        { submission },
        "Facial verification submitted successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Submit facial verification error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Obter status de verificação da conta
export const getVerificationStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        status: true,
        isVerified: true,
        document: true,
        verificationSubmissions: {
          orderBy: {
            submittedAt: "desc",
          },
          take: 20,
        },
      },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found"));
      return;
    }

    const latestDocumentSubmission = user.verificationSubmissions.find(
      (submission) => submission.type === VerificationType.DOCUMENT,
    );
    const latestFacialSubmission = user.verificationSubmissions.find(
      (submission) => submission.type === VerificationType.FACIAL,
    );

    res.status(200).json(
      successResponse(
        {
          userId: user.id,
          role: user.role,
          status: user.status,
          isVerified: user.isVerified,
          hasDocument: Boolean(user.document),
          documentVerification: latestDocumentSubmission || null,
          facialVerification: latestFacialSubmission || null,
          submissions: user.verificationSubmissions,
        },
        "Verification status retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get verification status error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Upgrade to professional (if user is CLIENT)
export const upgradeToProfessional = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found"));
      return;
    }

    if (user.role !== "CLIENT") {
      res
        .status(400)
        .json(errorResponse("User is already a professional or admin"));
      return;
    }

    // Update role to PROFESSIONAL
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role: "PROFESSIONAL" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res
      .status(200)
      .json(
        successResponse(
          { user: updatedUser },
          "Account upgraded to professional successfully",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Upgrade to professional error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Refresh access token
export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json(errorResponse("Refresh token is required"));
      return;
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      res.status(401).json(errorResponse("Invalid or expired refresh token"));
      return;
    }

    if (decoded.type !== 'refresh') {
      res.status(401).json(errorResponse("Invalid token type"));
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
        refreshToken: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(401).json(errorResponse("User not found or inactive"));
      return;
    }

    // Verify stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      res.status(401).json(errorResponse("Refresh token has been revoked"));
      return;
    }

    // Generate new access token
    const newToken = generateToken(user);

    // Generate new refresh token (rotation)
    const newRefreshToken = generateRefreshToken(user);

    // Update stored refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.status(200).json(
      successResponse(
        { token: newToken, refreshToken: newRefreshToken },
        "Token refreshed successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Refresh token error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export default {
  register,
  login,
  refreshAccessToken,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  submitDocumentVerification,
  submitFacialVerification,
  getVerificationStatus,
  upgradeToProfessional,
};
