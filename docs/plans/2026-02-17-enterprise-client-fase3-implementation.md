# Enterprise Client — Fase 3: Vitrine do Profissional + Analytics Empresarial — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar vitrine pública para profissionais avulsos, analytics avançado para empresas (gráficos de receita, performance por membro, taxa de conclusão), e fila de verificação de empresas no painel admin.

**Architecture:** Backend com endpoint público `GET /api/services/professional/:userId/storefront` e novos endpoints de analytics em `/api/company/analytics`. Admin ganha endpoints `GET /api/admin/companies/pending` e `POST /api/admin/companies/:id/verify`. Frontend com nova página `/profissional/:userId` (pública), página `/company/analytics` protegida, e `/admin/companies` no painel admin. Nenhum novo modelo de banco necessário — usa dados existentes agregados.

**Tech Stack:** Express 5 + Prisma 7 (SQLite) + TypeScript + React 18 + Vite + TailwindCSS + Pino

**Depends on:**
- `docs/plans/2026-02-17-enterprise-client-fase1-implementation.md` (Fase 1 deve estar implementada)
- `docs/plans/2026-02-17-enterprise-client-fase2-implementation.md` (Fase 2 deve estar implementada)

**Design doc:** `docs/plans/2026-02-17-enterprise-client-fase1-design.md`

---

## ⚠️ Pré-requisitos — O que as Fases 1 e 2 já criaram (NÃO recriar)

| Artefato | Status |
|---|---|
| `UserRole.COMPANY`, todos os modelos Company* | ✅ Fase 1 |
| `CompanyChannel`, `CompanyChannelMember` | ✅ Fase 2 |
| `src/middleware/companyPermission.ts` | ✅ Fase 1 |
| `src/types/company.ts` com todos os tipos | ✅ Fases 1 e 2 |
| Rotas `/api/company/*` registradas | ✅ Fases 1 e 2 |
| Bloco `/company/*` em `App.tsx` | ✅ Fase 1 + 2 — apenas adicionar filhos |
| `isCompany` no `AuthContext` | ✅ Fase 1 |
| Nav links empresa no `Layout.tsx` | ✅ Fase 2 |
| Endpoint `GET /api/admin/verifications` (para verificações de docs) | ✅ Projeto original |

---

## Visão Geral das Tasks

| # | Task | Área | Depende de |
|---|---|---|---|
| 1 | Backend — endpoint vitrine profissional avulso | Backend | — |
| 2 | Backend — endpoints analytics empresa | Backend | — |
| 3 | Backend — endpoints admin verificação empresas | Backend | — |
| 4 | Frontend tipos — analytics + vitrine profissional | Frontend | — |
| 5 | Página pública ProfessionalStorefront | Frontend | 1, 4 |
| 6 | Adicionar link vitrine no ServiceSearch + ServiceDetails | Frontend | 5 |
| 7 | Página company/Analytics | Frontend | 2, 4 |
| 8 | Componentes de analytics (gráficos, tabelas) | Frontend | 4 |
| 9 | Adicionar rota /company/analytics em App.tsx | Frontend | 7, 8 |
| 10 | Adicionar link Analytics no Layout | Frontend | 7 |
| 11 | Página admin/CompanyVerifications | Frontend | 3 |
| 12 | Adicionar rota + link admin para verificações de empresa | Frontend | 11 |
| 13 | Testes de integração — analytics + vitrine | Backend | 1, 2, 3 |
| 14 | Seed — adicionar dados de exemplo para analytics | Backend | — |

---

## Task 1: Backend — Endpoint Vitrine Profissional Avulso

**Files:**
- Modify: `backend/src/controllers/service/listingController.ts` (ou criar endpoint em `serviceRoutes.ts`)
- Modify: `backend/src/routes/serviceRoutes.ts`

### Step 1a: Escrever teste falhando

Em `backend/tests/professionalStorefront.test.ts` (criar arquivo):
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "../src/lib/prisma";

describe("Professional Storefront", () => {
  let professionalUserId: number;

  beforeAll(async () => {
    const prof = await prisma.user.findFirst({ where: { email: "profissional@teste.com" } });
    professionalUserId = prof?.id ?? 0;
  });

  it("should return professional storefront publicly (no auth)", async () => {
    if (!professionalUserId) return;
    const res = await request(app)
      .get(`/api/services/professional/${professionalUserId}/storefront`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data).toHaveProperty("services");
  });

  it("should return 404 for non-existent professional", async () => {
    const res = await request(app).get("/api/services/professional/999999/storefront");
    expect(res.status).toBe(404);
  });

  it("should return 400 for non-professional userId", async () => {
    // Usar um cliente (não profissional)
    const client = await prisma.user.findFirst({ where: { email: "cliente@teste.com" } });
    if (!client) return;
    const res = await request(app).get(`/api/services/professional/${client.id}/storefront`);
    expect(res.status).toBe(400);
  });
});
```

### Step 1b: Rodar para confirmar falha

```bash
cd backend && npx vitest run tests/professionalStorefront.test.ts 2>/dev/null || true
```
Esperado: FAIL — rota não existe.

### Step 1c: Criar a função getProfessionalStorefront

Localizar `backend/src/controllers/service/listingController.ts` e adicionar ao final:
```typescript
/** GET /api/services/professional/:userId/storefront — vitrine pública do profissional */
export const getProfessionalStorefront = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const professionalId = parseInt(userId, 10);

    if (isNaN(professionalId)) {
      res.status(400).json({ success: false, message: "ID inválido" });
      return;
    }

    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImage: true,
        role: true,
        isVerified: true,
        ratingAverage: true,
        totalReviews: true,
        createdAt: true,
        categories: {
          include: { category: { select: { id: true, name: true, icon: true } } },
        },
        certifications: {
          select: { id: true, title: true, issuer: true, issueDate: true },
          take: 5,
        },
        reviewsReceived: {
          where: { isProfessional: true },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true, rating: true, comment: true, createdAt: true,
            author: { select: { id: true, name: true, profileImage: true } },
          },
        },
        serviceListings: {
          where: { isAvailable: true },
          include: { category: { select: { id: true, name: true, icon: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!professional) {
      res.status(404).json({ success: false, message: "Profissional não encontrado" });
      return;
    }

    if (professional.role !== "PROFESSIONAL") {
      res.status(400).json({ success: false, message: "Usuário não é um profissional" });
      return;
    }

    // Estatísticas básicas
    const completedOrders = await prisma.serviceOrder.count({
      where: { professionalId, status: "COMPLETED" },
    });

    res.json({
      success: true,
      message: "Vitrine obtida",
      data: {
        user: professional,
        services: professional.serviceListings,
        stats: {
          completedOrders,
          ratingAverage: professional.ratingAverage,
          totalReviews: professional.totalReviews,
        },
        recentReviews: professional.reviewsReceived,
      },
    });
  } catch (err) {
    log.error({ err }, "getProfessionalStorefront error");
    throw err;
  }
};
```

### Step 1d: Registrar a rota em serviceRoutes.ts

Localizar o bloco de rotas com parâmetros `:id` em `serviceRoutes.ts` e adicionar ANTES delas (para não ser capturada pelo param middleware):
```typescript
// Vitrine pública do profissional (sem auth)
router.get("/professional/:userId/storefront", serviceController.getProfessionalStorefront);
```

**Atenção:** Esta rota deve ser adicionada ANTES das rotas `/:id` para não conflitar com o `router.param("id", ...)`.

### Step 1e: Exportar a função no index de controllers

Em `backend/src/controllers/service/index.ts`, verificar se há re-export e adicionar:
```typescript
export { getProfessionalStorefront } from "./listingController";
```

### Step 1f: Rodar o teste

```bash
cd backend && npx vitest run tests/professionalStorefront.test.ts
```
Esperado: PASS

### Step 1g: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 1h: Commit

```bash
cd backend
git add src/controllers/service/listingController.ts src/controllers/service/index.ts src/routes/serviceRoutes.ts tests/professionalStorefront.test.ts
git commit -m "feat: add public professional storefront endpoint"
```

---

## Task 2: Backend — Endpoints Analytics Empresa

**Files:**
- Create: `backend/src/controllers/companyAnalyticsController.ts`
- Modify: `backend/src/routes/companyRoutes.ts`

### Step 2a: Criar companyAnalyticsController.ts

```typescript
// backend/src/controllers/companyAnalyticsController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyAnalyticsController");

/** GET /api/company/analytics/revenue — receita mensal dos últimos 6 meses */
export async function getRevenueAnalytics(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    // Últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await prisma.payment.findMany({
      where: {
        professionalId: companyProfile.userId,
        status: { in: ["HELD", "RELEASED"] },
        paidAt: { gte: sixMonthsAgo },
      },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "asc" },
    });

    // Agrupar por mês
    const monthlyRevenue: Record<string, number> = {};
    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + payment.amount;
    }

    const data = Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue }));

    return res.json({ success: true, message: "Analytics de receita obtido", data });
  } catch (err) {
    log.error({ err }, "getRevenueAnalytics error");
    throw err;
  }
}

/** GET /api/company/analytics/members — performance por membro */
export async function getMemberPerformance(req: AuthRequest, res: Response) {
  try {
    const members = await prisma.companyMember.findMany({
      where: { companyId: req.companyId!, isActive: true },
      include: {
        user: { select: { id: true, name: true, profileImage: true, ratingAverage: true } },
        role: { select: { name: true, color: true } },
        teamMemberships: {
          include: {
            team: {
              include: {
                order: { select: { status: true, price: true } },
              },
            },
          },
        },
        ledTeams: {
          include: {
            order: { select: { status: true } },
          },
        },
      },
    });

    const performance = members.map(member => {
      const allTeams = member.teamMemberships;
      const totalAssigned = allTeams.length;
      const completed = allTeams.filter(t => t.team.order.status === "COMPLETED").length;
      const inProgress = allTeams.filter(t => t.team.order.status === "IN_PROGRESS").length;
      const ledTotal = member.ledTeams.length;
      const ledCompleted = member.ledTeams.filter(t => t.order.status === "COMPLETED").length;
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

      return {
        member: {
          id: member.id,
          name: member.user.name,
          profileImage: member.user.profileImage,
          role: member.role,
          ratingAverage: member.user.ratingAverage,
        },
        stats: {
          totalAssigned,
          completed,
          inProgress,
          completionRate,
          ledTotal,
          ledCompleted,
        },
      };
    });

    // Ordenar por taxa de conclusão (maior primeiro)
    performance.sort((a, b) => b.stats.completionRate - a.stats.completionRate);

    return res.json({ success: true, message: "Performance de membros obtida", data: performance });
  } catch (err) {
    log.error({ err }, "getMemberPerformance error");
    throw err;
  }
}

/** GET /api/company/analytics/services — top serviços por pedidos */
export async function getTopServices(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const listings = await prisma.serviceListing.findMany({
      where: { professionalId: companyProfile.userId },
      include: {
        category: { select: { name: true } },
        _count: { select: { serviceOrders: true } },
        serviceOrders: {
          where: { status: "COMPLETED" },
          select: { price: true },
        },
      },
      orderBy: { serviceOrders: { _count: "desc" } },
      take: 10,
    });

    const data = listings.map(listing => ({
      id: listing.id,
      title: listing.title,
      category: listing.category.name,
      price: listing.price,
      totalOrders: listing._count.serviceOrders,
      completedOrders: listing.serviceOrders.length,
      totalRevenue: listing.serviceOrders.reduce((sum, o) => sum + o.price, 0),
    }));

    return res.json({ success: true, message: "Top serviços obtidos", data });
  } catch (err) {
    log.error({ err }, "getTopServices error");
    throw err;
  }
}

/** GET /api/company/analytics/overview — resumo geral */
export async function getAnalyticsOverview(req: AuthRequest, res: Response) {
  try {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      select: { userId: true },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalOrders,
      completedOrders,
      ordersLast30Days,
      totalRevenue,
      revenueLast30Days,
      totalMembers,
      activeMembers,
      avgRating,
    ] = await Promise.all([
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId } }),
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId, status: "COMPLETED" } }),
      prisma.serviceOrder.count({ where: { professionalId: companyProfile.userId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.payment.aggregate({
        where: { professionalId: companyProfile.userId, status: { in: ["HELD", "RELEASED"] } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { professionalId: companyProfile.userId, status: { in: ["HELD", "RELEASED"] }, paidAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
      prisma.companyMember.count({ where: { companyId: req.companyId! } }),
      prisma.companyMember.count({ where: { companyId: req.companyId!, isActive: true } }),
      prisma.user.findUnique({ where: { id: companyProfile.userId }, select: { ratingAverage: true } }),
    ]);

    const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    return res.json({
      success: true,
      message: "Overview obtido",
      data: {
        totalOrders,
        completedOrders,
        ordersLast30Days,
        completionRate,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        revenueLast30Days: revenueLast30Days._sum.amount ?? 0,
        totalMembers,
        activeMembers,
        averageRating: avgRating?.ratingAverage ?? 0,
      },
    });
  } catch (err) {
    log.error({ err }, "getAnalyticsOverview error");
    throw err;
  }
}
```

### Step 2b: Adicionar rotas de analytics em companyRoutes.ts

Em `backend/src/routes/companyRoutes.ts`, adicionar imports e rotas:
```typescript
import {
  getRevenueAnalytics,
  getMemberPerformance,
  getTopServices,
  getAnalyticsOverview,
} from "../controllers/companyAnalyticsController";

// Dentro do router, após as rotas existentes:
router.get("/analytics/overview", requireCompanyPermission("metrics.view"), getAnalyticsOverview);
router.get("/analytics/revenue", requireCompanyPermission("metrics.view"), getRevenueAnalytics);
router.get("/analytics/members", requireCompanyPermission("metrics.viewTeam"), getMemberPerformance);
router.get("/analytics/services", requireCompanyPermission("metrics.view"), getTopServices);
```

### Step 2c: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 2d: Commit

```bash
cd backend
git add src/controllers/companyAnalyticsController.ts src/routes/companyRoutes.ts
git commit -m "feat: add company analytics endpoints (revenue, member performance, top services)"
```

---

## Task 3: Backend — Endpoints Admin Verificação de Empresas

**Files:**
- Modify: `backend/src/controllers/adminController.ts`
- Modify: `backend/src/routes/adminRoutes.ts`

### Step 3a: Escrever teste falhando

Em `backend/tests/adminCompanyVerification.test.ts` (criar arquivo):
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import prisma from "../src/lib/prisma";

describe("Admin Company Verification", () => {
  let adminToken: string;

  beforeAll(async () => {
    // Buscar admin do seed
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) return;
    const res = await request(app).post("/api/auth/login").send({
      email: admin.email,
      password: "Teste@123",
    });
    adminToken = res.body.data?.token;
  });

  it("should list pending companies", async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get("/api/admin/companies/pending")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should reject non-admin access to pending companies", async () => {
    const res = await request(app).get("/api/admin/companies/pending");
    expect(res.status).toBe(401);
  });
});
```

### Step 3b: Rodar para confirmar falha

```bash
cd backend && npx vitest run tests/adminCompanyVerification.test.ts 2>/dev/null || true
```
Esperado: FAIL — rota não existe.

### Step 3c: Adicionar funções ao adminController.ts

Em `backend/src/controllers/adminController.ts`, localizar o final do arquivo e adicionar:

```typescript
/** GET /api/admin/companies/pending — listar empresas aguardando verificação */
export const getPendingCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companies = await prisma.companyProfile.findMany({
      where: { isVerified: false },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, status: true,
            createdAt: true, profileImage: true,
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, message: "Empresas pendentes obtidas", data: companies });
  } catch (err) {
    log.error({ err }, "getPendingCompanies error");
    throw err;
  }
};

/** POST /api/admin/companies/:companyId/verify — verificar/rejeitar empresa */
export const verifyCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { approved, reason } = req.body;

    const company = await prisma.companyProfile.findUnique({
      where: { id: Number(companyId) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!company) {
      res.status(404).json({ success: false, message: "Empresa não encontrada" });
      return;
    }

    await prisma.companyProfile.update({
      where: { id: Number(companyId) },
      data: { isVerified: Boolean(approved) },
    });

    // Notificar a empresa
    await prisma.notification.create({
      data: {
        userId: company.userId,
        type: "SYSTEM_ALERT",
        title: approved ? "Empresa verificada!" : "Verificação recusada",
        message: approved
          ? `Parabéns! ${company.companyName} foi verificada e agora tem o selo de Empresa Verificada.`
          : `A verificação de ${company.companyName} foi recusada. ${reason ? `Motivo: ${reason}` : ""}`,
      },
    });

    res.json({
      success: true,
      message: approved ? "Empresa verificada com sucesso" : "Verificação recusada",
      data: { companyId: Number(companyId), isVerified: Boolean(approved) },
    });
  } catch (err) {
    log.error({ err }, "verifyCompany error");
    throw err;
  }
};

/** GET /api/admin/companies — listar todas as empresas */
export const getAllCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { verified } = req.query;
    const whereFilter = verified === "true"
      ? { isVerified: true }
      : verified === "false"
        ? { isVerified: false }
        : {};

    const companies = await prisma.companyProfile.findMany({
      where: whereFilter,
      include: {
        user: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, message: "Empresas obtidas", data: companies });
  } catch (err) {
    log.error({ err }, "getAllCompanies error");
    throw err;
  }
};
```

**Nota:** Verificar que `log` já está definido no adminController com `const log = createLogger("adminController")`. Se não, adicionar o import.

### Step 3d: Adicionar rotas no adminRoutes.ts

Em `backend/src/routes/adminRoutes.ts`, importar as novas funções e adicionar as rotas:
```typescript
import { getPendingCompanies, verifyCompany, getAllCompanies } from "../controllers/adminController";

// Adicionar ao router (requer requireRole("ADMIN")):
router.get("/companies", verifyToken, requireRole("ADMIN"), getAllCompanies);
router.get("/companies/pending", verifyToken, requireRole("ADMIN"), getPendingCompanies);
router.post("/companies/:companyId/verify", verifyToken, requireRole("ADMIN"), verifyCompany);
```

### Step 3e: Rodar o teste

```bash
cd backend && npx vitest run tests/adminCompanyVerification.test.ts
```
Esperado: PASS

### Step 3f: Checar tipos e suite completa

```bash
cd backend && npx tsc --noEmit && npm test
```
Esperado: sem erros, todos os testes passando.

### Step 3g: Commit

```bash
cd backend
git add src/controllers/adminController.ts src/routes/adminRoutes.ts tests/adminCompanyVerification.test.ts
git commit -m "feat: add admin company verification endpoints"
```

---

## Task 4: Frontend Tipos — Analytics + Vitrine Profissional

**Files:**
- Modify: `frontend/src/types/company.ts`
- Create: `frontend/src/types/storefront.ts`
- Modify: `frontend/src/types/index.ts`

### Step 4a: Adicionar tipos de analytics em company.ts

Ao final de `frontend/src/types/company.ts`, adicionar:
```typescript
export interface RevenueDataPoint {
  month: string; // "YYYY-MM"
  revenue: number;
}

export interface MemberPerformance {
  member: {
    id: number;
    name: string;
    profileImage?: string;
    role: { name: string; color?: string };
    ratingAverage: number;
  };
  stats: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    completionRate: number;
    ledTotal: number;
    ledCompleted: number;
  };
}

export interface TopService {
  id: number;
  title: string;
  category: string;
  price: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

export interface AnalyticsOverview {
  totalOrders: number;
  completedOrders: number;
  ordersLast30Days: number;
  completionRate: number;
  totalRevenue: number;
  revenueLast30Days: number;
  totalMembers: number;
  activeMembers: number;
  averageRating: number;
}

export interface PendingCompany {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  industry?: string;
  createdAt: string;
  isVerified: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
    createdAt: string;
  };
  _count: { members: number };
}
```

### Step 4b: Criar frontend/src/types/storefront.ts

```typescript
// frontend/src/types/storefront.ts

export interface ProfessionalStorefront {
  user: {
    id: number;
    name: string;
    bio?: string;
    profileImage?: string;
    isVerified: boolean;
    ratingAverage: number;
    totalReviews: number;
    createdAt: string;
    categories: Array<{
      category: { id: number; name: string; icon?: string };
    }>;
    certifications: Array<{
      id: number;
      title: string;
      issuer: string;
      issueDate: string;
    }>;
  };
  services: Array<{
    id: number;
    title: string;
    description: string;
    price: number;
    estimatedHours?: number;
    images: string[];
    tags: string[];
    category: { id: number; name: string; icon?: string };
  }>;
  stats: {
    completedOrders: number;
    ratingAverage: number;
    totalReviews: number;
  };
  recentReviews: Array<{
    id: number;
    rating: number;
    comment?: string;
    createdAt: string;
    author: { id: number; name: string; profileImage?: string };
  }>;
}
```

### Step 4c: Adicionar storefront.ts ao barrel index.ts

Em `frontend/src/types/index.ts`, adicionar:
```typescript
export * from "./storefront";
```

### Step 4d: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 4e: Commit

```bash
cd frontend
git add src/types/company.ts src/types/storefront.ts src/types/index.ts
git commit -m "feat: add analytics and storefront types"
```

---

## Task 5: Página Pública ProfessionalStorefront

**Files:**
- Create: `frontend/src/pages/ProfessionalStorefront.tsx`

### Step 5a: Criar ProfessionalStorefront.tsx

```typescript
// frontend/src/pages/ProfessionalStorefront.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Star, CheckCircle, Briefcase, Award, ArrowLeft, MessageCircle,
} from "lucide-react";
import api from "../services/api";
import { ProfessionalStorefront } from "../types";
import { Skeleton } from "../components/common/Skeleton";
import { formatCurrency, formatRating } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";

const ProfessionalStorefrontPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<ProfessionalStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/services/professional/${userId}/storefront`);
        setData(res.data.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Profissional não encontrado");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-48 rounded-2xl mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-slate-500">{error || "Profissional não encontrado"}</p>
        <button onClick={() => navigate(-1)} className="btn btn-ghost mt-4">Voltar</button>
      </div>
    );
  }

  const { user, services, stats, recentReviews } = data;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover rounded-2xl" />
            ) : (
              user.name.charAt(0)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h1>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  <CheckCircle className="h-3 w-3" />
                  Verificado
                </span>
              )}
            </div>
            {user.bio && <p className="text-slate-500 mt-1 text-sm">{user.bio}</p>}

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold text-sm">{formatRating(user.ratingAverage)}</span>
                <span className="text-slate-400 text-sm">({user.totalReviews} avaliações)</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500 text-sm">
                <Briefcase className="h-4 w-4" />
                {stats.completedOrders} serviços concluídos
              </div>
            </div>

            {/* Categorias */}
            {user.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {user.categories.map(cat => (
                  <span key={cat.category.id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                    {cat.category.icon} {cat.category.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Certificações */}
        {user.certifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <Award className="h-4 w-4" />
              Certificações
            </div>
            <div className="flex flex-wrap gap-2">
              {user.certifications.map(cert => (
                <span key={cert.id} className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
                  {cert.title} — {cert.issuer}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Serviços */}
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
        Serviços ({services.length})
      </h2>
      {services.length === 0 ? (
        <p className="text-slate-500 text-sm mb-6">Nenhum serviço disponível no momento.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {services.map(service => (
            <Link
              key={service.id}
              to={`/services/${service.id}`}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 mr-3">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{service.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{service.category.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{service.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(service.price)}</p>
                  {service.estimatedHours && (
                    <p className="text-xs text-slate-400 mt-0.5">{service.estimatedHours}h</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Avaliações recentes */}
      {recentReviews.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
            Avaliações Recentes
          </h2>
          <div className="space-y-3">
            {recentReviews.map(review => (
              <div key={review.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
                    {review.author.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{review.author.name}</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "text-amber-400 fill-current" : "text-slate-300"}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* CTA Contratar */}
      {isAuthenticated && (
        <div className="fixed bottom-6 right-6">
          <Link
            to={`/services?professional=${userId}`}
            className="btn btn-primary shadow-lg flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Ver serviços
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProfessionalStorefrontPage;
```

### Step 5b: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 5c: Commit

```bash
cd frontend
git add src/pages/ProfessionalStorefront.tsx
git commit -m "feat: add professional public storefront page"
```

---

## Task 6: Adicionar Link Vitrine no ServiceSearch + ServiceDetails

**Files:**
- Modify: `frontend/src/pages/services/ServiceSearch.tsx`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`
- Modify: `frontend/src/App.tsx`

### Step 6a: Registrar a rota pública /profissional/:userId em App.tsx

No `App.tsx`, localizar onde estão as rotas públicas (sem ProtectedRoute) como `/empresa/:companyId` e adicionar junto:
```typescript
import ProfessionalStorefrontPage from "./pages/ProfessionalStorefront";
```

E na seção de rotas (dentro do `<Route element={<Layout />}>`):
```tsx
<Route path="profissional/:userId" element={<ProfessionalStorefrontPage />} />
```

### Step 6b: Adicionar link para vitrine no ServiceSearch.tsx

Em `frontend/src/pages/services/ServiceSearch.tsx`, localizar onde o nome do profissional é renderizado nos resultados de busca e adicionar um `Link` para `/profissional/:professionalId`:

Após importar `Link` do react-router-dom (já deve estar), adicionar ao card do serviço:
```tsx
import { Link } from "react-router-dom";

// No JSX onde o profissional é mostrado:
<Link
  to={`/profissional/${service.professional?.id}`}
  className="text-sm text-blue-600 hover:underline"
  onClick={e => e.stopPropagation()} // evitar navegar para o serviço
>
  {service.professional?.name}
</Link>
```

**Nota:** O nome exato do campo depende do tipo `ServiceListingWithProfessional`. Verificar a estrutura do tipo em `src/services/serviceService.ts` antes de implementar.

### Step 6c: Adicionar link para vitrine no ServiceDetails.tsx

Em `frontend/src/pages/services/ServiceDetails.tsx`, localizar onde o nome/perfil do profissional é exibido e adicionar:
```tsx
<Link to={`/profissional/${service.professional?.id}`} className="hover:underline text-blue-600">
  Ver perfil completo →
</Link>
```

### Step 6d: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 6e: Commit

```bash
cd frontend
git add src/App.tsx src/pages/services/ServiceSearch.tsx src/pages/services/ServiceDetails.tsx
git commit -m "feat: add professional storefront route and links in service pages"
```

---

## Task 7: Página company/Analytics

**Files:**
- Create: `frontend/src/pages/company/Analytics.tsx`

### Step 7a: Criar Analytics.tsx

```typescript
// frontend/src/pages/company/Analytics.tsx
import React, { useState, useEffect } from "react";
import {
  TrendingUp, Users, Package, Star, CheckCircle,
  DollarSign, Activity,
} from "lucide-react";
import api from "../../services/api";
import {
  AnalyticsOverview, RevenueDataPoint, MemberPerformance, TopService,
} from "../../types";
import { Skeleton } from "../../components/common/Skeleton";
import { formatCurrency, formatRating } from "../../utils/formatters";
import RevenueChart from "../../components/company/RevenueChart";
import MemberPerformanceTable from "../../components/company/MemberPerformanceTable";

const CompanyAnalytics: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [members, setMembers] = useState<MemberPerformance[]>([]);
  const [services, setServices] = useState<TopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [overviewRes, revenueRes, membersRes, servicesRes] = await Promise.all([
          api.get("/company/analytics/overview"),
          api.get("/company/analytics/revenue"),
          api.get("/company/analytics/members"),
          api.get("/company/analytics/services"),
        ]);
        setOverview(overviewRes.data.data);
        setRevenue(revenueRes.data.data);
        setMembers(membersRes.data.data);
        setServices(servicesRes.data.data);
      } catch {
        setError("Erro ao carregar analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl mb-6" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-12 text-center text-slate-500">{error}</div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Analytics</h1>

      {/* Overview Cards */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pedidos (30d)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{overview.ordersLast30Days}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Taxa de Conclusão</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{overview.completionRate}%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Receita (30d)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(overview.revenueLast30Days)}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Avaliação Média</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatRating(overview.averageRating)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Receita */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Receita Mensal (6 meses)
        </h2>
        <RevenueChart data={revenue} />
      </div>

      {/* Performance dos Membros */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Performance da Equipe
        </h2>
        <MemberPerformanceTable members={members} />
      </div>

      {/* Top Serviços */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Top Serviços
        </h2>
        {services.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum serviço com pedidos ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500 font-medium">Serviço</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Pedidos</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Concluídos</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <td className="py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{service.title}</p>
                      <p className="text-xs text-slate-500">{service.category}</p>
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{service.totalOrders}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{service.completedOrders}</td>
                    <td className="py-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(service.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyAnalytics;
```

### Step 7b: Checar tipos (componentes serão criados na Task 8)

Os imports de `RevenueChart` e `MemberPerformanceTable` vão causar erro de compilação até a Task 8. Criar placeholders temporários:

```typescript
// frontend/src/components/company/RevenueChart.tsx
import React from "react";
import { RevenueDataPoint } from "../../types";
interface Props { data: RevenueDataPoint[]; }
const RevenueChart: React.FC<Props> = ({ data }) => (
  <div className="h-40 flex items-end gap-2">
    {data.map((d, i) => (
      <div key={i} className="flex-1 flex flex-col items-center gap-1">
        <div
          className="bg-blue-500 rounded-t w-full"
          style={{ height: `${Math.max((d.revenue / Math.max(...data.map(x => x.revenue))) * 120, 4)}px` }}
        />
        <span className="text-xs text-slate-400">{d.month.slice(5)}</span>
      </div>
    ))}
  </div>
);
export default RevenueChart;
```

```typescript
// frontend/src/components/company/MemberPerformanceTable.tsx
import React from "react";
import { MemberPerformance } from "../../types";
interface Props { members: MemberPerformance[]; }
const MemberPerformanceTable: React.FC<Props> = ({ members }) => (
  <div className="space-y-3">
    {members.map(m => (
      <div key={m.member.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        <div>
          <p className="font-medium text-sm">{m.member.name}</p>
          <p className="text-xs text-slate-500">{m.member.role.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-green-600">{m.stats.completionRate}%</p>
          <p className="text-xs text-slate-500">{m.stats.completed}/{m.stats.totalAssigned} concluídos</p>
        </div>
      </div>
    ))}
    {members.length === 0 && <p className="text-sm text-slate-500">Nenhum membro com serviços ainda.</p>}
  </div>
);
export default MemberPerformanceTable;
```

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 7c: Commit

```bash
cd frontend
git add src/pages/company/Analytics.tsx src/components/company/RevenueChart.tsx src/components/company/MemberPerformanceTable.tsx
git commit -m "feat: add company analytics page with revenue chart and member performance table"
```

---

## Task 8: Componentes de Analytics (Refinamento)

**Files:**
- Modify: `frontend/src/components/company/RevenueChart.tsx`
- Modify: `frontend/src/components/company/MemberPerformanceTable.tsx`

### Step 8a: Refinar RevenueChart.tsx

Substituir o placeholder pela versão melhorada com:
- Barras com tooltip ao hover (título + valor formatado)
- Eixo Y com valores
- Label do mês por extenso (ex: "Jan", "Fev")
- Estado vazio quando não há dados

```typescript
// frontend/src/components/company/RevenueChart.tsx
import React, { useState } from "react";
import { RevenueDataPoint } from "../../types";
import { formatCurrency } from "../../utils/formatters";

interface Props { data: RevenueDataPoint[]; }

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const RevenueChart: React.FC<Props> = ({ data }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-8">Sem dados de receita ainda.</p>;
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="relative">
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => {
          const height = Math.max((d.revenue / maxRevenue) * 128, 4);
          const month = d.month.slice(5);
          return (
            <div
              key={d.month}
              className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {formatCurrency(d.revenue)}
                </div>
              )}
              <div
                className={`w-full rounded-t transition-colors ${hovered === i ? "bg-blue-600" : "bg-blue-400 dark:bg-blue-500"}`}
                style={{ height: `${height}px` }}
              />
              <span className="text-xs text-slate-400">{MONTH_NAMES[month] ?? month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueChart;
```

### Step 8b: Refinar MemberPerformanceTable.tsx

Substituir o placeholder pela versão com:
- Avatar com inicial do nome
- Badge colorido do cargo
- Barra de progresso da taxa de conclusão
- Ordenação visual (maior taxa primeiro — já vem ordenado do backend)

```typescript
// frontend/src/components/company/MemberPerformanceTable.tsx
import React from "react";
import { MemberPerformance } from "../../types";
import { Star } from "lucide-react";
import { formatRating } from "../../utils/formatters";

interface Props { members: MemberPerformance[]; }

const MemberPerformanceTable: React.FC<Props> = ({ members }) => {
  if (members.length === 0) {
    return <p className="text-slate-500 text-sm">Nenhum membro com serviços ainda.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map(m => (
        <div key={m.member.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0"
              style={{ backgroundColor: m.member.role.color ?? "#6366f1" }}>
              {m.member.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{m.member.name}</p>
                <span className="text-xs px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: m.member.role.color ?? "#6366f1" }}>
                  {m.member.role.name}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-0.5 text-xs text-amber-500">
                  <Star className="h-3 w-3 fill-current" />
                  {formatRating(m.member.ratingAverage)}
                </span>
                <span className="text-xs text-slate-500">{m.stats.totalAssigned} designações</span>
                {m.stats.ledTotal > 0 && (
                  <span className="text-xs text-blue-500">{m.stats.ledTotal} como líder</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{m.stats.completionRate}%</p>
              <p className="text-xs text-slate-400">{m.stats.completed}/{m.stats.totalAssigned}</p>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${m.stats.completionRate}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemberPerformanceTable;
```

### Step 8c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 8d: Commit

```bash
cd frontend
git add src/components/company/RevenueChart.tsx src/components/company/MemberPerformanceTable.tsx
git commit -m "feat: refine analytics chart and member performance table components"
```

---

## Task 9: Adicionar rota /company/analytics em App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

### Step 9a: Adicionar import

```typescript
import CompanyAnalytics from "./pages/company/Analytics";
```

### Step 9b: Adicionar rota dentro do bloco /company já existente

**IMPORTANTE:** O bloco `/company` já existe desde a Fase 1. APENAS adicionar filho:
```tsx
<Route path="analytics" element={<CompanyAnalytics />} />
```

### Step 9c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 9d: Commit

```bash
cd frontend
git add src/App.tsx
git commit -m "feat: add company analytics route to App.tsx"
```

---

## Task 10: Adicionar link Analytics no Layout

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

### Step 10a: Adicionar link Analytics ao bloco isCompany

Localizar o bloco `{isCompany && (...)}` adicionado na Fase 2 e incluir o link de Analytics:
```tsx
<Link
  to="/company/analytics"
  className={clsx("nav-link", { active: location.pathname.startsWith("/company/analytics") })}
>
  <BarChart3 className="h-4 w-4" />
  Analytics
</Link>
```

Verificar se `BarChart3` está importado do `lucide-react`. Se não, adicionar ao import existente.

### Step 10b: Checar tipos e commit

```bash
cd frontend && npx tsc --noEmit
git add src/components/Layout.tsx
git commit -m "feat: add analytics link to company navigation in Layout"
```

---

## Task 11: Página admin/CompanyVerifications

**Files:**
- Create: `frontend/src/pages/admin/CompanyVerifications.tsx`

### Step 11a: Criar CompanyVerifications.tsx

```typescript
// frontend/src/pages/admin/CompanyVerifications.tsx
import React, { useState, useEffect } from "react";
import { Building2, Check, X, Clock } from "lucide-react";
import api from "../../services/api";
import { PendingCompany } from "../../types";
import { Skeleton } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { useToast } from "../../context/ToastContext";
import { formatRelativeTime } from "../../utils/formatters";

const CompanyVerifications: React.FC = () => {
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const toast = useToast();

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/companies/pending");
      setCompanies(res.data.data);
    } catch {
      toast.error("Erro ao carregar empresas pendentes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  const handleVerify = async (companyId: number, approved: boolean, reason?: string) => {
    try {
      setProcessing(companyId);
      await api.post(`/admin/companies/${companyId}/verify`, { approved, reason });
      toast.success(approved ? "Empresa verificada!" : "Verificação recusada");
      setCompanies(prev => prev.filter(c => c.id !== companyId));
    } catch {
      toast.error("Erro ao processar verificação");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificação de Empresas
        </h1>
        {companies.length > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            {companies.length} pendente{companies.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={<Check className="h-12 w-12" />}
          title="Nenhuma empresa pendente"
          description="Todas as solicitações de verificação foram processadas"
        />
      ) : (
        <div className="space-y-4">
          {companies.map(company => (
            <div key={company.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{company.companyName}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    CNPJ: {company.cnpj} · {company.industry || "Setor não informado"}
                  </p>
                  <p className="text-sm text-slate-500">
                    Responsável: {company.user.name} ({company.user.email})
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cadastrou {formatRelativeTime(company.createdAt)} · {company._count.members} membro{company._count.members !== 1 ? "s" : ""}
                  </p>
                  {company.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{company.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleVerify(company.id, false, "Documentação insuficiente")}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors disabled:opacity-50"
                    title="Recusar verificação"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleVerify(company.id, true)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors disabled:opacity-50"
                    title="Aprovar verificação"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanyVerifications;
```

### Step 11b: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 11c: Commit

```bash
cd frontend
git add src/pages/admin/CompanyVerifications.tsx
git commit -m "feat: add admin company verifications page"
```

---

## Task 12: Adicionar rota + link admin para verificações de empresa

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx` (nav admin)

### Step 12a: Adicionar import e rota em App.tsx

```typescript
import CompanyVerifications from "./pages/admin/CompanyVerifications";
```

Dentro do bloco de rotas `/admin/*` (já existente no projeto original):
```tsx
<Route path="companies" element={<CompanyVerifications />} />
```

### Step 12b: Adicionar link no menu admin do Layout

Localizar o bloco `{isAdmin && (...)}` no Layout e adicionar:
```tsx
<Link
  to="/admin/companies"
  className={clsx("nav-link", { active: location.pathname.startsWith("/admin/companies") })}
>
  <Building2 className="h-4 w-4" />
  Empresas
</Link>
```

Verificar se `Building2` está importado do `lucide-react`. Se não, adicionar ao import.

### Step 12c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 12d: Commit

```bash
cd frontend
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat: add admin company verification route and nav link"
```

---

## Task 13: Testes de Integração — Analytics + Vitrine

**Files:**
- Create: `backend/tests/companyAnalytics.test.ts`

### Step 13a: Criar testes de analytics

```typescript
// backend/tests/companyAnalytics.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

describe("Company Analytics", () => {
  let companyToken: string;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "empresa@teste.com",
      password: "Teste@123",
    });
    companyToken = res.body.data?.token;
  });

  it("should get analytics overview", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/overview")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalOrders");
    expect(res.body.data).toHaveProperty("completionRate");
    expect(res.body.data).toHaveProperty("totalRevenue");
  });

  it("should get revenue analytics", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/revenue")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should get member performance", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/members")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should get top services", async () => {
    if (!companyToken) return;
    const res = await request(app)
      .get("/api/company/analytics/services")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should block unauthenticated analytics access", async () => {
    const res = await request(app).get("/api/company/analytics/overview");
    expect(res.status).toBe(401);
  });
});
```

### Step 13b: Rodar todos os testes

```bash
cd backend && npm test
```
Esperado: todos passando.

### Step 13c: Checar tipos e build frontend

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: build bem-sucedido.

### Step 13d: Commit

```bash
cd backend
git add tests/companyAnalytics.test.ts tests/professionalStorefront.test.ts tests/adminCompanyVerification.test.ts
git commit -m "test: add analytics, storefront, and admin verification integration tests"
```

---

## Task 14: Seed — Dados de Exemplo para Analytics

**Files:**
- Modify: `backend/prisma/seed.ts`

### Step 14a: Adicionar serviços para a empresa de teste e um cargo padrão

Localizar o bloco de criação da empresa no seed (adicionado na Fase 1) e adicionar após:
```typescript
// Cargo padrão para a empresa de teste
const empresaProfile = await prisma.companyProfile.findUnique({
  where: { cnpj: "12345678000196" },
});

if (empresaProfile) {
  // Criar cargo "Operacional" para a empresa de teste (usando upsert para evitar duplicata)
  const operacionalRole = await prisma.companyRole.upsert({
    where: { id: 9999 }, // id fictício — seed usa upsert
    update: {},
    create: {
      companyId: empresaProfile.id,
      name: "Operacional",
      level: 3,
      permissions: {
        metrics: { view: false, viewTeam: false },
        chat: { view: true, respond: true, manage: false },
        orders: { view: true, assign: false, manage: false },
        finance: { view: false, transfer: false, salary: false },
        team: { view: false, invite: false, manage: false },
        catalog: { edit: true },
        company: { settings: false, roles: false },
      },
    },
  }).catch(() => null);

  // Criar um canal padrão para a empresa de teste
  await prisma.companyChannel.upsert({
    where: { id: 9999 },
    update: {},
    create: {
      companyId: empresaProfile.id,
      name: "Atendimento Geral",
      description: "Canal principal de atendimento ao cliente",
    },
  }).catch(() => null);
}
```

**Nota:** O `upsert` com `id: 9999` é uma abordagem simplificada para seed. Se o Prisma reclamar da constraint, usar `findFirst` + `create` condicional.

Abordagem alternativa (mais robusta):
```typescript
if (empresaProfile) {
  const existingRole = await prisma.companyRole.findFirst({
    where: { companyId: empresaProfile.id, name: "Operacional" }
  });
  if (!existingRole) {
    await prisma.companyRole.create({
      data: {
        companyId: empresaProfile.id,
        name: "Operacional",
        level: 3,
        permissions: { /* ... */ },
      }
    });
  }

  const existingChannel = await prisma.companyChannel.findFirst({
    where: { companyId: empresaProfile.id, name: "Atendimento Geral" }
  });
  if (!existingChannel) {
    await prisma.companyChannel.create({
      data: {
        companyId: empresaProfile.id,
        name: "Atendimento Geral",
        description: "Canal principal de atendimento ao cliente",
      }
    });
  }
}
```

### Step 14b: Rodar o seed

```bash
cd backend && npm run db:seed
```
Esperado: sem erros.

### Step 14c: Commit final da fase

```bash
cd backend
git add prisma/seed.ts
git commit -m "feat: add company role and channel to seed data for Phase 3"
```

---

## Verificação Final — Fase 3

```bash
# Backend
cd backend && npm test && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit && npm run build

# Subir ambiente completo
docker compose up
```

**Checklist manual:**
1. Acessar `/profissional/2` (profissional@teste.com) sem estar logado → vitrine pública
2. Ver link "Ver perfil completo" na página de detalhe de serviço
3. Login como empresa → ir para `/company/analytics` → ver gráfico e tabelas
4. Login como admin → ir para `/admin/companies` → ver lista de empresas pendentes
5. Aprovar/recusar uma empresa e verificar notificação criada
6. Verificar que o badge "Empresa Verificada" aparece na vitrine pública após aprovação

---

## Resumo de Arquivos Criados/Modificados — Fase 3

### Backend (novos)
- `src/controllers/companyAnalyticsController.ts`
- `tests/companyAnalytics.test.ts`
- `tests/professionalStorefront.test.ts`
- `tests/adminCompanyVerification.test.ts`

### Backend (modificados)
- `src/controllers/service/listingController.ts` — getProfessionalStorefront
- `src/controllers/service/index.ts` — re-export nova função
- `src/routes/serviceRoutes.ts` — rota GET /professional/:userId/storefront
- `src/controllers/adminController.ts` — getPendingCompanies, verifyCompany, getAllCompanies
- `src/routes/adminRoutes.ts` — novas rotas admin/companies
- `src/routes/companyRoutes.ts` — rotas analytics
- `prisma/seed.ts` — cargo e canal para empresa de teste

### Frontend (novos)
- `src/pages/ProfessionalStorefront.tsx`
- `src/pages/company/Analytics.tsx`
- `src/pages/admin/CompanyVerifications.tsx`
- `src/components/company/RevenueChart.tsx`
- `src/components/company/MemberPerformanceTable.tsx`
- `src/types/storefront.ts`

### Frontend (modificados)
- `src/types/company.ts` — tipos analytics + PendingCompany
- `src/types/index.ts` — re-export storefront types
- `src/App.tsx` — rotas analytics, profissional/:userId, admin/companies
- `src/components/Layout.tsx` — link analytics (empresa) + link companies (admin)
- `src/pages/services/ServiceSearch.tsx` — link vitrine profissional
- `src/pages/services/ServiceDetails.tsx` — link vitrine profissional
