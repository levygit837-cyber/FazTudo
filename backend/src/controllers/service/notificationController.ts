import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { NotificationType } from "@prisma/client";

// Tipos para request bodies
interface UpdateNotificationBody {
  status: "READ" | "ARCHIVED";
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

// Obter notificações do usuário
export const getNotifications = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { status, type, limit = 50 } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Construir filtros
    const filters: any = {
      userId: req.user.id,
    };

    if (status && status !== "all") {
      const validStatuses = ["UNREAD", "READ", "ARCHIVED"];
      if (validStatuses.includes(status as string)) {
        filters.status = status;
      }
    }

    if (type && type !== "all") {
      const validTypes = Object.values(NotificationType);
      if (validTypes.includes(type as NotificationType)) {
        filters.type = type;
      }
    }

    // Buscar notificações
    const notifications = await prisma.notification.findMany({
      where: filters,
      include: {
        serviceOrder: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(limitNum, 100), // Limitar a 100
    });

    // Contar não lidas
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        status: "UNREAD",
      },
    });

    res.status(200).json(
      successResponse(
        {
          notifications,
          unreadCount,
        },
        "Notifications retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Marcar notificação como lida/arquivada
export const updateNotification = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const notificationId = parseInt(String(req.params.id), 10);
    const { status }: UpdateNotificationBody = req.body;

    if (isNaN(notificationId)) {
      res.status(400).json(errorResponse("Invalid notification ID"));
      return;
    }

    if (!status || !["READ", "ARCHIVED"].includes(status)) {
      res
        .status(400)
        .json(errorResponse("Status must be 'READ' or 'ARCHIVED'"));
      return;
    }

    // Verificar se notificação existe e pertence ao usuário
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: req.user.id,
      },
    });

    if (!notification) {
      res.status(404).json(errorResponse("Notification not found"));
      return;
    }

    // Atualizar notificação
    const updateData: any = {
      status,
    };

    if (status === "READ" && notification.status === "UNREAD") {
      updateData.readAt = new Date();
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: updateData,
    });

    res
      .status(200)
      .json(
        successResponse(
          { notification: updatedNotification },
          "Notification updated successfully",
        ),
      );
  } catch (error) {
    console.error("Update notification error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Marcar todas notificações como lidas
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const now = new Date();

    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        status: "UNREAD",
      },
      data: {
        status: "READ",
        readAt: now,
      },
    });

    res
      .status(200)
      .json(successResponse(null, "All notifications marked as read"));
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
