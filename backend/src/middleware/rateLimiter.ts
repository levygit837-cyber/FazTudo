import type { Request } from "express";
import rateLimit, { type Options, ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env';
import { getRedisConnection } from '../queues/connection';
import { createLogger } from '../lib/logger';
import type { AuthRequest } from "./auth";

const log = createLogger("rateLimiter");

/**
 * Creates a Redis-backed store for rate limiting.
 * Falls back to in-memory store if Redis is unavailable (logged as warning).
 */
function createRedisStore(prefix: string): { store?: Options["store"] } {
  try {
    const client = getRedisConnection();
    return {
      store: new RedisStore({
        // Use the existing IORedis connection
        sendCommand: (...args: string[]) => client.call(...args) as any,
        prefix: `rl:${prefix}:`,
      }),
    };
  } catch (err) {
    log.warn({ err, prefix }, "Redis unavailable for rate limiting — using in-memory store");
    return {};
  }
}

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
  ...createRedisStore("general"),
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
  ...createRedisStore("auth"),
  message: {
    success: false,
    message: 'Muitas tentativas de autenticacao. Tente novamente em 15 minutos.',
    statusCode: 429,
  },
});

/**
 * Very strict limiter for sensitive operations (password reset, etc).
 * Configurable via SENSITIVE_RATE_LIMIT_MAX (default: 5 per 15min).
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.SENSITIVE_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...createRedisStore("sensitive"),
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente mais tarde.',
    statusCode: 429,
  },
});

/**
 * Very strict limiter for financial operations (withdraw, payment release).
 * Configurable via FINANCIAL_RATE_LIMIT_MAX (default: 3 per 15min).
 */
export const financialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.FINANCIAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...createRedisStore("financial"),
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
  prefix: string = "user",
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
    ...createRedisStore(prefix),
    message: {
      success: false,
      message,
      statusCode: 429,
    },
  });

/**
 * User-based rate limiter for financial operations.
 * Configurable via FINANCIAL_RATE_LIMIT_MAX (default: 3 per 15min per user).
 */
export const userFinancialLimiter = createUserRateLimiter(
  env.FINANCIAL_RATE_LIMIT_MAX,
  15 * 60 * 1000,
  "Muitas operações financeiras. Tente novamente em 15 minutos.",
  "user-financial",
);

/**
 * User-based rate limiter for sensitive auth operations.
 * Configurable via SENSITIVE_RATE_LIMIT_MAX (default: 5 per 15min per user).
 */
export const userSensitiveLimiter = createUserRateLimiter(
  env.SENSITIVE_RATE_LIMIT_MAX,
  15 * 60 * 1000,
  "Muitas tentativas. Tente novamente mais tarde.",
  "user-sensitive",
);

/**
 * Rate limiter for webhook endpoints.
 * Configurable via WEBHOOK_RATE_LIMIT_MAX (default: 100 per minute per IP).
 * Prevents flood attacks while allowing legitimate burst traffic from payment providers.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.WEBHOOK_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...createRedisStore("webhook"),
  message: {
    success: false,
    message: "Too many webhook requests",
    statusCode: 429,
  },
});

/**
 * MFA-specific rate limiter.
 * Configurable via MFA_RATE_LIMIT_MAX (default: 5 per 15min per IP).
 * Prevents brute-forcing TOTP codes (10^6 space = 1M, 5 guesses is safe).
 */
export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.MFA_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...createRedisStore("mfa"),
  message: {
    success: false,
    message: "Muitas tentativas de MFA. Tente novamente em 15 minutos.",
    statusCode: 429,
  },
});
