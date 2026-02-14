import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { NotificationType } from "@prisma/client";

// Tipos para request bodies
interface CreateReviewBody {
  rating: number;
  comment?: string;
  isProfessional?: boolean; // false = cliente avalia profissional, true = profissional avalia cliente
}

// Utilitário para respostas padronizadas
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

// Utilitário para criar notificações
const createNotification = async (
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: any,
) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        serviceOrderId: serviceOrderId || null,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

// Criar avaliação para um pedido concluído
export const createReview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const {
      rating,
      comment,
      isProfessional = false,
    }: CreateReviewBody = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json(errorResponse("Rating must be between 1 and 5"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: true,
        professional: true,
        reviews: true,
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar se pedido está concluído
    if (serviceOrder.status !== "COMPLETED") {
      res
        .status(400)
        .json(
          errorResponse("Reviews can only be created for completed orders"),
        );
      return;
    }

    // Determinar quem está avaliando quem
    let authorId: number;
    let targetId: number;

    if (isProfessional) {
      // Profissional avaliando cliente
      if (
        serviceOrder.professionalId !== req.user.id &&
        req.user.role !== "ADMIN"
      ) {
        res
          .status(403)
          .json(
            errorResponse(
              "Only the assigned professional can review the client",
            ),
          );
        return;
      }
      authorId = serviceOrder.professionalId!;
      targetId = serviceOrder.clientId;
    } else {
      // Cliente avaliando profissional
      if (serviceOrder.clientId !== req.user.id && req.user.role !== "ADMIN") {
        res
          .status(403)
          .json(errorResponse("Only the client can review the professional"));
        return;
      }
      authorId = serviceOrder.clientId;
      targetId = serviceOrder.professionalId!;
    }

    // Verificar se já existe avaliação deste autor para este pedido
    const existingReview = serviceOrder.reviews.find(
      (review) =>
        review.authorId === authorId && review.serviceOrderId === orderId,
    );

    if (existingReview) {
      res
        .status(400)
        .json(errorResponse("You have already reviewed this order"));
      return;
    }

    // Criar avaliação
    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment || undefined,
        isProfessional,
        authorId,
        targetId,
        serviceOrderId: orderId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        target: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        serviceOrder: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Recalcular rating médio do target
    const targetReviews = await prisma.review.findMany({
      where: {
        targetId,
        isProfessional: !isProfessional, // Inverter: se isProfessional=true, então target é cliente
      },
    });

    const totalRating = targetReviews.reduce((sum, rev) => sum + rev.rating, 0);
    const averageRating =
      targetReviews.length > 0 ? totalRating / targetReviews.length : 0;

    // Atualizar rating do target
    await prisma.user.update({
      where: { id: targetId },
      data: {
        ratingAverage: averageRating,
        totalReviews: targetReviews.length,
      },
    });

    // Criar notificação para o avaliado
    const notificationType = isProfessional
      ? NotificationType.REVIEW_RECEIVED
      : NotificationType.REVIEW_RECEIVED;

    const notificationTitle = isProfessional
      ? "Avaliação recebida do profissional"
      : "Avaliação recebida do cliente";

    const notificationMessage = isProfessional
      ? `O profissional ${req.user.name} avaliou você com ${rating} estrelas${comment ? `: "${comment}"` : ""}`
      : `O cliente ${req.user.name} avaliou você com ${rating} estrelas${comment ? `: "${comment}"` : ""}`;

    await createNotification(
      targetId,
      notificationType,
      notificationTitle,
      notificationMessage,
      orderId,
      { rating, comment, reviewerName: req.user.name },
    );

    res
      .status(201)
      .json(successResponse({ review }, "Review created successfully"));
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
