import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyAnalyticsController");

/** GET /api/company/analytics/revenue — monthly revenue for last 6 months */
export async function getRevenueAnalytics(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await prisma.payment.findMany({
      where: {
        professionalId: companyProfile.userId,
        status: { in: ["HELD", "RELEASED"] },
        paidAt: { gte: sixMonthsAgo },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    });

    const monthlyRevenue: Record<string, number> = {};
    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + payment.amount;
    }

    const data = Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue }));
    return res.json({ success: true, message: "Analytics de receita obtido", data });
  } catch (err) {
    log.error({ err }, "getRevenueAnalytics error");
    throw err;
  }
}

/** GET /api/company/analytics/members — member performance */
export async function getMemberPerformance(req: AuthRequest, res: Response) {
  try {
    const members = await prisma.companyMember.findMany({
      where: { companyId: req.companyId!, isActive: true },
      include: {
        user: { select: { id: true, name: true, profileImage: true, ratingAverage: true } },
        role: { select: { name: true, color: true } },
        teamMemberships: {
          include: {
            team: {
              include: {
                order: { select: { status: true, price: true } },
              },
            },
          },
        },
        ledTeams: {
          include: {
            order: { select: { status: true } },
          },
        },
      },
    });

    const performance = members.map(member => {
      const allTeams = member.teamMemberships;
      const totalAssigned = allTeams.length;
      const completed = allTeams.filter(t => t.team.order.status === "COMPLETED").length;
      const inProgress = allTeams.filter(t => t.team.order.status === "IN_PROGRESS").length;
      const ledTotal = member.ledTeams.length;
      const ledCompleted = member.ledTeams.filter(t => t.order.status === "COMPLETED").length;
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

      return {
        member: {
          id: member.id,
          name: member.user.name,
          profileImage: member.user.profileImage,
          role: member.role,
          ratingAverage: member.user.ratingAverage,
        },
        stats: { totalAssigned, completed, inProgress, completionRate, ledTotal, ledCompleted },
      };
    });

    performance.sort((a, b) => b.stats.completionRate - a.stats.completionRate);
    return res.json({ success: true, message: "Performance de membros obtida", data: performance });
  } catch (err) {
    log.error({ err }, "getMemberPerformance error");
    throw err;
  }
}

/** GET /api/company/analytics/services — top services by orders */
export async function getTopServices(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const listings = await prisma.serviceListing.findMany({
      where: { professionalId: companyProfile.userId },
      include: {
        category: { select: { name: true } },
        _count: { select: { serviceOrders: true } },
        serviceOrders: {
          where: { status: "COMPLETED" },
          select: { price: true },
        },
      },
      orderBy: { serviceOrders: { _count: "desc" } },
      take: 10,
    });

    const data = listings.map(listing => ({
      id: listing.id,
      title: listing.title,
      category: listing.category.name,
      price: listing.price,
      totalOrders: listing._count.serviceOrders,
      completedOrders: listing.serviceOrders.length,
      totalRevenue: listing.serviceOrders.reduce((sum, o) => sum + o.price, 0),
    }));

    return res.json({ success: true, message: "Top serviços obtidos", data });
  } catch (err) {
    log.error({ err }, "getTopServices error");
    throw err;
  }
}

/** GET /api/company/analytics/overview — overall summary */
export async function getAnalyticsOverview(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalOrders,
      completedOrders,
      ordersLast30Days,
      totalRevenue,
      revenueLast30Days,
      totalMembers,
      activeMembers,
      avgRating,
    ] = await Promise.all([
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId } }),
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId, status: "COMPLETED" } }),
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.payment.aggregate({
        where: { professionalId: companyProfile.userId, status: { in: ["HELD", "RELEASED"] } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { professionalId: companyProfile.userId, status: { in: ["HELD", "RELEASED"] }, paidAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
      prisma.companyMember.count({ where: { companyId: req.companyId! } }),
      prisma.companyMember.count({ where: { companyId: req.companyId!, isActive: true } }),
      prisma.user.findUnique({ where: { id: companyProfile.userId }, select: { ratingAverage: true } }),
    ]);

    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    return res.json({
      success: true,
      message: "Overview obtido",
      data: {
        totalOrders,
        completedOrders,
        ordersLast30Days,
        completionRate,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        revenueLast30Days: revenueLast30Days._sum.amount ?? 0,
        totalMembers,
        activeMembers,
        averageRating: avgRating?.ratingAverage ?? 0,
      },
    });
  } catch (err) {
    log.error({ err }, "getAnalyticsOverview error");
    throw err;
  }
}
