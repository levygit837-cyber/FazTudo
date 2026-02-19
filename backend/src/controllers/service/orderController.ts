import type { Response } from "express";
import prisma from "../../lib/prisma";
import { SAFE_USER_SELECT } from "../../lib/safeSelect";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";
import { emitToUser, emitToOrder } from "../../lib/socket";
import { releasePaymentFromEscrow } from "../../services/escrowService";

import { createLogger } from "../../lib/logger";

const log = createLogger("orderController");


// Tipos para request bodies
interface CreateServiceOrderBody {
  serviceListingId: number;
  title: string;
  description?: string;
  scheduledDate?: string;
  addressId?: number;
  addressNotes?: string;
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

// Utilitário para criar notificações (+ emit via Socket)
const createNotification = async (
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: any,
) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        serviceOrderId: serviceOrderId || null,
        metadata,
      },
    });

    // Emit real-time notification via Socket.io
    emitToUser(userId, "notification:new", {
      id: notification.id,
      type,
      title,
      message,
      serviceOrderId,
    });

    return notification;
  } catch (error) {
    log.error({ err: error }, "Failed to create notification");
  }
};

// Utilitário para calcular data limite
const calculateDeadlineDate = (days: number): Date => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
};

// Criar novo pedido de serviço (apenas clientes)
export const createServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT") {
      res
        .status(403)
        .json(errorResponse("Only clients can create service orders"));
      return;
    }

    const {
      serviceListingId,
      title,
      description,
      scheduledDate,
      addressId,
      addressNotes,
    }: CreateServiceOrderBody = req.body;

    // Validações básicas
    if (!serviceListingId || !title) {
      res
        .status(400)
        .json(errorResponse("Service listing ID and title are required"));
      return;
    }

    // Verificar se serviço existe e está disponível
    const serviceListing = await prisma.serviceListing.findUnique({
      where: { id: serviceListingId },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!serviceListing) {
      res.status(404).json(errorResponse("Service listing not found"));
      return;
    }

    if (!serviceListing.isAvailable) {
      res.status(400).json(errorResponse("This service is not available"));
      return;
    }

    // Verificar endereço se fornecido
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: {
          id: addressId,
          userId: req.user.id,
        },
      });

      if (!address) {
        res
          .status(404)
          .json(errorResponse("Address not found or does not belong to you"));
        return;
      }
    }

    // Converter scheduledDate se fornecida
    let scheduledDateObj: Date | undefined;
    if (scheduledDate) {
      scheduledDateObj = new Date(scheduledDate);
      if (isNaN(scheduledDateObj.getTime())) {
        res.status(400).json(errorResponse("Invalid scheduled date"));
        return;
      }
    }

    // Calcular data limite (usar padrão do sistema ou do serviço)
    const defaultDeadlineDays = env.DEFAULT_ESCROW_HOLD_DAYS;
    const deadlineDate = calculateDeadlineDate(defaultDeadlineDays);

    // Criar pedido
    const serviceOrder = await prisma.serviceOrder.create({
      data: {
        title,
        description: description || null,
        price: serviceListing.price,
        status: "PENDING",
        scheduledDate: scheduledDateObj || null,
        deadlineDays: defaultDeadlineDays,
        deadlineDate,
        clientId: req.user.id,
        professionalId: serviceListing.professionalId,
        serviceListingId,
        addressId: addressId || null,
        addressNotes: addressNotes || null,
      },
      include: {
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
        serviceListing: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
          },
        },
        address: true,
      },
    });

    // Criar notificação para o profissional
    await createNotification(
      serviceListing.professionalId,
      NotificationType.ORDER_CREATED,
      "Novo pedido recebido",
      `Você recebeu um novo pedido: "${title}" de ${req.user.name}`,
      serviceOrder.id,
      { clientId: req.user.id, clientName: req.user.name },
    );

    // Notificar o cliente de que o pedido foi criado com sucesso
    await createNotification(
      req.user.id,
      NotificationType.ORDER_CREATED,
      "📋 Pedido criado",
      `Seu pedido "${title}" foi enviado para o profissional ${serviceListing.professional.name}. Aguarde a aceitação.`,
      serviceOrder.id,
      { professionalId: serviceListing.professionalId, professionalName: serviceListing.professional.name },
    );

    res
      .status(201)
      .json(
        successResponse({ serviceOrder }, "Service order created successfully"),
      );
  } catch (error) {
    log.error({ err: error }, "Create service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Obter pedidos do usuário (como cliente ou profissional)
export const getUserServiceOrders = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const {
      status,
      role = req.user.role === "PROFESSIONAL" ? "professional" : "client",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const filters: any = {};

    // Filtrar por status se fornecido
    if (status && status !== "all") {
      const validStatuses = [
        "DRAFT",
        "PENDING",
        "ACCEPTED",
        "IN_PROGRESS",
        "AWAITING_CLIENT_CONFIRMATION",
        "AWAITING_PROFESSIONAL_CONFIRMATION",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
        "DISPUTED",
      ];
      if (validStatuses.includes(status as string)) {
        filters.status = status;
      }
    }

    // Determinar se busca como cliente ou profissional
    let whereClause: any;
    if (role === "professional" && req.user.role === "PROFESSIONAL") {
      whereClause = {
        ...filters,
        professionalId: req.user.id,
      };
    } else {
      whereClause = {
        ...filters,
        clientId: req.user.id,
      };
    }

    // Buscar pedidos
    const [serviceOrders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: whereClause,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              ratingAverage: true,
            },
          },
          professional: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              ratingAverage: true,
            },
          },
          serviceListing: {
            select: {
              id: true,
              title: true,
              price: true,
            },
          },
          payments: {
            where: {
              status: {
                in: ["HELD", "RELEASED"],
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              messages: true,
              reviews: true,
            },
          },
          brief: {
            select: {
              id: true,
              urgencyLevel: true,
              notes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limitNum,
      }),
      prisma.serviceOrder.count({
        where: whereClause,
      }),
    ]);

    res.status(200).json(
      successResponse(
        {
          serviceOrders,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        "Service orders retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get user service orders error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Obter detalhes de um pedido específico
export const getServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            phone: true,
            ratingAverage: true,
            totalReviews: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            phone: true,
            ratingAverage: true,
            totalReviews: true,
            bio: true,
            categories: {
              include: {
                category: true,
              },
            },
          },
        },
        serviceListing: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            images: true,
          },
        },
        address: true,
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          take: 50,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                profileImage: true,
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
        },
        reviews: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                profileImage: true,
              },
            },
          },
        },
        files: {
          orderBy: {
            createdAt: "desc",
          },
        },
        brief: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão (cliente, profissional envolvido ou admin)
    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isProfessional && !isAdmin) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to view this order"));
      return;
    }

    res
      .status(200)
      .json(
        successResponse(
          { serviceOrder },
          "Service order retrieved successfully",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Get service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Aceitar pedido (apenas profissional)
export const acceptServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
      res
        .status(403)
        .json(errorResponse("Only professionals can accept service orders"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: { select: SAFE_USER_SELECT },
        professional: { select: SAFE_USER_SELECT },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão (profissional designado ou admin)
    if (
      serviceOrder.professionalId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to accept this order"));
      return;
    }

    // Verificar se pedido pode ser aceito
    if (serviceOrder.status !== "PENDING") {
      res
        .status(400)
        .json(
          errorResponse(
            `Order cannot be accepted. Current status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Atualizar status
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "ACCEPTED",
        startedAt: new Date(),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        brief: true,
      },
    });

    // Criar notificação para o cliente
    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_ACCEPTED,
      "Pedido aceito",
      `Seu pedido "${serviceOrder.title}" foi aceito pelo profissional ${req.user.name}`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

    // Real-time Socket.io emissions
    emitToUser(serviceOrder.clientId, "order:accepted", {
      orderId: serviceOrder.id,
      title: serviceOrder.title,
      professionalName: req.user.name,
    });
    emitToOrder(serviceOrder.id, "order:statusChanged", {
      orderId: serviceOrder.id,
      status: "ACCEPTED",
    });

    res
      .status(200)
      .json(
        successResponse(
          { serviceOrder: updatedOrder },
          "Service order accepted successfully",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Accept service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Iniciar serviço (apenas profissional)
export const startServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
      res
        .status(403)
        .json(errorResponse("Only professionals can start service orders"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão (profissional designado ou admin)
    if (
      serviceOrder.professionalId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to start this order"));
      return;
    }

    // Verificar se pedido pode ser iniciado
    if (serviceOrder.status !== "ACCEPTED") {
      res
        .status(400)
        .json(
          errorResponse(
            `Order cannot be started. Current status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Atualizar status
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "IN_PROGRESS",
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Criar notificação para o cliente
    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_ACCEPTED,
      "🚀 Profissional a caminho",
      `O profissional ${req.user.name} iniciou o serviço "${serviceOrder.title}" e está a caminho do local.`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

    // Real-time Socket.io emissions
    emitToOrder(serviceOrder.id, "order:statusChanged", {
      orderId: serviceOrder.id,
      status: "IN_PROGRESS",
    });

    res
      .status(200)
      .json(
        successResponse(
          { serviceOrder: updatedOrder },
          "Service started successfully",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Start service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Cliente confirma que o serviço foi realizado
export const completeServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT" && req.user.role !== "ADMIN") {
      res
        .status(403)
        .json(errorResponse("Only clients can submit service completion"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: "HELD",
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão (cliente do pedido ou admin)
    const isClient = serviceOrder.clientId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isClient && !isAdmin) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to complete this order"),
        );
      return;
    }

    // Verificar se pedido pode ser marcado como concluído
    if (serviceOrder.status !== "IN_PROGRESS") {
      res
        .status(400)
        .json(
          errorResponse(
            `Order cannot be submitted for completion. Current status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Verificar se há pagamento em escrow
    const activePayment = serviceOrder.payments.find(
      (p) => p.status === "HELD",
    );
    if (!activePayment) {
      res
        .status(400)
        .json(errorResponse("No payment held in escrow for this order"));
      return;
    }

    // Atualizar status para aguardar confirmação do profissional
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "AWAITING_PROFESSIONAL_CONFIRMATION",
        clientConfirmedAt: new Date(),
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Criar notificação para o profissional
    if (serviceOrder.professionalId) {
      await createNotification(
        serviceOrder.professionalId,
        NotificationType.ORDER_COMPLETED,
        "Cliente confirmou o serviço",
        `O cliente confirmou que o serviço "${serviceOrder.title}" foi realizado. Confirme para liberar o pagamento.`,
        orderId,
        { clientId: req.user.id, clientName: req.user.name },
      );
    }

    // Real-time Socket.io emissions
    emitToOrder(orderId, "order:statusChanged", {
      orderId,
      status: "AWAITING_PROFESSIONAL_CONFIRMATION",
    });

    res
      .status(200)
      .json(
        successResponse(
          {
            serviceOrder: updatedOrder,
            confirmations: {
              professionalConfirmed: false,
              clientConfirmed: true,
              professionalConfirmedAt: null,
              clientConfirmedAt: updatedOrder.clientConfirmedAt?.toISOString() || null,
            },
          },
          "Client confirmed service completion. Waiting for professional confirmation.",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Complete service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Cliente confirma conclusão de serviço entregue
export const confirmServiceOrderCompletion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT" && req.user.role !== "ADMIN") {
      res
        .status(403)
        .json(errorResponse("Only clients can confirm service completion"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: "HELD",
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    const isClient = serviceOrder.clientId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isAdmin) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to confirm this order"));
      return;
    }

    if (serviceOrder.status !== "AWAITING_CLIENT_CONFIRMATION") {
      res
        .status(400)
        .json(
          errorResponse(
            `Order cannot be confirmed. Current status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    const activePayment = serviceOrder.payments.find(
      (payment) => payment.status === "HELD",
    );

    if (!activePayment) {
      res
        .status(400)
        .json(errorResponse("No payment held in escrow for this order"));
      return;
    }

    const now = new Date();

    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "AWAITING_PROFESSIONAL_CONFIRMATION",
        clientConfirmedAt: now,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Notificar profissional para confirmar
    if (serviceOrder.professionalId) {
      await createNotification(
        serviceOrder.professionalId,
        NotificationType.ORDER_COMPLETED,
        "Cliente confirmou conclusão",
        `O cliente confirmou a conclusão do serviço "${serviceOrder.title}". Confirme também para finalizar o pedido.`,
        orderId,
        { clientId: req.user.id, clientName: req.user.name },
      );
    }

    res.status(200).json(
      successResponse(
        {
          serviceOrder: updatedOrder,
          confirmations: {
            professionalConfirmed: true,
            clientConfirmed: true,
            professionalConfirmedAt: serviceOrder.professionalConfirmedAt?.toISOString() || null,
            clientConfirmedAt: now.toISOString(),
          },
        },
        "Client confirmed. Waiting for professional confirmation.",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Confirm service completion error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Profissional confirma conclusão após cliente já ter confirmado
export const confirmProfessionalCompletion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("Only professionals can confirm completion"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: "HELD" },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.professionalId !== req.user.id && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("You don't have permission"));
      return;
    }

    if (serviceOrder.status !== "AWAITING_PROFESSIONAL_CONFIRMATION") {
      res.status(400).json(
        errorResponse(`Order cannot be confirmed. Current status: ${serviceOrder.status}`),
      );
      return;
    }

    const now = new Date();
    const activePayment = serviceOrder.payments.find((p) => p.status === "HELD");

    // Step 1: Update order status
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        professionalConfirmedAt: now,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        professional: { select: { id: true, name: true, email: true } },
      },
    });

    // Step 2: Release escrow via canonical function (prevents double-credit)
    if (activePayment) {
      const releaseResult = await releasePaymentFromEscrow(activePayment.id, true);
      if (!releaseResult.success) {
        log.warn(
          { orderId, paymentId: activePayment.id, reason: releaseResult.error },
          "Payment release failed during professional confirmation"
        );
      }
    }

    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_COMPLETED,
      "Serviço concluído",
      `O profissional confirmou a conclusão do serviço "${serviceOrder.title}". Pedido finalizado!`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

    // Real-time Socket.io emissions
    emitToOrder(orderId, "order:statusChanged", {
      orderId,
      status: "COMPLETED",
    });

    res.status(200).json(
      successResponse(
        { serviceOrder: updatedOrder },
        "Professional confirmed completion. Order is now COMPLETED.",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Confirm professional completion error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Cancelar pedido (cliente ou profissional com permissões)
export const cancelServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    const { reason } = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: {
              in: ["PENDING", "HELD"],
            },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão (cliente, profissional envolvido ou admin)
    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isProfessional && !isAdmin) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to cancel this order"));
      return;
    }

    // Verificar se pedido pode ser cancelado
    const cancellableStatuses = ["PENDING", "ACCEPTED"];
    if (!cancellableStatuses.includes(serviceOrder.status)) {
      res
        .status(400)
        .json(
          errorResponse(
            `Order cannot be cancelled. Current status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Preparar transação para cancelamento
    const transactionOperations: any[] = [];

    // 1. Atualizar status do pedido
    transactionOperations.push(
      prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      }),
    );

    // 2. Se houver pagamento pendente ou em escrow, reembolsar
    if (serviceOrder.payments.length > 0) {
      serviceOrder.payments.forEach((payment) => {
        if (payment.status === "PENDING" || payment.status === "HELD") {
          transactionOperations.push(
            prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: "REFUNDED",
                refundedAt: new Date(),
              },
            }),
          );

          // Adicionar transação de reembolso
          transactionOperations.push(
            prisma.transaction.create({
              data: {
                type: "REFUND",
                amount: payment.amount,
                description: `Refund for cancelled order #${orderId}${reason ? ` - ${reason}` : ""}`,
                balanceBefore: 0, // Seria calculado com o saldo atual
                balanceAfter: 0,
                userId: serviceOrder.clientId,
                paymentId: payment.id,
              },
            }),
          );
        }
      });
    }

    // Executar transação
    await prisma.$transaction(transactionOperations);

    // Criar notificação para a outra parte
    const notificationUserId = isClient
      ? serviceOrder.professionalId!
      : serviceOrder.clientId;
    const actorName = req.user.name;
    const orderTitle = serviceOrder.title;

    await createNotification(
      notificationUserId,
      NotificationType.ORDER_CANCELLED,
      "Pedido cancelado",
      `O pedido "${orderTitle}" foi cancelado por ${actorName}${reason ? ` - Motivo: ${reason}` : ""}`,
      orderId,
      { cancelledById: req.user.id, cancelledByName: actorName, reason },
    );

    // Real-time Socket.io emissions
    emitToOrder(orderId, "order:statusChanged", {
      orderId,
      status: "CANCELLED",
    });

    res
      .status(200)
      .json(successResponse(null, "Service order cancelled successfully"));
  } catch (error) {
    log.error({ err: error }, "Cancel service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Criar pedido rascunho (DRAFT) para conversar antes de formalizar
export const createDraftOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT" && req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only clients and professionals can create draft orders"));
      return;
    }

    const { serviceListingId, message } = req.body;

    if (!serviceListingId) {
      res.status(400).json(errorResponse("Service listing ID is required"));
      return;
    }

    const serviceListing = await prisma.serviceListing.findUnique({
      where: { id: serviceListingId },
      include: {
        professional: {
          select: { id: true, name: true },
        },
      },
    });

    if (!serviceListing) {
      res.status(404).json(errorResponse("Service listing not found"));
      return;
    }

    if (!serviceListing.isAvailable) {
      res.status(400).json(errorResponse("This service is not available"));
      return;
    }

    // Profissional não pode criar DRAFT no próprio serviço
    if (serviceListing.professionalId === req.user.id) {
      res.status(400).json(errorResponse("Você não pode criar um pedido no seu próprio serviço"));
      return;
    }

    // Verificar se já existe DRAFT ativo para este listing + cliente
    const existingDraft = await prisma.serviceOrder.findFirst({
      where: {
        clientId: req.user.id,
        serviceListingId,
        status: "DRAFT",
      },
    });

    if (existingDraft) {
      // Retornar o draft existente em vez de criar novo
      res.status(200).json(
        successResponse(
          { serviceOrder: existingDraft },
          "Existing draft order found",
        ),
      );
      return;
    }

    const draftOrder = await prisma.serviceOrder.create({
      data: {
        title: `Conversa sobre: ${serviceListing.title}`,
        description: null,
        price: serviceListing.price,
        status: "DRAFT",
        deadlineDays: env.DEFAULT_ESCROW_HOLD_DAYS,
        deadlineDate: calculateDeadlineDate(env.DEFAULT_ESCROW_HOLD_DAYS),
        clientId: req.user.id,
        professionalId: serviceListing.professionalId,
        serviceListingId,
      },
      include: {
        client: {
          select: { id: true, name: true, profileImage: true },
        },
        professional: {
          select: { id: true, name: true, profileImage: true },
        },
        serviceListing: {
          select: { id: true, title: true, price: true },
        },
      },
    });

    // Se o cliente enviou uma mensagem inicial, criar mensagem
    if (message && message.trim().length > 0) {
      await prisma.message.create({
        data: {
          content: message.trim(),
          type: "TEXT",
          senderId: req.user.id,
          recipientId: serviceListing.professionalId,
          serviceOrderId: draftOrder.id,
        },
      });
    }

    // Notificar profissional
    await createNotification(
      serviceListing.professionalId,
      NotificationType.NEW_MESSAGE,
      "Novo contato recebido",
      `${req.user.name} quer conversar sobre "${serviceListing.title}"`,
      draftOrder.id,
      { clientId: req.user.id, clientName: req.user.name },
    );

    // Socket.io
    emitToUser(serviceListing.professionalId, "order:draft", {
      orderId: draftOrder.id,
      clientName: req.user.name,
      listingTitle: serviceListing.title,
    });

    res.status(201).json(
      successResponse(
        { serviceOrder: draftOrder },
        "Draft order created successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Create draft order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Converter DRAFT em pedido real (PENDING) — requer confirmação de ambas as partes
export const convertDraftToOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { title, description, scheduledDate, price } = req.body;

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        serviceListing: {
          select: { title: true, price: true },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.status !== "DRAFT") {
      res.status(400).json(errorResponse("Only draft orders can be converted"));
      return;
    }

    // Verificar que o usuário é participante
    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;

    if (!isClient && !isProfessional) {
      res.status(403).json(errorResponse("You are not part of this order"));
      return;
    }

    // Converter scheduledDate
    let scheduledDateObj: Date | undefined;
    if (scheduledDate) {
      scheduledDateObj = new Date(scheduledDate);
      if (isNaN(scheduledDateObj.getTime())) {
        res.status(400).json(errorResponse("Invalid scheduled date"));
        return;
      }
    }

    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "PENDING",
        title: title || serviceOrder.title,
        description: description || serviceOrder.description,
        price: price || serviceOrder.price,
        scheduledDate: scheduledDateObj || serviceOrder.scheduledDate,
      },
      include: {
        client: {
          select: { id: true, name: true, profileImage: true },
        },
        professional: {
          select: { id: true, name: true, profileImage: true },
        },
        serviceListing: {
          select: { id: true, title: true, price: true },
        },
      },
    });

    // Notificar a outra parte
    const notifyUserId = isClient
      ? serviceOrder.professionalId!
      : serviceOrder.clientId;
    const actorLabel = isClient ? "cliente" : "profissional";

    await createNotification(
      notifyUserId,
      NotificationType.ORDER_CREATED,
      "Conversa convertida em pedido",
      `O ${actorLabel} ${req.user.name} formalizou o pedido "${updatedOrder.title}"`,
      orderId,
      { convertedBy: req.user.id },
    );

    emitToOrder(orderId, "order:statusChanged", {
      orderId,
      status: "PENDING",
    });

    res.status(200).json(
      successResponse(
        { serviceOrder: updatedOrder },
        "Draft converted to order successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Convert draft to order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ============================================
// EN-ROUTE & DELAY DETECTION
// ============================================

// Profissional marca que está a caminho
export const markEnRoute = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: { select: SAFE_USER_SELECT },
        professional: { select: SAFE_USER_SELECT },
      },
    });

    if (!order) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (order.professionalId !== req.user.id) {
      res
        .status(403)
        .json(errorResponse("Only the assigned professional can mark en-route"));
      return;
    }

    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      res
        .status(400)
        .json(errorResponse("Order must be ACCEPTED or IN_PROGRESS to mark en-route"));
      return;
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { enRouteAt: new Date() },
    });

    // Notify client
    await createNotification(
      order.clientId,
      NotificationType.PROFESSIONAL_EN_ROUTE,
      "Profissional a caminho!",
      `${order.professional!.name} esta a caminho para realizar o servico "${order.title}"`,
      orderId,
    );

    emitToUser(order.clientId, "order:enRoute", {
      orderId,
      professionalName: order.professional!.name,
      enRouteAt: updated.enRouteAt,
    });

    log.info({ orderId, professionalId: req.user.id }, "Professional marked en-route");

    res.status(200).json(
      successResponse(
        { serviceOrder: updated },
        "En-route marked successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Mark en-route error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Cliente responde sobre atraso do profissional
export const delayResponse = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { arrived, action } = req.body;

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: { select: SAFE_USER_SELECT },
        professional: { select: SAFE_USER_SELECT },
      },
    });

    if (!order) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (order.clientId !== req.user.id && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("Only the client can respond to delay check"));
      return;
    }

    if (arrived === true) {
      // Professional arrived — no action needed
      log.info({ orderId }, "Client confirmed professional arrived");
      res.status(200).json(
        successResponse(null, "Ok, bom servico!"),
      );
      return;
    }

    if (action === "message") {
      // Send system message in chat + notify professional
      await prisma.message.create({
        data: {
          content:
            "⏰ O cliente reportou que o profissional nao chegou no horario agendado.",
          type: "SYSTEM",
          senderId: req.user.id,
          recipientId: order.professionalId!,
          serviceOrderId: orderId,
        },
      });

      await createNotification(
        order.professionalId!,
        NotificationType.SYSTEM_ALERT,
        "Cliente aguardando",
        `O cliente reportou que voce nao chegou no horario agendado para "${order.title}"`,
        orderId,
      );

      emitToOrder(orderId, "chat:message", {
        type: "SYSTEM",
        content: "⏰ Cliente reportou atraso do profissional.",
      });

      log.info({ orderId }, "Client sent delay message to professional");
      res.status(200).json(
        successResponse(null, "Mensagem enviada ao profissional"),
      );
    } else if (action === "dispute") {
      // Create automatic dispute
      const dispute = await prisma.dispute.create({
        data: {
          serviceOrderId: orderId,
          initiatorId: req.user.id,
          reason: "Profissional nao compareceu",
          description: `O profissional nao chegou no horario agendado${order.scheduledDate ? ` (${order.scheduledDate.toISOString()})` : ""} e nao iniciou o trajeto apos 15 minutos.`,
          status: "OPEN",
        },
      });

      // Set order to DISPUTED
      await prisma.serviceOrder.update({
        where: { id: orderId },
        data: { status: "DISPUTED" },
      });

      // System message in chat
      await prisma.message.create({
        data: {
          content:
            "⚠️ Uma disputa foi aberta: Profissional nao compareceu no horario agendado.",
          type: "SYSTEM",
          senderId: req.user.id,
          recipientId: order.professionalId!,
          serviceOrderId: orderId,
        },
      });

      // Notify professional
      await createNotification(
        order.professionalId!,
        NotificationType.SYSTEM_ALERT,
        "Disputa aberta",
        `Uma disputa foi aberta para "${order.title}": Profissional nao compareceu`,
        orderId,
      );

      emitToUser(order.clientId, "notification:new", {
        type: "SYSTEM_ALERT",
        title: "Disputa registrada",
      });
      emitToOrder(orderId, "order:statusChanged", {
        orderId,
        status: "DISPUTED",
      });

      log.info({ orderId, disputeId: dispute.id }, "Dispute created for professional no-show");
      res.status(200).json(
        successResponse({ dispute }, "Disputa aberta com sucesso"),
      );
    } else {
      res.status(400).json(errorResponse("Informe 'arrived' ou 'action'"));
    }
  } catch (error) {
    log.error({ err: error }, "Delay response error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
