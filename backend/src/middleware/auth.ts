import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { env } from "../config/env";
import prisma from "../lib/prisma";

import { createLogger } from "../lib/logger";

const log = createLogger("auth");


// Tipos estendidos para Request
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    status: string;
  };
}

// Interface para payload do JWT
export interface JwtPayload {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  tokenVersion: number;
}

// Middleware de verificação de token
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "Token de autorização não fornecido",
      });
      return;
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Formato de token inválido",
      });
      return;
    }

    // Verificar token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Buscar usuário no banco de dados
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isVerified: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Usuário não encontrado",
      });
      return;
    }

    if (user.status !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "Conta não está ativa",
      });
      return;
    }

    // Verify token version matches (invalidated on password change)
    if (user.tokenVersion !== decoded.tokenVersion) {
      res.status(401).json({
        success: false,
        message: "Token invalidado. Faça login novamente.",
      });
      return;
    }

    // Adicionar usuário à requisição
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expirado",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Token inválido",
      });
      return;
    }

    log.error({ err: error }, "Erro na verificação de token");
    res.status(500).json({
      success: false,
      message: "Erro interno na autenticação",
    });
  }
};

// Middleware para verificar roles específicas
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Permissão insuficiente para acessar este recurso",
      });
      return;
    }

    next();
  };
};

// Middleware para verificar se é o próprio usuário ou admin
export const requireSelfOrAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Usuário não autenticado",
    });
    return;
  }

  const userId = parseInt(String(req.params.id), 10);

  // Se for admin ou o próprio usuário, permite
  if (req.user.role === "ADMIN" || req.user.id === userId) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: "Permissão insuficiente para acessar este recurso",
  });
};

// Middleware para verificar se é profissional ou admin
export const requireProfessionalOrAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Usuário não autenticado",
    });
    return;
  }

  if (req.user.role === "PROFESSIONAL" || req.user.role === "ADMIN") {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message:
      "Apenas profissionais ou administradores podem acessar este recurso",
  });
};

// Gerar token JWT
export const generateToken = (user: {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  tokenVersion: number;
}): string => {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    tokenVersion: user.tokenVersion,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

// Gerar refresh token (longa duração)
export const generateRefreshToken = (user: {
  id: number;
  email: string;
}): string => {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};

// Hash de senha
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

// Comparar senha
export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Middleware para verificar se usuário está verificado
export const requireVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Usuário não autenticado",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isVerified: true },
    });

    if (!user || !user.isVerified) {
      res.status(403).json({
        success: false,
        message: "Conta não verificada. Verifique seu e-mail.",
      });
      return;
    }

    next();
  } catch (error) {
    log.error({ err: error }, "Erro ao verificar status do usuário");
    res.status(500).json({
      success: false,
      message: "Erro interno ao verificar conta",
    });
  }
};

// Middleware para logar requisições de autenticação
export const authLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();

  // Rotas publicas conhecidas que nao precisam de autenticacao
  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ];
  const isPublicRoute = publicPaths.some(
    (p) => req.path === p || req.path.endsWith(p),
  );

  log.debug({ method: req.method, path: req.path }, "Request started");

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    // Resolve userInfo here, AFTER verifyToken has had a chance to populate req.user
    const userFields = req.user
      ? { userId: req.user.id, userRole: req.user.role }
      : { userId: null as null, userRole: isPublicRoute ? "[Public]" : "[Unauthenticated]" };

    log.info(
      { ...userFields, method: req.method, path: req.path, statusCode: res.statusCode, duration },
      "Request completed",
    );
  });

  next();
};

// Middleware de erro de autenticação
export const handleAuthError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    res.status(401).json({
      success: false,
      message: "Token de autenticação inválido ou expirado",
    });
    return;
  }

  log.error({ err: error }, "Erro não tratado em autenticação");
  res.status(500).json({
    success: false,
    message: "Erro interno no servidor de autenticação",
  });
};

// Exports úteis
export default {
  verifyToken,
  requireRole,
  requireSelfOrAdmin,
  requireProfessionalOrAdmin,
  generateToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  requireVerified,
  authLogger,
  handleAuthError,
};
