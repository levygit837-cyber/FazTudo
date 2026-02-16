import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ServiceCategoryType } from "@prisma/client";

import { createLogger } from "../lib/logger";

const log = createLogger("categoryController");


// ==================== HELPERS ====================

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

// ==================== LIST CATEGORIES ====================

/**
 * Lista todas as categorias
 * GET /api/categories
 * Query params:
 *   - type: HOME_SERVICES | BUSINESS_SERVICES | BOTH
 *   - parentOnly: boolean - se true, retorna apenas categorias pai
 *   - includeSubcategories: boolean - se true, inclui subcategorias aninhadas
 */
export const listCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { type, parentOnly, includeSubcategories = "true" } = req.query;

    const where: any = {};

    // Filtro por tipo
    if (
      type &&
      ["HOME_SERVICES", "BUSINESS_SERVICES", "BOTH"].includes(type as string)
    ) {
      where.OR = [
        { type: type as ServiceCategoryType },
        { type: "BOTH" as ServiceCategoryType },
      ];
    }

    // Filtro para apenas categorias pai
    if (parentOnly === "true") {
      where.parentCategoryId = null;
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      include:
        includeSubcategories === "true"
          ? {
              subcategories: {
                orderBy: { name: "asc" },
              },
              _count: {
                select: {
                  serviceListings: true,
                  professionalCategories: true,
                },
              },
            }
          : {
              _count: {
                select: {
                  serviceListings: true,
                  professionalCategories: true,
                },
              },
            },
      orderBy: { name: "asc" },
    });

    res.status(200).json(
      successResponse(
        {
          categories,
          total: categories.length,
        },
        "Categories retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "List categories error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== GET CATEGORY BY ID ====================

/**
 * Obtém uma categoria específica
 * GET /api/categories/:id
 */
export const getCategoryById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const category = await prisma.serviceCategory.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        parentCategory: true,
        subcategories: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                serviceListings: true,
                professionalCategories: true,
              },
            },
          },
        },
        serviceListings: {
          where: { isAvailable: true },
          take: 10,
          orderBy: { createdAt: "desc" },
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
          },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
            subcategories: true,
          },
        },
      },
    });

    if (!category) {
      res.status(404).json(errorResponse("Category not found", 404));
      return;
    }

    res
      .status(200)
      .json(successResponse(category, "Category retrieved successfully"));
  } catch (error) {
    log.error({ err: error }, "Get category error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== GET CATEGORY BY SLUG/NAME ====================

/**
 * Obtém uma categoria pelo nome (slug)
 * GET /api/categories/slug/:name
 */
export const getCategoryByName = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const name = req.params.name as string;
    const decodedName = decodeURIComponent(name);

    const category = await prisma.serviceCategory.findFirst({
      where: {
        name: {
          equals: decodedName,
        },
      },
      include: {
        parentCategory: true,
        subcategories: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
          },
        },
      },
    });

    if (!category) {
      res.status(404).json(errorResponse("Category not found", 404));
      return;
    }

    res
      .status(200)
      .json(successResponse(category, "Category retrieved successfully"));
  } catch (error) {
    log.error({ err: error }, "Get category by name error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== GET MAIN CATEGORIES (FOR HOME PAGE) ====================

/**
 * Obtém categorias principais para exibição na home
 * GET /api/categories/main
 */
export const getMainCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { type, limit = "12" } = req.query;

    const where: any = {
      parentCategoryId: null, // Apenas categorias pai
    };

    if (
      type &&
      ["HOME_SERVICES", "BUSINESS_SERVICES"].includes(type as string)
    ) {
      where.OR = [
        { type: type as ServiceCategoryType },
        { type: "BOTH" as ServiceCategoryType },
      ];
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      include: {
        subcategories: {
          take: 5,
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
            subcategories: true,
          },
        },
      },
      orderBy: [
        {
          serviceListings: {
            _count: "desc",
          },
        },
        { name: "asc" },
      ],
      take: parseInt(limit as string),
    });

    res.status(200).json(
      successResponse(
        {
          categories,
          total: categories.length,
        },
        "Main categories retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get main categories error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== SEARCH CATEGORIES ====================

/**
 * Busca categorias por termo
 * GET /api/categories/search
 * Query params:
 *   - q: termo de busca
 *   - type: HOME_SERVICES | BUSINESS_SERVICES | BOTH
 */
export const searchCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { q, type } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res
        .status(400)
        .json(errorResponse("Search term must be at least 2 characters"));
      return;
    }

    const searchTerm = (q as string).trim();

    const where: any = {
      OR: [
        { name: { contains: searchTerm } },
        { description: { contains: searchTerm } },
      ],
    };

    if (
      type &&
      ["HOME_SERVICES", "BUSINESS_SERVICES", "BOTH"].includes(type as string)
    ) {
      where.AND = [
        {
          OR: [
            { type: type as ServiceCategoryType },
            { type: "BOTH" as ServiceCategoryType },
          ],
        },
      ];
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
          },
        },
      },
      orderBy: [
        {
          serviceListings: {
            _count: "desc",
          },
        },
        { name: "asc" },
      ],
      take: 20,
    });

    res.status(200).json(
      successResponse(
        {
          categories,
          total: categories.length,
          searchTerm,
        },
        "Search completed successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Search categories error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== GET CATEGORY TREE ====================

/**
 * Obtém árvore completa de categorias
 * GET /api/categories/tree
 */
export const getCategoryTree = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { type } = req.query;

    const where: any = {
      parentCategoryId: null,
    };

    if (
      type &&
      ["HOME_SERVICES", "BUSINESS_SERVICES"].includes(type as string)
    ) {
      where.OR = [
        { type: type as ServiceCategoryType },
        { type: "BOTH" as ServiceCategoryType },
      ];
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      include: {
        subcategories: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                serviceListings: true,
                professionalCategories: true,
              },
            },
          },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
            subcategories: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Agrupar por tipo
    const homeServices = categories.filter(
      (c) => c.type === "HOME_SERVICES" || c.type === "BOTH",
    );
    const businessServices = categories.filter(
      (c) => c.type === "BUSINESS_SERVICES" || c.type === "BOTH",
    );

    res.status(200).json(
      successResponse(
        {
          all: categories,
          homeServices,
          businessServices,
          totalCategories: categories.length,
          totalSubcategories: categories.reduce(
            (acc, c) => acc + (c._count?.subcategories || 0),
            0,
          ),
        },
        "Category tree retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get category tree error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== ADMIN: CREATE CATEGORY ====================

/**
 * Cria uma nova categoria (Admin only)
 * POST /api/categories
 */
export const createCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, icon, type, parentCategoryId } = req.body;

    // Validações
    if (!name || name.trim().length < 2) {
      res
        .status(400)
        .json(
          errorResponse(
            "Category name is required and must be at least 2 characters",
          ),
        );
      return;
    }

    if (
      !type ||
      !["HOME_SERVICES", "BUSINESS_SERVICES", "BOTH"].includes(type)
    ) {
      res.status(400).json(errorResponse("Valid category type is required"));
      return;
    }

    // Verificar se já existe
    const existing = await prisma.serviceCategory.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      res
        .status(409)
        .json(errorResponse("Category with this name already exists"));
      return;
    }

    // Se tem categoria pai, verificar se existe
    if (parentCategoryId) {
      const parent = await prisma.serviceCategory.findUnique({
        where: { id: parentCategoryId },
      });

      if (!parent) {
        res.status(404).json(errorResponse("Parent category not found"));
        return;
      }
    }

    const category = await prisma.serviceCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || null,
        type: type as ServiceCategoryType,
        parentCategoryId: parentCategoryId || null,
      },
      include: {
        parentCategory: true,
      },
    });

    res
      .status(201)
      .json(successResponse(category, "Category created successfully"));
  } catch (error) {
    log.error({ err: error }, "Create category error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== ADMIN: UPDATE CATEGORY ====================

/**
 * Atualiza uma categoria (Admin only)
 * PUT /api/categories/:id
 */
export const updateCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, icon, type, parentCategoryId } = req.body;

    const categoryId = parseInt(id, 10);

    // Verificar se existe
    const existing = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      res.status(404).json(errorResponse("Category not found", 404));
      return;
    }

    // Verificar nome duplicado
    if (name && name !== existing.name) {
      const nameExists = await prisma.serviceCategory.findUnique({
        where: { name: name.trim() },
      });

      if (nameExists) {
        res
          .status(409)
          .json(errorResponse("Category with this name already exists"));
        return;
      }
    }

    // Não permitir que uma categoria seja pai de si mesma
    if (parentCategoryId === categoryId) {
      res.status(400).json(errorResponse("Category cannot be its own parent"));
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (icon !== undefined) updateData.icon = icon || null;
    if (type && ["HOME_SERVICES", "BUSINESS_SERVICES", "BOTH"].includes(type)) {
      updateData.type = type as ServiceCategoryType;
    }
    if (parentCategoryId !== undefined) {
      updateData.parentCategoryId = parentCategoryId || null;
    }

    const category = await prisma.serviceCategory.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        parentCategory: true,
        subcategories: true,
      },
    });

    res
      .status(200)
      .json(successResponse(category, "Category updated successfully"));
  } catch (error) {
    log.error({ err: error }, "Update category error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== ADMIN: DELETE CATEGORY ====================

/**
 * Remove uma categoria (Admin only)
 * DELETE /api/categories/:id
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { force } = req.query;

    const categoryId = parseInt(id, 10);

    // Verificar se existe
    const existing = await prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            subcategories: true,
            serviceListings: true,
            professionalCategories: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json(errorResponse("Category not found", 404));
      return;
    }

    // Verificar dependências
    const hasSubcategories = existing._count.subcategories > 0;
    const hasListings = existing._count.serviceListings > 0;
    const hasProfessionals = existing._count.professionalCategories > 0;

    if (
      (hasSubcategories || hasListings || hasProfessionals) &&
      force !== "true"
    ) {
      res.status(400).json({
        success: false,
        message: "Category has dependencies and cannot be deleted",
        data: {
          subcategories: existing._count.subcategories,
          serviceListings: existing._count.serviceListings,
          professionals: existing._count.professionalCategories,
          hint: "Use ?force=true to delete anyway (will cascade)",
        },
      });
      return;
    }

    // Deletar categoria (cascade definido no schema)
    await prisma.serviceCategory.delete({
      where: { id: categoryId },
    });

    res
      .status(200)
      .json(successResponse(null, "Category deleted successfully"));
  } catch (error) {
    log.error({ err: error }, "Delete category error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// ==================== GET POPULAR CATEGORIES ====================

/**
 * Obtém categorias mais populares (com mais serviços/profissionais)
 * GET /api/categories/popular
 */
export const getPopularCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { limit = "8", type } = req.query;

    const where: any = {};

    if (
      type &&
      ["HOME_SERVICES", "BUSINESS_SERVICES"].includes(type as string)
    ) {
      where.OR = [
        { type: type as ServiceCategoryType },
        { type: "BOTH" as ServiceCategoryType },
      ];
    }

    const categories = await prisma.serviceCategory.findMany({
      where,
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            serviceListings: true,
            professionalCategories: true,
          },
        },
      },
      orderBy: [
        {
          serviceListings: {
            _count: "desc",
          },
        },
        {
          professionalCategories: {
            _count: "desc",
          },
        },
      ],
      take: parseInt(limit as string),
    });

    res.status(200).json(
      successResponse(
        {
          categories,
          total: categories.length,
        },
        "Popular categories retrieved successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Get popular categories error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

export default {
  listCategories,
  getCategoryById,
  getCategoryByName,
  getMainCategories,
  searchCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getPopularCategories,
};
