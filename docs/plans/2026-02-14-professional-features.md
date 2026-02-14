# Professional Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build 4 professional-facing features: Smart CRM Dashboard, Operational Calendar, Financial Management, and Actionable Reputation Panel.

**Architecture:** Each feature adds a backend API endpoint in the existing Express/Prisma stack, a frontend service layer function, and a React page component with Tailwind CSS. New routes mount under existing `/api/dashboard` (CRM, Reputation) and `/api/wallet` (Financial). Calendar gets its own route group. Frontend pages register under the existing `/professional/*` route tree.

**Tech Stack:** TypeScript, Express 5, Prisma 7 (SQLite/LibSQL), React 18, Vite, TailwindCSS, Lucide icons, Vitest for testing.

---

## Phase 1: CRM Inteligente (Smart CRM)

### Task 1: Backend — CRM Stats API Endpoint

**Files:**
- Test: `backend/tests/integration/professionalCrm.test.ts`
- Modify: `backend/src/controllers/dashboardController.ts`
- Modify: `backend/src/routes/dashboardRoutes.ts`

**Step 1: Write the failing test**

```typescript
// backend/tests/integration/professionalCrm.test.ts
import { describe, it, expect } from "vitest";

describe("Professional CRM Stats", () => {
  it("should calculate orders today correctly", () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const orders = [
      { createdAt: new Date(), status: "PENDING" },
      { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
      { createdAt: new Date(), status: "IN_PROGRESS" },
    ];

    const ordersToday = orders.filter(
      (o) => o.createdAt >= todayStart && o.createdAt < todayEnd
    ).length;

    expect(ordersToday).toBe(2);
  });

  it("should calculate orders last 7 days correctly", () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orders = [
      { createdAt: new Date(), status: "PENDING" },
      { createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
      { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
    ];

    const ordersLast7Days = orders.filter((o) => o.createdAt >= sevenDaysAgo).length;

    expect(ordersLast7Days).toBe(2);
  });

  it("should calculate monthly revenue from released payments", () => {
    const payments = [
      { amount: 100, status: "RELEASED" },
      { amount: 200, status: "RELEASED" },
      { amount: 50, status: "HELD" },
    ];
    const platformFeePercentage = 10;

    const monthlyRevenue = payments
      .filter((p) => p.status === "RELEASED")
      .reduce((sum, p) => sum + p.amount * (1 - platformFeePercentage / 100), 0);

    expect(monthlyRevenue).toBe(270); // (100 + 200) * 0.9
  });
});
```

**Step 2: Run test to verify it passes (pure logic test)**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/integration/professionalCrm.test.ts`
Expected: PASS

**Step 3: Implement CRM stats endpoint in dashboardController.ts**

Add this function at the end of `backend/src/controllers/dashboardController.ts`:

```typescript
export const getProfessionalCrmStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access CRM stats"));
      return;
    }

    const userId = req.user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [ordersToday, ordersLast7Days, pendingOrders, monthlyPayments] = await Promise.all([
      prisma.serviceOrder.count({
        where: {
          professionalId: userId,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.serviceOrder.count({
        where: {
          professionalId: userId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.serviceOrder.count({
        where: {
          professionalId: userId,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
      }),
      prisma.payment.findMany({
        where: {
          professionalId: userId,
          status: "RELEASED",
          releasedAt: { gte: monthStart, lt: monthEnd },
        },
        select: { amount: true },
      }),
    ]);

    // Fetch escrow config for fee calculation
    const escrowConfig = await prisma.escrowConfig.findFirst({ where: { name: "default" } });
    const feePercentage = escrowConfig?.platformFeePercentage ?? 10;
    const monthlyRevenue = monthlyPayments.reduce(
      (sum, p) => sum + p.amount * (1 - feePercentage / 100), 0
    );

    res.status(200).json(
      successResponse({
        ordersToday,
        ordersLast7Days,
        pendingOrders,
        monthlyRevenue,
        feePercentage,
      }, "Professional CRM stats retrieved"),
    );
  } catch (error) {
    console.error("Professional CRM stats error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 4: Register route in dashboardRoutes.ts**

Add to `backend/src/routes/dashboardRoutes.ts`:

```typescript
router.get("/professional/crm", verifyToken, dashboardController.getProfessionalCrmStats);
```

**Step 5: Run backend to verify no compile errors**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/tests/integration/professionalCrm.test.ts backend/src/controllers/dashboardController.ts backend/src/routes/dashboardRoutes.ts
git commit -m "feat: add professional CRM stats API endpoint"
```

---

### Task 2: Frontend — CRM Dashboard Service Layer

**Files:**
- Modify: `frontend/src/services/dashboardService.ts`

**Step 1: Add CRM stats interface and service function**

Add to `frontend/src/services/dashboardService.ts`:

```typescript
export interface ProfessionalCrmStats {
  ordersToday: number;
  ordersLast7Days: number;
  pendingOrders: number;
  monthlyRevenue: number;
  feePercentage: number;
}

export const getProfessionalCrmStats = async (): Promise<ProfessionalCrmStats> => {
  const response = await api.get<ApiResponse<ProfessionalCrmStats>>(
    "/dashboard/professional/crm"
  );
  return extractData(response);
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/services/dashboardService.ts
git commit -m "feat: add CRM stats service function"
```

---

### Task 3: Frontend — CRM Dashboard Page

**Files:**
- Create: `frontend/src/pages/professional/CRM.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create CRM page component**

Create `frontend/src/pages/professional/CRM.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { StatsCard } from "../../components/dashboard/StatsCard";
import { OrderCard } from "../../components/orders/OrderCard";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  getProfessionalCrmStats,
  getRecentOrders,
  ProfessionalCrmStats,
} from "../../services/dashboardService";
import { ServiceOrder } from "../../types";
import { formatCurrency } from "../../utils/formatters";

const ProfessionalCRM: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfessionalCrmStats>({
    ordersToday: 0,
    ordersLast7Days: 0,
    pendingOrders: 0,
    monthlyRevenue: 0,
    feePercentage: 10,
  });
  const [pendingOrdersList, setPendingOrdersList] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [crmData, ordersData] = await Promise.all([
          getProfessionalCrmStats().catch(() => null),
          getRecentOrders(10).catch(() => []),
        ]);

        if (crmData) setStats(crmData);

        const pending = ordersData.filter(
          (o) => o.status === "PENDING" || o.status === "ACCEPTED"
        );
        setPendingOrdersList(pending);
      } catch (error) {
        console.error("Erro ao carregar CRM:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          CRM Profissional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Acompanhe seus pedidos e faturamento em tempo real.
        </p>
      </div>

      {/* Monthly Revenue Callout */}
      {stats.monthlyRevenue > 0 && (
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-200" />
            <div>
              <p className="text-sm text-emerald-100">Faturado este mes (liquido)</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              <p className="text-xs text-emerald-200 mt-1">
                Taxa da plataforma: {stats.feePercentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Pedidos Hoje"
          value={stats.ordersToday}
          icon={<CalendarCheck className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Ultimos 7 Dias"
          value={stats.ordersLast7Days}
          icon={<CalendarDays className="w-6 h-6" />}
          color="primary"
        />
        <StatsCard
          title="Faturado no Mes"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Pedidos Pendentes"
          value={stats.pendingOrders}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Pending Orders List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Pedidos Pendentes
          </h2>
          <Link
            to="/professional/services"
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {pendingOrdersList.length === 0 ? (
          <EmptyState
            icon="package"
            title="Nenhum pedido pendente"
            description="Todos os seus pedidos estao em dia!"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-grid">
            {pendingOrdersList.map((order) => (
              <OrderCard
                key={order.id}
                id={order.id}
                title={order.title}
                status={order.status}
                price={order.price}
                scheduledDate={order.scheduledDate || undefined}
                deadlineDate={order.deadlineDate || undefined}
                createdAt={order.createdAt}
                client={
                  order.client
                    ? {
                        id: order.client.id,
                        name: order.client.name,
                        profileImage: order.client.profileImage || undefined,
                      }
                    : undefined
                }
                isProfessionalView
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalCRM;
```

**Step 2: Register route in App.tsx**

Add import at top of `frontend/src/App.tsx`:

```typescript
import ProfessionalCRM from "./pages/professional/CRM";
```

Add route inside the `<Route path="professional">` block, after the dashboard route:

```tsx
<Route path="crm" element={<ProfessionalCRM />} />
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/professional/CRM.tsx frontend/src/App.tsx
git commit -m "feat: add professional CRM dashboard page"
```

---

## Phase 2: Agenda Operacional (Operational Calendar)

### Task 4: Backend — Calendar Overview API Endpoint

**Files:**
- Test: `backend/tests/integration/professionalCalendar.test.ts`
- Create: `backend/src/controllers/calendarController.ts`
- Modify: `backend/src/routes/dashboardRoutes.ts`

**Step 1: Write the failing test**

```typescript
// backend/tests/integration/professionalCalendar.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Calendar", () => {
  it("should group orders by day in a month", () => {
    const orders = [
      { scheduledDate: new Date("2026-02-05"), status: "COMPLETED", clientId: 1 },
      { scheduledDate: new Date("2026-02-05"), status: "IN_PROGRESS", clientId: 2 },
      { scheduledDate: new Date("2026-02-10"), status: "PENDING", clientId: 3 },
      { scheduledDate: new Date("2026-02-15"), status: "ACCEPTED", clientId: 4 },
    ];

    const dayMap: Record<number, { total: number; completed: number; upcoming: number }> = {};

    for (const order of orders) {
      const day = order.scheduledDate.getDate();
      if (!dayMap[day]) {
        dayMap[day] = { total: 0, completed: 0, upcoming: 0 };
      }
      dayMap[day].total++;
      if (order.status === "COMPLETED") {
        dayMap[day].completed++;
      } else {
        dayMap[day].upcoming++;
      }
    }

    expect(dayMap[5]).toEqual({ total: 2, completed: 1, upcoming: 1 });
    expect(dayMap[10]).toEqual({ total: 1, completed: 0, upcoming: 1 });
    expect(dayMap[15]).toEqual({ total: 1, completed: 0, upcoming: 1 });
  });

  it("should identify available days from schedule", () => {
    const schedule = [
      { dayOfWeek: 0, isAvailable: false },
      { dayOfWeek: 1, isAvailable: true },
      { dayOfWeek: 2, isAvailable: true },
      { dayOfWeek: 3, isAvailable: true },
      { dayOfWeek: 4, isAvailable: true },
      { dayOfWeek: 5, isAvailable: true },
      { dayOfWeek: 6, isAvailable: false },
    ];

    const availableDays = schedule.filter((s) => s.isAvailable).map((s) => s.dayOfWeek);
    expect(availableDays).toEqual([1, 2, 3, 4, 5]);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/integration/professionalCalendar.test.ts`
Expected: PASS

**Step 3: Create calendarController.ts**

Create `backend/src/controllers/calendarController.ts`:

```typescript
import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

/**
 * GET /api/dashboard/professional/calendar?month=2026-02
 * Monthly overview: per-day order counts, availability
 */
export const getCalendarOverview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access calendar"));
      return;
    }

    const userId = req.user.id;
    const monthStr = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [yearStr, monStr] = monthStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monStr, 10) - 1; // JS months are 0-indexed

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Fetch orders for this month
    const orders = await prisma.serviceOrder.findMany({
      where: {
        professionalId: userId,
        scheduledDate: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledDate: true,
        client: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Fetch weekly schedule
    const schedule = await prisma.professionalSchedule.findMany({
      where: { professionalId: userId },
      orderBy: { dayOfWeek: "asc" },
    });

    // Fetch schedule blocks for the month
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        professionalId: userId,
        startDateTime: { gte: monthStart, lt: monthEnd },
      },
    });

    // Build per-day summary
    const days: Array<{
      date: string;
      dayOfMonth: number;
      dayOfWeek: number;
      totalOrders: number;
      completedOrders: number;
      upcomingOrders: number;
      isAvailable: boolean;
      isBlocked: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().slice(0, 10);
      const dow = date.getDay();

      const dayOrders = orders.filter(
        (o) => o.scheduledDate && o.scheduledDate.toISOString().slice(0, 10) === dateStr
      );

      const scheduleDay = schedule.find((s) => s.dayOfWeek === dow);
      const isAvailable = scheduleDay ? scheduleDay.isAvailable : dow !== 0;

      const dayBlocks = blocks.filter(
        (b) => b.startDateTime.toISOString().slice(0, 10) === dateStr
      );

      days.push({
        date: dateStr,
        dayOfMonth: d,
        dayOfWeek: dow,
        totalOrders: dayOrders.length,
        completedOrders: dayOrders.filter((o) => o.status === "COMPLETED").length,
        upcomingOrders: dayOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length,
        isAvailable,
        isBlocked: dayBlocks.length > 0,
      });
    }

    res.status(200).json(
      successResponse({
        month: monthStr,
        daysInMonth,
        days,
        totalMonthOrders: orders.length,
        schedule: schedule.length > 0 ? schedule : null,
      }, "Calendar overview retrieved"),
    );
  } catch (error) {
    console.error("Calendar overview error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * GET /api/dashboard/professional/calendar/:date
 * Daily detail: hourly schedule with order slots
 */
export const getCalendarDayDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access calendar"));
      return;
    }

    const userId = req.user.id;
    const dateStr = req.params.date; // YYYY-MM-DD

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json(errorResponse("Invalid date format. Use YYYY-MM-DD"));
      return;
    }

    const date = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59");
    const dow = date.getDay();

    // Fetch orders for this day
    const orders = await prisma.serviceOrder.findMany({
      where: {
        professionalId: userId,
        scheduledDate: { gte: date, lte: dayEnd },
      },
      include: {
        client: { select: { id: true, name: true, profileImage: true, phone: true } },
        serviceListing: { select: { id: true, title: true } },
        address: true,
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Fetch schedule for this day of week
    const scheduleDay = await prisma.professionalSchedule.findUnique({
      where: { professionalId_dayOfWeek: { professionalId: userId, dayOfWeek: dow } },
    });

    // Fetch blocks for this day
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        professionalId: userId,
        startDateTime: { lte: dayEnd },
        endDateTime: { gte: date },
      },
    });

    const startTime = scheduleDay?.startTime || (dow === 0 ? null : "08:00");
    const endTime = scheduleDay?.endTime || (dow === 0 ? null : "18:00");
    const isAvailable = scheduleDay?.isAvailable ?? (dow !== 0);

    // Build hourly slots
    const slots: Array<{
      time: string;
      available: boolean;
      order: any | null;
      blockReason: string | null;
    }> = [];

    if (isAvailable && startTime && endTime) {
      const startH = parseInt(startTime.split(":")[0], 10);
      const endH = parseInt(endTime.split(":")[0], 10);

      for (let h = startH; h < endH; h++) {
        const timeStr = `${String(h).padStart(2, "0")}:00`;
        const slotStart = new Date(`${dateStr}T${timeStr}:00`);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

        const slotOrder = orders.find((o) => {
          if (!o.scheduledDate) return false;
          const orderH = o.scheduledDate.getHours();
          return orderH === h;
        });

        const block = blocks.find(
          (b) => slotStart < b.endDateTime && slotEnd > b.startDateTime
        );

        slots.push({
          time: timeStr,
          available: !slotOrder && !block,
          order: slotOrder
            ? {
                id: slotOrder.id,
                title: slotOrder.title,
                status: slotOrder.status,
                price: slotOrder.price,
                client: slotOrder.client,
                address: slotOrder.address,
              }
            : null,
          blockReason: block?.reason || null,
        });
      }
    }

    res.status(200).json(
      successResponse({
        date: dateStr,
        dayOfWeek: dow,
        isAvailable,
        startTime,
        endTime,
        slots,
        totalOrders: orders.length,
      }, "Calendar day detail retrieved"),
    );
  } catch (error) {
    console.error("Calendar day detail error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 4: Register routes**

Add to `backend/src/routes/dashboardRoutes.ts`:

```typescript
import * as calendarController from "../controllers/calendarController";

router.get("/professional/calendar", verifyToken, calendarController.getCalendarOverview);
router.get("/professional/calendar/:date", verifyToken, calendarController.getCalendarDayDetail);
```

**Step 5: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/tests/integration/professionalCalendar.test.ts backend/src/controllers/calendarController.ts backend/src/routes/dashboardRoutes.ts
git commit -m "feat: add professional calendar API endpoints"
```

---

### Task 5: Frontend — Calendar Service Layer

**Files:**
- Create: `frontend/src/services/calendarService.ts`

**Step 1: Create calendar service**

Create `frontend/src/services/calendarService.ts`:

```typescript
import api, { ApiResponse, extractData } from "./api";

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  dayOfWeek: number;
  totalOrders: number;
  completedOrders: number;
  upcomingOrders: number;
  isAvailable: boolean;
  isBlocked: boolean;
}

export interface CalendarOverview {
  month: string;
  daysInMonth: number;
  days: CalendarDay[];
  totalMonthOrders: number;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }> | null;
}

export interface CalendarSlot {
  time: string;
  available: boolean;
  order: {
    id: number;
    title: string;
    status: string;
    price: number;
    client: { id: number; name: string; profileImage: string | null };
    address: { street: string; number: string; neighborhood: string; city: string } | null;
  } | null;
  blockReason: string | null;
}

export interface CalendarDayDetail {
  date: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  slots: CalendarSlot[];
  totalOrders: number;
}

export const getCalendarOverview = async (month: string): Promise<CalendarOverview> => {
  const response = await api.get<ApiResponse<CalendarOverview>>(
    "/dashboard/professional/calendar",
    { params: { month } }
  );
  return extractData(response);
};

export const getCalendarDayDetail = async (date: string): Promise<CalendarDayDetail> => {
  const response = await api.get<ApiResponse<CalendarDayDetail>>(
    `/dashboard/professional/calendar/${date}`
  );
  return extractData(response);
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/services/calendarService.ts
git commit -m "feat: add calendar service layer"
```

---

### Task 6: Frontend — Calendar Page Component

**Files:**
- Create: `frontend/src/pages/professional/Calendar.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Calendar page**

Create `frontend/src/pages/professional/Calendar.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import {
  getCalendarOverview,
  getCalendarDayDetail,
  CalendarOverview,
  CalendarDayDetail,
  CalendarDay,
} from "../../services/calendarService";
import { formatCurrency, formatOrderStatus } from "../../utils/formatters";

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ProfessionalCalendar: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<CalendarOverview | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const loadOverview = useCallback(async (month: string) => {
    try {
      setLoading(true);
      const data = await getCalendarOverview(month);
      setOverview(data);
      setSelectedDay(null);
      setDayDetail(null);
    } catch (error) {
      console.error("Erro ao carregar calendario:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview(currentMonth);
  }, [currentMonth, loadOverview]);

  const handleDayClick = async (day: CalendarDay) => {
    setSelectedDay(day.date);
    setDayLoading(true);
    try {
      const detail = await getCalendarDayDetail(day.date);
      setDayDetail(detail);
    } catch (error) {
      console.error("Erro ao carregar detalhe do dia:", error);
    } finally {
      setDayLoading(false);
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const [year, month] = currentMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  if (loading && !overview) return <SkeletonDashboard />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Agenda Operacional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Visualize e gerencie seus agendamentos do mes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Month days */}
            {overview?.days.map((day) => {
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              const isSelected = day.date === selectedDay;
              const hasOrders = day.totalOrders > 0;

              return (
                <button
                  key={day.date}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square rounded-lg p-1 flex flex-col items-center justify-center
                    text-sm transition-all relative
                    ${isSelected
                      ? "bg-primary-600 text-white ring-2 ring-primary-300"
                      : isToday
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 ring-1 ring-primary-200"
                        : !day.isAvailable
                          ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }
                  `}
                >
                  <span className="font-medium">{day.dayOfMonth}</span>
                  {hasOrders && (
                    <div className="flex gap-0.5 mt-0.5">
                      {day.completedOrders > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-emerald-200" : "bg-emerald-500"}`} />
                      )}
                      {day.upcomingOrders > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-blue-200" : "bg-blue-500"}`} />
                      )}
                    </div>
                  )}
                  {hasOrders && (
                    <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                      {day.totalOrders}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Concluidos
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Proximos
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600" /> Indisponivel
            </div>
          </div>
        </div>

        {/* Day Detail Sidebar */}
        <div className="card">
          {!selectedDay ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CalendarIcon className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Selecione um dia para ver os agendamentos</p>
            </div>
          ) : dayLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dayDetail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <span className="text-sm text-slate-500">
                  {dayDetail.totalOrders} agendamento{dayDetail.totalOrders !== 1 ? "s" : ""}
                </span>
              </div>

              {!dayDetail.isAvailable ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm">Dia indisponivel na sua agenda</span>
                </div>
              ) : dayDetail.slots.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum horario configurado</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {dayDetail.slots.map((slot) => (
                    <div
                      key={slot.time}
                      className={`
                        p-3 rounded-lg border text-sm
                        ${slot.order
                          ? "border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10"
                          : slot.blockReason
                            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {slot.time}
                        </span>
                        {slot.order && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                            {formatOrderStatus(slot.order.status)}
                          </span>
                        )}
                      </div>

                      {slot.order ? (
                        <div className="ml-6 space-y-1">
                          <Link
                            to={`/professional/services/${slot.order.id}`}
                            className="font-medium text-primary-600 hover:underline"
                          >
                            {slot.order.title}
                          </Link>
                          <div className="flex items-center gap-1 text-slate-500">
                            <User className="w-3 h-3" />
                            {slot.order.client.name}
                          </div>
                          {slot.order.address && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <MapPin className="w-3 h-3" />
                              {slot.order.address.street}, {slot.order.address.number} - {slot.order.address.neighborhood}
                            </div>
                          )}
                          <p className="font-medium text-emerald-600">
                            {formatCurrency(slot.order.price)}
                          </p>
                        </div>
                      ) : slot.blockReason ? (
                        <p className="ml-6 text-red-600 dark:text-red-400 text-xs">
                          Bloqueado: {slot.blockReason}
                        </p>
                      ) : (
                        <p className="ml-6 text-slate-400 text-xs">Disponivel</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalCalendar;
```

**Step 2: Register route in App.tsx**

Add import:

```typescript
import ProfessionalCalendar from "./pages/professional/Calendar";
```

Add route inside `<Route path="professional">`:

```tsx
<Route path="agenda" element={<ProfessionalCalendar />} />
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/professional/Calendar.tsx frontend/src/services/calendarService.ts frontend/src/App.tsx
git commit -m "feat: add professional operational calendar page"
```

---

## Phase 3: Gestao Financeira Profissional (Financial Management)

### Task 7: Backend — Financial Forecast API Endpoint

**Files:**
- Test: `backend/tests/integration/professionalFinance.test.ts`
- Modify: `backend/src/controllers/walletController.ts`
- Modify: `backend/src/routes/walletRoutes.ts`

**Step 1: Write the failing test**

```typescript
// backend/tests/integration/professionalFinance.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Financial Forecast", () => {
  it("should calculate next withdrawal forecast from held payments", () => {
    const heldPayments = [
      { amount: 500, heldUntil: new Date("2026-02-20"), status: "HELD" },
      { amount: 300, heldUntil: new Date("2026-02-25"), status: "HELD" },
      { amount: 200, heldUntil: new Date("2026-03-01"), status: "HELD" },
    ];
    const feePercentage = 10;

    const forecast = heldPayments.map((p) => ({
      amount: p.amount * (1 - feePercentage / 100),
      releaseDate: p.heldUntil,
    }));

    expect(forecast[0]).toEqual({
      amount: 450,
      releaseDate: new Date("2026-02-20"),
    });
    expect(forecast[1]).toEqual({
      amount: 270,
      releaseDate: new Date("2026-02-25"),
    });
  });

  it("should compute fee breakdown correctly", () => {
    const grossAmount = 1000;
    const feePercentage = 10;
    const platformFee = grossAmount * (feePercentage / 100);
    const netAmount = grossAmount - platformFee;

    expect(platformFee).toBe(100);
    expect(netAmount).toBe(900);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/integration/professionalFinance.test.ts`
Expected: PASS

**Step 3: Add financial forecast endpoint to walletController.ts**

Add to the end of `backend/src/controllers/walletController.ts`:

```typescript
/**
 * GET /api/wallet/professional/overview
 * Enhanced financial overview with forecast
 */
export const getProfessionalFinancialOverview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access financial overview"));
      return;
    }

    const userId = req.user.id;

    const [user, heldPayments, earnedAgg, withdrawnAgg, feeAgg, escrowConfig] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        }),
        prisma.payment.findMany({
          where: { professionalId: userId, status: "HELD" },
          select: { amount: true, heldUntil: true, serviceOrderId: true },
          orderBy: { heldUntil: "asc" },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "PAYMENT" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "WITHDRAWAL" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "FEE" },
          _sum: { amount: true },
        }),
        prisma.escrowConfig.findFirst({ where: { name: "default" } }),
      ]);

    const feePercentage = escrowConfig?.platformFeePercentage ?? 10;
    const pendingInEscrow = heldPayments.reduce((sum, p) => sum + p.amount, 0);

    // Build release forecast
    const releaseForecast = heldPayments.map((p) => ({
      grossAmount: p.amount,
      netAmount: p.amount * (1 - feePercentage / 100),
      platformFee: p.amount * (feePercentage / 100),
      releaseDate: p.heldUntil,
      serviceOrderId: p.serviceOrderId,
    }));

    // Get recent transactions (last 30)
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        payment: { select: { id: true, status: true, serviceOrderId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.status(200).json(
      successResponse({
        balance: user?.balance || 0,
        totalEarned: earnedAgg._sum.amount || 0,
        totalWithdrawn: withdrawnAgg._sum.amount || 0,
        totalFees: feeAgg._sum.amount || 0,
        pendingInEscrow,
        feePercentage,
        releaseForecast,
        recentTransactions,
      }, "Professional financial overview retrieved"),
    );
  } catch (error) {
    console.error("Professional financial overview error:", error);
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};
```

**Step 4: Register route in walletRoutes.ts**

Add to `backend/src/routes/walletRoutes.ts`:

```typescript
router.get("/professional/overview", verifyToken, walletController.getProfessionalFinancialOverview);
```

**Step 5: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/tests/integration/professionalFinance.test.ts backend/src/controllers/walletController.ts backend/src/routes/walletRoutes.ts
git commit -m "feat: add professional financial overview API with release forecast"
```

---

### Task 8: Frontend — Enhanced Financial Management Page

**Files:**
- Modify: `frontend/src/services/walletService.ts`
- Create: `frontend/src/pages/professional/Finance.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add service function to walletService.ts**

Add to `frontend/src/services/walletService.ts`:

```typescript
export interface ReleaseForecastItem {
  grossAmount: number;
  netAmount: number;
  platformFee: number;
  releaseDate: string;
  serviceOrderId: number;
}

export interface ProfessionalFinancialOverview {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalFees: number;
  pendingInEscrow: number;
  feePercentage: number;
  releaseForecast: ReleaseForecastItem[];
  recentTransactions: Transaction[];
}

export const getProfessionalFinancialOverview = async (): Promise<ProfessionalFinancialOverview> => {
  const response = await api.get<ApiResponse<ProfessionalFinancialOverview>>(
    "/wallet/professional/overview"
  );
  return extractData(response);
};
```

**Step 2: Create Finance page**

Create `frontend/src/pages/professional/Finance.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import {
  Wallet,
  DollarSign,
  Clock,
  ArrowUpCircle,
  Percent,
  TrendingUp,
  Calendar,
  Shield,
} from "lucide-react";
import { StatsCard } from "../../components/dashboard/StatsCard";
import TransactionList from "../../components/wallet/TransactionList";
import WithdrawalModal from "../../components/wallet/WithdrawalModal";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  getProfessionalFinancialOverview,
  requestWithdrawal,
  ProfessionalFinancialOverview,
} from "../../services/walletService";
import type { TransactionType, Transaction } from "../../types";

const ProfessionalFinance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfessionalFinancialOverview | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const overview = await getProfessionalFinancialOverview();
        setData(overview);
      } catch (error) {
        console.error("Erro ao carregar dados financeiros:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleWithdrawal = async (amount: number) => {
    const result = await requestWithdrawal({ amount });
    if (data) {
      setData({
        ...data,
        balance: result.newBalance,
        totalWithdrawn: data.totalWithdrawn + amount,
      });
    }
  };

  if (loading) return <SkeletonDashboard />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Gestao Financeira
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Controle seus ganhos, taxas e previsoes de saque.
          </p>
        </div>
        <button
          onClick={() => setShowWithdrawalModal(true)}
          disabled={data.balance < 10}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowUpCircle className="w-5 h-5" />
          Solicitar Saque
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-6 h-6 text-emerald-200" />
            <p className="text-sm text-emerald-100">Saldo Disponivel</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.balance)}</p>
          <p className="text-sm text-emerald-200 mt-1">Pronto para saque</p>
        </div>

        <div className="card bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-amber-200" />
            <p className="text-sm text-amber-100">Em Escrow</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.pendingInEscrow)}</p>
          <p className="text-sm text-amber-200 mt-1">
            Aguardando liberacao ({data.releaseForecast.length} pagamento{data.releaseForecast.length !== 1 ? "s" : ""})
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Total Ganho (liquido)"
          value={formatCurrency(data.totalEarned)}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Total Sacado"
          value={formatCurrency(data.totalWithdrawn)}
          icon={<ArrowUpCircle className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Taxas Pagas"
          value={formatCurrency(data.totalFees)}
          subtitle={`Taxa: ${data.feePercentage}%`}
          icon={<Percent className="w-6 h-6" />}
          color="red"
        />
        <StatsCard
          title="Em Escrow"
          value={formatCurrency(data.pendingInEscrow)}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Release Forecast */}
      {data.releaseForecast.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Previsao de Recebimento
            </h2>
          </div>
          <div className="space-y-3">
            {data.releaseForecast.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Pedido #{item.serviceOrderId}
                    </p>
                    <p className="text-xs text-slate-500">
                      Liberacao: {item.releaseDate ? formatDate(item.releaseDate) : "A definir"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    +{formatCurrency(item.netAmount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Bruto: {formatCurrency(item.grossAmount)} | Taxa: {formatCurrency(item.platformFee)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Historico de Transacoes
        </h2>
        <TransactionList
          transactions={data.recentTransactions}
          loading={false}
          isProfessional={true}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          onFilterChange={() => {}}
          activeFilter={undefined}
        />
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        onConfirm={handleWithdrawal}
        balance={data.balance}
      />
    </div>
  );
};

export default ProfessionalFinance;
```

**Step 3: Register route in App.tsx**

Add import:

```typescript
import ProfessionalFinance from "./pages/professional/Finance";
```

Add route inside `<Route path="professional">`:

```tsx
<Route path="financeiro" element={<ProfessionalFinance />} />
```

**Step 4: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/services/walletService.ts frontend/src/pages/professional/Finance.tsx frontend/src/App.tsx
git commit -m "feat: add professional financial management page with release forecast"
```

---

## Phase 4: Reputacao Profissional Acionavel (Actionable Reputation)

### Task 9: Backend — Reputation Analytics API Endpoint

**Files:**
- Test: `backend/tests/integration/professionalReputation.test.ts`
- Create: `backend/src/controllers/reputationController.ts`
- Modify: `backend/src/routes/dashboardRoutes.ts`

**Step 1: Write the failing test**

```typescript
// backend/tests/integration/professionalReputation.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Reputation Analytics", () => {
  it("should identify low rating reasons", () => {
    const reviews = [
      { rating: 2, comment: "Atrasou muito", createdAt: new Date() },
      { rating: 1, comment: "Trabalho mal feito", createdAt: new Date() },
      { rating: 5, comment: "Excelente", createdAt: new Date() },
      { rating: 3, comment: "Ok mas demorou", createdAt: new Date() },
    ];

    const lowRatingReviews = reviews.filter((r) => r.rating <= 3);
    expect(lowRatingReviews.length).toBe(3);
  });

  it("should calculate churn risk based on recent ratings", () => {
    const ratings = [2, 3, 1, 4, 2]; // recent ratings
    const avgRecent = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const churnRisk = avgRecent < 3 ? "HIGH" : avgRecent < 4 ? "MEDIUM" : "LOW";

    expect(avgRecent).toBe(2.4);
    expect(churnRisk).toBe("HIGH");
  });

  it("should generate ranking improvement recommendations", () => {
    const stats = {
      avgResponseTimeHours: 8, // > 4h = slow
      completionRate: 75, // < 90% = needs improvement
      avgRating: 3.5, // < 4.0 = needs improvement
      cancelledOrders: 5,
      totalOrders: 20,
    };

    const recommendations: string[] = [];
    if (stats.avgResponseTimeHours > 4) {
      recommendations.push("RESPONSE_TIME");
    }
    if (stats.completionRate < 90) {
      recommendations.push("COMPLETION_RATE");
    }
    if (stats.avgRating < 4.0) {
      recommendations.push("QUALITY");
    }
    if (stats.cancelledOrders / stats.totalOrders > 0.1) {
      recommendations.push("RELIABILITY");
    }

    expect(recommendations).toContain("RESPONSE_TIME");
    expect(recommendations).toContain("COMPLETION_RATE");
    expect(recommendations).toContain("QUALITY");
    expect(recommendations).toContain("RELIABILITY");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/integration/professionalReputation.test.ts`
Expected: PASS

**Step 3: Create reputationController.ts**

Create `backend/src/controllers/reputationController.ts`:

```typescript
import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

/**
 * GET /api/dashboard/professional/reputation
 * Reputation analytics with low-rating reasons, churn risk, recommendations
 */
export const getReputationAnalytics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access reputation analytics"));
      return;
    }

    const userId = req.user.id;

    // Fetch all reviews about this professional (where isProfessional = false means client reviewed professional)
    const allReviews = await prisma.review.findMany({
      where: { targetId: userId, isProfessional: false },
      include: {
        author: { select: { id: true, name: true, profileImage: true } },
        serviceOrder: { select: { id: true, title: true, completedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Low rating reviews (3 or below)
    const lowRatingReviews = allReviews
      .filter((r) => r.rating <= 3)
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.author,
        serviceOrder: r.serviceOrder,
        createdAt: r.createdAt,
      }));

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of allReviews) {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    }

    // User stats
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ratingAverage: true, totalReviews: true },
    });

    // Order stats for completion rate and response time
    const [totalOrders, completedOrders, cancelledOrders, acceptedOrders] = await Promise.all([
      prisma.serviceOrder.count({ where: { professionalId: userId } }),
      prisma.serviceOrder.count({ where: { professionalId: userId, status: "COMPLETED" } }),
      prisma.serviceOrder.count({ where: { professionalId: userId, status: "CANCELLED" } }),
      prisma.serviceOrder.findMany({
        where: {
          professionalId: userId,
          status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "AWAITING_CLIENT_CONFIRMATION"] },
        },
        select: { createdAt: true, startedAt: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const completionRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 100)
      : 100;

    // Average response time (time from order creation to acceptance/start)
    const responseTimes = acceptedOrders
      .filter((o) => o.startedAt)
      .map((o) => (o.startedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60));
    const avgResponseTimeHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Churn risk calculation
    const recentReviews = allReviews.slice(0, 5);
    const avgRecentRating = recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : 5;
    const churnRisk: "LOW" | "MEDIUM" | "HIGH" =
      avgRecentRating < 3 ? "HIGH" : avgRecentRating < 4 ? "MEDIUM" : "LOW";

    // Generate recommendations
    const recommendations: Array<{
      type: string;
      title: string;
      description: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
    }> = [];

    if (avgResponseTimeHours > 4) {
      recommendations.push({
        type: "RESPONSE_TIME",
        title: "Melhore seu tempo de resposta",
        description: `Seu tempo medio de resposta e ${avgResponseTimeHours.toFixed(1)}h. Tente responder em ate 2h para melhorar seu ranking.`,
        priority: avgResponseTimeHours > 8 ? "HIGH" : "MEDIUM",
      });
    }

    if (completionRate < 90) {
      recommendations.push({
        type: "COMPLETION_RATE",
        title: "Aumente sua taxa de conclusao",
        description: `Sua taxa de conclusao e ${completionRate}%. Profissionais com mais de 90% tem mais visibilidade.`,
        priority: completionRate < 70 ? "HIGH" : "MEDIUM",
      });
    }

    if ((user?.ratingAverage || 0) < 4.0) {
      recommendations.push({
        type: "QUALITY",
        title: "Melhore a qualidade dos servicos",
        description: `Sua avaliacao media e ${(user?.ratingAverage || 0).toFixed(1)}. Foque em pontualidade e comunicacao com o cliente.`,
        priority: (user?.ratingAverage || 0) < 3.0 ? "HIGH" : "MEDIUM",
      });
    }

    if (totalOrders > 0 && cancelledOrders / totalOrders > 0.1) {
      recommendations.push({
        type: "RELIABILITY",
        title: "Reduza cancelamentos",
        description: `Voce tem ${cancelledOrders} cancelamentos em ${totalOrders} pedidos (${Math.round(cancelledOrders / totalOrders * 100)}%). Aceite apenas servicos que pode cumprir.`,
        priority: "HIGH",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: "KEEP_GOING",
        title: "Continue assim!",
        description: "Seu desempenho esta otimo. Continue mantendo a qualidade do servico.",
        priority: "LOW",
      });
    }

    res.status(200).json(
      successResponse({
        averageRating: user?.ratingAverage || 0,
        totalReviews: user?.totalReviews || 0,
        ratingDistribution,
        lowRatingReviews,
        completionRate,
        avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
        churnRisk,
        churnRiskScore: avgRecentRating,
        recommendations,
        stats: {
          totalOrders,
          completedOrders,
          cancelledOrders,
        },
      }, "Reputation analytics retrieved"),
    );
  } catch (error) {
    console.error("Reputation analytics error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 4: Register route**

Add to `backend/src/routes/dashboardRoutes.ts`:

```typescript
import * as reputationController from "../controllers/reputationController";

router.get("/professional/reputation", verifyToken, reputationController.getReputationAnalytics);
```

**Step 5: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/tests/integration/professionalReputation.test.ts backend/src/controllers/reputationController.ts backend/src/routes/dashboardRoutes.ts
git commit -m "feat: add professional reputation analytics API endpoint"
```

---

### Task 10: Frontend — Reputation Service Layer

**Files:**
- Create: `frontend/src/services/reputationService.ts`

**Step 1: Create reputation service**

Create `frontend/src/services/reputationService.ts`:

```typescript
import api, { ApiResponse, extractData } from "./api";

export interface LowRatingReview {
  id: number;
  rating: number;
  comment: string | null;
  author: { id: number; name: string; profileImage: string | null };
  serviceOrder: { id: number; title: string; completedAt: string | null };
  createdAt: string;
}

export interface ReputationRecommendation {
  type: string;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ReputationAnalytics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  lowRatingReviews: LowRatingReview[];
  completionRate: number;
  avgResponseTimeHours: number;
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  churnRiskScore: number;
  recommendations: ReputationRecommendation[];
  stats: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  };
}

export const getReputationAnalytics = async (): Promise<ReputationAnalytics> => {
  const response = await api.get<ApiResponse<ReputationAnalytics>>(
    "/dashboard/professional/reputation"
  );
  return extractData(response);
};
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/services/reputationService.ts
git commit -m "feat: add reputation service layer"
```

---

### Task 11: Frontend — Reputation Dashboard Page

**Files:**
- Create: `frontend/src/pages/professional/Reputation.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Reputation page**

Create `frontend/src/pages/professional/Reputation.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import {
  Star,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Zap,
  MessageCircle,
  ThumbsDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  getReputationAnalytics,
  ReputationAnalytics,
} from "../../services/reputationService";
import { formatRelativeTime, formatRating } from "../../utils/formatters";

const CHURN_RISK_CONFIG = {
  LOW: {
    label: "Baixo",
    color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30",
    icon: Shield,
  },
  MEDIUM: {
    label: "Medio",
    color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    icon: AlertTriangle,
  },
  HIGH: {
    label: "Alto",
    color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
    icon: XCircle,
  },
};

const PRIORITY_CONFIG = {
  HIGH: { label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  MEDIUM: { label: "Media", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  LOW: { label: "Baixa", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  RESPONSE_TIME: <Zap className="w-5 h-5" />,
  COMPLETION_RATE: <CheckCircle className="w-5 h-5" />,
  QUALITY: <Star className="w-5 h-5" />,
  RELIABILITY: <Shield className="w-5 h-5" />,
  KEEP_GOING: <TrendingUp className="w-5 h-5" />,
};

const ProfessionalReputation: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReputationAnalytics | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const analytics = await getReputationAnalytics();
        setData(analytics);
      } catch (error) {
        console.error("Erro ao carregar reputacao:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <SkeletonDashboard />;
  if (!data) return null;

  const churnConfig = CHURN_RISK_CONFIG[data.churnRisk];
  const ChurnIcon = churnConfig.icon;

  const maxRatingCount = Math.max(...Object.values(data.ratingDistribution), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reputacao Profissional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Analise seu desempenho e descubra como melhorar seu ranking.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rating Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avaliacao Media</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatRating(data.averageRating)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">{data.totalReviews} avaliacoes</p>
        </div>

        {/* Completion Rate */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Taxa de Conclusao</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.completionRate}%
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {data.stats.completedOrders}/{data.stats.totalOrders} pedidos
          </p>
        </div>

        {/* Response Time */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Tempo de Resposta</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.avgResponseTimeHours}h
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {data.avgResponseTimeHours <= 2 ? "Excelente" : data.avgResponseTimeHours <= 4 ? "Bom" : "Precisa melhorar"}
          </p>
        </div>

        {/* Churn Risk */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${churnConfig.color}`}>
              <ChurnIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Risco de Churn</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {churnConfig.label}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Baseado nas ultimas 5 avaliacoes
          </p>
        </div>
      </div>

      {/* Churn Alert (only if HIGH) */}
      {data.churnRisk === "HIGH" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              Atencao: Risco alto de perda de clientes
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">
              Suas avaliacoes recentes estao abaixo da media. Siga as recomendacoes abaixo para melhorar.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Distribuicao de Avaliacoes
          </h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.ratingDistribution[star] || 0;
              const percentage = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{star}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        star >= 4 ? "bg-emerald-500" : star === 3 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Recomendacoes para Melhorar
          </h2>
          <div className="space-y-3">
            {data.recommendations.map((rec, idx) => {
              const priorityConfig = PRIORITY_CONFIG[rec.priority];
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 flex-shrink-0 mt-0.5">
                      {RECOMMENDATION_ICONS[rec.type] || <TrendingUp className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Low Rating Reviews */}
      {data.lowRatingReviews.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsDown className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Avaliacoes com Notas Baixas
            </h2>
          </div>
          <div className="space-y-3">
            {data.lowRatingReviews.map((review) => (
              <div
                key={review.id}
                className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= review.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-500">
                      {formatRelativeTime(review.createdAt)}
                    </span>
                  </div>
                  <Link
                    to={`/professional/services/${review.serviceOrder.id}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Pedido #{review.serviceOrder.id}
                  </Link>
                </div>
                {review.comment && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    "{review.comment}"
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MessageCircle className="w-3 h-3" />
                  <span>por {review.author.name}</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>{review.serviceOrder.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalReputation;
```

**Step 2: Register route in App.tsx**

Add import:

```typescript
import ProfessionalReputation from "./pages/professional/Reputation";
```

Add route inside `<Route path="professional">`:

```tsx
<Route path="reputacao" element={<ProfessionalReputation />} />
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/professional/Reputation.tsx frontend/src/services/reputationService.ts frontend/src/App.tsx
git commit -m "feat: add professional reputation dashboard with analytics and recommendations"
```

---

## Phase 5: Navigation Integration

### Task 12: Update Professional Dashboard Navigation

**Files:**
- Modify: `frontend/src/pages/professional/Dashboard.tsx`

**Step 1: Add navigation links to new pages in Dashboard quick actions**

Replace the quick actions grid section in `frontend/src/pages/professional/Dashboard.tsx` to include links to CRM, Agenda, Financeiro, and Reputacao:

```tsx
{/* Ações rápidas */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 stagger-grid">
  <Link to="/professional/services" className="card card-hover flex items-center gap-4 p-6">
    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
      <FileText className="w-6 h-6 text-primary-600" />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Meus Pedidos</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Gerencie seus pedidos</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
  </Link>

  <Link to="/professional/crm" className="card card-hover flex items-center gap-4 p-6">
    <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
      <TrendingUp className="w-6 h-6 text-cyan-600" />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">CRM</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Pedidos e faturamento</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
  </Link>

  <Link to="/professional/agenda" className="card card-hover flex items-center gap-4 p-6">
    <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
      <Clock className="w-6 h-6 text-violet-600" />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Agenda</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Calendario operacional</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
  </Link>

  <Link to="/professional/financeiro" className="card card-hover flex items-center gap-4 p-6">
    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
      <Wallet className="w-6 h-6 text-green-600" />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Financeiro</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Ganhos e saques</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
  </Link>

  <Link to="/professional/reputacao" className="card card-hover flex items-center gap-4 p-6">
    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
      <Star className="w-6 h-6 text-amber-600" />
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Reputacao</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Avaliacoes e ranking</p>
    </div>
    <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
  </Link>
</div>
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat: add navigation links to new professional features in dashboard"
```

---

## Phase 6: Run All Tests

### Task 13: Run All Tests and Verify Build

**Step 1: Run backend tests**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run`
Expected: All tests pass

**Step 2: Run frontend type check**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run frontend build**

Run: `cd /home/levybonito/faztudo-main/frontend && npx vite build`
Expected: Build succeeds

**Step 4: Run backend build**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: professional features implementation complete — CRM, calendar, finance, reputation"
```

---

## Summary of New Routes

### Backend API Routes Added
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/dashboard/professional/crm` | CRM stats (orders today, 7d, monthly revenue, pending) |
| GET | `/api/dashboard/professional/calendar?month=YYYY-MM` | Calendar monthly overview |
| GET | `/api/dashboard/professional/calendar/:date` | Calendar daily detail with hourly slots |
| GET | `/api/wallet/professional/overview` | Enhanced financial overview with release forecast |
| GET | `/api/dashboard/professional/reputation` | Reputation analytics with recommendations |

### Frontend Routes Added
| Route | Page | Description |
|-------|------|-------------|
| `/professional/crm` | CRM.tsx | Smart CRM dashboard |
| `/professional/agenda` | Calendar.tsx | Operational calendar |
| `/professional/financeiro` | Finance.tsx | Financial management |
| `/professional/reputacao` | Reputation.tsx | Reputation analytics |

### New Files Created
**Backend:**
- `backend/src/controllers/calendarController.ts`
- `backend/src/controllers/reputationController.ts`
- `backend/tests/integration/professionalCrm.test.ts`
- `backend/tests/integration/professionalCalendar.test.ts`
- `backend/tests/integration/professionalFinance.test.ts`
- `backend/tests/integration/professionalReputation.test.ts`

**Frontend:**
- `frontend/src/pages/professional/CRM.tsx`
- `frontend/src/pages/professional/Calendar.tsx`
- `frontend/src/pages/professional/Finance.tsx`
- `frontend/src/pages/professional/Reputation.tsx`
- `frontend/src/services/calendarService.ts`
- `frontend/src/services/reputationService.ts`

### Files Modified
**Backend:**
- `backend/src/controllers/dashboardController.ts` (add CRM endpoint)
- `backend/src/controllers/walletController.ts` (add financial overview endpoint)
- `backend/src/routes/dashboardRoutes.ts` (register new routes)
- `backend/src/routes/walletRoutes.ts` (register financial overview route)

**Frontend:**
- `frontend/src/App.tsx` (register 4 new routes)
- `frontend/src/services/dashboardService.ts` (add CRM types and service function)
- `frontend/src/services/walletService.ts` (add financial overview types and service function)
- `frontend/src/pages/professional/Dashboard.tsx` (update quick action links)
