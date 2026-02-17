# Admin Panel SPA — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete admin panel as a separate React SPA (`admin/`) with sidebar navigation, real-time metrics dashboard, user management, document verification, traffic analytics, dispute resolution, and platform settings.

**Architecture:** Separate Vite+React SPA in `admin/` directory, sharing the same backend API (port 3001). Backend gets new Prisma models (UserSession, PageView), new endpoints for stats/traffic/disputes/config, and a dedicated admin login endpoint. Frontend tracking integrated into the main `frontend/` app to collect session/pageview data.

**Tech Stack:** React 18 + TypeScript + Vite (port 5174), TailwindCSS 3, Recharts, Lucide React, Axios

---

## Phase 1: Backend Foundation (Prisma + Tracking + CORS)

### Task 1: Add UserSession and PageView models to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add the UserSession model after the existing User model relations**

Add to `backend/prisma/schema.prisma`, inside the `User` model, a new relation:
```prisma
sessions      UserSession[]
```

Then add the new models at the end of the file:
```prisma
model UserSession {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  startedAt   DateTime   @default(now())
  endedAt     DateTime?
  duration    Int?
  pagesViewed Int        @default(0)
  device      String?
  pageViews   PageView[]
  createdAt   DateTime   @default(now())

  @@index([userId])
  @@index([startedAt])
}

model PageView {
  id        String      @id @default(uuid())
  sessionId String
  session   UserSession @relation(fields: [sessionId], references: [id])
  path      String
  enteredAt DateTime    @default(now())
  duration  Int?

  @@index([sessionId])
  @@index([path])
  @@index([enteredAt])
}
```

**Step 2: Push the schema to the database**

Run: `cd backend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Verify the Prisma client regenerated**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add UserSession and PageView models for analytics tracking"
```

---

### Task 2: Update CORS to allow admin SPA origin

**Files:**
- Modify: `backend/.env` (add admin origin)
- Modify: `backend/.env.example` (document new pattern)

**Step 1: Update .env CORS_ORIGIN to include admin port**

In `backend/.env`, change:
```
CORS_ORIGIN=http://localhost:5173
```
To:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

The backend already supports comma-separated origins: `env.CORS_ORIGIN.split(",")` in `src/index.ts` line 85.

**Step 2: Update .env.example similarly**

**Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "feat: add admin SPA origin to CORS config"
```

---

### Task 3: Create session tracking routes and controller

**Files:**
- Create: `backend/src/controllers/sessionController.ts`
- Create: `backend/src/routes/sessionRoutes.ts`
- Modify: `backend/src/index.ts` (register new routes)

**Step 1: Create the session controller**

Create `backend/src/controllers/sessionController.ts`:
```typescript
import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("sessionController");

const successResponse = (data: unknown, message: string) => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string) => ({
  success: false,
  message,
});

/**
 * Parse User-Agent to determine device type
 */
function detectDevice(userAgent: string | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * POST /api/sessions/start
 * Start a new tracking session
 */
export const startSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const device = detectDevice(req.headers["user-agent"]);

    const session = await prisma.userSession.create({
      data: {
        userId: req.user.id,
        device,
      },
      select: { id: true, startedAt: true, device: true },
    });

    res.status(201).json(successResponse({ session }, "Session started"));
  } catch (error) {
    log.error({ err: error }, "Failed to start session");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * PATCH /api/sessions/:id/heartbeat
 * Update session heartbeat (keeps duration accurate)
 */
export const heartbeat = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { id } = req.params;

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true, startedAt: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const duration = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000
    );

    await prisma.userSession.update({
      where: { id },
      data: { duration },
    });

    res.status(200).json(successResponse({ duration }, "Heartbeat recorded"));
  } catch (error) {
    log.error({ err: error }, "Failed to record heartbeat");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * PATCH /api/sessions/:id/end
 * End a session
 */
export const endSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { id } = req.params;

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true, startedAt: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const duration = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000
    );

    const pageViewCount = await prisma.pageView.count({
      where: { sessionId: id },
    });

    await prisma.userSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        duration,
        pagesViewed: pageViewCount,
      },
    });

    res.status(200).json(successResponse({ duration }, "Session ended"));
  } catch (error) {
    log.error({ err: error }, "Failed to end session");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * POST /api/sessions/:id/pageview
 * Record a page view within a session
 */
export const recordPageView = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { id } = req.params;
    const { path: pagePath, duration } = req.body;

    if (!pagePath || typeof pagePath !== "string") {
      res.status(400).json(errorResponse("Path is required"));
      return;
    }

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const pageView = await prisma.pageView.create({
      data: {
        sessionId: id,
        path: pagePath,
        duration: typeof duration === "number" ? duration : undefined,
      },
      select: { id: true, path: true, enteredAt: true },
    });

    res.status(201).json(successResponse({ pageView }, "Page view recorded"));
  } catch (error) {
    log.error({ err: error }, "Failed to record page view");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 2: Create the session routes**

Create `backend/src/routes/sessionRoutes.ts`:
```typescript
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as sessionController from "../controllers/sessionController";

const router = Router();

// All session routes require authentication
router.use(verifyToken);

router.post("/start", sessionController.startSession);
router.patch("/:id/heartbeat", sessionController.heartbeat);
router.patch("/:id/end", sessionController.endSession);
router.post("/:id/pageview", sessionController.recordPageView);

export default router;
```

**Step 3: Register routes in index.ts**

Add import at top of `backend/src/index.ts`:
```typescript
import sessionRoutes from "./routes/sessionRoutes";
```

Add route registration after the existing `app.use("/api/admin", adminRoutes);` line:
```typescript
app.use("/api/sessions", sessionRoutes);
```

**Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/controllers/sessionController.ts backend/src/routes/sessionRoutes.ts backend/src/index.ts
git commit -m "feat: add session tracking endpoints for analytics"
```

---

### Task 4: Add admin login endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Add admin login Zod schema to validation.ts**

Add to `backend/src/middleware/validation.ts`:
```typescript
export const adminLoginSchema = z.object({
  email: z.email({ error: "Email invalido" }),
  password: z.string().min(1, "Senha obrigatoria"),
});
```

**Step 2: Add adminLogin controller function**

Add to `backend/src/controllers/adminController.ts`:
```typescript
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const adminLogin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        status: true,
        isVerified: true,
        tokenVersion: true,
        profileImage: true,
      },
    });

    if (!user) {
      res.status(401).json(errorResponse("Credenciais invalidas"));
      return;
    }

    if (user.role !== "ADMIN") {
      log.warn({ email }, "Non-admin attempted admin login");
      res.status(403).json(errorResponse("Acesso nao autorizado"));
      return;
    }

    if (user.status !== "ACTIVE") {
      res.status(403).json(errorResponse("Conta suspensa ou inativa"));
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json(errorResponse("Credenciais invalidas"));
      return;
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    const { password: _, ...userData } = user;

    res.status(200).json(
      successResponse(
        {
          user: userData,
          token,
          refreshToken,
        },
        "Login realizado com sucesso"
      )
    );
  } catch (error) {
    log.error({ err: error }, "Admin login failed");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 3: Add admin login route BEFORE the router.use(verifyToken) line**

In `backend/src/routes/adminRoutes.ts`, add the login route BEFORE the `router.use(verifyToken, requireRole("ADMIN"))` line:
```typescript
import { validateBody } from "../middleware/validate";
import { adminLoginSchema } from "../middleware/validation";

// Public admin login (no auth required)
router.post("/login", validateBody(adminLoginSchema), adminController.adminLogin);

// All routes below require admin auth
router.use(verifyToken, requireRole("ADMIN"));
```

**Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts backend/src/middleware/validation.ts
git commit -m "feat: add dedicated admin login endpoint"
```

---

### Task 5: Add admin stats dashboard endpoint with real time-series data

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`

**Step 1: Add the dashboard stats controller function**

Add to `backend/src/controllers/adminController.ts`:
```typescript
export const getDashboardStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const period = parseInt(String(req.query.period || "30"), 10);
    const now = new Date();
    const startDate = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);

    // Current period queries
    const [
      completedOrders,
      previousCompletedOrders,
      currentPayments,
      previousPayments,
      newUsers,
      previousNewUsers,
      currentOrderValues,
      previousOrderValues,
      // Time series data
      dailyUsers,
      dailyPayments,
      // Funnel data
      totalUsers,
      usersWithOrders,
      usersWithCompletedOrders,
      // Top categories
      categoryStats,
      // Timing metrics
      allOrders,
      // Rates
      cancelledOrders,
      disputedOrders,
      totalMessages,
    ] = await Promise.all([
      // KPI: Completed orders in period
      prisma.serviceOrder.count({
        where: { status: "COMPLETED", updatedAt: { gte: startDate } },
      }),
      prisma.serviceOrder.count({
        where: { status: "COMPLETED", updatedAt: { gte: previousStart, lt: startDate } },
      }),
      // KPI: Payments released in period
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: startDate } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: previousStart, lt: startDate } },
        select: { amount: true },
      }),
      // KPI: New users
      prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: previousStart, lt: startDate } },
      }),
      // KPI: Order values for ticket medio
      prisma.serviceOrder.findMany({
        where: { status: "COMPLETED", updatedAt: { gte: startDate } },
        select: { totalAmount: true },
      }),
      prisma.serviceOrder.findMany({
        where: { status: "COMPLETED", updatedAt: { gte: previousStart, lt: startDate } },
        select: { totalAmount: true },
      }),
      // Time series: daily new users
      prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // Time series: daily payments
      prisma.payment.findMany({
        where: { status: "RELEASED", updatedAt: { gte: startDate } },
        select: { amount: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
      }),
      // Funnel
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.user.count({
        where: {
          createdAt: { gte: startDate },
          serviceOrders: { some: {} },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: { gte: startDate },
          serviceOrders: { some: { status: "COMPLETED" } },
        },
      }),
      // Top categories
      prisma.serviceCategory.findMany({
        select: {
          id: true,
          name: true,
          serviceListings: {
            select: {
              serviceOrders: {
                where: { status: "COMPLETED", updatedAt: { gte: startDate } },
                select: { totalAmount: true },
              },
            },
          },
        },
      }),
      // All orders in period (for timing)
      prisma.serviceOrder.findMany({
        where: { createdAt: { gte: startDate } },
        select: { status: true, createdAt: true, updatedAt: true },
      }),
      // Cancelled
      prisma.serviceOrder.count({
        where: { status: "CANCELLED", updatedAt: { gte: startDate } },
      }),
      // Disputed
      prisma.dispute.count({
        where: { createdAt: { gte: startDate } },
      }),
      // Messages
      prisma.message.count({
        where: { createdAt: { gte: startDate } },
      }),
    ]);

    // Calculate KPIs
    const currentRevenue = currentPayments.reduce((s, p) => s + p.amount, 0);
    const previousRevenue = previousPayments.reduce((s, p) => s + p.amount, 0);
    const platformFee = 10; // percentage
    const currentPlatformRevenue = (currentRevenue * platformFee) / 100;
    const previousPlatformRevenue = (previousRevenue * platformFee) / 100;

    const currentTicket = currentOrderValues.length > 0
      ? currentOrderValues.reduce((s, o) => s + (o.totalAmount || 0), 0) / currentOrderValues.length
      : 0;
    const previousTicket = previousOrderValues.length > 0
      ? previousOrderValues.reduce((s, o) => s + (o.totalAmount || 0), 0) / previousOrderValues.length
      : 0;

    const calcChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    // Group daily users by date
    const usersByDay: Record<string, number> = {};
    dailyUsers.forEach((u) => {
      const day = u.createdAt.toISOString().split("T")[0];
      usersByDay[day] = (usersByDay[day] || 0) + 1;
    });

    // Group daily revenue by date
    const revenueByDay: Record<string, number> = {};
    dailyPayments.forEach((p) => {
      const day = p.updatedAt.toISOString().split("T")[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + p.amount;
    });

    // Fill missing days
    const dailyUsersSeries: Array<{ date: string; value: number }> = [];
    const dailyRevenueSeries: Array<{ date: string; value: number }> = [];
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dailyUsersSeries.push({ date: key, value: usersByDay[key] || 0 });
      dailyRevenueSeries.push({ date: key, value: revenueByDay[key] || 0 });
    }

    // Top categories by revenue
    const topCategories = categoryStats
      .map((cat) => {
        const revenue = cat.serviceListings.reduce(
          (sum, l) => sum + l.serviceOrders.reduce((s, o) => s + (o.totalAmount || 0), 0),
          0
        );
        return { id: cat.id, name: cat.name, revenue };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Rates
    const totalOrdersInPeriod = allOrders.length;
    const cancellationRate = totalOrdersInPeriod > 0 ? (cancelledOrders / totalOrdersInPeriod) * 100 : 0;
    const disputeRate = totalOrdersInPeriod > 0 ? (disputedOrders / totalOrdersInPeriod) * 100 : 0;
    const avgMessagesPerDay = period > 0 ? totalMessages / period : 0;

    res.status(200).json(
      successResponse(
        {
          kpis: {
            completedOrders: {
              value: completedOrders,
              change: calcChange(completedOrders, previousCompletedOrders),
            },
            platformRevenue: {
              value: currentPlatformRevenue,
              change: calcChange(currentPlatformRevenue, previousPlatformRevenue),
            },
            newUsers: {
              value: newUsers,
              change: calcChange(newUsers, previousNewUsers),
            },
            averageTicket: {
              value: currentTicket,
              change: calcChange(currentTicket, previousTicket),
            },
          },
          charts: {
            dailyUsers: dailyUsersSeries,
            dailyRevenue: dailyRevenueSeries,
          },
          funnel: {
            totalUsers,
            usersWithOrders,
            usersWithCompletedOrders,
          },
          topCategories,
          rates: {
            cancellationRate,
            disputeRate,
            avgMessagesPerDay,
          },
        },
        "Dashboard stats retrieved"
      )
    );
  } catch (error) {
    log.error({ err: error }, "Failed to get dashboard stats");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 2: Add route**

In `backend/src/routes/adminRoutes.ts`, add after the existing stats route:
```typescript
router.get("/stats/dashboard", adminController.getDashboardStats);
```

**Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts
git commit -m "feat: add dashboard stats endpoint with real time-series data"
```

---

### Task 6: Add traffic analytics endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`

**Step 1: Add traffic stats controller function**

Add to `backend/src/controllers/adminController.ts`:
```typescript
export const getTrafficStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const period = parseInt(String(req.query.period || "30"), 10);
    const now = new Date();
    const startDate = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousStart = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);

    const [
      sessions,
      previousSessions,
      allSessionsForChart,
      deviceSessions,
      // Chat metrics
      messages,
      conversations,
      // Retention data
      usersCreatedInPeriod,
    ] = await Promise.all([
      // Current period sessions
      prisma.userSession.findMany({
        where: { startedAt: { gte: startDate } },
        select: { duration: true, userId: true },
      }),
      // Previous period sessions
      prisma.userSession.findMany({
        where: { startedAt: { gte: previousStart, lt: startDate } },
        select: { duration: true, userId: true },
      }),
      // All sessions for daily chart
      prisma.userSession.findMany({
        where: { startedAt: { gte: startDate } },
        select: { startedAt: true, userId: true, duration: true },
        orderBy: { startedAt: "asc" },
      }),
      // Device distribution
      prisma.userSession.groupBy({
        by: ["device"],
        where: { startedAt: { gte: startDate } },
        _count: true,
      }),
      // Chat metrics
      prisma.message.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, serviceOrderId: true },
      }),
      // Conversation stats (grouped by order)
      prisma.message.groupBy({
        by: ["serviceOrderId"],
        where: { createdAt: { gte: startDate }, serviceOrderId: { not: null } },
        _count: true,
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      // Retention: users created recently
      prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { id: true, createdAt: true },
      }),
    ]);

    // KPIs
    const totalSessions = sessions.length;
    const previousTotalSessions = previousSessions.length;
    const avgDuration = sessions.length > 0
      ? sessions.reduce((s, sess) => s + (sess.duration || 0), 0) / sessions.length
      : 0;
    const previousAvgDuration = previousSessions.length > 0
      ? previousSessions.reduce((s, sess) => s + (sess.duration || 0), 0) / previousSessions.length
      : 0;
    const activeUsers = new Set(sessions.map((s) => s.userId)).size;
    const previousActiveUsers = new Set(previousSessions.map((s) => s.userId)).size;

    const calcChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    // Daily sessions chart
    const sessionsByDay: Record<string, { total: number; unique: Set<string> }> = {};
    allSessionsForChart.forEach((s) => {
      const day = s.startedAt.toISOString().split("T")[0];
      if (!sessionsByDay[day]) sessionsByDay[day] = { total: 0, unique: new Set() };
      sessionsByDay[day].total++;
      sessionsByDay[day].unique.add(s.userId);
    });

    const dailySessions: Array<{ date: string; sessions: number; uniqueUsers: number }> = [];
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      const data = sessionsByDay[key];
      dailySessions.push({
        date: key,
        sessions: data?.total || 0,
        uniqueUsers: data?.unique.size || 0,
      });
    }

    // Hourly distribution
    const hourlyDist: number[] = new Array(24).fill(0);
    allSessionsForChart.forEach((s) => {
      hourlyDist[s.startedAt.getHours()]++;
    });

    // Device distribution
    const deviceDistribution = deviceSessions.map((d) => ({
      device: d.device || "unknown",
      count: d._count,
    }));

    // Chat metrics
    const totalMsgs = messages.length;
    const avgMsgsPerDay = period > 0 ? totalMsgs / period : 0;
    const avgMsgsPerConversation = conversations.length > 0
      ? conversations.reduce((s, c) => s + c._count, 0) / conversations.length
      : 0;
    const avgChatDuration = conversations.length > 0
      ? conversations.reduce((s, c) => {
          const min = c._min.createdAt ? c._min.createdAt.getTime() : 0;
          const max = c._max.createdAt ? c._max.createdAt.getTime() : 0;
          return s + (max - min) / 1000; // seconds
        }, 0) / conversations.length
      : 0;

    // Retention (simplified cohort)
    const retentionData: Array<{ cohort: string; d1: number; d7: number; d14: number; d30: number }> = [];
    // Group users by week of creation
    const weekGroups: Record<string, string[]> = {};
    usersCreatedInPeriod.forEach((u) => {
      const weekNum = Math.floor(
        (u.createdAt.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const weekKey = `Semana ${weekNum + 1}`;
      if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
      weekGroups[weekKey].push(u.id);
    });

    res.status(200).json(
      successResponse(
        {
          kpis: {
            totalSessions: {
              value: totalSessions,
              change: calcChange(totalSessions, previousTotalSessions),
            },
            avgDuration: {
              value: Math.round(avgDuration),
              change: calcChange(avgDuration, previousAvgDuration),
            },
            activeUsers: {
              value: activeUsers,
              change: calcChange(activeUsers, previousActiveUsers),
            },
          },
          charts: {
            dailySessions,
            hourlyDistribution: hourlyDist,
            deviceDistribution,
          },
          chat: {
            totalMessages: totalMsgs,
            avgMessagesPerDay: Math.round(avgMsgsPerDay * 10) / 10,
            avgMessagesPerConversation: Math.round(avgMsgsPerConversation * 10) / 10,
            avgChatDurationSeconds: Math.round(avgChatDuration),
          },
          retention: retentionData,
        },
        "Traffic stats retrieved"
      )
    );
  } catch (error) {
    log.error({ err: error }, "Failed to get traffic stats");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 2: Add route**

```typescript
router.get("/stats/traffic", adminController.getTrafficStats);
```

**Step 3: Verify and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts
git commit -m "feat: add traffic analytics endpoint with session/chat metrics"
```

---

### Task 7: Add dispute management endpoints

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Add Zod schemas to validation.ts**

```typescript
export const resolveDisputeSchema = z.object({
  resolution: z.string().min(10, "Descricao da resolucao muito curta").max(1000),
  action: z.enum(["FAVOR_CLIENT", "FAVOR_PROFESSIONAL", "MUTUAL_AGREEMENT"], {
    error: "Acao invalida",
  }),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"], {
    error: "Status invalido",
  }),
});
```

**Step 2: Add controller functions**

Add `listDisputes`, `getDisputeDetails`, `assignDispute`, `resolveDispute` to adminController.ts.

`listDisputes`:
```typescript
export const listDisputes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const page = parseInt(String(req.query.page || "1"), 10);
    const limit = parseInt(String(req.query.limit || "20"), 10);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          serviceOrder: {
            select: {
              id: true, title: true, status: true, totalAmount: true,
              client: { select: { id: true, name: true, email: true } },
              professional: { select: { id: true, name: true, email: true } },
            },
          },
          initiator: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    res.status(200).json(successResponse({
      items: disputes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, "Disputes retrieved"));
  } catch (error) {
    log.error({ err: error }, "Failed to list disputes");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

`resolveDispute`:
```typescript
export const resolveDisputeAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json(errorResponse("Invalid ID")); return; }

    const { resolution, action } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: { serviceOrder: { select: { id: true, clientId: true, professionalId: true } } },
    });

    if (!dispute) { res.status(404).json(errorResponse("Disputa nao encontrada")); return; }
    if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") {
      res.status(400).json(errorResponse("Disputa ja foi resolvida"));
      return;
    }

    const updated = await prisma.dispute.update({
      where: { id },
      data: { status: "RESOLVED", resolution, updatedAt: new Date() },
    });

    // Notify both parties
    const clientMsg = action === "FAVOR_CLIENT"
      ? "A disputa foi resolvida a seu favor."
      : action === "FAVOR_PROFESSIONAL"
      ? "A disputa foi resolvida a favor do profissional."
      : "A disputa foi resolvida por acordo mutuo.";

    const proMsg = action === "FAVOR_PROFESSIONAL"
      ? "A disputa foi resolvida a seu favor."
      : action === "FAVOR_CLIENT"
      ? "A disputa foi resolvida a favor do cliente."
      : "A disputa foi resolvida por acordo mutuo.";

    await Promise.all([
      prisma.notification.create({
        data: {
          type: "SYSTEM_ALERT",
          title: "Disputa Resolvida",
          message: clientMsg,
          userId: dispute.serviceOrder.clientId,
          serviceOrderId: dispute.serviceOrder.id,
        },
      }),
      prisma.notification.create({
        data: {
          type: "SYSTEM_ALERT",
          title: "Disputa Resolvida",
          message: proMsg,
          userId: dispute.serviceOrder.professionalId,
          serviceOrderId: dispute.serviceOrder.id,
        },
      }),
    ]);

    res.status(200).json(successResponse({ dispute: updated }, "Disputa resolvida com sucesso"));
  } catch (error) {
    log.error({ err: error }, "Failed to resolve dispute");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 3: Add routes**

```typescript
router.get("/disputes", adminController.listDisputes);
router.put("/disputes/:id/resolve",
  auditLog("ADMIN_RESOLVE_DISPUTE"),
  validateBody(resolveDisputeSchema),
  adminController.resolveDisputeAdmin
);
```

**Step 4: Verify and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts backend/src/middleware/validation.ts
git commit -m "feat: add dispute management endpoints for admin panel"
```

---

### Task 8: Add platform config endpoints

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Add Zod schema**

```typescript
export const updatePlatformConfigSchema = z.object({
  platformFeePercentage: z.number().min(0).max(50).optional(),
  defaultHoldDays: z.number().int().min(0).max(365).optional(),
  disputePeriodDays: z.number().int().min(0).max(30).optional(),
  requireVerificationProfessional: z.boolean().optional(),
  requireVerificationCompany: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
});
```

**Step 2: Add controller functions**

`getPlatformConfig`:
```typescript
export const getPlatformConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const [escrowConfig, systemConfigs] = await Promise.all([
      prisma.escrowConfig.findFirst({ where: { name: "default" } }),
      prisma.systemConfig.findMany({ orderBy: { key: "asc" } }),
    ]);

    res.status(200).json(successResponse({
      escrow: escrowConfig,
      system: systemConfigs,
    }, "Config retrieved"));
  } catch (error) {
    log.error({ err: error }, "Failed to get config");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

`updatePlatformConfig`:
```typescript
export const updatePlatformConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const { platformFeePercentage, defaultHoldDays, disputePeriodDays, ...systemUpdates } = req.body;

    // Update escrow config if any escrow fields provided
    if (platformFeePercentage !== undefined || defaultHoldDays !== undefined || disputePeriodDays !== undefined) {
      const escrowData: Record<string, unknown> = {};
      if (platformFeePercentage !== undefined) escrowData.platformFeePercentage = platformFeePercentage;
      if (defaultHoldDays !== undefined) escrowData.defaultHoldDays = defaultHoldDays;
      if (disputePeriodDays !== undefined) escrowData.disputePeriodDays = disputePeriodDays;

      await prisma.escrowConfig.updateMany({
        where: { name: "default" },
        data: escrowData,
      });
    }

    // Update system configs
    for (const [key, value] of Object.entries(systemUpdates)) {
      if (value !== undefined) {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value: JSON.stringify(value) },
          create: { key, value: JSON.stringify(value) },
        });
      }
    }

    res.status(200).json(successResponse(null, "Configuracoes atualizadas"));
  } catch (error) {
    log.error({ err: error }, "Failed to update config");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 3: Add routes**

```typescript
router.get("/config", adminController.getPlatformConfig);
router.put("/config",
  auditLog("ADMIN_UPDATE_CONFIG"),
  validateBody(updatePlatformConfigSchema),
  adminController.updatePlatformConfig
);
```

**Step 4: Verify and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts backend/src/middleware/validation.ts
git commit -m "feat: add platform config endpoints for admin settings"
```

---

### Task 9: Add force-logout endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`

**Step 1: Add controller function**

```typescript
export const forceLogout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json(errorResponse("Invalid ID")); return; }

    // Prevent self-logout
    if (id === req.user.id) {
      res.status(400).json(errorResponse("Nao e possivel forcar logout de si mesmo"));
      return;
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, tokenVersion: true } });
    if (!user) { res.status(404).json(errorResponse("Usuario nao encontrado")); return; }

    await prisma.user.update({
      where: { id },
      data: { tokenVersion: user.tokenVersion + 1 },
    });

    res.status(200).json(successResponse(null, "Logout forcado com sucesso"));
  } catch (error) {
    log.error({ err: error }, "Failed to force logout");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
```

**Step 2: Add route**

```typescript
router.post("/users/:id/force-logout",
  auditLog("ADMIN_FORCE_LOGOUT"),
  adminController.forceLogout
);
```

**Step 3: Verify and commit**

```bash
cd backend && npx tsc --noEmit
git add backend/src/controllers/adminController.ts backend/src/routes/adminRoutes.ts
git commit -m "feat: add force-logout endpoint for admin user management"
```

---

## Phase 2: Admin SPA Scaffold

### Task 10: Initialize admin SPA project

**Files:**
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/tsconfig.json`
- Create: `admin/tsconfig.node.json`
- Create: `admin/postcss.config.cjs`
- Create: `admin/tailwind.config.js`
- Create: `admin/index.html`
- Create: `admin/src/main.tsx`
- Create: `admin/src/index.css`
- Create: `admin/.env`

**Step 1: Create admin/package.json**

```json
{
  "name": "faztudo-admin",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.292.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: Copy tsconfig.json, tsconfig.node.json, postcss.config.cjs from frontend** (identical configs)

**Step 4: Create tailwind.config.js**

Copy the frontend's `tailwind.config.js` but change the `content` paths to point to `admin/src/`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  // ... rest identical to frontend config
};
```

**Step 5: Create admin/index.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>FazTudo Admin</title>
  </head>
  <body class="dark">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create admin/src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 7: Create admin/src/index.css**

Copy `frontend/src/index.css` in its entirety (it contains all the TailwindCSS directives, custom component classes like `.btn`, `.card`, `.badge`, fonts, animations, etc.). This ensures the admin SPA has the exact same design system.

**Step 8: Create admin/.env**

```
VITE_API_URL=http://localhost:3001/api
```

**Step 9: Install dependencies**

Run: `cd admin && npm install`

**Step 10: Verify it starts**

Run: `cd admin && npm run dev`
Expected: Vite dev server on http://localhost:5174

**Step 11: Commit**

```bash
git add admin/
git commit -m "feat: scaffold admin SPA with Vite + React + TailwindCSS"
```

---

### Task 11: Create shared utilities and types

**Files:**
- Create: `admin/src/utils/formatters.ts`
- Create: `admin/src/types/index.ts`
- Create: `admin/src/services/api.ts`

**Step 1: Copy formatters from frontend**

Copy `frontend/src/utils/formatters.ts` to `admin/src/utils/formatters.ts` — identical file.

**Step 2: Create admin types**

Create `admin/src/types/index.ts`:
```typescript
// Enums (matching Prisma)
export enum UserRole { CLIENT = "CLIENT", PROFESSIONAL = "PROFESSIONAL", ADMIN = "ADMIN" }
export enum UserStatus { PENDING = "PENDING", ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED", INACTIVE = "INACTIVE" }
export enum ServiceOrderStatus {
  PENDING = "PENDING", ACCEPTED = "ACCEPTED", IN_PROGRESS = "IN_PROGRESS",
  AWAITING_CLIENT_CONFIRMATION = "AWAITING_CLIENT_CONFIRMATION",
  AWAITING_PROFESSIONAL_CONFIRMATION = "AWAITING_PROFESSIONAL_CONFIRMATION",
  COMPLETED = "COMPLETED", CANCELLED = "CANCELLED", EXPIRED = "EXPIRED", DISPUTED = "DISPUTED",
}
export enum PaymentStatus {
  PENDING = "PENDING", HELD = "HELD", RELEASED = "RELEASED",
  REFUNDED = "REFUNDED", FAILED = "FAILED", PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

// Dashboard types
export interface KpiValue { value: number; change: number; }
export interface DashboardStats {
  kpis: {
    completedOrders: KpiValue;
    platformRevenue: KpiValue;
    newUsers: KpiValue;
    averageTicket: KpiValue;
  };
  charts: {
    dailyUsers: Array<{ date: string; value: number }>;
    dailyRevenue: Array<{ date: string; value: number }>;
  };
  funnel: { totalUsers: number; usersWithOrders: number; usersWithCompletedOrders: number };
  topCategories: Array<{ id: number; name: string; revenue: number }>;
  rates: { cancellationRate: number; disputeRate: number; avgMessagesPerDay: number };
}

// Traffic types
export interface TrafficStats {
  kpis: {
    totalSessions: KpiValue;
    avgDuration: KpiValue;
    activeUsers: KpiValue;
  };
  charts: {
    dailySessions: Array<{ date: string; sessions: number; uniqueUsers: number }>;
    hourlyDistribution: number[];
    deviceDistribution: Array<{ device: string; count: number }>;
  };
  chat: {
    totalMessages: number;
    avgMessagesPerDay: number;
    avgMessagesPerConversation: number;
    avgChatDurationSeconds: number;
  };
}

// User types
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  phone?: string;
  profileImage?: string;
  rating?: number;
  createdAt: string;
  _count: { serviceOrders: number; servicesProvided: number; serviceListings: number };
}

// Dispute types
export interface AdminDispute {
  id: number;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  serviceOrder: {
    id: number; title: string; status: string; totalAmount: number;
    client: { id: number; name: string; email: string };
    professional: { id: number; name: string; email: string };
  };
  initiator: { id: number; name: string; email: string; role: string };
}

// Verification types
export interface AdminVerification {
  id: number;
  type: string;
  status: string;
  metadata?: unknown;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  user: { id: number; name: string; email: string; role: string; profileImage?: string; isVerified: boolean };
}

// Paginated result
export interface PaginatedResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Auth
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  profileImage?: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  refreshToken: string;
}
```

**Step 3: Create API service**

Create `admin/src/services/api.ts`:
```typescript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("admin-token");
      localStorage.removeItem("admin-user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function extractData<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || "Erro desconhecido";
  }
  return "Erro desconhecido";
}

export default api;
```

**Step 4: Commit**

```bash
git add admin/src/
git commit -m "feat: add shared utils, types, and API service for admin SPA"
```

---

### Task 12: Create AuthContext and ThemeContext

**Files:**
- Create: `admin/src/context/AuthContext.tsx`
- Create: `admin/src/context/ThemeContext.tsx`

**Step 1: Create AuthContext**

Create `admin/src/context/AuthContext.tsx`:
```typescript
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { extractData } from "../services/api";
import type { AuthUser, LoginResponse } from "../types";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("admin-token");
    const userStr = localStorage.getItem("admin-user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        setState({ user, token, isAuthenticated: true, isLoading: false, error: null });
      } catch {
        localStorage.removeItem("admin-token");
        localStorage.removeItem("admin-user");
        setState((s) => ({ ...s, isLoading: false }));
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const data = extractData<LoginResponse>(
        await api.post("/admin/login", { email, password })
      );
      localStorage.setItem("admin-token", data.token);
      localStorage.setItem("admin-user", JSON.stringify(data.user));
      if (data.refreshToken) {
        localStorage.setItem("admin-refresh-token", data.refreshToken);
      }
      setState({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao fazer login";
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    localStorage.removeItem("admin-refresh-token");
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
```

**Step 2: Create ThemeContext**

Copy `frontend/src/context/ThemeContext.tsx` to `admin/src/context/ThemeContext.tsx` — change localStorage key to `"faztudo-admin-theme"` and default to `"dark"`.

**Step 3: Commit**

```bash
git add admin/src/context/
git commit -m "feat: add AuthContext and ThemeContext for admin SPA"
```

---

### Task 13: Create Admin Layout with Sidebar

**Files:**
- Create: `admin/src/components/layout/AdminLayout.tsx`
- Create: `admin/src/components/layout/Sidebar.tsx`
- Create: `admin/src/components/layout/Header.tsx`

**Step 1: Create Sidebar component**

Create `admin/src/components/layout/Sidebar.tsx`:
```tsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, ShieldCheck, BarChart3,
  Scale, Mail, Settings, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/users", label: "Usuarios", icon: Users },
  { path: "/verifications", label: "Verificacoes", icon: ShieldCheck, badge: true },
  { path: "/traffic", label: "Trafego", icon: BarChart3 },
  { path: "/disputes", label: "Disputas", icon: Scale },
  { path: "/inbox", label: "Inbox", icon: Mail },
  { path: "/settings", label: "Configuracoes", icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        {!collapsed && (
          <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
            FazTudo <span className="text-primary-500">Admin</span>
          </span>
        )}
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
```

**Step 2: Create Header component**

Create `admin/src/components/layout/Header.tsx`:
```tsx
import React from "react";
import { Sun, Moon, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const Header: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div />
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
            {user?.name?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-300 md:block">
            {user?.name || "Admin"}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
```

**Step 3: Create AdminLayout**

Create `admin/src/components/layout/AdminLayout.tsx`:
```tsx
import React, { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Sidebar from "./Sidebar";
import Header from "./Header";

const AdminLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="loader h-8 w-8 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
```

**Step 4: Commit**

```bash
git add admin/src/components/layout/
git commit -m "feat: add admin layout with collapsible sidebar and header"
```

---

### Task 14: Create App.tsx router and Login page

**Files:**
- Create: `admin/src/App.tsx`
- Create: `admin/src/pages/Login.tsx`

**Step 1: Create Login page**

Create `admin/src/pages/Login.tsx`:
```tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Login: React.FC = () => {
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      // Error is handled by AuthContext
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10 ring-1 ring-primary-500/20">
            <Shield className="h-8 w-8 text-primary-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">FazTudo</h1>
          <p className="mt-1 text-sm text-slate-400">Painel Administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="label text-slate-300">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-primary-500"
              placeholder="admin@faztudo.com"
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="label text-slate-300">Senha</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-primary-500 pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="loader h-4 w-4 border-white" />
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
```

**Step 2: Create App.tsx**

Create `admin/src/App.tsx`:
```tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import AdminLayout from "./components/layout/AdminLayout";
import Login from "./pages/Login";

// Lazy-loaded pages
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Users = React.lazy(() => import("./pages/Users"));
const Verifications = React.lazy(() => import("./pages/Verifications"));
const Traffic = React.lazy(() => import("./pages/Traffic"));
const Disputes = React.lazy(() => import("./pages/Disputes"));
const Inbox = React.lazy(() => import("./pages/Inbox"));
const Settings = React.lazy(() => import("./pages/Settings"));

const SuspenseFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="loader h-8 w-8 border-primary-500" />
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <React.Suspense fallback={<SuspenseFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/users" element={<Users />} />
                <Route path="/verifications" element={<Verifications />} />
                <Route path="/traffic" element={<Traffic />} />
                <Route path="/disputes" element={<Disputes />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </React.Suspense>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
```

**Step 3: Create placeholder pages for each route**

Create each of these files with a minimal placeholder:
- `admin/src/pages/Dashboard.tsx`
- `admin/src/pages/Users.tsx`
- `admin/src/pages/Verifications.tsx`
- `admin/src/pages/Traffic.tsx`
- `admin/src/pages/Disputes.tsx`
- `admin/src/pages/Inbox.tsx`
- `admin/src/pages/Settings.tsx`

Each follows this pattern:
```tsx
import React from "react";

const PageName: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Page Title</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">Description</p>
    </div>
  );
};

export default PageName;
```

**Step 4: Verify it builds**

Run: `cd admin && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add admin/src/
git commit -m "feat: add router, login page, and placeholder pages for admin SPA"
```

---

## Phase 3: Admin Pages Implementation

### Task 15: Build Dashboard page with real charts

**Files:**
- Create: `admin/src/services/statsService.ts`
- Create: `admin/src/components/charts/AreaChartCard.tsx`
- Create: `admin/src/components/charts/FunnelChart.tsx`
- Create: `admin/src/components/metrics/KpiCard.tsx`
- Create: `admin/src/components/metrics/PeriodSelector.tsx`
- Modify: `admin/src/pages/Dashboard.tsx`

This task implements the full Dashboard with 4 KPI cards, 2 time-series charts (Recharts AreaChart), funnel visualization, top categories ranking, and timing metrics. All data comes from `GET /api/admin/stats/dashboard?period=30`.

The KpiCard shows value + change% + sparkline. The PeriodSelector is a button group with 1d/7d/30d options. Charts use Recharts' `AreaChart`, `Area`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`.

**Commit:** `feat: implement admin dashboard with real-time metrics and charts`

---

### Task 16: Build Users page with role-based metrics

**Files:**
- Create: `admin/src/services/usersService.ts`
- Create: `admin/src/components/users/UserCard.tsx`
- Create: `admin/src/components/users/UserFilters.tsx`
- Create: `admin/src/components/common/Skeleton.tsx` (copy from frontend with adaptations)
- Create: `admin/src/components/common/EmptyState.tsx` (copy from frontend)
- Modify: `admin/src/pages/Users.tsx`

Implements the Users page with tabs (Todos/Clientes/Profissionais/Empresas), search/filter bar, user cards with role-specific metrics, and pagination. Empresas tab shows EmptyState for now.

**Commit:** `feat: implement admin users page with role-based filtering and metrics`

---

### Task 17: Build User Detail page

**Files:**
- Create: `admin/src/pages/UserDetail.tsx`
- Modify: `admin/src/App.tsx` (add `/users/:id` route)

Implements the full user detail page with 5 tabs (Overview, Orders, Payments, Verification, Activity), action buttons (Activate/Suspend/Deactivate/Force Logout), and all role-specific metrics.

**Commit:** `feat: implement admin user detail page with tabbed interface`

---

### Task 18: Build Verifications page with document viewer

**Files:**
- Create: `admin/src/services/verificationsService.ts`
- Create: `admin/src/components/verifications/VerificationCard.tsx`
- Create: `admin/src/components/verifications/DocumentViewer.tsx`
- Modify: `admin/src/pages/Verifications.tsx`

Implements verifications page with tabs (Pendentes/Aprovadas/Rejeitadas), document thumbnails, fullscreen image viewer modal with zoom, validation status display, and approve/reject actions.

**Commit:** `feat: implement admin verifications page with document viewer`

---

### Task 19: Build Traffic Analytics page

**Files:**
- Create: `admin/src/services/trafficService.ts`
- Create: `admin/src/components/charts/LineChartCard.tsx`
- Create: `admin/src/components/charts/BarChartCard.tsx`
- Create: `admin/src/components/charts/DonutChart.tsx`
- Modify: `admin/src/pages/Traffic.tsx`

Implements traffic analytics with KPI cards, daily sessions line chart (2 lines), hourly bar chart, device donut chart, chat metrics cards, messages area chart, and retention cohort table with heatmap.

**Commit:** `feat: implement admin traffic analytics page with charts and metrics`

---

### Task 20: Build Disputes page

**Files:**
- Create: `admin/src/services/disputesService.ts`
- Create: `admin/src/components/common/Modal.tsx`
- Modify: `admin/src/pages/Disputes.tsx`

Implements disputes management with tabs (Open/Under Review/Resolved/Closed), dispute cards showing order info + parties + amount, resolve modal with decision + justification fields.

**Commit:** `feat: implement admin disputes management page`

---

### Task 21: Build Inbox placeholder and Settings page

**Files:**
- Modify: `admin/src/pages/Inbox.tsx`
- Create: `admin/src/services/configService.ts`
- Modify: `admin/src/pages/Settings.tsx`

Inbox: elegant empty state with email icon and "coming soon" message.
Settings: form with platform fee %, escrow hold days, dispute period, verification requirements toggle, maintenance mode toggle. Data from `GET /api/admin/config`, saved via `PUT /api/admin/config`.

**Commit:** `feat: implement admin inbox placeholder and settings page`

---

## Phase 4: Frontend Tracking Integration

### Task 22: Add session tracking to main frontend app

**Files:**
- Create: `frontend/src/hooks/useSessionTracking.ts`
- Modify: `frontend/src/App.tsx` (add hook usage)

**Step 1: Create useSessionTracking hook**

Create `frontend/src/hooks/useSessionTracking.ts`:
```typescript
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";

export function useSessionTracking(isAuthenticated: boolean) {
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastPathRef = useRef<string>("");
  const pageEnteredAtRef = useRef<number>(0);
  const location = useLocation();

  // Start session on auth
  useEffect(() => {
    if (!isAuthenticated) return;

    const startSession = async () => {
      try {
        const res = await api.post("/sessions/start");
        sessionIdRef.current = res.data.data.session.id;

        // Start heartbeat every 60s
        heartbeatRef.current = setInterval(async () => {
          if (sessionIdRef.current) {
            try {
              await api.patch(`/sessions/${sessionIdRef.current}/heartbeat`);
            } catch { /* silently fail */ }
          }
        }, 60000);
      } catch { /* silently fail */ }
    };

    startSession();

    // End session on unmount/close
    const endSession = () => {
      if (sessionIdRef.current) {
        // Use sendBeacon for reliability on page close
        const token = localStorage.getItem("token");
        navigator.sendBeacon(
          `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/sessions/${sessionIdRef.current}/end`,
          new Blob([JSON.stringify({})], { type: "application/json" })
        );
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };

    window.addEventListener("beforeunload", endSession);
    return () => {
      endSession();
      window.removeEventListener("beforeunload", endSession);
    };
  }, [isAuthenticated]);

  // Track page views on route change
  useEffect(() => {
    if (!sessionIdRef.current || !isAuthenticated) return;

    // Record duration of previous page
    if (lastPathRef.current && pageEnteredAtRef.current) {
      const duration = Math.floor((Date.now() - pageEnteredAtRef.current) / 1000);
      api.post(`/sessions/${sessionIdRef.current}/pageview`, {
        path: lastPathRef.current,
        duration,
      }).catch(() => {});
    }

    lastPathRef.current = location.pathname;
    pageEnteredAtRef.current = Date.now();
  }, [location.pathname, isAuthenticated]);
}
```

**Step 2: Add to App.tsx**

In `frontend/src/App.tsx`, inside the main component (after AuthProvider is available), call:
```typescript
useSessionTracking(isAuthenticated);
```

This requires a small wrapper component inside AuthProvider that calls the hook.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useSessionTracking.ts frontend/src/App.tsx
git commit -m "feat: add session tracking to frontend for admin analytics"
```

---

## Phase 5: Docker & Cleanup

### Task 23: Update docker-compose.yml for admin SPA

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add admin service**

```yaml
  admin:
    build:
      context: ./admin
      dockerfile: Dockerfile
    ports:
      - "5174:5174"
    volumes:
      - ./admin/src:/app/src
      - ./admin/public:/app/public
      - admin_node_modules:/app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend
    restart: unless-stopped
```

Add to volumes:
```yaml
  admin_node_modules:
```

Update backend CORS_ORIGIN:
```yaml
      - CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add admin SPA to docker-compose"
```

---

### Task 24: Fix known bugs

**Files:**
- Fix `_count` name mismatch between backend and admin types
- Ensure admin types use `serviceOrders`/`servicesProvided` (matching backend)

**Commit:** `fix: align admin user count field names with backend response`

---

### Task 25: Final verification

**Step 1:** Start backend: `cd backend && npm run dev`
**Step 2:** Start admin: `cd admin && npm run dev`
**Step 3:** Navigate to `http://localhost:5174`
**Step 4:** Login with admin credentials
**Step 5:** Verify each page loads correctly
**Step 6:** Verify dark/light theme toggle works
**Step 7:** Verify sidebar collapses/expands
**Step 8:** Run TypeScript check: `cd admin && npx tsc --noEmit`

**Commit:** `chore: final verification of admin panel SPA`
