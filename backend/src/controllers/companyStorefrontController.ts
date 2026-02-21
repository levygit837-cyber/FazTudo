import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const log = createLogger("companyStorefront");

// ──────────────────────────────────────────────
// PUBLIC: get full storefront for a company
// ──────────────────────────────────────────────
export async function getPublicStorefront(req: Request, res: Response) {
  const companyId = parseInt(req.params.companyId as string);
  if (isNaN(companyId)) {
    return res.status(400).json({ success: false, message: "ID inválido" });
  }
  try {
    const company = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      include: {
        storefrontSections: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                listing: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    price: true,
                    images: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        storefrontBlocks: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        pinnedTestimonials: {
          orderBy: { order: "asc" },
          include: {
            review: {
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                author: { select: { name: true, profileImage: true } },
              },
            },
          },
        },
        user: { select: { name: true, profileImage: true } },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            role: { select: { name: true } },
            user: { select: { name: true, profileImage: true } },
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    }

    const ordersCount = await prisma.serviceOrder.count({
      where: {
        professional: { companyMember: { companyId: company.id } },
        status: "COMPLETED",
      },
    });

    return res.json({
      success: true,
      message: "Vitrine carregada",
      data: { company, ordersCount },
    });
  } catch (err) {
    log.error({ err }, "getPublicStorefront error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// EDITOR: get storefront data for editing
// ──────────────────────────────────────────────
export async function getStorefrontEditor(req: Request, res: Response) {
  const userId = (req as any).user.id;
  try {
    const member = await prisma.companyMember.findFirst({
      where: { userId, isActive: true },
      include: {
        company: {
          include: {
            storefrontSections: {
              orderBy: { order: "asc" },
              include: { items: { orderBy: { order: "asc" }, include: { listing: true } } },
            },
            storefrontBlocks: { orderBy: { order: "asc" } },
            pinnedTestimonials: {
              orderBy: { order: "asc" },
              include: {
                review: {
                  include: { author: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!member) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    return res.json({ success: true, message: "Editor carregado", data: member.company });
  } catch (err) {
    log.error({ err }, "getStorefrontEditor error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// SECTIONS
// ──────────────────────────────────────────────
const sectionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

export async function createSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const body = sectionSchema.safeParse(req.body);
  if (!body.success)
    return res
      .status(400)
      .json({ success: false, message: "Dados inválidos", data: body.error.flatten() });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.create({
      data: { ...body.data, companyId: member.companyId },
    });
    return res.status(201).json({ success: true, message: "Seção criada", data: section });
  } catch (err) {
    log.error({ err }, "createSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function updateSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId as string);
  const body = sectionSchema.partial().safeParse(req.body);
  if (!body.success)
    return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section)
      return res.status(404).json({ success: false, message: "Seção não encontrada" });

    const updated = await prisma.companyStorefrontSection.update({
      where: { id: sectionId },
      data: body.data,
    });
    return res.json({ success: true, message: "Seção atualizada", data: updated });
  } catch (err) {
    log.error({ err }, "updateSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function deleteSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId as string);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section)
      return res.status(404).json({ success: false, message: "Seção não encontrada" });

    await prisma.companyStorefrontSection.delete({ where: { id: sectionId } });
    return res.json({ success: true, message: "Seção removida" });
  } catch (err) {
    log.error({ err }, "deleteSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function addItemToSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId as string);
  const bodySchema = z.object({
    listingId: z.number().int(),
    order: z.number().int(),
    isFeatured: z.boolean().optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success)
    return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section)
      return res.status(404).json({ success: false, message: "Seção não encontrada" });

    const item = await prisma.companyStorefrontItem.create({
      data: { sectionId, ...body.data },
    });
    return res.status(201).json({ success: true, message: "Item adicionado", data: item });
  } catch (err) {
    log.error({ err }, "addItemToSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function removeItemFromSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId as string);
  const itemId = parseInt(req.params.itemId as string);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const item = await prisma.companyStorefrontItem.findFirst({
      where: { id: itemId, sectionId },
      include: { section: true },
    });
    if (!item || item.section.companyId !== member.companyId) {
      return res.status(404).json({ success: false, message: "Item não encontrado" });
    }

    await prisma.companyStorefrontItem.delete({ where: { id: itemId } });
    return res.json({ success: true, message: "Item removido" });
  } catch (err) {
    log.error({ err }, "removeItemFromSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// BLOCKS (HERO, ABOUT, TESTIMONIALS)
// ──────────────────────────────────────────────
const blockSchema = z.object({
  type: z.enum(["HERO", "ABOUT", "TESTIMONIALS"]),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
  content: z.record(z.string(), z.unknown()),
});

export async function upsertBlock(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const body = blockSchema.safeParse(req.body);
  if (!body.success)
    return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const existing = await prisma.companyStorefrontBlock.findFirst({
      where: { companyId: member.companyId, type: body.data.type },
    });

    const content = body.data.content as Prisma.InputJsonValue;
    let block;
    if (existing) {
      block = await prisma.companyStorefrontBlock.update({
        where: { id: existing.id },
        data: {
          type: body.data.type,
          order: body.data.order,
          isActive: body.data.isActive,
          content,
        },
      });
    } else {
      block = await prisma.companyStorefrontBlock.create({
        data: {
          companyId: member.companyId,
          type: body.data.type,
          order: body.data.order,
          isActive: body.data.isActive,
          content,
        },
      });
    }

    return res.json({ success: true, message: "Bloco salvo", data: block });
  } catch (err) {
    log.error({ err }, "upsertBlock error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// PINNED TESTIMONIALS
// ──────────────────────────────────────────────
export async function pinTestimonial(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const bodySchema = z.object({
    reviewId: z.number().int(),
    order: z.number().int().min(0),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success)
    return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const count = await prisma.companyPinnedTestimonial.count({
      where: { companyId: member.companyId },
    });
    if (count >= 6) {
      return res
        .status(400)
        .json({ success: false, message: "Máximo de 6 depoimentos fixados" });
    }

    const pinned = await prisma.companyPinnedTestimonial.create({
      data: { companyId: member.companyId, ...body.data },
    });
    return res.status(201).json({ success: true, message: "Depoimento fixado", data: pinned });
  } catch (err) {
    log.error({ err }, "pinTestimonial error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function unpinTestimonial(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const pinnedId = parseInt(req.params.pinnedId as string);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const pinned = await prisma.companyPinnedTestimonial.findFirst({
      where: { id: pinnedId, companyId: member.companyId },
    });
    if (!pinned)
      return res.status(404).json({ success: false, message: "Depoimento não encontrado" });

    await prisma.companyPinnedTestimonial.delete({ where: { id: pinnedId } });
    return res.json({ success: true, message: "Depoimento removido" });
  } catch (err) {
    log.error({ err }, "unpinTestimonial error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}
