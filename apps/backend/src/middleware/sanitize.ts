import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Recursively sanitize all string values in an object to prevent XSS.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Mutate object values in-place by sanitizing each string property.
 * This avoids reassigning read-only properties (Express 5 req.query/req.params).
 */
function sanitizeInPlace(obj: Record<string, any>): void {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = xss(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map(sanitizeValue);
    } else if (obj[key] !== null && typeof obj[key] === "object") {
      sanitizeInPlace(obj[key]);
    }
  }
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * against XSS attacks. Compatible with Express 5 (read-only query/params).
 */
export const xssSanitizer = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // req.body is mutable — safe to reassign
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  // req.query is read-only in Express 5 — mutate values in-place
  if (req.query && typeof req.query === "object") {
    sanitizeInPlace(req.query as Record<string, any>);
  }
  // req.params is read-only in Express 5 — mutate values in-place
  if (req.params && typeof req.params === "object") {
    sanitizeInPlace(req.params as Record<string, any>);
  }
  next();
};
