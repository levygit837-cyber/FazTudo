import path from 'path';
import fs from 'fs';

// Load MercadoPago credentials from VARIAVEIS/.env.mp if it exists
const mpEnvPath = path.resolve(__dirname, '../../../VARIAVEIS/.env.mp');
if (fs.existsSync(mpEnvPath)) {
  const mpEnvContent = fs.readFileSync(mpEnvPath, 'utf8');
  for (const line of mpEnvContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

import 'dotenv/config';
import crypto from 'crypto';

import { createLogger } from "../lib/logger";

const log = createLogger("env");


export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // Database
  DATABASE_URL: string;

  // Redis
  REDIS_URL: string;

  // Authentication
  JWT_SECRET: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;

  // Security
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  AUTH_RATE_LIMIT_WINDOW_MS: number;
  AUTH_RATE_LIMIT_MAX_REQUESTS: number;
  BODY_SIZE_LIMIT: string;

  // Escrow System
  DEFAULT_ESCROW_HOLD_DAYS: number;
  ESCROW_AUTO_RELEASE_DAYS: number;
  PLATFORM_FEE_PERCENTAGE: number;

  // MercadoPago
  MP_ACCESS_TOKEN: string;
  MP_PUBLIC_KEY: string;
  MP_CLIENT_ID: string;
  MP_CLIENT_SECRET: string;
  MP_WEBHOOK_SECRET: string;
  MP_SANDBOX: boolean;

  // Notifications
  ENABLE_EMAIL_NOTIFICATIONS: boolean;

  // Email (SMTP)
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM_NAME: string;
  SMTP_FROM_EMAIL: string;

  // File Upload
  MAX_FILE_SIZE_MB: number;
  ALLOWED_FILE_TYPES: string[];

  // Frontend
  FRONTEND_URL: string;
  BACKEND_URL?: string;

  // Google Maps
  PLACES_API_KEY: string;

  // Development
  ENABLE_SWAGGER: boolean;
  ALLOW_LOCAL_PAYMENT_FALLBACK: boolean;
}

/**
 * Generate a random JWT secret for development only.
 * This ensures that even in dev, each server restart gets a unique secret,
 * preventing accidental use of a hardcoded known secret.
 */
function generateDevSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

function getEnvConfig(): EnvConfig {
  const nodeEnv = (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development';

  // JWT_SECRET: REQUIRED in production and staging. Random per-run in dev.
  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length === 0) {
    if (nodeEnv === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is required in production. ' +
        'Set a strong random secret (min 64 chars) via your deployment config.'
      );
    }
    jwtSecret = generateDevSecret();
    log.warn("⚠️  JWT_SECRET not set — generated random dev secret (tokens will invalidate on restart).");
  } else if (jwtSecret.length < 32) {
    if (nodeEnv === 'production') {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production.');
    }
    log.warn("⚠️  JWT_SECRET is too short. Use at least 32 characters for security.");
  }

  // JWT_ACCESS_SECRET / JWT_REFRESH_SECRET: falls back to JWT_SECRET for backward compatibility
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || jwtSecret;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;

  if (nodeEnv === 'production' && jwtAccessSecret === jwtRefreshSecret) {
    log.warn("⚠️  JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are the same. " +
      "Set different secrets in production for enhanced security.");
  }

  // CORS: REQUIRED specific origin in production
  const corsOrigin = process.env.CORS_ORIGIN || (nodeEnv === 'production' ? '' : 'http://localhost:5173');
  if (nodeEnv === 'production' && (!corsOrigin || corsOrigin === '*')) {
    throw new Error(
      'FATAL: CORS_ORIGIN must be set to specific origins in production (not "*"). ' +
      'Example: CORS_ORIGIN=https://faztudo.com.br,https://www.faztudo.com.br'
    );
  }

  const config: EnvConfig = {
    NODE_ENV: nodeEnv,
    PORT: parseInt(process.env.PORT || '3001', 10),

    // Database
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Authentication — reduced default expiry for security
    JWT_SECRET: jwtSecret,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

    // Security
    CORS_ORIGIN: corsOrigin,
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10),
    AUTH_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    AUTH_RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10', 10),
    BODY_SIZE_LIMIT: process.env.BODY_SIZE_LIMIT || '10kb',

    // Escrow System
    DEFAULT_ESCROW_HOLD_DAYS: parseInt(process.env.DEFAULT_ESCROW_HOLD_DAYS || '0', 10),
    ESCROW_AUTO_RELEASE_DAYS: parseInt(process.env.ESCROW_AUTO_RELEASE_DAYS || '0', 10),
    PLATFORM_FEE_PERCENTAGE: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10.0'),

    // MercadoPago
    MP_ACCESS_TOKEN: process.env.ACESS_TOKEN_MP || process.env.MP_ACCESS_TOKEN || '',
    MP_PUBLIC_KEY: process.env.PUBLIC_KEY_MP || process.env.MP_PUBLIC_KEY || '',
    MP_CLIENT_ID: process.env.CLIENT_ID || process.env.MP_CLIENT_ID || '',
    MP_CLIENT_SECRET: process.env.CLIENT_SECRET || process.env.MP_CLIENT_SECRET || '',
    MP_WEBHOOK_SECRET: (() => {
      if (process.env.NODE_ENV === 'production' && !process.env.MP_WEBHOOK_SECRET) {
        throw new Error(
          'FATAL: MP_WEBHOOK_SECRET must be set in production. '
          + 'Without it, webhook signatures cannot be verified and payments can be forged.'
        );
      }
      return process.env.MP_WEBHOOK_SECRET || '';
    })(),
    MP_SANDBOX: process.env.MP_SANDBOX !== 'false',

    // Notifications
    ENABLE_EMAIL_NOTIFICATIONS: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',

    // Email (SMTP)
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'FazTudo',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL ||
      (process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('FATAL: SMTP_FROM_EMAIL must be set in production'); })()
        : 'noreply@faztudo.local'),

    // File Upload
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    ALLOWED_FILE_TYPES: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf').split(','),

    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    BACKEND_URL: process.env.BACKEND_URL || undefined,

    // Google Maps
    PLACES_API_KEY: process.env.PLACES_API || '',

    // Development
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER === 'true',
    ALLOW_LOCAL_PAYMENT_FALLBACK: process.env.ALLOW_LOCAL_PAYMENT_FALLBACK === 'true',
  };

  return config;
}

export const env = getEnvConfig();

// Utilitário para verificar ambiente
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export default env;
