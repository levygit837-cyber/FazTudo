import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { createNotification, NotificationType } from "../../services/notificationService";
import { filterChatContent, getBlockedContentMessage } from "../../middleware/chatFilter";
import { emitToOrder } from "../../lib/socket";

import { createLogger } from "../../lib/logger";

const log = createLogger("messageController");


// Tipos para request bodies
interface SendMessageBody {
  content: string;
  serviceOrderId: number;
  type?: "TEXT" | "ATTACHMENT" | "LOCATION";
  // Attachment fields
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  // Location fields
  locationLat?: number;
  locationLng?: number;
  locationLabel?: string;
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

    // Determine message type and process content accordingly
    const messageType = req.body.type || "TEXT";

    let finalContent = content.trim();
    let filterWarning: string | undefined;

    if (messageType === "TEXT") {
      // Filter personal contact information only for text messages
      const filterResult = filterChatContent(finalContent);
      finalContent = filterResult.sanitized;
      filterWarning = filterResult.clean
        ? undefined
        : getBlockedContentMessage(filterResult.blockedTypes);
    } else if (messageType === "LOCATION") {
      finalContent = req.body.locationLabel || "Localização compartilhada";
    } else if (messageType === "ATTACHMENT") {
      finalContent = req.body.attachmentName || "Arquivo anexado";
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
        status: true,
        payments: {
          where: {
            status: { in: ["HELD", "RELEASED"] },
          },
          select: { id: true },
          take: 1,
        },
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

    // Payment gate: chat is only available after payment is approved
    // Exception: DRAFT orders allow text-only messages (pre-payment negotiation)
    const isDraft = serviceOrder.status === "DRAFT";
    if (!isAdmin && !isDraft && serviceOrder.payments.length === 0) {
      res
        .status(403)
        .json(errorResponse("Chat is only available after payment is approved"));
      return;
    }

    // DRAFT orders: only text messages allowed (no attachments or location)
    if (isDraft && messageType !== "TEXT") {
      res
        .status(403)
        .json(errorResponse("Only text messages are allowed for draft orders"));
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
        content: finalContent,
        type: messageType,
        senderId,
        recipientId,
        serviceOrderId: orderId,
        // Attachment fields
        ...(messageType === "ATTACHMENT" && {
          attachmentUrl: req.body.attachmentUrl,
          attachmentName: req.body.attachmentName,
          attachmentType: req.body.attachmentType,
          attachmentSize: req.body.attachmentSize,
        }),
        // Location fields
        ...(messageType === "LOCATION" && {
          locationLat: req.body.locationLat,
          locationLng: req.body.locationLng,
          locationLabel: req.body.locationLabel,
        }),
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

    // Real-time Socket.io emission
    emitToOrder(orderId, "chat:message", {
      id: message.id,
      content: message.content,
      type: message.type,
      senderId: message.senderId,
      sender: message.sender,
      createdAt: message.createdAt,
    });

    res
      .status(201)
      .json(successResponse(
        { message, filterWarning },
        filterWarning ? "Message sent with content filtered" : "Message sent successfully",
      ));
  } catch (error) {
    log.error({ err: error }, "Send message error");
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
    log.error({ err: error }, "Get order messages error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
