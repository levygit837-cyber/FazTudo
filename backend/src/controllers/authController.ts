import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import {
  generateToken,
  hashPassword,
  comparePassword,
  AuthRequest,
} from "../middleware/auth";
import { VerificationType } from "@prisma/client";

import { createLogger } from "../lib/logger";

const log = createLogger("authController");


// Types for request bodies
interface RegisterBody {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CLIENT" | "PROFESSIONAL";
  document?: string;
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
    const validRoles = ["CLIENT", "PROFESSIONAL"];
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
        tokenVersion: true,
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
      tokenVersion: user.tokenVersion,
    });

    res.status(201).json(
      successResponse(
        {
          user,
          token,
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

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    });

    res.status(200).json(
      successResponse(
        {
          user: userWithoutPassword,
          token,
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
      select: { id: true, email: true },
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

      // Log the reset link in development (replace with email in production)
      if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        log.info({ resetUrl, email: user.email }, "Password reset link generated (dev mode)");
      }

      // TODO: Send email with resetUrl when email service is configured
      // Example: await sendResetEmail(user.email, resetUrl);
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

    // In a real application, you would:
    // 1. Verify the email verification token
    // 2. Find the user associated with the token
    // 3. Update user.isVerified = true

    res
      .status(501)
      .json(
        errorResponse(
          "Funcionalidade de verificacao de email ainda nao implementada",
          501,
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Verify email error");
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

    const submissionMetadata = {
      documentType,
      documentNumber: documentNumber || null,
      documentImageUrl: documentImageUrl || null,
      ...(metadata || {}),
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

    const submission = await prisma.verificationSubmission.create({
      data: {
        userId: req.user.id,
        type: VerificationType.FACIAL,
        status: "PENDING",
        metadata: {
          selfieImageUrl: selfieImageUrl || null,
          livenessScore: livenessScore ?? null,
          ...(metadata || {}),
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

export default {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  submitDocumentVerification,
  submitFacialVerification,
  getVerificationStatus,
  upgradeToProfessional,
};
