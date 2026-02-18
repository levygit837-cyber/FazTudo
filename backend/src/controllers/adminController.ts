import type { Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";

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

// ==================== COMPANY VERIFICATION ====================

/** GET /api/admin/companies/pending — list companies awaiting verification */
export const getPendingCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companies = await prisma.companyProfile.findMany({
      where: { isVerified: false },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, status: true,
            createdAt: true, profileImage: true,
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, message: "Empresas pendentes obtidas", data: companies });
  } catch (err) {
    log.error({ err }, "getPendingCompanies error");
    throw err;
  }
};

/** POST /api/admin/companies/:companyId/verify — verify or reject a company */
export const verifyCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { approved, reason } = req.body;

    const company = await prisma.companyProfile.findUnique({
      where: { id: Number(companyId) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!company) {
      res.status(404).json({ success: false, message: "Empresa não encontrada" });
      return;
    }

    await prisma.companyProfile.update({
      where: { id: Number(companyId) },
      data: { isVerified: Boolean(approved) },
    });

    await prisma.notification.create({
      data: {
        userId: company.userId,
        type: "SYSTEM_ALERT",
        title: approved ? "Empresa verificada!" : "Verificação recusada",
        message: approved
          ? `Parabéns! ${company.companyName} foi verificada e agora tem o selo de Empresa Verificada.`
          : `A verificação de ${company.companyName} foi recusada. ${reason ? `Motivo: ${reason}` : ""}`,
      },
    });

    res.json({
      success: true,
      message: approved ? "Empresa verificada com sucesso" : "Verificação recusada",
      data: { companyId: Number(companyId), isVerified: Boolean(approved) },
    });
  } catch (err) {
    log.error({ err }, "verifyCompany error");
    throw err;
  }
};

/** GET /api/admin/companies — list all companies */
export const getAllCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { verified } = req.query;
    const whereFilter = verified === "true"
      ? { isVerified: true }
      : verified === "false"
        ? { isVerified: false }
        : {};

    const companies = await prisma.companyProfile.findMany({
      where: whereFilter,
      include: {
        user: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, message: "Empresas obtidas", data: companies });
  } catch (err) {
    log.error({ err }, "getAllCompanies error");
    throw err;
  }
};

// ==================== ADMIN LOGIN ====================

export const adminLogin = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        status: true,
        isVerified: true,
        tokenVersion: true,
        profileImage: true,
      },
    });

    if (!user) {
      res.status(401).json(errorResponse("Credenciais invalidas"));
      return;
    }

    if (user.role !== "ADMIN") {
      log.warn({ email }, "Non-admin attempted admin login");
      res.status(403).json(errorResponse("Acesso nao autorizado"));
      return;
    }

    if (user.status !== "ACTIVE") {
      res.status(403).json(errorResponse("Conta suspensa ou inativa"));
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json(errorResponse("Credenciais invalidas"));
      return;
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    const { password: _, ...userData } = user;

    res.status(200).json(
      successResponse(
        {
          user: userData,
          token,
          refreshToken,
        },
        "Login realizado com sucesso",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Admin login failed");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

// ==================== DASHBOARD STATS ====================

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const period = parseInt(String(req.query.period || "30"), 10);
    const now = new Date();
    const startDate = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);

    const [
      completedOrdersCurrent,
      completedOrdersPrevious,
      currentPayments,
      previousPayments,
      newUsers,
      previousNewUsers,
      currentOrderValues,
      previousOrderValues,
      dailyUsers,
      dailyPaymentsData,
      totalUsers,
      usersWithOrders,
      usersWithCompletedOrders,
      categoryStats,
      allOrders,
      cancelledOrders,
      disputedOrders,
      totalMessages,
    ] = await Promise.all([
      prisma.serviceOrder.count({
        where: { status: "COMPLETED", updatedAt: { gte: startDate } },
      }),
      prisma.serviceOrder.count({
        where: { status: "COMPLETED", updatedAt: { gte: previousStart, lt: startDate } },
      }),
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: startDate } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: previousStart, lt: startDate } },
        select: { amount: true },
      }),
      prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: previousStart, lt: startDate } },
      }),
      prisma.serviceOrder.findMany({
        where: { status: "COMPLETED", updatedAt: { gte: startDate } },
        select: { price: true },
      }),
      prisma.serviceOrder.findMany({
        where: { status: "COMPLETED", updatedAt: { gte: previousStart, lt: startDate } },
        select: { price: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: startDate } },
        select: { amount: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
      }),
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({
        where: {
          createdAt: { gte: startDate },
          serviceOrders: { some: {} },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: startDate },
          serviceOrders: { some: { status: "COMPLETED" } },
        },
      }),
      prisma.serviceCategory.findMany({
        select: {
          id: true,
          name: true,
          serviceListings: {
            select: {
              serviceOrders: {
                where: { status: "COMPLETED", updatedAt: { gte: startDate } },
                select: { id: true },
              },
            },
          },
        },
        take: 20,
      }),
      prisma.serviceOrder.findMany({
        where: { createdAt: { gte: startDate } },
        select: { status: true, createdAt: true, updatedAt: true },
      }),
      prisma.serviceOrder.count({
        where: { status: "CANCELLED", updatedAt: { gte: startDate } },
      }),
      prisma.dispute.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.message.count({
        where: { createdAt: { gte: startDate } },
      }),
    ]);

    // Calculate KPIs
    const currentRevenue = currentPayments.reduce((s, p) => s + p.amount, 0);
    const previousRevenue = previousPayments.reduce((s, p) => s + p.amount, 0);
    const platformFee = 10;
    const currentPlatformRevenue = (currentRevenue * platformFee) / 100;
    const previousPlatformRevenue = (previousRevenue * platformFee) / 100;

    const currentTicket = currentOrderValues.length > 0
      ? currentOrderValues.reduce((s, o) => s + (o.price || 0), 0) / currentOrderValues.length
      : 0;
    const previousTicket = previousOrderValues.length > 0
      ? previousOrderValues.reduce((s, o) => s + (o.price || 0), 0) / previousOrderValues.length
      : 0;

    const calcChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    // Group daily users
    const usersByDay: Record<string, number> = {};
    dailyUsers.forEach((u) => {
      const day = u.createdAt.toISOString().slice(0, 10);
      usersByDay[day] = (usersByDay[day] || 0) + 1;
    });

    // Group daily revenue
    const revenueByDay: Record<string, number> = {};
    dailyPaymentsData.forEach((p) => {
      const day = p.updatedAt.toISOString().slice(0, 10);
      revenueByDay[day] = (revenueByDay[day] || 0) + p.amount;
    });

    // Fill missing days
    const dailyUsersSeries: Array<{ date: string; value: number }> = [];
    const dailyRevenueSeries: Array<{ date: string; value: number }> = [];
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dailyUsersSeries.push({ date: key, value: usersByDay[key] || 0 });
      dailyRevenueSeries.push({ date: key, value: revenueByDay[key] || 0 });
    }

    // Top categories by completed order count (simple metric)
    const topCategories = categoryStats
      .map((cat) => {
        const count = cat.serviceListings.reduce(
          (sum, listing) => sum + listing.serviceOrders.length,
          0
        );
        return { id: cat.id, name: cat.name, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Rates
    const totalOrdersInPeriod = allOrders.length;
    const cancellationRate = totalOrdersInPeriod > 0 ? (cancelledOrders / totalOrdersInPeriod) * 100 : 0;
    const disputeRate = totalOrdersInPeriod > 0 ? (disputedOrders / totalOrdersInPeriod) * 100 : 0;
    const avgMessagesPerDay = period > 0 ? totalMessages / period : 0;

    res.status(200).json(
      successResponse(
        {
          kpis: {
            completedOrders: {
              value: completedOrdersCurrent,
              change: calcChange(completedOrdersCurrent, completedOrdersPrevious),
            },
            platformRevenue: {
              value: currentPlatformRevenue,
              change: calcChange(currentPlatformRevenue, previousPlatformRevenue),
            },
            newUsers: {
              value: newUsers,
              change: calcChange(newUsers, previousNewUsers),
            },
            averageTicket: {
              value: currentTicket,
              change: calcChange(currentTicket, previousTicket),
            },
          },
          charts: {
            dailyUsers: dailyUsersSeries,
            dailyRevenue: dailyRevenueSeries,
          },
          funnel: {
            totalUsers,
            usersWithOrders,
            usersWithCompletedOrders,
          },
          topCategories,
          rates: {
            cancellationRate,
            disputeRate,
            avgMessagesPerDay,
          },
        },
        "Dashboard stats retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Failed to get dashboard stats");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

// ==================== TRAFFIC ANALYTICS ====================

export const getTrafficStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const period = parseInt(String(req.query.period || "30"), 10);
    const now = new Date();
    const startDate = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);

    const [
      sessions,
      previousSessions,
      allSessionsForChart,
      deviceSessions,
      messages,
      conversations,
    ] = await Promise.all([
      prisma.userSession.findMany({
        where: { startedAt: { gte: startDate } },
        select: { duration: true, userId: true },
      }),
      prisma.userSession.findMany({
        where: { startedAt: { gte: previousStart, lt: startDate } },
        select: { duration: true, userId: true },
      }),
      prisma.userSession.findMany({
        where: { startedAt: { gte: startDate } },
        select: { startedAt: true, userId: true, duration: true },
        orderBy: { startedAt: "asc" },
      }),
      prisma.userSession.groupBy({
        by: ["device"],
        where: { startedAt: { gte: startDate } },
        _count: true,
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, serviceOrderId: true },
      }),
      prisma.message.groupBy({
        by: ["serviceOrderId"],
        where: { createdAt: { gte: startDate } },
        _count: true,
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
    ]);

    // KPIs
    const totalSessions = sessions.length;
    const previousTotalSessions = previousSessions.length;
    const avgDuration = sessions.length > 0
      ? sessions.reduce((s, sess) => s + (sess.duration || 0), 0) / sessions.length
      : 0;
    const previousAvgDuration = previousSessions.length > 0
      ? previousSessions.reduce((s, sess) => s + (sess.duration || 0), 0) / previousSessions.length
      : 0;
    const activeUsers = new Set(sessions.map((s) => s.userId)).size;
    const previousActiveUsers = new Set(previousSessions.map((s) => s.userId)).size;

    const calcChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    // Daily sessions chart
    const sessionsByDay: Record<string, { total: number; unique: Set<number> }> = {};
    allSessionsForChart.forEach((s) => {
      const day = s.startedAt.toISOString().slice(0, 10);
      if (!sessionsByDay[day]) sessionsByDay[day] = { total: 0, unique: new Set() };
      sessionsByDay[day].total++;
      sessionsByDay[day].unique.add(s.userId);
    });

    const dailySessions: Array<{ date: string; sessions: number; uniqueUsers: number }> = [];
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const data = sessionsByDay[key];
      dailySessions.push({
        date: key,
        sessions: data?.total || 0,
        uniqueUsers: data?.unique.size || 0,
      });
    }

    // Hourly distribution
    const hourlyDist: number[] = new Array(24).fill(0) as number[];
    allSessionsForChart.forEach((s) => {
      const hour = s.startedAt.getHours();
      hourlyDist[hour] = (hourlyDist[hour] ?? 0) + 1;
    });

    // Device distribution
    const deviceDistribution = deviceSessions.map((d) => ({
      device: d.device || "unknown",
      count: d._count,
    }));

    // Chat metrics
    const totalMsgs = messages.length;
    const avgMsgsPerDay = period > 0 ? totalMsgs / period : 0;
    const avgMsgsPerConversation = conversations.length > 0
      ? conversations.reduce((s, c) => s + c._count, 0) / conversations.length
      : 0;
    const avgChatDuration = conversations.length > 0
      ? conversations.reduce((s, c) => {
          const min = c._min.createdAt ? c._min.createdAt.getTime() : 0;
          const max = c._max.createdAt ? c._max.createdAt.getTime() : 0;
          return s + (max - min) / 1000;
        }, 0) / conversations.length
      : 0;

    res.status(200).json(
      successResponse(
        {
          kpis: {
            totalSessions: {
              value: totalSessions,
              change: calcChange(totalSessions, previousTotalSessions),
            },
            avgDuration: {
              value: Math.round(avgDuration),
              change: calcChange(avgDuration, previousAvgDuration),
            },
            activeUsers: {
              value: activeUsers,
              change: calcChange(activeUsers, previousActiveUsers),
            },
          },
          charts: {
            dailySessions,
            hourlyDistribution: hourlyDist,
            deviceDistribution,
          },
          chat: {
            totalMessages: totalMsgs,
            avgMessagesPerDay: Math.round(avgMsgsPerDay * 10) / 10,
            avgMessagesPerConversation: Math.round(avgMsgsPerConversation * 10) / 10,
            avgChatDurationSeconds: Math.round(avgChatDuration),
          },
        },
        "Traffic stats retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Failed to get traffic stats");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

// ==================== DISPUTE MANAGEMENT ====================

export const listDisputes = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = parseInt(String(req.query.limit || "20"), 10);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          serviceOrder: {
            select: {
              id: true,
              title: true,
              status: true,
              price: true,
              client: { select: { id: true, name: true, email: true } },
              professional: { select: { id: true, name: true, email: true } },
            },
          },
          initiator: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    res.status(200).json(
      successResponse(
        {
          items: disputes,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
        "Disputes retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Failed to list disputes");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

export const resolveDisputeAdmin = async (
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
      res.status(400).json(errorResponse("Invalid ID"));
      return;
    }

    const { resolution, action } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { serviceOrder: { select: { id: true, clientId: true, professionalId: true } } },
    });

    if (!dispute) {
      res.status(404).json(errorResponse("Disputa nao encontrada"));
      return;
    }
    if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
      res.status(400).json(errorResponse("Disputa ja foi resolvida"));
      return;
    }

    const updated = await prisma.dispute.update({
      where: { id },
      data: { status: "RESOLVED", resolution, updatedAt: new Date() },
    });

    // Notify both parties
    const clientMsg =
      action === "FAVOR_CLIENT"
        ? "A disputa foi resolvida a seu favor."
        : action === "FAVOR_PROFESSIONAL"
          ? "A disputa foi resolvida a favor do profissional."
          : "A disputa foi resolvida por acordo mutuo.";

    const proMsg =
      action === "FAVOR_PROFESSIONAL"
        ? "A disputa foi resolvida a seu favor."
        : action === "FAVOR_CLIENT"
          ? "A disputa foi resolvida a favor do cliente."
          : "A disputa foi resolvida por acordo mutuo.";

    if (dispute.serviceOrder.professionalId) {
      await Promise.all([
        prisma.notification.create({
          data: {
            type: "SYSTEM_ALERT",
            title: "Disputa Resolvida",
            message: clientMsg,
            userId: dispute.serviceOrder.clientId,
            serviceOrderId: dispute.serviceOrder.id,
          },
        }),
        prisma.notification.create({
          data: {
            type: "SYSTEM_ALERT",
            title: "Disputa Resolvida",
            message: proMsg,
            userId: dispute.serviceOrder.professionalId,
            serviceOrderId: dispute.serviceOrder.id,
          },
        }),
      ]);
    }

    res.status(200).json(successResponse({ dispute: updated }, "Disputa resolvida com sucesso"));
  } catch (error) {
    log.error({ err: error }, "Failed to resolve dispute");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

// ==================== PLATFORM CONFIG ====================

export const getPlatformConfig = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const [escrowConfig, systemConfigs] = await Promise.all([
      prisma.escrowConfig.findFirst({ where: { name: "default" } }),
      prisma.systemConfig.findMany({ orderBy: { key: "asc" } }),
    ]);

    res.status(200).json(
      successResponse(
        {
          escrow: escrowConfig,
          system: systemConfigs,
        },
        "Config retrieved",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Failed to get config");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

export const updatePlatformConfig = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { platformFeePercentage, defaultHoldDays, disputePeriodDays, ...systemUpdates } = req.body;

    // Update escrow config if any escrow fields provided
    if (platformFeePercentage !== undefined || defaultHoldDays !== undefined || disputePeriodDays !== undefined) {
      const escrowData: Record<string, unknown> = {};
      if (platformFeePercentage !== undefined) escrowData.platformFeePercentage = platformFeePercentage;
      if (defaultHoldDays !== undefined) escrowData.defaultHoldDays = defaultHoldDays;
      if (disputePeriodDays !== undefined) escrowData.disputePeriodDays = disputePeriodDays;

      await prisma.escrowConfig.updateMany({
        where: { name: "default" },
        data: escrowData,
      });
    }

    // Update system configs
    for (const [key, value] of Object.entries(systemUpdates)) {
      if (value !== undefined) {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value: JSON.stringify(value) },
          create: { key, value: JSON.stringify(value) },
        });
      }
    }

    res.status(200).json(successResponse(null, "Configuracoes atualizadas"));
  } catch (error) {
    log.error({ err: error }, "Failed to update config");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

// ==================== FORCE LOGOUT ====================

export const forceLogout = async (
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
      res.status(400).json(errorResponse("Invalid ID"));
      return;
    }

    // Prevent self-logout
    if (id === req.user.id) {
      res.status(400).json(errorResponse("Nao e possivel forcar logout de si mesmo"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, tokenVersion: true },
    });
    if (!user) {
      res.status(404).json(errorResponse("Usuario nao encontrado"));
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { tokenVersion: user.tokenVersion + 1 },
    });

    res.status(200).json(successResponse(null, "Logout forcado com sucesso"));
  } catch (error) {
    log.error({ err: error }, "Failed to force logout");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
