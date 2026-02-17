import type { Request, Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";

import { createLogger } from "../../lib/logger";

const log = createLogger("listingController");


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
    log.error({ err: error }, "List services error");
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
            addresses: {
              take: 1,
              select: {
                city: true,
                neighborhood: true,
                state: true,
                latitude: true,
                longitude: true,
              },
            },
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
    log.error({ err: error }, "Get service error");
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
    log.error({ err: error }, "Create service listing error");
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
    log.error({ err: error }, "Update service listing error");
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
    log.error({ err: error }, "Delete service listing error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
