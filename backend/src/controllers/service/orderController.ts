import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";

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
        client: true,
        professional: true,
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

    // Calculate professional amount (deduct platform fee)
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = activePayment
      ? (activePayment.amount * platformFeePercentage) / 100
      : 0;
    const professionalAmount = activePayment
      ? activePayment.amount - platformFee
      : 0;

    const transactionOps: any[] = [
      prisma.serviceOrder.update({
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
      }),
    ];

    if (activePayment) {
      transactionOps.push(
        prisma.payment.update({
          where: { id: activePayment.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
          },
        }),
      );
      // Credit professional balance
      transactionOps.push(
        prisma.user.update({
          where: { id: serviceOrder.professionalId! },
          data: {
            balance: {
              increment: professionalAmount,
            },
          },
        }),
      );
      // Create credit transaction
      transactionOps.push(
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: professionalAmount,
            description: `Pagamento liberado para pedido #${orderId}`,
            balanceBefore: 0,
            balanceAfter: 0,
            userId: serviceOrder.professionalId!,
            paymentId: activePayment.id,
          },
        }),
      );
    }

    const [updatedOrder] = await prisma.$transaction(transactionOps);

    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_COMPLETED,
      "Serviço concluído",
      `O profissional confirmou a conclusão do serviço "${serviceOrder.title}". Pedido finalizado!`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

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

    res
      .status(200)
      .json(successResponse(null, "Service order cancelled successfully"));
  } catch (error) {
    log.error({ err: error }, "Cancel service order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
