import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

import { createLogger } from "../lib/logger";

const log = createLogger("reputationController");


const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

/**
 * GET /api/dashboard/professional/reputation
 * Reputation analytics with low-rating reasons, churn risk, recommendations
 */
export const getReputationAnalytics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access reputation analytics"));
      return;
    }

    const userId = req.user.id;

    // Fetch all reviews about this professional (where isProfessional = false means client reviewed professional)
    const allReviews = await prisma.review.findMany({
      where: { targetId: userId, isProfessional: false },
      include: {
        author: { select: { id: true, name: true, profileImage: true } },
        serviceOrder: { select: { id: true, title: true, completedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Low rating reviews (3 or below)
    const lowRatingReviews = allReviews
      .filter((r) => r.rating <= 3)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.author,
        serviceOrder: r.serviceOrder,
        createdAt: r.createdAt,
      }));

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of allReviews) {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    }

    // User stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ratingAverage: true, totalReviews: true },
    });

    // Order stats for completion rate and response time
    const [totalOrders, completedOrders, cancelledOrders, acceptedOrders] = await Promise.all([
      prisma.serviceOrder.count({ where: { professionalId: userId } }),
      prisma.serviceOrder.count({ where: { professionalId: userId, status: "COMPLETED" } }),
      prisma.serviceOrder.count({ where: { professionalId: userId, status: "CANCELLED" } }),
      prisma.serviceOrder.findMany({
        where: {
          professionalId: userId,
          status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "AWAITING_CLIENT_CONFIRMATION"] },
        },
        select: { createdAt: true, startedAt: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const completionRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 100)
      : 100;

    // Average response time (time from order creation to acceptance/start)
    const responseTimes = acceptedOrders
      .filter((o) => o.startedAt)
      .map((o) => (o.startedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60));
    const avgResponseTimeHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Churn risk calculation
    const recentReviews = allReviews.slice(0, 5);
    const avgRecentRating = recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : 5;
    const churnRisk: "LOW" | "MEDIUM" | "HIGH" =
      avgRecentRating < 3 ? "HIGH" : avgRecentRating < 4 ? "MEDIUM" : "LOW";

    // Generate recommendations
    const recommendations: Array<{
      type: string;
      title: string;
      description: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
    }> = [];

    if (avgResponseTimeHours > 4) {
      recommendations.push({
        type: "RESPONSE_TIME",
        title: "Melhore seu tempo de resposta",
        description: `Seu tempo medio de resposta e ${avgResponseTimeHours.toFixed(1)}h. Tente responder em ate 2h para melhorar seu ranking.`,
        priority: avgResponseTimeHours > 8 ? "HIGH" : "MEDIUM",
      });
    }

    if (completionRate < 90) {
      recommendations.push({
        type: "COMPLETION_RATE",
        title: "Aumente sua taxa de conclusao",
        description: `Sua taxa de conclusao e ${completionRate}%. Profissionais com mais de 90% tem mais visibilidade.`,
        priority: completionRate < 70 ? "HIGH" : "MEDIUM",
      });
    }

    if ((user?.ratingAverage || 0) < 4.0) {
      recommendations.push({
        type: "QUALITY",
        title: "Melhore a qualidade dos servicos",
        description: `Sua avaliacao media e ${(user?.ratingAverage || 0).toFixed(1)}. Foque em pontualidade e comunicacao com o cliente.`,
        priority: (user?.ratingAverage || 0) < 3.0 ? "HIGH" : "MEDIUM",
      });
    }

    if (totalOrders > 0 && cancelledOrders / totalOrders > 0.1) {
      recommendations.push({
        type: "RELIABILITY",
        title: "Reduza cancelamentos",
        description: `Voce tem ${cancelledOrders} cancelamentos em ${totalOrders} pedidos (${Math.round(cancelledOrders / totalOrders * 100)}%). Aceite apenas servicos que pode cumprir.`,
        priority: "HIGH",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: "KEEP_GOING",
        title: "Continue assim!",
        description: "Seu desempenho esta otimo. Continue mantendo a qualidade do servico.",
        priority: "LOW",
      });
    }

    res.status(200).json(
      successResponse({
        averageRating: user?.ratingAverage || 0,
        totalReviews: user?.totalReviews || 0,
        ratingDistribution,
        lowRatingReviews,
        completionRate,
        avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
        churnRisk,
        churnRiskScore: avgRecentRating,
        recommendations,
        stats: {
          totalOrders,
          completedOrders,
          cancelledOrders,
        },
      }, "Reputation analytics retrieved"),
    );
  } catch (error) {
    log.error({ err: error }, "Reputation analytics error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
