import prisma from "../lib/prisma";
import { NotificationStatus, NotificationType as PrismaNotificationType } from "@prisma/client";
import { env } from "../config/env";
import { sendEmail } from "./emailService";
import { emitToUser } from "../lib/socket";
import { createLogger } from "../lib/logger";

const log = createLogger("notificationService");

// Re-exportar enum para uso em outros arquivos
export const NotificationType = {
  ORDER_CREATED: "ORDER_CREATED" as PrismaNotificationType,
  ORDER_ACCEPTED: "ORDER_ACCEPTED" as PrismaNotificationType,
  ORDER_COMPLETED: "ORDER_COMPLETED" as PrismaNotificationType,
  ORDER_CANCELLED: "ORDER_CANCELLED" as PrismaNotificationType,
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED" as PrismaNotificationType,
  PAYMENT_RELEASED: "PAYMENT_RELEASED" as PrismaNotificationType,
  DEADLINE_WARNING: "DEADLINE_WARNING" as PrismaNotificationType,
  DEADLINE_EXPIRED: "DEADLINE_EXPIRED" as PrismaNotificationType,
  NEW_MESSAGE: "NEW_MESSAGE" as PrismaNotificationType,
  REVIEW_RECEIVED: "REVIEW_RECEIVED" as PrismaNotificationType,
  SYSTEM_ALERT: "SYSTEM_ALERT" as PrismaNotificationType,
  PROFESSIONAL_EN_ROUTE: "PROFESSIONAL_EN_ROUTE" as PrismaNotificationType,
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

// ==================== CRIAÇÃO DE NOTIFICAÇÕES ====================

/**
 * Cria uma notificação para um usuário
 */
export const createNotification = async (
  userId: number,
  type: PrismaNotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: Record<string, any>
): Promise<any> => {
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      message,
      status: "UNREAD",
      userId,
      serviceOrderId: serviceOrderId || null,
      metadata: metadata ?? undefined,
    },
  });

  // Real-time Socket.io emission
  emitToUser(userId, "notification:new", {
    id: notification.id,
    type,
    title,
    message,
    serviceOrderId,
  });

  // TODO: Integrar com sistema de push notifications (Firebase, OneSignal, etc.)

  // Enviar email se habilitado
  if (env.ENABLE_EMAIL_NOTIFICATIONS) {
    // Buscar email do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      sendEmail({
        to: user.email,
        subject: `FazTudo - ${title}`,
        html: `<div style="font-family:sans-serif;padding:16px;">
          <h2 style="color:#1e293b;">${title}</h2>
          <p style="color:#475569;">${message}</p>
          <hr style="border-color:#e2e8f0;" />
          <p style="color:#94a3b8;font-size:12px;">FazTudo - Marketplace de Serviços</p>
        </div>`,
      }).catch((err) => {
        log.error({ err, userId, type }, "Failed to send notification email");
      });
    }
  }

  return notification;
};

/**
 * Cria notificações em lote para múltiplos usuários
 */
export const createBulkNotifications = async (
  userIds: number[],
  type: PrismaNotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: Record<string, any>
): Promise<number> => {
  const data = userIds.map((userId) => ({
    type,
    title,
    message,
    status: "UNREAD" as NotificationStatus,
    userId,
    serviceOrderId: serviceOrderId || null,
    metadata: metadata ?? undefined,
  }));

  const result = await prisma.notification.createMany({
    data,
  });

  return result.count;
};

// ==================== LEITURA DE NOTIFICAÇÕES ====================

/**
 * Obtém notificações de um usuário
 */
export const getUserNotifications = async (
  userId: number,
  options?: {
    status?: NotificationStatus;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  }
): Promise<{ notifications: any[]; total: number; unreadCount: number }> => {
  const { status, limit = 20, offset = 0, includeArchived = false } = options || {};

  const where: any = { userId };

  if (status) {
    where.status = status;
  } else if (!includeArchived) {
    where.status = { not: "ARCHIVED" };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        serviceOrder: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, status: "UNREAD" },
    }),
  ]);

  return { notifications, total, unreadCount };
};

/**
 * Obtém contagem de notificações não lidas
 */
export const getUnreadCount = async (userId: number): Promise<number> => {
  return prisma.notification.count({
    where: { userId, status: "UNREAD" },
  });
};

// ==================== ATUALIZAÇÃO DE NOTIFICAÇÕES ====================

/**
 * Marca notificação como lida
 */
export const markAsRead = async (
  notificationId: number,
  userId: number
): Promise<any> => {
  const notification = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Garantir que pertence ao usuário
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return notification;
};

/**
 * Marca todas as notificações de um usuário como lidas
 */
export const markAllAsRead = async (userId: number): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return result.count;
};

/**
 * Arquiva uma notificação
 */
export const archiveNotification = async (
  notificationId: number,
  userId: number
): Promise<any> => {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      status: "ARCHIVED",
    },
  });
};

/**
 * Arquiva notificações antigas (mais de X dias)
 */
export const archiveOldNotifications = async (
  daysOld: number = 30
): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.updateMany({
    where: {
      status: "READ",
      createdAt: {
        lt: cutoffDate,
      },
    },
    data: {
      status: "ARCHIVED",
    },
  });

  return result.count;
};

// ==================== DELEÇÃO DE NOTIFICAÇÕES ====================

/**
 * Deleta notificações arquivadas mais antigas que X dias
 */
export const deleteOldArchivedNotifications = async (
  daysOld: number = 90
): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      status: "ARCHIVED",
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
};

// ==================== NOTIFICAÇÕES ESPECÍFICAS ====================

/**
 * Notifica sobre novo pedido criado
 */
export const notifyOrderCreated = async (
  orderId: number,
  professionalId: number,
  clientName: string,
  orderTitle: string
): Promise<void> => {
  await createNotification(
    professionalId,
    NotificationType.ORDER_CREATED,
    "Novo pedido recebido",
    `${clientName} solicitou o serviço "${orderTitle}". Aceite ou recuse o pedido.`,
    orderId,
    { clientName, orderTitle }
  );
};

/**
 * Notifica sobre pedido aceito
 */
export const notifyOrderAccepted = async (
  orderId: number,
  clientId: number,
  professionalName: string,
  orderTitle: string
): Promise<void> => {
  await createNotification(
    clientId,
    NotificationType.ORDER_ACCEPTED,
    "Pedido aceito",
    `${professionalName} aceitou seu pedido "${orderTitle}". Realize o pagamento para confirmar.`,
    orderId,
    { professionalName, orderTitle }
  );
};

/**
 * Notifica sobre pagamento recebido
 */
export const notifyPaymentReceived = async (
  orderId: number,
  professionalId: number,
  amount: number,
  orderTitle: string,
  deadlineDays: number
): Promise<void> => {
  await createNotification(
    professionalId,
    NotificationType.PAYMENT_RECEIVED,
    "Pagamento confirmado",
    `Pagamento de R$${amount.toFixed(2)} recebido para "${orderTitle}". Você tem ${deadlineDays} dias para concluir o serviço.`,
    orderId,
    { amount, deadlineDays, orderTitle }
  );
};

/**
 * Notifica sobre pedido concluído
 */
export const notifyOrderCompleted = async (
  orderId: number,
  clientId: number,
  professionalName: string,
  orderTitle: string
): Promise<void> => {
  await createNotification(
    clientId,
    NotificationType.ORDER_COMPLETED,
    "Serviço concluído",
    `${professionalName} marcou o serviço "${orderTitle}" como concluído. Confirme a conclusão para liberar o pagamento.`,
    orderId,
    { professionalName, orderTitle }
  );
};

/**
 * Notifica sobre nova mensagem
 */
export const notifyNewMessage = async (
  orderId: number,
  recipientId: number,
  senderName: string,
  messagePreview: string
): Promise<void> => {
  const preview = messagePreview.length > 50
    ? messagePreview.substring(0, 50) + "..."
    : messagePreview;

  await createNotification(
    recipientId,
    NotificationType.NEW_MESSAGE,
    "Nova mensagem",
    `${senderName}: ${preview}`,
    orderId,
    { senderName, messagePreview }
  );
};

/**
 * Notifica sobre nova avaliação recebida
 */
export const notifyReviewReceived = async (
  orderId: number,
  targetId: number,
  reviewerName: string,
  rating: number,
  orderTitle: string
): Promise<void> => {
  await createNotification(
    targetId,
    NotificationType.REVIEW_RECEIVED,
    "Nova avaliação recebida",
    `${reviewerName} avaliou o serviço "${orderTitle}" com ${rating} estrela${rating > 1 ? "s" : ""}.`,
    orderId,
    { reviewerName, rating, orderTitle }
  );
};

/**
 * Notifica sobre pedido cancelado
 */
export const notifyOrderCancelled = async (
  orderId: number,
  userId: number,
  cancelledBy: string,
  orderTitle: string,
  reason?: string
): Promise<void> => {
  await createNotification(
    userId,
    NotificationType.ORDER_CANCELLED,
    "Pedido cancelado",
    `O pedido "${orderTitle}" foi cancelado por ${cancelledBy}.${reason ? ` Motivo: ${reason}` : ""}`,
    orderId,
    { cancelledBy, orderTitle, reason }
  );
};

export default {
  NotificationType,
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  archiveOldNotifications,
  deleteOldArchivedNotifications,
  notifyOrderCreated,
  notifyOrderAccepted,
  notifyPaymentReceived,
  notifyOrderCompleted,
  notifyNewMessage,
  notifyReviewReceived,
  notifyOrderCancelled,
};
