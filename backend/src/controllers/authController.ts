import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  generateToken,
  hashPassword,
  comparePassword,
  AuthRequest,
} from "../middleware/auth";
import { VerificationType } from "@prisma/client";

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
    console.error("Registration error:", error);
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
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
    console.error("Login error:", error);
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
    console.error("Get profile error:", error);
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
    console.error("Update profile error:", error);
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
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res
      .status(200)
      .json(successResponse(null, "Password changed successfully"));
  } catch (error) {
    console.error("Change password error:", error);
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

    // For security, always return success even if user doesn't exist
    if (user) {
      // TODO: Implement password reset flow:
      // 1. Generate a cryptographically secure reset token
      // 2. Save it to the database with expiration (e.g., 1 hour)
      // 3. Send email with reset link containing the token
    }

    res
      .status(200)
      .json(
        successResponse(
          null,
          "If an account exists with this email, you will receive a password reset link",
        ),
      );
  } catch (error) {
    console.error("Forgot password error:", error);
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

    if (newPassword.length < 6) {
      res
        .status(400)
        .json(errorResponse("New password must be at least 6 characters long"));
      return;
    }

    // In a real application, you would:
    // 1. Verify the reset token (check database and expiration)
    // 2. Find the user associated with the token
    // 3. Update the password
    // 4. Invalidate the used token

    res
      .status(501)
      .json(
        errorResponse(
          "Funcionalidade de reset de senha ainda nao implementada",
          501,
        ),
      );
  } catch (error) {
    console.error("Reset password error:", error);
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
    console.error("Verify email error:", error);
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
    console.error("Submit document verification error:", error);
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
    console.error("Submit facial verification error:", error);
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
    console.error("Get verification status error:", error);
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
    console.error("Upgrade to professional error:", error);
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
