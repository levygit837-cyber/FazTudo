import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";

import { createLogger } from "../../lib/logger";

const log = createLogger("chatController");


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

/**
 * Lista conversas ativas do usuário.
 * Uma conversa é criada automaticamente quando o pagamento é confirmado (HELD).
 * Retorna orders que têm pagamento HELD, RELEASED, ou PARTIALLY_REFUNDED
 * E que possuem mensagens OU cujo pagamento foi confirmado.
 */
export const getUserChats = async (
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

    // Buscar orders com pagamento confirmado onde o usuário é participante
    const whereClause = role === "CLIENT"
      ? { clientId: userId }
      : role === "PROFESSIONAL"
        ? { professionalId: userId }
        : { OR: [{ clientId: userId }, { professionalId: userId }] };

    const orders = await prisma.serviceOrder.findMany({
      where: {
        ...whereClause,
        payments: {
          some: {
            status: { in: ["HELD", "RELEASED", "PARTIALLY_REFUNDED"] },
          },
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        client: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            senderId: true,
            createdAt: true,
            isRead: true,
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                recipientId: userId,
                isRead: false,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Formatar resposta para o frontend
    const chats = orders.map((order) => {
      const lastMessage = order.messages[0] || null;
      const otherUser = role === "CLIENT" ? order.professional : order.client;

      return {
        orderId: order.id,
        orderTitle: order.title,
        orderStatus: order.status,
        otherUser: otherUser
          ? {
              id: otherUser.id,
              name: otherUser.name,
              profileImage: otherUser.profileImage,
            }
          : null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              isRead: lastMessage.isRead,
            }
          : null,
        unreadCount: (order._count as any).messages || 0,
      };
    });

    // Sort conversations by last message time (most recent first)
    chats.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return timeB - timeA;
    });

    res.status(200).json(
      successResponse(
        { chats },
        "Chats retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get user chats error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
