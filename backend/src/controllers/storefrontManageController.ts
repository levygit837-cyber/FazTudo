import { Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { AuthRequest } from "../middleware/auth";

const log = createLogger("storefrontManage");

// ── Helpers ──────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function getOwnStorefront(userId: number) {
  return prisma.storefront.findUnique({ where: { userId } });
}

// ── Storefront CRUD ──────────────────────────────────────

// GET /api/storefronts/mine
export async function getMyStorefront(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const storefront = await prisma.storefront.findUnique({
      where: { userId },
      include: {
        mainCategory: { select: { id: true, name: true, icon: true } },
        categories: {
          orderBy: { order: "asc" },
          include: {
            services: {
              orderBy: { order: "asc" },
              include: { options: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });

    if (!storefront) {
      res.json({ success: true, message: "Nenhuma vitrine encontrada", data: null });
      return;
    }

    res.json({ success: true, message: "Vitrine carregada", data: storefront });
  } catch (error: any) {
    log.error({ err: error }, "Error fetching own storefront");
    res.status(500).json({ success: false, message: "Erro ao carregar vitrine" });
  }
}

// POST /api/storefronts
export async function createStorefront(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { name, slug, description, mainCategoryId } = req.body;

    // Check if user already has a storefront
    const existing = await getOwnStorefront(userId);
    if (existing) {
      res.status(409).json({ success: false, message: "Voce ja possui uma vitrine" });
      return;
    }

    // Generate slug if not provided
    let finalSlug = slug || slugify(name);

    // Ensure slug uniqueness
    const slugExists = await prisma.storefront.findUnique({ where: { slug: finalSlug } });
    if (slugExists) {
      finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
    }

    const storefront = await prisma.storefront.create({
      data: {
        userId,
        name,
        slug: finalSlug,
        description,
        mainCategoryId,
      },
    });

    log.info({ storefrontId: storefront.id, userId }, "Storefront created");
    res.status(201).json({ success: true, message: "Vitrine criada", data: storefront });
  } catch (error: any) {
    log.error({ err: error }, "Error creating storefront");
    res.status(500).json({ success: false, message: "Erro ao criar vitrine" });
  }
}

// PUT /api/storefronts/mine
export async function updateStorefront(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const { name, slug, description, logo, banner, mainCategoryId, isActive } = req.body;

    // If slug changed, ensure uniqueness
    if (slug && slug !== storefront.slug) {
      const slugExists = await prisma.storefront.findUnique({ where: { slug } });
      if (slugExists) {
        res.status(409).json({ success: false, message: "Slug ja em uso" });
        return;
      }
    }

    const updated = await prisma.storefront.update({
      where: { userId },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description }),
        ...(logo !== undefined && { logo }),
        ...(banner !== undefined && { banner }),
        ...(mainCategoryId !== undefined && { mainCategoryId }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    log.info({ storefrontId: updated.id }, "Storefront updated");
    res.json({ success: true, message: "Vitrine atualizada", data: updated });
  } catch (error: any) {
    log.error({ err: error }, "Error updating storefront");
    res.status(500).json({ success: false, message: "Erro ao atualizar vitrine" });
  }
}

// PUT /api/storefronts/mine/publish
export async function publishStorefront(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const { isPublished } = req.body;

    // Require at least one category with one service to publish
    if (isPublished) {
      const serviceCount = await prisma.storefrontService.count({
        where: {
          category: { storefrontId: storefront.id },
          isAvailable: true,
        },
      });
      if (serviceCount === 0) {
        res.status(400).json({
          success: false,
          message: "Adicione pelo menos um servico antes de publicar",
        });
        return;
      }
    }

    const updated = await prisma.storefront.update({
      where: { userId },
      data: { isPublished },
    });

    log.info({ storefrontId: updated.id, isPublished }, "Storefront publish status changed");
    res.json({
      success: true,
      message: isPublished ? "Vitrine publicada" : "Vitrine despublicada",
      data: updated,
    });
  } catch (error: any) {
    log.error({ err: error }, "Error publishing storefront");
    res.status(500).json({ success: false, message: "Erro ao publicar vitrine" });
  }
}

// ── Categories CRUD ──────────────────────────────────────

// GET /api/storefronts/mine/categories
export async function listMyCategories(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const categories = await prisma.storefrontCategory.findMany({
      where: { storefrontId: storefront.id },
      orderBy: { order: "asc" },
      include: {
        services: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
      },
    });

    res.json({ success: true, message: "Categorias carregadas", data: categories });
  } catch (error: any) {
    log.error({ err: error }, "Error listing categories");
    res.status(500).json({ success: false, message: "Erro ao listar categorias" });
  }
}

// POST /api/storefronts/mine/categories
export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const { name, order } = req.body;

    // Auto-calculate order if not provided
    let finalOrder = order;
    if (finalOrder === undefined) {
      const maxOrder = await prisma.storefrontCategory.aggregate({
        where: { storefrontId: storefront.id },
        _max: { order: true },
      });
      finalOrder = (maxOrder._max.order ?? -1) + 1;
    }

    const category = await prisma.storefrontCategory.create({
      data: {
        storefrontId: storefront.id,
        name,
        order: finalOrder,
      },
    });

    log.info({ categoryId: category.id, storefrontId: storefront.id }, "Category created");
    res.status(201).json({ success: true, message: "Categoria criada", data: category });
  } catch (error: any) {
    log.error({ err: error }, "Error creating category");
    res.status(500).json({ success: false, message: "Erro ao criar categoria" });
  }
}

// PUT /api/storefronts/mine/categories/:id
export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const categoryId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership
    const category = await prisma.storefrontCategory.findFirst({
      where: { id: categoryId, storefrontId: storefront.id },
    });
    if (!category) {
      res.status(404).json({ success: false, message: "Categoria nao encontrada" });
      return;
    }

    const { name, isActive } = req.body;

    const updated = await prisma.storefrontCategory.update({
      where: { id: categoryId },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ success: true, message: "Categoria atualizada", data: updated });
  } catch (error: any) {
    log.error({ err: error }, "Error updating category");
    res.status(500).json({ success: false, message: "Erro ao atualizar categoria" });
  }
}

// PUT /api/storefronts/mine/categories/reorder
export async function reorderCategories(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const { order } = req.body as { order: { id: number; order: number }[] };

    await prisma.$transaction(
      order.map((item) =>
        prisma.storefrontCategory.updateMany({
          where: { id: item.id, storefrontId: storefront.id },
          data: { order: item.order },
        }),
      ),
    );

    res.json({ success: true, message: "Ordem atualizada" });
  } catch (error: any) {
    log.error({ err: error }, "Error reordering categories");
    res.status(500).json({ success: false, message: "Erro ao reordenar categorias" });
  }
}

// DELETE /api/storefronts/mine/categories/:id
export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const categoryId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership
    const category = await prisma.storefrontCategory.findFirst({
      where: { id: categoryId, storefrontId: storefront.id },
    });
    if (!category) {
      res.status(404).json({ success: false, message: "Categoria nao encontrada" });
      return;
    }

    // Count services that will be deleted
    const serviceCount = await prisma.storefrontService.count({
      where: { categoryId },
    });

    await prisma.storefrontCategory.delete({ where: { id: categoryId } });

    // Update storefront totalServices
    if (serviceCount > 0) {
      await prisma.storefront.update({
        where: { id: storefront.id },
        data: { totalServices: { decrement: serviceCount } },
      });
    }

    log.info({ categoryId, serviceCount }, "Category deleted");
    res.json({ success: true, message: "Categoria removida" });
  } catch (error: any) {
    log.error({ err: error }, "Error deleting category");
    res.status(500).json({ success: false, message: "Erro ao remover categoria" });
  }
}

// ── Services CRUD ────────────────────────────────────────

// GET /api/storefronts/mine/services
export async function listMyServices(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const services = await prisma.storefrontService.findMany({
      where: { category: { storefrontId: storefront.id } },
      orderBy: { order: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        options: { orderBy: { order: "asc" } },
      },
    });

    res.json({ success: true, message: "Servicos carregados", data: services });
  } catch (error: any) {
    log.error({ err: error }, "Error listing services");
    res.status(500).json({ success: false, message: "Erro ao listar servicos" });
  }
}

// POST /api/storefronts/mine/services
export async function createService(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    const { categoryId, title, description, price, images, order } = req.body;

    // Verify category belongs to storefront
    const category = await prisma.storefrontCategory.findFirst({
      where: { id: categoryId, storefrontId: storefront.id },
    });
    if (!category) {
      res.status(404).json({ success: false, message: "Categoria nao encontrada" });
      return;
    }

    // Auto-calculate order if not provided
    let finalOrder = order;
    if (finalOrder === undefined) {
      const maxOrder = await prisma.storefrontService.aggregate({
        where: { categoryId },
        _max: { order: true },
      });
      finalOrder = (maxOrder._max.order ?? -1) + 1;
    }

    const service = await prisma.storefrontService.create({
      data: {
        categoryId,
        title,
        description,
        price,
        images: images || null,
        order: finalOrder,
      },
    });

    // Update storefront totalServices
    await prisma.storefront.update({
      where: { id: storefront.id },
      data: { totalServices: { increment: 1 } },
    });

    log.info({ serviceId: service.id, storefrontId: storefront.id }, "Service created");
    res.status(201).json({ success: true, message: "Servico criado", data: service });
  } catch (error: any) {
    log.error({ err: error }, "Error creating service");
    res.status(500).json({ success: false, message: "Erro ao criar servico" });
  }
}

// PUT /api/storefronts/mine/services/:id
export async function updateService(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const serviceId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership via category
    const service = await prisma.storefrontService.findFirst({
      where: { id: serviceId, category: { storefrontId: storefront.id } },
    });
    if (!service) {
      res.status(404).json({ success: false, message: "Servico nao encontrado" });
      return;
    }

    const { categoryId, title, description, price, images, isAvailable, order } = req.body;

    // If changing category, verify new category belongs to storefront
    if (categoryId && categoryId !== service.categoryId) {
      const newCategory = await prisma.storefrontCategory.findFirst({
        where: { id: categoryId, storefrontId: storefront.id },
      });
      if (!newCategory) {
        res.status(404).json({ success: false, message: "Categoria destino nao encontrada" });
        return;
      }
    }

    const updated = await prisma.storefrontService.update({
      where: { id: serviceId },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(images !== undefined && { images }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(order !== undefined && { order }),
      },
    });

    res.json({ success: true, message: "Servico atualizado", data: updated });
  } catch (error: any) {
    log.error({ err: error }, "Error updating service");
    res.status(500).json({ success: false, message: "Erro ao atualizar servico" });
  }
}

// DELETE /api/storefronts/mine/services/:id
export async function deleteService(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const serviceId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership
    const service = await prisma.storefrontService.findFirst({
      where: { id: serviceId, category: { storefrontId: storefront.id } },
    });
    if (!service) {
      res.status(404).json({ success: false, message: "Servico nao encontrado" });
      return;
    }

    await prisma.storefrontService.delete({ where: { id: serviceId } });

    // Update storefront totalServices
    await prisma.storefront.update({
      where: { id: storefront.id },
      data: { totalServices: { decrement: 1 } },
    });

    log.info({ serviceId }, "Service deleted");
    res.json({ success: true, message: "Servico removido" });
  } catch (error: any) {
    log.error({ err: error }, "Error deleting service");
    res.status(500).json({ success: false, message: "Erro ao remover servico" });
  }
}

// ── Options CRUD ─────────────────────────────────────────

// POST /api/storefronts/mine/services/:id/options
export async function createOption(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const serviceId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify service belongs to storefront
    const service = await prisma.storefrontService.findFirst({
      where: { id: serviceId, category: { storefrontId: storefront.id } },
    });
    if (!service) {
      res.status(404).json({ success: false, message: "Servico nao encontrado" });
      return;
    }

    const { name, price, isDefault, order } = req.body;

    // Auto-calculate order if not provided
    let finalOrder = order;
    if (finalOrder === undefined) {
      const maxOrder = await prisma.storefrontServiceOption.aggregate({
        where: { serviceId },
        _max: { order: true },
      });
      finalOrder = (maxOrder._max.order ?? -1) + 1;
    }

    const option = await prisma.storefrontServiceOption.create({
      data: {
        serviceId,
        name,
        price: price ?? null,
        isDefault: isDefault ?? false,
        order: finalOrder,
      },
    });

    log.info({ optionId: option.id, serviceId }, "Option created");
    res.status(201).json({ success: true, message: "Opcao criada", data: option });
  } catch (error: any) {
    log.error({ err: error }, "Error creating option");
    res.status(500).json({ success: false, message: "Erro ao criar opcao" });
  }
}

// PUT /api/storefronts/mine/options/:id
export async function updateOption(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const optionId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership via service → category → storefront
    const option = await prisma.storefrontServiceOption.findFirst({
      where: {
        id: optionId,
        service: { category: { storefrontId: storefront.id } },
      },
    });
    if (!option) {
      res.status(404).json({ success: false, message: "Opcao nao encontrada" });
      return;
    }

    const { name, price, isDefault, order } = req.body;

    const updated = await prisma.storefrontServiceOption.update({
      where: { id: optionId },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price }),
        ...(isDefault !== undefined && { isDefault }),
        ...(order !== undefined && { order }),
      },
    });

    res.json({ success: true, message: "Opcao atualizada", data: updated });
  } catch (error: any) {
    log.error({ err: error }, "Error updating option");
    res.status(500).json({ success: false, message: "Erro ao atualizar opcao" });
  }
}

// DELETE /api/storefronts/mine/options/:id
export async function deleteOption(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const optionId = parseInt(req.params.id as string, 10);
    const storefront = await getOwnStorefront(userId);

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // Verify ownership
    const option = await prisma.storefrontServiceOption.findFirst({
      where: {
        id: optionId,
        service: { category: { storefrontId: storefront.id } },
      },
    });
    if (!option) {
      res.status(404).json({ success: false, message: "Opcao nao encontrada" });
      return;
    }

    await prisma.storefrontServiceOption.delete({ where: { id: optionId } });

    log.info({ optionId }, "Option deleted");
    res.json({ success: true, message: "Opcao removida" });
  } catch (error: any) {
    log.error({ err: error }, "Error deleting option");
    res.status(500).json({ success: false, message: "Erro ao remover opcao" });
  }
}
