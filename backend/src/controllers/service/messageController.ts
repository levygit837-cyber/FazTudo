import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { NotificationType } from "@prisma/client";

// Tipos para request bodies
interface SendMessageBody {
  content: string;
  serviceOrderId: number;
}

interface ListOrderMessagesQuery {
  page?: string;
  limit?: string;
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

// Enviar mensagem em um pedido
export const sendMessage = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const { content }: SendMessageBody = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json(errorResponse("Message content is required"));
      return;
    }

    if (content.length > 2000) {
      res
        .status(400)
        .json(
          errorResponse("Message content is too long (max 2000 characters)"),
        );
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
        status: true,
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar se usuário está envolvido no pedido ou é admin
    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isProfessional && !isAdmin) {
      res
        .status(403)
        .json(errorResponse("You are not part of this service order"));
      return;
    }

    // Determinar remetente e destinatário
    const senderId = req.user.id;
    let recipientId: number;

    if (isClient) {
      recipientId = serviceOrder.professionalId!;
    } else {
      recipientId = serviceOrder.clientId;
    }

    // Criar mensagem
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId,
        recipientId,
        serviceOrderId: orderId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            role: true,
          },
        },
        recipient: {
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

    // Criar notificação para o destinatário
    await createNotification(
      recipientId,
      NotificationType.NEW_MESSAGE,
      "Nova mensagem",
      `Você recebeu uma nova mensagem de ${req.user.name} no pedido "${serviceOrder.id}"`,
      orderId,
      { senderId, senderName: req.user.name, messageId: message.id },
    );

    res
      .status(201)
      .json(successResponse({ message }, "Message sent successfully"));
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Listar mensagens de um pedido
export const getOrderMessages = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const { page = "1", limit = "50" } = req.query as ListOrderMessagesQuery;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isProfessional && !isAdmin) {
      res
        .status(403)
        .json(errorResponse("You are not part of this service order"));
      return;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          serviceOrderId: orderId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              role: true,
            },
          },
          recipient: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        skip,
        take: limitNum,
      }),
      prisma.message.count({
        where: {
          serviceOrderId: orderId,
        },
      }),
    ]);

    await prisma.message.updateMany({
      where: {
        serviceOrderId: orderId,
        recipientId: req.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.status(200).json(
      successResponse(
        {
          messages,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        "Messages retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Get order messages error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
