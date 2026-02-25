import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("storefrontController");

// GET /api/storefronts — List published storefronts (public)
export async function listStorefronts(req: Request, res: Response) {
  try {
    const {
      page = "1",
      limit = "20",
      search,
      categoryId,
      sortBy = "relevance",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(
      50,
      Math.max(1, parseInt(limit as string, 10) || 20),
    );
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      isActive: true,
      isPublished: true,
    };

    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        {
          categories: {
            some: {
              services: {
                some: { title: { contains: search } },
              },
            },
          },
        },
      ];
    }

    if (categoryId) {
      where.mainCategoryId = parseInt(categoryId as string, 10);
    }

    let orderBy: any = {};
    switch (sortBy) {
      case "rating":
        orderBy = { ratingAverage: "desc" };
        break;
      case "recent":
        orderBy = { createdAt: "desc" };
        break;
      case "services":
        orderBy = { totalServices: "desc" };
        break;
      default: // relevance
        orderBy = [{ ratingAverage: "desc" }, { totalServices: "desc" }];
    }

    const [storefronts, total] = await Promise.all([
      prisma.storefront.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              isVerified: true,
            },
          },
          mainCategory: {
            select: { id: true, name: true, icon: true },
          },
        },
      }),
      prisma.storefront.count({ where }),
    ]);

    res.json({
      success: true,
      message: "Vitrines carregadas",
      data: {
        items: storefronts,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    log.error({ err: error }, "Error listing storefronts");
    res
      .status(500)
      .json({ success: false, message: "Erro ao listar vitrines" });
  }
}

// GET /api/storefronts/:slug — Get storefront by slug (public)
export async function getStorefrontBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;

    const storefront = await prisma.storefront.findUnique({
      where: { slug, isActive: true, isPublished: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            isVerified: true,
            ratingAverage: true,
            totalReviews: true,
          },
        },
        mainCategory: {
          select: { id: true, name: true, icon: true },
        },
        categories: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: {
            services: {
              where: { isAvailable: true },
              orderBy: { order: "asc" },
              include: {
                options: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!storefront) {
      res
        .status(404)
        .json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    res.json({
      success: true,
      message: "Vitrine carregada",
      data: storefront,
    });
  } catch (error: any) {
    log.error({ err: error }, "Error fetching storefront");
    res
      .status(500)
      .json({ success: false, message: "Erro ao carregar vitrine" });
  }
}
