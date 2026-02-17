// backend/src/controllers/companyController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyController");

/** GET /api/company/profile */
export async function getCompanyProfile(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const profile = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } } },
    });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    return res.json({ success: true, message: "Perfil obtido", data: profile });
  } catch (err) {
    log.error({ err }, "getCompanyProfile error");
    throw err;
  }
}

/** PUT /api/company/profile */
export async function updateCompanyProfile(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const { companyName, description, logo, coverImage, website, phone, address, industry, foundedAt } = req.body;
    const updated = await prisma.companyProfile.update({
      where: { id: companyId },
      data: { companyName, description, logo, coverImage, website, phone, address, industry, foundedAt: foundedAt ? new Date(foundedAt) : undefined },
    });
    return res.json({ success: true, message: "Perfil atualizado", data: updated });
  } catch (err) {
    log.error({ err }, "updateCompanyProfile error");
    throw err;
  }
}

/** GET /api/company/storefront/:companyId — public */
export async function getCompanyStorefront(req: AuthRequest, res: Response) {
  try {
    const { companyId } = req.params;
    const profile = await prisma.companyProfile.findUnique({
      where: { id: Number(companyId) },
      include: {
        user: {
          select: {
            id: true, name: true, profileImage: true, ratingAverage: true, totalReviews: true,
            serviceListings: {
              where: { isAvailable: true },
              include: { category: true },
              take: 20,
            },
          },
        },
      },
    });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    return res.json({ success: true, message: "Vitrine obtida", data: profile });
  } catch (err) {
    log.error({ err }, "getCompanyStorefront error");
    throw err;
  }
}

/** GET /api/company/dashboard */
export async function getCompanyDashboard(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const profile = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { userId: true } });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const [totalOrders, pendingOrders, inProgressOrders, completedOrders, totalServices, totalMembers, wallet] =
      await Promise.all([
        prisma.serviceOrder.count({ where: { professionalId: profile.userId } }),
        prisma.serviceOrder.count({ where: { professionalId: profile.userId, status: "PENDING" } }),
        prisma.serviceOrder.count({ where: { professionalId: profile.userId, status: "IN_PROGRESS" } }),
        prisma.serviceOrder.count({ where: { professionalId: profile.userId, status: "COMPLETED" } }),
        prisma.serviceListing.count({ where: { professionalId: profile.userId } }),
        prisma.companyMember.count({ where: { companyId } }),
        prisma.user.findUnique({ where: { id: profile.userId }, select: { balance: true } }),
      ]);

    return res.json({
      success: true,
      message: "Dashboard obtido",
      data: { totalOrders, pendingOrders, inProgressOrders, completedOrders, totalServices, totalMembers, availableBalance: wallet?.balance ?? 0 },
    });
  } catch (err) {
    log.error({ err }, "getCompanyDashboard error");
    throw err;
  }
}
