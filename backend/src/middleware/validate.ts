import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createLogger } from '../lib/logger';

const log = createLogger('validate');

/**
 * Extract structured errors from a Zod v4 error.
 */
function extractErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (sanitized) data.
 * On failure, returns 400 with structured error messages.
 */
export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.body = result.data;
      next();
    } else {
      const errors = extractErrors(result.error);
      log.warn({ body: req.body, errors, path: req.path }, 'Body validation failed');
      res.status(400).json({
        success: false,
        message: 'Erro de validacao',
        errors,
        statusCode: 400,
      });
    }
  };
}

/**
 * Express middleware factory that validates req.query against a Zod schema.
 * On success, attaches validated data to req.validatedQuery.
 */
export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (result.success) {
      (req as any).validatedQuery = result.data;
      next();
    } else {
      const errors = extractErrors(result.error);
      res.status(400).json({
        success: false,
        message: 'Parametros de consulta invalidos',
        errors,
        statusCode: 400,
      });
    }
  };
}

/**
 * Express middleware factory that validates req.params against a Zod schema.
 */
export function validateParams<T extends Record<string, string>>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (result.success) {
      req.params = result.data;
      next();
    } else {
      const errors = extractErrors(result.error);
      res.status(400).json({
        success: false,
        message: 'Parametros invalidos',
        errors,
        statusCode: 400,
      });
    }
  };
}
