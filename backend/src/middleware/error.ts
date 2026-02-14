import { Request, Response, NextFunction } from "express";
import { isDevelopment } from "../config/env";
import { Prisma } from "@prisma/client";

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = "Validation error",
    public errors?: any[],
  ) {
    super(message, 400);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// Prisma error handling
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
): AppError => {
  switch (error.code) {
    case "P2002":
      const field = (error.meta?.target as string[])?.join(", ") || "field";
      return new ConflictError(`A record with this ${field} already exists`);
    case "P2025":
      return new NotFoundError("Record not found");
    case "P2003":
      return new ValidationError("Foreign key constraint failed");
    case "P2016":
      return new ValidationError("Query interpretation error");
    case "P2000":
      return new ValidationError(
        "The provided value is too long for the column",
      );
    case "P2001":
      return new NotFoundError("The record searched for does not exist");
    case "P2004":
      return new ValidationError("A constraint failed on the database");
    case "P2005":
      return new ValidationError("Invalid value stored in database");
    default:
      return new AppError(`Database error: ${error.code}`, 500);
  }
};

// JWT error handling
const handleJwtError = (error: any): AppError => {
  if (error.name === "JsonWebTokenError") {
    return new AuthenticationError("Invalid token");
  }
  if (error.name === "TokenExpiredError") {
    return new AuthenticationError("Token expired");
  }
  return new AuthenticationError("Authentication error");
};

// Error response formatter
interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  stack?: string;
  errors?: any[];
  timestamp?: string;
}

const sendErrorResponse = (
  res: Response,
  error: AppError | Error,
  stack?: string,
): void => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error.message || "Internal server error";
  const isOperational = error instanceof AppError ? error.isOperational : false;

  const response: ErrorResponse = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (isDevelopment && stack) {
    response.stack = stack;
  }

  // Include validation errors if available
  if (error instanceof ValidationError && error.errors) {
    response.errors = error.errors;
  }

  res.status(statusCode).json(response);

  // Log error (except for operational errors in production, or always in development)
  if (!isOperational || isDevelopment) {
    logError(error, { statusCode, isOperational });
  }
};

// Global error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let processedError: AppError;

  // Handle known error types
  if (error instanceof AppError) {
    processedError = error;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    processedError = handlePrismaError(error);
  } else if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    processedError = handleJwtError(error);
  } else if (error.name === "ValidationError" && (error as any).errors) {
    // Handle express-validator or similar validation errors
    processedError = new ValidationError(error.message, (error as any).errors);
  } else {
    // Unknown error - mark as non-operational
    processedError = new AppError(
      error.message || "Internal server error",
      500,
      false,
    );
  }

  sendErrorResponse(res, processedError, error.stack);
};

// 404 handler middleware
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper for controllers
export const asyncHandler = <T extends Function>(fn: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error logging utility
export const logError = (error: Error, context?: any): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "ERROR",
    message: error.message,
    stack: error.stack,
    context,
  };

  console.error(JSON.stringify(logEntry, null, isDevelopment ? 2 : 0));

  // In production, you could send to external monitoring service
  // if (isProduction) {
  //   // Example: Sentry.captureException(error, { extra: context });
  // }
};

// Request validation error handler (for express-validator or similar)
export const validationErrorHandler = (errors: any[]): ValidationError => {
  return new ValidationError("Validation failed", errors);
};

// Utility to throw specific errors
export const throwError = {
  notFound: (message?: string) => {
    throw new NotFoundError(message);
  },
  validation: (message?: string, errors?: any[]) => {
    throw new ValidationError(message, errors);
  },
  authentication: (message?: string) => {
    throw new AuthenticationError(message);
  },
  authorization: (message?: string) => {
    throw new AuthorizationError(message);
  },
  conflict: (message?: string) => {
    throw new ConflictError(message);
  },
  rateLimit: (message?: string) => {
    throw new RateLimitError(message);
  },
  internal: (message?: string) => {
    throw new AppError(message || "Internal server error", 500, false);
  },
};

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  logError,
  validationErrorHandler,
  throwError,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};
