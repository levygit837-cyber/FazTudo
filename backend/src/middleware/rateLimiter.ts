import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

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
