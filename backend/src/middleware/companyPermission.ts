import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "./auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyPermission");

// e.g. "metrics.view", "team.manage"
type PermissionPath = string;

/**
 * Middleware: ensure the authenticated user has the COMPANY role and attach
 * their companyId (and companyMemberId, if they are a team member) to the request.
 *
 * The company owner (the User linked via CompanyProfile.userId) is always allowed;
 * they may or may not have a CompanyMember record.
 */
export const requireCompanyMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "COMPANY") {
      res.status(403).json({ success: false, message: "Acesso restrito a empresas" });
      return;
    }

    // Find the company profile owned by this user
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!companyProfile) {
      res.status(403).json({ success: false, message: "Empresa não encontrada" });
      return;
    }

    req.companyId = companyProfile.id;

    // Attach companyMemberId if this user also has a member record
    const member = await prisma.companyMember.findFirst({
      where: { companyId: companyProfile.id, userId: req.user.id, isActive: true },
    });

    if (member) {
      req.companyMemberId = member.id;
    }

    next();
  } catch (err) {
    log.error({ err }, "requireCompanyMember error");
    next(err);
  }
};

/**
 * Middleware factory: verify the user has a specific permission such as
 * "metrics.view" or "team.manage".
 *
 * Resolution order:
 *  1. Company owner (no member record OR owner's own userId on the profile) → always granted.
 *  2. Active member with customPermissions set → use customPermissions.
 *  3. Active member without customPermissions → use role.permissions.
 */
export const requireCompanyPermission = (permissionPath: PermissionPath) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "COMPANY") {
        res.status(403).json({ success: false, message: "Acesso restrito a empresas" });
        return;
      }

      const companyProfile = await prisma.companyProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (!companyProfile) {
        res.status(403).json({ success: false, message: "Empresa não encontrada" });
        return;
      }

      req.companyId = companyProfile.id;

      // Owner of the company always has full access
      if (companyProfile.userId === req.user.id) {
        // Still attach companyMemberId if they happen to also be a member
        const ownerMember = await prisma.companyMember.findFirst({
          where: { companyId: companyProfile.id, userId: req.user.id, isActive: true },
        });
        if (ownerMember) req.companyMemberId = ownerMember.id;
        next();
        return;
      }

      // For non-owner members, verify their permission
      const member = await prisma.companyMember.findFirst({
        where: { companyId: companyProfile.id, userId: req.user.id, isActive: true },
        include: { role: true },
      });

      if (!member) {
        res.status(403).json({
          success: false,
          message: "Usuário não é membro ativo desta empresa",
        });
        return;
      }

      req.companyMemberId = member.id;

      // Resolve permission: customPermissions takes priority over role permissions
      const permissionsSource =
        (member.customPermissions as Record<string, Record<string, boolean>> | null) ??
        (member.role.permissions as Record<string, Record<string, boolean>>);

      const parts = permissionPath.split(".");
      const section = parts[0];
      const action = parts[1];
      const hasPermission =
        section !== undefined && action !== undefined
          ? permissionsSource?.[section]?.[action] === true
          : false;

      if (!hasPermission) {
        log.warn(
          { userId: req.user.id, companyId: companyProfile.id, permissionPath },
          "Permission denied",
        );
        res.status(403).json({
          success: false,
          message: `Sem permissão: ${permissionPath}`,
        });
        return;
      }

      next();
    } catch (err) {
      log.error({ err }, "requireCompanyPermission error");
      next(err);
    }
  };
};

/**
 * Middleware: ensure the user is the owner of the company (not just a member).
 * Useful for sensitive operations like deleting the company or changing billing.
 */
export const requireCompanyOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "COMPANY") {
      res.status(403).json({ success: false, message: "Acesso restrito a empresas" });
      return;
    }

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!companyProfile) {
      res.status(403).json({ success: false, message: "Empresa não encontrada" });
      return;
    }

    // The owning User is the one whose id matches CompanyProfile.userId
    if (companyProfile.userId !== req.user.id) {
      res.status(403).json({
        success: false,
        message: "Apenas o proprietário pode realizar esta ação",
      });
      return;
    }

    req.companyId = companyProfile.id;
    next();
  } catch (err) {
    log.error({ err }, "requireCompanyOwner error");
    next(err);
  }
};
