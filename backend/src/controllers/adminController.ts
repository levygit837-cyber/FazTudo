import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

import { createLogger } from "../lib/logger";

const log = createLogger("adminController");


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

// ==================== STATS ====================

export const getAdminStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const [
      totalUsers,
      totalClients,
      totalProfessionals,
      totalAdmins,
      activeUsers,
      suspendedUsers,
      pendingUsers,
      totalServices,
      availableServices,
      totalOrders,
      pendingOrders,
      inProgressOrders,
      completedOrders,
      cancelledOrders,
      totalVerificationsPending,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "CLIENT" } }),
      prisma.user.count({ where: { role: "PROFESSIONAL" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.serviceListing.count(),
      prisma.serviceListing.count({ where: { isAvailable: true } }),
      prisma.serviceOrder.count(),
      prisma.serviceOrder.count({ where: { status: "PENDING" } }),
      prisma.serviceOrder.count({ where: { status: "IN_PROGRESS" } }),
      prisma.serviceOrder.count({ where: { status: "COMPLETED" } }),
      prisma.serviceOrder.count({ where: { status: "CANCELLED" } }),
      prisma.verificationSubmission.count({ where: { status: "PENDING" } }),
    ]);

    // Revenue from released payments
    const releasedPayments = await prisma.payment.findMany({
      where: { status: "RELEASED" },
      select: { amount: true },
    });
    const totalRevenue = releasedPayments.reduce((sum, p) => sum + p.amount, 0);

    // Held payments (escrow)
    const heldPayments = await prisma.payment.findMany({
      where: { status: "HELD" },
      select: { amount: true },
    });
    const heldInEscrow = heldPayments.reduce((sum, p) => sum + p.amount, 0);

    // Recent activity - new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersLast30Days = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    const newOrdersLast30Days = await prisma.serviceOrder.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    res.status(200).json(
      successResponse(
        {
          users: {
            total: totalUsers,
            clients: totalClients,
            professionals: totalProfessionals,
            admins: totalAdmins,
            active: activeUsers,
            suspended: suspendedUsers,
            pending: pendingUsers,
            newLast30Days: newUsersLast30Days,
          },
          services: {
            total: totalServices,
            available: availableServices,
            unavailable: totalServices - availableServices,
          },
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            inProgress: inProgressOrders,
            completed: completedOrders,
            cancelled: cancelledOrders,
            newLast30Days: newOrdersLast30Days,
          },
          financial: {
            totalRevenue,
            heldInEscrow,
          },
          verifications: {
            pending: totalVerificationsPending,
          },
        },
        "Admin stats retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Admin stats error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== USERS ====================

export const listUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const role = req.query.role as string;
    const status = req.query.status as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (role && ["CLIENT", "PROFESSIONAL", "ADMIN"].includes(role)) {
      where.role = role;
    }

    if (
      status &&
      ["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)
    ) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          isVerified: true,
          profileImage: true,
          ratingAverage: true,
          totalReviews: true,
          balance: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              serviceOrders: true,
              servicesProvided: true,
              serviceListings: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json(
      successResponse(
        {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Users retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "List users error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export const getUserDetails = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json(errorResponse("Invalid user ID"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        role: true,
        status: true,
        isVerified: true,
        bio: true,
        profileImage: true,
        ratingAverage: true,
        totalReviews: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
        addresses: true,
        categories: {
          include: { category: true },
        },
        serviceListings: {
          select: {
            id: true,
            title: true,
            price: true,
            isAvailable: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        certifications: true,
        _count: {
          select: {
            serviceOrders: true,
            servicesProvided: true,
            serviceListings: true,
            reviewsReceived: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found", 404));
      return;
    }

    res.status(200).json(successResponse({ user }, "User details retrieved"));
  } catch (error) {
    log.error({ err: error }, "Get user details error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export const updateUserStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json(errorResponse("Invalid user ID"));
      return;
    }

    const { status } = req.body;

    if (
      !status ||
      !["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)
    ) {
      res
        .status(400)
        .json(
          errorResponse(
            "Invalid status. Must be PENDING, ACTIVE, SUSPENDED, or INACTIVE",
          ),
        );
      return;
    }

    // Prevent self-suspension
    if (id === req.user.id && status === "SUSPENDED") {
      res.status(400).json(errorResponse("Cannot suspend your own account"));
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existingUser) {
      res.status(404).json(errorResponse("User not found", 404));
      return;
    }

    // Prevent modifying other admins unless superadmin logic is added
    if (existingUser.role === "ADMIN" && id !== req.user.id) {
      res
        .status(403)
        .json(errorResponse("Cannot modify another admin's status"));
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    res
      .status(200)
      .json(successResponse({ user: updatedUser }, "User status updated"));
  } catch (error) {
    log.error({ err: error }, "Update user status error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== VERIFICATIONS ====================

export const listVerifications = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || "PENDING";

    const where: any = {};
    if (
      status &&
      ["PENDING", "APPROVED", "REJECTED"].includes(status.toUpperCase())
    ) {
      where.status = status.toUpperCase();
    }

    const [verifications, total] = await Promise.all([
      prisma.verificationSubmission.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              profileImage: true,
              isVerified: true,
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.verificationSubmission.count({ where }),
    ]);

    res.status(200).json(
      successResponse(
        {
          verifications,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Verifications retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "List verifications error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export const reviewVerification = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json(errorResponse("Invalid verification ID"));
      return;
    }

    const { action, rejectionReason } = req.body;

    if (!action || !["APPROVED", "REJECTED"].includes(action)) {
      res
        .status(400)
        .json(errorResponse("Invalid action. Must be APPROVED or REJECTED"));
      return;
    }

    if (action === "REJECTED" && !rejectionReason) {
      res
        .status(400)
        .json(
          errorResponse("Rejection reason is required when rejecting"),
        );
      return;
    }

    const verification = await prisma.verificationSubmission.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!verification) {
      res.status(404).json(errorResponse("Verification not found", 404));
      return;
    }

    if (verification.status !== "PENDING") {
      res
        .status(400)
        .json(errorResponse("Verification has already been reviewed"));
      return;
    }

    // Use transaction to update verification and optionally update user
    const result = await prisma.$transaction(async (tx) => {
      const updatedVerification = await tx.verificationSubmission.update({
        where: { id },
        data: {
          status: action,
          rejectionReason: action === "REJECTED" ? rejectionReason : null,
          reviewedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isVerified: true,
            },
          },
        },
      });

      // If approved, check if user should be marked as verified
      if (action === "APPROVED") {
        // Check if user has all required verification types approved
        const approvedSubmissions =
          await tx.verificationSubmission.findMany({
            where: {
              userId: verification.userId,
              status: "APPROVED",
            },
            select: { type: true },
          });

        const approvedTypes = approvedSubmissions.map((s) => s.type);
        const hasDocument = approvedTypes.includes("DOCUMENT");
        const hasFacial = approvedTypes.includes("FACIAL");

        // Mark user as verified if both document and facial are approved
        if (hasDocument && hasFacial) {
          await tx.user.update({
            where: { id: verification.userId },
            data: { isVerified: true },
          });
        }
      }

      return updatedVerification;
    });

    // Create notification for the user
    try {
      await prisma.notification.create({
        data: {
          type: "SYSTEM_ALERT",
          title:
            action === "APPROVED"
              ? "Verificacao aprovada"
              : "Verificacao rejeitada",
          message:
            action === "APPROVED"
              ? "Sua verificacao foi aprovada com sucesso!"
              : `Sua verificacao foi rejeitada: ${rejectionReason}`,
          userId: verification.userId,
        },
      });
    } catch (notifError) {
      log.error({ err: notifError }, "Failed to create notification");
      // Don't fail the request if notification fails
    }

    res
      .status(200)
      .json(
        successResponse(
          { verification: result },
          `Verification ${action.toLowerCase()}`,
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Review verification error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
