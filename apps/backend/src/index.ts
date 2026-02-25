import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { env, isProduction } from "./config/env";
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
import companyInviteRoutes from "./routes/companyInviteRoutes";
import storefrontRoutes from "./routes/storefrontRoutes";
import { getPublicStorefront } from "./controllers/companyStorefrontController";
import locationRoutes from "./routes/locationRoutes";
import geocodingRoutes from "./routes/geocodingRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import mfaRoutes from "./routes/mfaRoutes";
import storageRoutes from "./routes/storageRoutes";
import { startScheduledTasks, stopScheduledTasks } from "./lib/scheduler";
import { scheduleDailySalaries, stopSalaryCron } from "./services/companyCronService";
import { startWorkers, stopWorkers } from "./workers";
import { closeAllQueues } from "./queues";
import { closeRedisConnection, isRedisHealthy, initRedisConnection } from "./queues/connection";
import { register, httpRequestDuration, httpRequestTotal, httpErrorsTotal } from "./lib/metrics";
import { QUEUE_NAMES, getQueueStatus, type QueueName } from "./queues/queues";
import { getCircuitBreakerStatus } from "./services/mercadopagoService";
import { initDatabaseConnection } from "./lib/prisma";

const app = express();
const httpServer = createServer(app);
const log = createLogger("server");

// ============================================
// REQUEST LOGGING
// ============================================

app.use(requestLogger);

// ============================================
// PROMETHEUS HTTP METRICS
// ============================================

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || "unknown";
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, durationMs);
    httpRequestTotal.inc(labels);
    if (res.statusCode >= 500) {
      httpErrorsTotal.inc({ method: req.method, route });
    }
  });
  next();
});

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

// Trust proxy (env-configurable for different deployment topologies)
app.set('trust proxy', env.TRUST_PROXY);
log.info({ trustProxy: env.TRUST_PROXY }, "Trust proxy configured");

if (isProduction && env.TRUST_PROXY === 0) {
  log.warn(
    "TRUST_PROXY is 0 in production. If behind a load balancer/reverse proxy, " +
    "set TRUST_PROXY to the number of proxy hops or a specific CIDR. " +
    "Without this, rate limiting uses proxy IP instead of client IP."
  );
}

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
// HEALTH PROBES & METRICS
// ============================================

// Root ping (no version/environment info leaked)
app.get("/", (_req, res) => {
  res.json({
    message: "FazTudo API",
    status: "OK",
  });
});

// Health probe authentication: localhost always allowed, external needs token
const healthAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

  if (isLocal) {
    next();
    return;
  }

  // Allow with auth token (for VPC/internal access)
  if (env.HEALTH_AUTH_TOKEN) {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${env.HEALTH_AUTH_TOKEN}`) {
      next();
      return;
    }
  }

  res.status(404).json({ success: false, message: "Not found" });
};

// Liveness — is the process alive? No dependency checks.
app.get("/health/live", healthAuthMiddleware, (_req, res) => {
  res.json({ status: "alive", timestamp: new Date().toISOString() });
});

// Readiness — can the service handle traffic?
app.get("/health/ready", healthAuthMiddleware, async (_req, res) => {
  const checks: Record<string, unknown> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis
  try {
    const healthy = await isRedisHealthy();
    checks.redis = healthy ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  // All 6 queues
  try {
    const queueNames: QueueName[] = [
      QUEUE_NAMES.NOTIFICATION, QUEUE_NAMES.EMAIL, QUEUE_NAMES.PAYMENT,
      QUEUE_NAMES.RECONCILIATION, QUEUE_NAMES.ANTI_FRAUD, QUEUE_NAMES.ESCROW,
    ];
    const queueStatuses = await Promise.all(
      queueNames.map(async (queueName) => {
        try {
          const status = await getQueueStatus(queueName);
          return status;
        } catch {
          return { name: queueName, error: true };
        }
      })
    );
    checks.queues = Object.fromEntries(
      queueStatuses.map((s) => [s.name, s])
    );
  } catch {
    checks.queues = "error";
  }

  // Circuit Breaker
  try {
    checks.circuitBreaker = getCircuitBreakerStatus();
  } catch {
    checks.circuitBreaker = "unknown";
  }

  const isReady = checks.database === "ok" && checks.redis === "ok";

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    ...checks,
    timestamp: new Date().toISOString(),
  });
});

// Startup — has initial setup completed? (checked once on boot)
let startupComplete = false;
app.get("/health/startup", healthAuthMiddleware, async (_req, res) => {
  if (startupComplete) {
    res.json({ status: "started", timestamp: new Date().toISOString() });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    startupComplete = true;
    res.json({ status: "started", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "starting", timestamp: new Date().toISOString() });
  }
});

// Backward compat: /health redirects to readiness probe
app.get("/health", healthAuthMiddleware, async (req, res) => {
  const checks: Record<string, unknown> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis
  try {
    const healthy = await isRedisHealthy();
    checks.redis = healthy ? "ok" : "error";
  } catch {
    checks.redis = "error";
  }

  const isHealthy = checks.database === "ok" && checks.redis === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    ...checks,
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint (protected by health auth)
app.get("/metrics", healthAuthMiddleware, async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch {
    res.status(500).end();
  }
});

// ============================================
// ROUTES
// ============================================

app.use("/api/auth", authRoutes);
app.use("/api/auth/mfa", mfaRoutes);
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
app.use("/api/storage", storageRoutes);
// More-specific /api/company/* sub-paths must be registered BEFORE the
// general /api/company router, otherwise Express will match the wildcard
// route (e.g. GET /storefront/:companyId) before the sub-routers.
// The public storefront route (GET /:companyId) is defined inside
// companyStorefrontRoutes and is registered first (before auth-protected routes).
app.use("/api/company/storefront", companyStorefrontRoutes);
app.use("/api/company/invite", companyInviteRoutes);
app.use("/api/company/members", companyMemberRoutes);
app.use("/api/company/salary", companySalaryRoutes);
app.use("/api/company/teams", companyTeamRoutes);
app.use("/api/company/channels", companyChannelRoutes);
app.use("/api/company", companyRoutes);
app.get("/api/storefront/:companyId", getPublicStorefront);
app.use("/api/storefronts", storefrontRoutes);

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
    stopSalaryCron();
    await stopScheduledTasks();
    await stopWorkers();
    await closeAllQueues();
    server.close(() => {
      log.info("HTTP server closed");
    });
    await prisma.$disconnect();
    await closeRedisConnection();
    log.info("Database and Redis connections closed");
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

const server = httpServer.listen(PORT, async () => {
  // Initialize database and Redis connections with fallback ports
  await initDatabaseConnection();
  await initRedisConnection();

  log.info({ port: PORT, env: env.NODE_ENV }, "Server started");
  await startScheduledTasks();
  scheduleDailySalaries();
  startWorkers();
});

export default app;
