import { Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";

const log = createLogger("companyInvite");

const INVITE_TTL_HOURS = 48;

const generateInviteSchema = z.object({
  role: z.string().optional(),
});

// POST /api/company/invite/generate
// Requires: verifyToken + requireCompanyPermission("team.invite")
// The companyPermission middleware populates req.companyId for us.
export async function generateInviteLink(req: AuthRequest, res: Response) {
  const parsed = generateInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Dados inválidos" });
  }

  try {
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    const token = randomUUID();

    const invite = await prisma.companyInviteToken.create({
      data: {
        companyId: req.companyId!,
        token,
        role: parsed.data.role ?? "MEMBER",
        createdById: req.user!.id,
        expiresAt,
      },
    });

    const link = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/invite/${invite.token}`;

    log.info({ companyId: req.companyId, userId: req.user!.id }, "Invite link generated");

    return res.status(201).json({
      success: true,
      message: "Link de convite gerado",
      data: { token: invite.token, link, expiresAt: invite.expiresAt },
    });
  } catch (err) {
    log.error({ err }, "generateInviteLink error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// GET /api/company/invite/:token  — public, no auth required
export async function validateInviteToken(req: Request, res: Response) {
  const token = String(req.params.token);

  try {
    const invite = await prisma.companyInviteToken.findUnique({
      where: { token },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            logo: true,
            user: { select: { name: true, profileImage: true } },
          },
        },
      },
    });

    if (!invite) {
      return res.status(404).json({ success: false, message: "Convite não encontrado" });
    }
    if (invite.usedAt) {
      return res.status(410).json({ success: false, message: "Convite já utilizado" });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: "Convite expirado" });
    }

    return res.json({
      success: true,
      message: "Convite válido",
      data: {
        company: invite.company,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    log.error({ err }, "validateInviteToken error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// POST /api/company/invite/:token/accept  — requires verifyToken
export async function acceptInvite(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const token = String(req.params.token);

  try {
    const invite = await prisma.companyInviteToken.findUnique({
      where: { token },
    });

    if (!invite) {
      return res.status(404).json({ success: false, message: "Convite não encontrado" });
    }
    if (invite.usedAt) {
      return res.status(410).json({ success: false, message: "Convite já utilizado" });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: "Convite expirado" });
    }

    // Check if the user is already a member of this company
    const existing = await prisma.companyMember.findFirst({
      where: { companyId: invite.companyId, userId },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Você já é membro desta empresa" });
    }

    // Resolve roleId: try to find a CompanyRole whose name matches the invite's role string
    // (case-insensitive via JS since SQLite doesn't support mode:"insensitive").
    // Fall back to the highest-level (lowest-privilege) role in the company.
    const allRoles = await prisma.companyRole.findMany({
      where: { companyId: invite.companyId },
      orderBy: { level: "desc" }, // highest level number = lowest privilege
    });

    if (allRoles.length === 0) {
      log.error({ companyId: invite.companyId }, "No roles found for company; cannot accept invite");
      return res.status(422).json({
        success: false,
        message: "A empresa não possui cargos configurados. Contate o administrador.",
      });
    }

    const matchingRole =
      allRoles.find((r) => r.name.toLowerCase() === invite.role.toLowerCase()) ?? allRoles[0]!;

    // Atomically create the member record and mark the token as used
    const [member] = await prisma.$transaction([
      prisma.companyMember.create({
        data: {
          companyId: invite.companyId,
          userId,
          roleId: matchingRole.id,
          isActive: true,
        },
        include: {
          role: { select: { id: true, name: true, level: true } },
          company: { select: { id: true, companyName: true, logo: true } },
        },
      }),
      prisma.companyInviteToken.update({
        where: { token },
        data: { usedById: userId, usedAt: new Date() },
      }),
    ]);

    log.info(
      { companyId: invite.companyId, userId, roleId: matchingRole.id, roleName: matchingRole.name },
      "User joined company via invite link",
    );

    return res.json({
      success: true,
      message: "Você entrou na empresa!",
      data: { companyId: invite.companyId, member },
    });
  } catch (err) {
    log.error({ err }, "acceptInvite error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}
