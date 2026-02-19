import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';
import type { AuthRequest } from "./auth";

/**
 * General API rate limiter.
 * 500 req/15min — generous enough for SPAs with periodic polling
 * (chat 5s, notifications 60s, location 5s can consume ~375 req/15min).
 * Per-route limiters handle sensitive endpoints separately.
 * OPTIONS (CORS preflight) requests are skipped to avoid double-counting.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Muitas requisicoes. Tente novamente mais tarde.',
    statusCode: 429,
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute-force login / registration attacks.
 */
export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Muitas tentativas de autenticacao. Tente novamente em 15 minutos.',
    statusCode: 429,
  },
});

/**
 * Very strict limiter for sensitive operations (password reset, etc).
 * 5 requests per 15 minutes.
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente mais tarde.',
    statusCode: 429,
  },
});

/**
 * Very strict limiter for financial operations (withdraw, payment release).
 * 3 requests per 15 minutes per IP.
 */
export const financialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Muitas operacoes financeiras. Tente novamente em 15 minutos.',
    statusCode: 429,
  },
});

/**
 * Rate limiter by authenticated userId (not by IP).
 * Immune to X-Forwarded-For manipulation since it uses the JWT identity.
 * Use in addition to IP-based limiters for sensitive authenticated endpoints.
 */
export const createUserRateLimiter = (
  maxRequests: number,
  windowMs: number,
  message: string = "Muitas requisições. Tente novamente mais tarde.",
) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthRequest;
      // Falls back to IP if user not authenticated (uses ipKeyGenerator for IPv6 safety)
      return authReq.user ? `user:${authReq.user.id}` : ipKeyGenerator(req.ip ?? "unknown");
    },
    message: {
      success: false,
      message,
      statusCode: 429,
    },
  });

/**
 * User-based rate limiter for financial operations.
 * 3 operations per 15 minutes per user (not per IP).
 */
export const userFinancialLimiter = createUserRateLimiter(
  3,
  15 * 60 * 1000,
  "Muitas operações financeiras. Tente novamente em 15 minutos.",
);

/**
 * User-based rate limiter for sensitive auth operations.
 * 5 operations per 15 minutes per user.
 */
export const userSensitiveLimiter = createUserRateLimiter(
  5,
  15 * 60 * 1000,
  "Muitas tentativas. Tente novamente mais tarde.",
);
