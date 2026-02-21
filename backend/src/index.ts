import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { env } from "./config/env";
import { initializeSocket } from "./lib/socket";
import prisma from "./lib/prisma";
import logger, { createLogger } from "./lib/logger";
import { requestLogger } from "./middleware/requestLog";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { generalLimiter } from "./middleware/rateLimiter";
import { verifyToken } from "./middleware/auth";
import { xssSanitizer } from "./middleware/sanitize";
import authRoutes from "./routes/authRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import orderRoutes from "./routes/orderRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import chatRoutes from "./routes/chatRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import proposalRoutes from "./routes/proposalRoutes";
import disputeRoutes from "./routes/disputeRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import adminRoutes from "./routes/adminRoutes";
import walletRoutes from "./routes/walletRoutes";
import companyRoutes from "./routes/companyRoutes";
import companyMemberRoutes from "./routes/companyMemberRoutes";
import companySalaryRoutes from "./routes/companySalaryRoutes";
import companyTeamRoutes from "./routes/companyTeamRoutes";
import companyChannelRoutes from "./routes/companyChannelRoutes";
import companyStorefrontRoutes from "./routes/companyStorefrontRoutes";
import { getPublicStorefront } from "./controllers/companyStorefrontController";
import locationRoutes from "./routes/locationRoutes";
import geocodingRoutes from "./routes/geocodingRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import { startScheduledTasks, stopScheduledTasks } from "./lib/scheduler";

const app = express();
const httpServer = createServer(app);
const log = createLogger("server");

// ============================================
// REQUEST LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet: sets various HTTP headers for security
// connectSrc inclui FRONTEND_URL para permitir que o SPA faça requests XHR/fetch para esta API
const frontendOrigins = env.CORS_ORIGIN === "*" ? [] : env.CORS_ORIGIN.split(",").map(o => o.trim());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      // Inclui origens do frontend e ws/wss para Socket.io
      connectSrc: [
        "'self'",
        ...frontendOrigins,
        // ws/wss para Socket.io em dev e prod
        ...frontendOrigins.map(o => o.replace(/^http/, "ws")),
        "ws://localhost:3001",
        "wss://localhost:3001",
        "ws:",
        "wss:",
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));

// Trust first proxy (needed for rate limiter behind reverse proxy)
app.set('trust proxy', 1);

// Serve uploaded files BEFORE rate limiter (static files should not count)
// Chat uploads require authentication (may contain sensitive documents)
app.use("/uploads/chat", verifyToken, express.static(path.join(process.cwd(), "uploads", "chat")));
// Non-chat uploads remain publicly accessible
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// 1. CORS — DEVE vir antes do rate limiter para que 429 também tenha CORS headers
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Cache-Control e Pragma são adicionados pelo interceptor do Axios em GETs
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Cache-Control', 'Pragma'],
  }),
);

// 2. Rate limiter (após CORS para que 429 tenha Access-Control-Allow-Origin)
app.use(generalLimiter);

// Body parsing with size limits
app.use(express.json({ limit: env.BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.BODY_SIZE_LIMIT }));

// Cookie parser for httpOnly JWT cookies
app.use(cookieParser());

// XSS sanitization for all incoming data
app.use(xssSanitizer);

// ============================================
// HEALTH CHECKS
// ============================================

// Root ping (no version/environment info leaked)
app.get("/", (_req, res) => {
  res.json({
    message: "FazTudo API",
    status: "OK",
  });
});

// Protect health endpoint - internal use only
const localOnlyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocal) {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }
  next();
};

// Database Health Check (localhost only)
app.get("/health", localOnlyMiddleware, async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// ROUTES
// ============================================

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);           // Listings + briefs
app.use("/api/services", orderRoutes);             // Orders (pedidos)
app.use("/api/services", paymentRoutes);           // Payments (webhook, config, order payments)
app.use("/api/services", chatRoutes);              // Chats + messages
app.use("/api/services", reviewRoutes);            // Reviews
app.use("/api/services", proposalRoutes);          // Proposals
app.use("/api/services", disputeRoutes);           // Disputes
app.use("/api/services", scheduleRoutes);          // Schedule / calendar
app.use("/api/services", notificationRoutes);      // Notifications
app.use("/api/services", recommendationRoutes);    // Recommendations
app.use("/api/services", locationRoutes);          // Location tracking
app.use("/api/geocoding", geocodingRoutes);         // Geocoding & directions proxy
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/company/members", companyMemberRoutes);
app.use("/api/company/salary", companySalaryRoutes);
app.use("/api/company/teams", companyTeamRoutes);
app.use("/api/company/channels", companyChannelRoutes);
app.get("/api/storefront/:companyId", getPublicStorefront);
app.use("/api/company/storefront", companyStorefrontRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN (single handler set)
// ============================================

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, "Shutting down gracefully...");
  try {
    stopScheduledTasks();
    server.close(() => {
      log.info("HTTP server closed");
    });
    await prisma.$disconnect();
    log.info("Database connection closed");
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  log.fatal({ err: error }, "Uncaught Exception");
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  log.fatal({ err: reason, promise }, "Unhandled Rejection");
  gracefulShutdown("UNHANDLED_REJECTION");
});

// ============================================
// START SERVER
// ============================================

const PORT = env.PORT;

// Initialize Socket.io before starting server
initializeSocket(httpServer);

const server = httpServer.listen(PORT, () => {
  log.info({ port: PORT, env: env.NODE_ENV }, "Server started");
  startScheduledTasks();
});

export default app;
