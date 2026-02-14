import type { Request, Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";
import {
  NotificationType,
  ServiceOrderStatus,
  PaymentStatus,
} from "@prisma/client";
import type { ServiceListing } from "../lib/prisma";

// Tipos para request bodies
interface CreateServiceListingBody {
  title: string;
  description: string;
  price: number;
  categoryId: number;
  estimatedHours?: number;
  images?: string[];
  tags?: string[];
}

interface UpdateServiceListingBody {
  title?: string;
  description?: string;
  price?: number;
  categoryId?: number;
  estimatedHours?: number;
  isAvailable?: boolean;
  images?: string[];
  tags?: string[];
}

interface CreateServiceOrderBody {
  serviceListingId: number;
  title: string;
  description?: string;
  scheduledDate?: string;
  addressId?: number;
  addressNotes?: string;
}

interface UpdateServiceOrderBody {
  title?: string;
  description?: string;
  scheduledDate?: string;
  addressId?: number;
  addressNotes?: string;
  deadlineDays?: number;
}

interface CreatePaymentBody {
  paymentMethod: string;
  transactionId?: string;
  metadata?: any;
}

interface CreateReviewBody {
  rating: number;
  comment?: string;
  isProfessional?: boolean; // false = cliente avalia profissional, true = profissional avalia cliente
}

interface SendMessageBody {
  content: string;
  serviceOrderId: number;
}

interface UpdateNotificationBody {
  status: "READ" | "ARCHIVED";
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

// Helper para parsear campos JSON do SQLite
const parseJsonField = (value: any): any => {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
};

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

// Utilitário para calcular data limite
const calculateDeadlineDate = (days: number): Date => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
};

// ============================================
// CONTROLLER DE SERVICE LISTINGS (CATÁLOGO)
// ============================================

// Listar todos os serviços disponíveis (com filtros)
export const listServices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      categoryId,
      minPrice,
      maxPrice,
      search,
      professionalId,
      availableOnly = "true",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const filters: any = {};
    const availableOnlyValue = Array.isArray(availableOnly)
      ? availableOnly[0]
      : availableOnly;
    if (availableOnlyValue !== "all") {
      filters.isAvailable = availableOnlyValue !== "false";
    }

    if (categoryId) {
      const catId = parseInt(categoryId as string, 10);
      if (!isNaN(catId)) {
        filters.categoryId = catId;
      }
    }

    if (professionalId) {
      const profId = parseInt(professionalId as string, 10);
      if (!isNaN(profId)) {
        filters.professionalId = profId;
      }
    }

    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) {
        const min = parseFloat(minPrice as string);
        if (!isNaN(min)) filters.price.gte = min;
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice as string);
        if (!isNaN(max)) filters.price.lte = max;
      }
    }

    // Buscar texto (simples - em produção usaríamos search engine)
    let whereClause: any = filters;

    if (search) {
      whereClause = {
        ...filters,
        OR: [
          { title: { contains: search as string } },
          { description: { contains: search as string } },
        ],
      };
    }

    // Buscar serviços com informações relacionadas
    const [services, total] = await Promise.all([
      prisma.serviceListing.findMany({
        where: whereClause,
        include: {
          professional: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              ratingAverage: true,
              totalReviews: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
          serviceOrders: {
            where: {
              status: "COMPLETED",
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limitNum,
      }),
      prisma.serviceListing.count({
        where: whereClause,
      }),
    ]);

    // Adicionar contagem de serviços completados
    const servicesWithStats = services.map((service: any) => ({
      ...service,
      images: parseJsonField(service.images),
      tags: parseJsonField(service.tags),
      completedOrders: service.serviceOrders?.length || 0,
      serviceOrders: undefined, // Remover array original
    }));

    res.status(200).json(
      successResponse(
        {
          services: servicesWithStats,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        "Services retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("List services error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Obter detalhes de um serviço específico
export const getService = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const serviceId = parseInt(String(req.params.id), 10);

    if (isNaN(serviceId)) {
      res.status(400).json(errorResponse("Invalid service ID"));
      return;
    }

    const service = await prisma.serviceListing.findUnique({
      where: { id: serviceId },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            ratingAverage: true,
            totalReviews: true,
            categories: {
              include: {
                category: true,
              },
            },
            certifications: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
          },
        },
        serviceOrders: {
          where: {
            status: "COMPLETED",
          },
          take: 5,
          include: {
            reviews: {
              where: {
                isProfessional: false,
              },
              take: 3,
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
          },
        },
      },
    });

    if (!service) {
      res.status(404).json(errorResponse("Service not found"));
      return;
    }

    // Contar pedidos completados
    const completedOrdersCount = await prisma.serviceOrder.count({
      where: {
        serviceListingId: serviceId,
        status: "COMPLETED",
      },
    });

    const serviceWithStats = {
      ...service,
      images: parseJsonField(service.images),
      tags: parseJsonField(service.tags),
      completedOrdersCount,
    };

    res
      .status(200)
      .json(
        successResponse(
          { service: serviceWithStats },
          "Service retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Get service error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Criar nova listagem de serviço (apenas profissionais)
export const createServiceListing = async (
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
        .json(errorResponse("Only professionals can create service listings"));
      return;
    }

    const {
      title,
      description,
      price,
      categoryId,
      estimatedHours,
      images = [],
      tags = [],
    }: CreateServiceListingBody = req.body;

    // Validações básicas
    if (!title || !description || !price || !categoryId) {
      res
        .status(400)
        .json(
          errorResponse("Title, description, price, and category are required"),
        );
      return;
    }

    if (price <= 0) {
      res.status(400).json(errorResponse("Price must be greater than 0"));
      return;
    }

    // Verificar se categoria existe
    const category = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(404).json(errorResponse("Category not found"));
      return;
    }

    // Criar serviço
    const service = await prisma.serviceListing.create({
      data: {
        title,
        description,
        price,
        estimatedHours: estimatedHours || null,
        images: images || [],
        tags: tags || [],
        professionalId: req.user.id,
        categoryId,
        isAvailable: true,
      },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    res
      .status(201)
      .json(
        successResponse({ service }, "Service listing created successfully"),
      );
  } catch (error) {
    console.error("Create service listing error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Atualizar listagem de serviço (apenas proprietário ou admin)
export const updateServiceListing = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const serviceId = parseInt(String(req.params.id), 10);

    if (isNaN(serviceId)) {
      res.status(400).json(errorResponse("Invalid service ID"));
      return;
    }

    const {
      title,
      description,
      price,
      categoryId,
      estimatedHours,
      isAvailable,
      images,
      tags,
    }: UpdateServiceListingBody = req.body;

    // Verificar se serviço existe e se usuário tem permissão
    const existingService = await prisma.serviceListing.findUnique({
      where: { id: serviceId },
      select: {
        professionalId: true,
      },
    });

    if (!existingService) {
      res.status(404).json(errorResponse("Service not found"));
      return;
    }

    // Apenas proprietário ou admin pode atualizar
    if (
      existingService.professionalId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to update this service"),
        );
      return;
    }

    // Verificar categoria se fornecida
    if (categoryId) {
      const category = await prisma.serviceCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        res.status(404).json(errorResponse("Category not found"));
        return;
      }
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) {
      if (price <= 0) {
        res.status(400).json(errorResponse("Price must be greater than 0"));
        return;
      }
      updateData.price = price;
    }
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (estimatedHours !== undefined)
      updateData.estimatedHours = estimatedHours;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (images !== undefined) updateData.images = images || undefined;
    if (tags !== undefined) updateData.tags = tags || undefined;

    // Atualizar serviço
    const updatedService = await prisma.serviceListing.update({
      where: { id: serviceId },
      data: updateData,
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    res
      .status(200)
      .json(
        successResponse(
          { service: updatedService },
          "Service listing updated successfully",
        ),
      );
  } catch (error) {
    console.error("Update service listing error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Deletar listagem de serviço (apenas proprietário ou admin)
export const deleteServiceListing = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const serviceId = parseInt(String(req.params.id), 10);

    if (isNaN(serviceId)) {
      res.status(400).json(errorResponse("Invalid service ID"));
      return;
    }

    // Verificar se serviço existe e se usuário tem permissão
    const existingService = await prisma.serviceListing.findUnique({
      where: { id: serviceId },
      include: {
        serviceOrders: {
          where: {
            status: {
              in: [
                "PENDING",
                "ACCEPTED",
                "IN_PROGRESS",
                "AWAITING_CLIENT_CONFIRMATION",
              ],
            },
          },
        },
      },
    });

    if (!existingService) {
      res.status(404).json(errorResponse("Service not found"));
      return;
    }

    // Apenas proprietário ou admin pode deletar
    if (
      existingService.professionalId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to delete this service"),
        );
      return;
    }

    // Verificar se há pedidos ativos
    if (existingService.serviceOrders.length > 0) {
      res
        .status(400)
        .json(
          errorResponse(
            "Cannot delete service with active orders. Cancel or complete the orders first.",
          ),
        );
      return;
    }

    // Deletar serviço
    await prisma.serviceListing.delete({
      where: { id: serviceId },
    });

    res
      .status(200)
      .json(successResponse(null, "Service listing deleted successfully"));
  } catch (error) {
    console.error("Delete service listing error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ============================================
// CONTROLLER DE SERVICE ORDERS (PEDIDOS)
// ============================================

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

    res
      .status(201)
      .json(
        successResponse({ serviceOrder }, "Service order created successfully"),
      );
  } catch (error) {
    console.error("Create service order error:", error);
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
    console.error("Get user service orders error:", error);
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
    console.error("Get service order error:", error);
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
    console.error("Accept service order error:", error);
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
      "Serviço iniciado",
      `O profissional ${req.user.name} iniciou o serviço "${serviceOrder.title}"`,
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
    console.error("Start service order error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Completar serviço (apenas profissional)
export const completeServiceOrder = async (
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
        .json(errorResponse("Only professionals can complete service orders"));
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

    // Verificar permissão (profissional designado ou admin)
    if (
      serviceOrder.professionalId !== req.user.id &&
      req.user.role !== "ADMIN"
    ) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to complete this order"),
        );
      return;
    }

    // Verificar se pedido pode ser marcado como entregue
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

    // Atualizar status para aguardar confirmação do cliente
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "AWAITING_CLIENT_CONFIRMATION",
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
      NotificationType.ORDER_COMPLETED,
      "Serviço entregue",
      `O serviço "${serviceOrder.title}" foi marcado como entregue por ${req.user.name}. Confirme a conclusão para continuar a liberação do pagamento.`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

    res
      .status(200)
      .json(
        successResponse(
          { serviceOrder: updatedOrder },
          "Service marked as delivered. Waiting for client confirmation.",
        ),
      );
  } catch (error) {
    console.error("Complete service order error:", error);
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
    const releaseDate = new Date(now);
    releaseDate.setDate(releaseDate.getDate() + env.ESCROW_AUTO_RELEASE_DAYS);

    const [updatedOrder] = await prisma.$transaction([
      prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          completedAt: now,
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
      }),
      prisma.payment.update({
        where: { id: activePayment.id },
        data: {
          heldUntil: releaseDate,
        },
      }),
    ]);

    if (serviceOrder.professionalId) {
      await createNotification(
        serviceOrder.professionalId,
        NotificationType.ORDER_COMPLETED,
        "Conclusão confirmada",
        `O cliente confirmou a conclusão do serviço "${serviceOrder.title}". O pagamento poderá ser liberado após o período de revisão.`,
        orderId,
        { clientId: req.user.id, clientName: req.user.name },
      );
    }

    res.status(200).json(
      successResponse(
        { serviceOrder: updatedOrder },
        "Service completion confirmed successfully",
      ),
    );
  } catch (error) {
    console.error("Confirm service completion error:", error);
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
    console.error("Cancel service order error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ============================================
// CONTROLLER DE PAGAMENTOS
// ============================================

// Criar pagamento para um pedido (apenas cliente)
export const createPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create payments"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const { paymentMethod, transactionId, metadata }: CreatePaymentBody =
      req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!paymentMethod) {
      res.status(400).json(errorResponse("Payment method is required"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        professional: true,
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

    // Verificar se pedido pertence ao cliente
    if (serviceOrder.clientId !== req.user.id) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to pay for this order"));
      return;
    }

    // Verificar se pedido pode receber pagamento
    if (
      serviceOrder.status !== "PENDING" &&
      serviceOrder.status !== "ACCEPTED"
    ) {
      res
        .status(400)
        .json(
          errorResponse(
            `Payment cannot be processed. Order status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Verificar se já existe pagamento ativo
    if (serviceOrder.payments.length > 0) {
      res
        .status(400)
        .json(
          errorResponse("There is already an active payment for this order"),
        );
      return;
    }

    // Calcular taxa da plataforma
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;

    // Calcular datas
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    // Criar pagamento em escrow
    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: "HELD",
        paymentMethod,
        transactionId: transactionId || undefined,
        metadata: metadata || undefined,
        paidAt: now,
        heldUntil,
        serviceOrderId: orderId,
        clientId: req.user.id,
        professionalId: serviceOrder.professionalId || undefined,
      },
      include: {
        serviceOrder: {
          select: {
            title: true,
            price: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Criar transação
    await prisma.transaction.create({
      data: {
        type: "PAYMENT",
        amount: serviceOrder.price,
        description: `Payment for order #${orderId}: ${serviceOrder.title}`,
        balanceBefore: 0, // Seria calculado com o saldo atual
        balanceAfter: 0,
        userId: req.user.id,
        paymentId: payment.id,
      },
    });

    // Criar notificação para o profissional
    await createNotification(
      serviceOrder.professionalId!,
      NotificationType.PAYMENT_RECEIVED,
      "Pagamento recebido",
      `Pagamento de R$${serviceOrder.price.toFixed(2)} recebido para o pedido "${serviceOrder.title}"`,
      orderId,
      {
        amount: serviceOrder.price,
        platformFee,
        professionalAmount,
        heldUntil: heldUntil.toISOString(),
      },
    );

    res.status(201).json(
      successResponse(
        {
          payment,
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
            heldUntil,
          },
        },
        "Payment created successfully. Amount held in escrow.",
      ),
    );
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Liberar pagamento em escrow (cliente após período de revisão ou automaticamente)
export const releasePayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Buscar pedido e pagamento
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: "HELD",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar se pedido pertence ao cliente ou é admin
    const isClient = serviceOrder.clientId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isAdmin) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to release this payment"),
        );
      return;
    }

    // Verificar se há pagamento em escrow
    if (serviceOrder.payments.length === 0) {
      res
        .status(404)
        .json(errorResponse("No payment held in escrow for this order"));
      return;
    }

    const payment = serviceOrder.payments[0];

    if (!payment) {
      res.status(404).json(errorResponse("Payment not found"));
      return;
    }

    // Verificar se pagamento pode ser liberado
    if (payment.status !== "HELD") {
      res.status(400).json(errorResponse("Payment is not in escrow status"));
      return;
    }

    if (serviceOrder.status !== "COMPLETED" && !isAdmin) {
      res
        .status(400)
        .json(
          errorResponse(
            "Payment can only be released after order completion confirmation",
          ),
        );
      return;
    }

    // Verificar se período de espera já passou (ou admin pode liberar)
    const now = new Date();
    if (payment.heldUntil && now < payment.heldUntil && !isAdmin) {
      res.status(400).json({
        success: false,
        message: `Payment cannot be released yet. Available after: ${payment.heldUntil.toISOString()}`,
        data: { heldUntil: payment.heldUntil },
      });
      return;
    }

    // Calcular valores
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (payment.amount * platformFeePercentage) / 100;
    const professionalAmount = payment.amount - platformFee;

    // Executar transação para liberar pagamento
    const [updatedPayment, professionalTransaction] = await prisma.$transaction(
      [
        // Atualizar status do pagamento
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
          },
        }),
        // Adicionar transação para o profissional
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: professionalAmount,
            description: `Payment released from escrow for order #${orderId}`,
            balanceBefore: 0, // Seria calculado com o saldo atual do profissional
            balanceAfter: 0,
            userId: serviceOrder.professionalId!,
            paymentId: payment.id,
          },
        }),
        // Atualizar saldo do profissional
        prisma.user.update({
          where: { id: serviceOrder.professionalId! },
          data: {
            balance: {
              increment: professionalAmount,
            },
          },
        }),
      ],
    );

    // Criar notificação para o profissional
    await createNotification(
      serviceOrder.professionalId!,
      NotificationType.PAYMENT_RELEASED,
      "Pagamento liberado",
      `Pagamento de R$${professionalAmount.toFixed(2)} liberado do escrow para o pedido "${serviceOrder.title}"`,
      orderId,
      {
        totalAmount: payment.amount,
        platformFee,
        professionalAmount,
        releasedAt: now.toISOString(),
      },
    );

    res.status(200).json(
      successResponse(
        {
          payment: updatedPayment,
          releasedAmount: professionalAmount,
          platformFee,
        },
        "Payment released successfully",
      ),
    );
  } catch (error) {
    console.error("Release payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ============================================
// CONTROLLER DE AVALIAÇÕES
// ============================================

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

// ============================================
// CONTROLLER DE MENSAGENS
// ============================================

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

// ============================================
// CONTROLLER DE NOTIFICAÇÕES
// ============================================

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

// Exportar todos os controllers
export default {
  // Service Listings
  listServices,
  getService,
  createServiceListing,
  updateServiceListing,
  deleteServiceListing,

  // Service Orders
  createServiceOrder,
  getUserServiceOrders,
  getServiceOrder,
  acceptServiceOrder,
  startServiceOrder,
  completeServiceOrder,
  confirmServiceOrderCompletion,
  cancelServiceOrder,

  // Payments
  createPayment,
  releasePayment,

  // Reviews
  createReview,

  // Messages
  sendMessage,
  getOrderMessages,

  // Notifications
  getNotifications,
  updateNotification,
  markAllNotificationsAsRead,
};
