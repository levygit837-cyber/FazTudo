import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

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

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const userId = req.user.id;
    const role = req.user.role;

    if (role === "CLIENT") {
      const [
        totalOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
      ] = await Promise.all([
        prisma.serviceOrder.count({ where: { clientId: userId } }),
        prisma.serviceOrder.count({ where: { clientId: userId, status: "PENDING" } }),
        prisma.serviceOrder.count({ where: { clientId: userId, status: "IN_PROGRESS" } }),
        prisma.serviceOrder.count({ where: { clientId: userId, status: "COMPLETED" } }),
        prisma.serviceOrder.count({ where: { clientId: userId, status: "CANCELLED" } }),
      ]);

      const completedOrdersData = await prisma.serviceOrder.findMany({
        where: { clientId: userId, status: "COMPLETED" },
        select: { price: true },
      });
      const totalSpent = completedOrdersData.reduce((sum, o) => sum + o.price, 0);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ratingAverage: true, totalReviews: true },
      });

      res.status(200).json(
        successResponse({
          totalOrders,
          pendingOrders,
          inProgressOrders,
          completedOrders,
          cancelledOrders,
          totalSpent,
          averageRating: user?.ratingAverage || 0,
          totalReviews: user?.totalReviews || 0,
        }, "Client dashboard stats retrieved"),
      );
    } else if (role === "PROFESSIONAL") {
      const [
        totalOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        totalServices,
      ] = await Promise.all([
        prisma.serviceOrder.count({ where: { professionalId: userId } }),
        prisma.serviceOrder.count({ where: { professionalId: userId, status: "PENDING" } }),
        prisma.serviceOrder.count({ where: { professionalId: userId, status: "IN_PROGRESS" } }),
        prisma.serviceOrder.count({ where: { professionalId: userId, status: "COMPLETED" } }),
        prisma.serviceListing.count({ where: { professionalId: userId } }),
      ]);

      const releasedPayments = await prisma.payment.findMany({
        where: { professionalId: userId, status: "RELEASED" },
        select: { amount: true },
      });
      const totalEarnings = releasedPayments.reduce((sum, p) => sum + p.amount, 0);

      const heldPayments = await prisma.payment.findMany({
        where: { professionalId: userId, status: "HELD" },
        select: { amount: true },
      });
      const pendingRevenue = heldPayments.reduce((sum, p) => sum + p.amount, 0);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ratingAverage: true, totalReviews: true, balance: true },
      });

      res.status(200).json(
        successResponse({
          totalOrders,
          pendingOrders,
          inProgressOrders,
          completedOrders,
          totalServices,
          totalEarnings,
          pendingRevenue,
          availableBalance: user?.balance || 0,
          averageRating: user?.ratingAverage || 0,
          totalReviews: user?.totalReviews || 0,
        }, "Professional dashboard stats retrieved"),
      );
    } else {
      res.status(403).json(errorResponse("Unsupported role for dashboard"));
    }
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export const getRecentOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const userId = req.user.id;
    const role = req.user.role;
    const limit = parseInt(req.query.limit as string) || 5;

    const whereClause = role === "PROFESSIONAL"
      ? { professionalId: userId }
      : { clientId: userId };

    const orders = await prisma.serviceOrder.findMany({
      where: whereClause,
      include: {
        client: {
          select: { id: true, name: true, profileImage: true, ratingAverage: true },
        },
        professional: {
          select: { id: true, name: true, profileImage: true, ratingAverage: true },
        },
        serviceListing: {
          select: { id: true, title: true, price: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.status(200).json(
      successResponse({ orders }, "Recent orders retrieved"),
    );
  } catch (error) {
    console.error("Recent orders error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
