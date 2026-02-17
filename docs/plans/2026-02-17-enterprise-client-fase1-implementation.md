# Enterprise Client — Fase 1: Fundação — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar o role `COMPANY` ao FazTudo, permitindo que empresas se registrem, criem perfis verificados, ofereçam serviços no catálogo, gerenciem membros/cargos com permissões granulares, tenham wallet corporativa, e designem equipes a pedidos com chat em grupo automático.

**Architecture:** Novo role `COMPANY` no Prisma e frontend. Modelos `CompanyProfile`, `CompanyRole`, `CompanyMember`, `CompanySalaryRule`, `CompanySalaryPayment`, `ServiceTeam`, `ServiceTeamMember` adicionados ao schema. Backend organizado em 4 route files novos + middleware de permissões. Frontend com seção `/company/*` protegida e páginas dedicadas.

**Tech Stack:** Express 5 + Prisma 7 (SQLite) + TypeScript + React 18 + Vite + TailwindCSS + Zod (validação) + Pino (logging)

**Design doc:** `docs/plans/2026-02-17-enterprise-client-fase1-design.md`

---

## Visão Geral das Tasks

| # | Task | Área | Depende de |
|---|---|---|---|
| 1 | Schema Prisma — novos modelos | Backend DB | — |
| 2 | Tipos e enums frontend | Frontend | 1 |
| 3 | Validação Zod + auth backend | Backend | 1 |
| 4 | companyPermission middleware | Backend | 1 |
| 5 | companyRoutes — perfil e vitrine | Backend | 3, 4 |
| 6 | companyMemberRoutes — membros e cargos | Backend | 3, 4 |
| 7 | companySalaryRoutes — regras salariais | Backend | 3, 4 |
| 8 | companyTeamRoutes — equipes por pedido | Backend | 3, 4 |
| 9 | Registro de routers em index.ts | Backend | 5, 6, 7, 8 |
| 10 | Dashboard controller — branch COMPANY | Backend | 3 |
| 11 | Registro + Login frontend | Frontend | 2 |
| 12 | App.tsx — rotas /company/* | Frontend | 2 |
| 13 | Páginas company — Dashboard + Profile | Frontend | 12 |
| 14 | Páginas company — Members + Roles | Frontend | 12 |
| 15 | Páginas company — Salary | Frontend | 12 |
| 16 | Páginas company — Orders + TeamBuilder | Frontend | 12 |
| 17 | CompanyStorefront — vitrine pública | Frontend | 12 |
| 18 | Testes de integração — fluxo empresa | Backend | 9 |
| 19 | Seed — empresa de teste | Backend | 1 |

---

## Task 1: Schema Prisma — Novos Modelos e Alterações

**Files:**
- Modify: `backend/prisma/schema.prisma`

### Step 1: Abrir o schema e localizar o enum UserRole

```bash
grep -n "enum UserRole" backend/prisma/schema.prisma
```
Esperado: linha com `enum UserRole {`

### Step 2: Adicionar COMPANY ao enum UserRole

No `backend/prisma/schema.prisma`, alterar:
```prisma
enum UserRole {
  CLIENT
  PROFESSIONAL
  ADMIN
}
```
Para:
```prisma
enum UserRole {
  CLIENT
  PROFESSIONAL
  COMPANY
  ADMIN
}
```

### Step 3: Adicionar SalaryStatus enum (antes dos Models)

Adicionar após o último enum existente (antes de `// Models`):
```prisma
enum SalaryStatus {
  PENDING
  PAID
  FAILED
}
```

### Step 4: Adicionar campos isGroup, isArchived, teamId ao modelo Message

Localizar o modelo `Message` no schema e adicionar os campos ao final (antes do fechamento `}`):
```prisma
  isGroup    Boolean  @default(false)
  isArchived Boolean  @default(false)
  teamId     Int?
  team       ServiceTeam? @relation(fields: [teamId], references: [id])
```

### Step 5: Adicionar os novos modelos ao final do schema

Adicionar ao final do arquivo `backend/prisma/schema.prisma`:
```prisma
model CompanyProfile {
  id           Int       @id @default(autoincrement())
  userId       Int       @unique
  user         User      @relation(fields: [userId], references: [id])
  companyName  String
  cnpj         String    @unique
  description  String?
  logo         String?
  coverImage   String?
  website      String?
  phone        String?
  address      Json?
  isVerified   Boolean   @default(false)
  industry     String?
  foundedAt    DateTime?
  createdAt    DateTime  @default(now())

  members  CompanyMember[]
  roles    CompanyRole[]
}

model CompanyRole {
  id          Int            @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id])
  name        String
  level       Int
  permissions Json
  color       String?
  createdAt   DateTime       @default(now())

  members     CompanyMember[]
  salaryRules CompanySalaryRule[]
}

model CompanyMember {
  id                Int            @id @default(autoincrement())
  companyId         Int
  company           CompanyProfile @relation(fields: [companyId], references: [id])
  userId            Int
  user              User           @relation(fields: [userId], references: [id])
  roleId            Int
  role              CompanyRole    @relation(fields: [roleId], references: [id])
  customPermissions Json?
  joinedAt          DateTime       @default(now())
  isActive          Boolean        @default(true)

  salaryHistory   CompanySalaryPayment[]
  teamMemberships ServiceTeamMember[]
  ledTeams        ServiceTeam[]          @relation("TeamLeader")
}

model CompanySalaryRule {
  id          Int            @id @default(autoincrement())
  companyId   Int
  roleId      Int?
  role        CompanyRole?   @relation(fields: [roleId], references: [id])
  memberId    Int?
  amount      Float
  dayOfMonth  Int
  description String?
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())

  payments CompanySalaryPayment[]
}

model CompanySalaryPayment {
  id       Int               @id @default(autoincrement())
  ruleId   Int
  rule     CompanySalaryRule @relation(fields: [ruleId], references: [id])
  memberId Int
  member   CompanyMember     @relation(fields: [memberId], references: [id])
  amount   Float
  paidAt   DateTime
  status   SalaryStatus
  note     String?
}

model ServiceTeam {
  id        Int           @id @default(autoincrement())
  orderId   Int           @unique
  order     ServiceOrder  @relation(fields: [orderId], references: [id])
  leaderId  Int
  leader    CompanyMember @relation("TeamLeader", fields: [leaderId], references: [id])
  createdAt DateTime      @default(now())

  members  ServiceTeamMember[]
  messages Message[]
}

model ServiceTeamMember {
  id       Int           @id @default(autoincrement())
  teamId   Int
  team     ServiceTeam   @relation(fields: [teamId], references: [id])
  memberId Int
  member   CompanyMember @relation(fields: [memberId], references: [id])
}
```

### Step 6: Adicionar relação CompanyProfile e CompanyMember no modelo User

No modelo `User`, adicionar as relações ao final (antes do fechamento `}`):
```prisma
  companyProfile CompanyProfile?
  companyMember  CompanyMember?
```

### Step 7: Aplicar a migration

```bash
cd backend && npx prisma db push
```
Esperado: `Your database is now in sync with your Prisma schema.`

### Step 8: Verificar que o client Prisma gerou os novos tipos

```bash
cd backend && npx prisma generate
```
Esperado: `Generated Prisma Client`

### Step 9: Checar tipos TypeScript

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros de tipo.

### Step 10: Commit

```bash
cd backend
git add prisma/schema.prisma
git commit -m "feat: add COMPANY role and enterprise models to prisma schema"
```

---

## Task 2: Tipos e Enums Frontend

**Files:**
- Modify: `frontend/src/types/enums.ts`
- Modify: `frontend/src/types/entities.ts`
- Create: `frontend/src/types/company.ts`

### Step 1: Adicionar COMPANY ao enum UserRole em enums.ts

Em `frontend/src/types/enums.ts`, alterar:
```typescript
export enum UserRole {
  CLIENT = "CLIENT",
  PROFESSIONAL = "PROFESSIONAL",
  ADMIN = "ADMIN",
}
```
Para:
```typescript
export enum UserRole {
  CLIENT = "CLIENT",
  PROFESSIONAL = "PROFESSIONAL",
  COMPANY = "COMPANY",
  ADMIN = "ADMIN",
}

export enum SalaryStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
}
```

### Step 2: Criar frontend/src/types/company.ts

```typescript
// ============================================
// COMPANY TYPES
// ============================================

export interface CompanyPermissions {
  metrics: {
    view: boolean;
    viewTeam: boolean;
  };
  chat: {
    view: boolean;
    respond: boolean;
    manage: boolean;
  };
  orders: {
    view: boolean;
    assign: boolean;
    manage: boolean;
  };
  finance: {
    view: boolean;
    transfer: boolean;
    salary: boolean;
  };
  team: {
    view: boolean;
    invite: boolean;
    manage: boolean;
  };
  catalog: {
    edit: boolean;
  };
  company: {
    settings: boolean;
    roles: boolean;
  };
}

export const DEFAULT_PERMISSIONS: CompanyPermissions = {
  metrics: { view: false, viewTeam: false },
  chat: { view: false, respond: false, manage: false },
  orders: { view: false, assign: false, manage: false },
  finance: { view: false, transfer: false, salary: false },
  team: { view: false, invite: false, manage: false },
  catalog: { edit: false },
  company: { settings: false, roles: false },
};

export interface CompanyProfile {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  website?: string;
  phone?: string;
  address?: Record<string, string>;
  isVerified: boolean;
  industry?: string;
  foundedAt?: string;
  createdAt: string;
}

export interface CompanyRole {
  id: number;
  companyId: number;
  name: string;
  level: number;
  permissions: CompanyPermissions;
  color?: string;
  createdAt: string;
  memberCount?: number;
}

export interface CompanyMember {
  id: number;
  companyId: number;
  userId: number;
  roleId: number;
  customPermissions?: Partial<CompanyPermissions>;
  joinedAt: string;
  isActive: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    profileImage?: string;
  };
  role: CompanyRole;
  // permissões resolvidas (cargo + override individual)
  resolvedPermissions?: CompanyPermissions;
}

export interface CompanySalaryRule {
  id: number;
  companyId: number;
  roleId?: number;
  memberId?: number;
  amount: number;
  dayOfMonth: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  role?: CompanyRole;
  member?: CompanyMember;
}

export interface CompanySalaryPayment {
  id: number;
  ruleId: number;
  memberId: number;
  amount: number;
  paidAt: string;
  status: import("./enums").SalaryStatus;
  note?: string;
  member?: CompanyMember;
}

export interface ServiceTeam {
  id: number;
  orderId: number;
  leaderId: number;
  createdAt: string;
  leader: CompanyMember;
  members: ServiceTeamMember[];
}

export interface ServiceTeamMember {
  id: number;
  teamId: number;
  memberId: number;
  member: CompanyMember;
}

export interface CompanyDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalServices: number;
  totalRevenue: number;
  availableBalance: number;
  totalMembers: number;
  activeMembers: number;
  averageRating: number;
}
```

### Step 3: Adicionar company.ts ao barrel export em index.ts

Em `frontend/src/types/index.ts`, adicionar:
```typescript
export * from "./company";
```

### Step 4: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros novos.

### Step 5: Commit

```bash
cd frontend
git add src/types/enums.ts src/types/company.ts src/types/index.ts
git commit -m "feat: add COMPANY role and company types to frontend"
```

---

## Task 3: Validação Zod + Auth Backend

**Files:**
- Modify: `backend/src/middleware/validation.ts`
- Modify: `backend/src/controllers/authController.ts`

### Step 3a: Escrever teste falhando para registro de empresa

Em `backend/tests/companyRegistration.test.ts` (criar arquivo):
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app"; // será ajustado se necessário

describe("Company Registration", () => {
  it("should register a company with CNPJ", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Empresa Teste Ltda",
      email: "empresa@teste.com",
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Empresa Teste Ltda",
      cnpj: "12345678000195",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("COMPANY");
  });

  it("should reject COMPANY registration without cnpj", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Empresa Sem CNPJ",
      email: "empresa2@teste.com",
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Empresa Sem CNPJ",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

### Step 3b: Rodar o teste para confirmar falha

```bash
cd backend && npx vitest run tests/companyRegistration.test.ts
```
Esperado: FAIL — role COMPANY rejected ou endpoint não aceita campos empresa.

### Step 3c: Atualizar registerSchema em validation.ts

Em `backend/src/middleware/validation.ts`, localizar `registerSchema` e atualizar:
```typescript
export const registerSchema = z.object({
  name: sanitizedString
    .pipe(z.string().min(2, 'Nome deve ter no minimo 2 caracteres').max(100, 'Nome muito longo')),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(['CLIENT', 'PROFESSIONAL', 'COMPANY'], {
    error: 'Role deve ser CLIENT, PROFESSIONAL ou COMPANY',
  }).optional().default('CLIENT'),
  document: z.string().trim().optional(),
  // campos de empresa (obrigatórios se role=COMPANY)
  companyName: z.string().trim().min(2).max(200).optional(),
  cnpj: z.string().trim().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos numéricos').optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'COMPANY') {
    if (!data.companyName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nome da empresa é obrigatório', path: ['companyName'] });
    }
    if (!data.cnpj) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CNPJ é obrigatório para empresas', path: ['cnpj'] });
    }
  }
});
```

### Step 3d: Atualizar RegisterBody e handler de registro em authController.ts

Em `backend/src/controllers/authController.ts`, atualizar a interface `RegisterBody`:
```typescript
interface RegisterBody {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CLIENT" | "PROFESSIONAL" | "COMPANY";
  document?: string;
  companyName?: string;
  cnpj?: string;
}
```

Localizar a função `register` no authController e adicionar, após a criação do User (após `const user = await prisma.user.create(...)`), o bloco de criação do CompanyProfile:
```typescript
// Se for empresa, criar CompanyProfile
if (body.role === "COMPANY") {
  await prisma.companyProfile.create({
    data: {
      userId: user.id,
      companyName: body.companyName!,
      cnpj: body.cnpj!,
    },
  });
}
```

### Step 3e: Rodar o teste

```bash
cd backend && npx vitest run tests/companyRegistration.test.ts
```
Esperado: PASS

### Step 3f: Rodar todos os testes para garantir nenhuma regressão

```bash
cd backend && npm test
```
Esperado: todos passando.

### Step 3g: Commit

```bash
cd backend
git add src/middleware/validation.ts src/controllers/authController.ts tests/companyRegistration.test.ts
git commit -m "feat: support COMPANY role in registration with CNPJ validation"
```

---

## Task 4: companyPermission Middleware

**Files:**
- Create: `backend/src/middleware/companyPermission.ts`

### Step 4a: Criar o middleware

```typescript
// backend/src/middleware/companyPermission.ts
import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "./auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyPermission");

type PermissionPath =
  | "metrics.view" | "metrics.viewTeam"
  | "chat.view" | "chat.respond" | "chat.manage"
  | "orders.view" | "orders.assign" | "orders.manage"
  | "finance.view" | "finance.transfer" | "finance.salary"
  | "team.view" | "team.invite" | "team.manage"
  | "catalog.edit"
  | "company.settings" | "company.roles";

function resolvePermission(
  rolePerms: Record<string, any>,
  customPerms: Record<string, any> | null,
  path: PermissionPath
): boolean {
  const [area, key] = path.split(".");
  const custom = customPerms?.[area]?.[key];
  if (custom !== undefined && custom !== null) return Boolean(custom);
  return Boolean(rolePerms?.[area]?.[key]);
}

/**
 * Middleware: verifica se o usuário autenticado (membro da empresa) tem a permissão requerida.
 * O dono da empresa (role=COMPANY + userId = companyProfile.userId) sempre tem acesso total.
 */
export function requireCompanyPermission(permission: PermissionPath) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      // Dono da empresa tem acesso total
      if (req.user?.role === "COMPANY") {
        const profile = await prisma.companyProfile.findUnique({ where: { userId } });
        if (profile) {
          req.companyId = profile.id;
          return next();
        }
      }

      // Membro da empresa
      const member = await prisma.companyMember.findFirst({
        where: { userId, isActive: true },
        include: { role: true },
      });

      if (!member) {
        return res.status(403).json({ success: false, message: "Acesso negado: não é membro de nenhuma empresa" });
      }

      req.companyId = member.companyId;
      req.companyMemberId = member.id;

      const hasPermission = resolvePermission(
        member.role.permissions as Record<string, any>,
        member.customPermissions as Record<string, any> | null,
        permission
      );

      if (!hasPermission) {
        log.warn({ userId, permission, memberId: member.id }, "Permission denied");
        return res.status(403).json({ success: false, message: "Sem permissão para esta ação" });
      }

      next();
    } catch (err) {
      log.error({ err }, "Error in companyPermission middleware");
      next(err);
    }
  };
}

/**
 * Middleware: garante que o usuário é o dono (role=COMPANY) da empresa.
 */
export async function requireCompanyOwner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "COMPANY") {
      return res.status(403).json({ success: false, message: "Apenas o proprietário da empresa pode executar esta ação" });
    }
    const profile = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Perfil de empresa não encontrado" });
    }
    req.companyId = profile.id;
    next();
  } catch (err) {
    next(err);
  }
}
```

### Step 4b: Estender o tipo AuthRequest para incluir companyId e companyMemberId

Em `backend/src/middleware/auth.ts`, localizar a interface `AuthRequest` e adicionar:
```typescript
companyId?: number;
companyMemberId?: number;
```

### Step 4c: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 4d: Commit

```bash
cd backend
git add src/middleware/companyPermission.ts src/middleware/auth.ts
git commit -m "feat: add companyPermission middleware with granular permission resolution"
```

---

## Task 5: companyRoutes — Perfil e Vitrine

**Files:**
- Create: `backend/src/controllers/companyController.ts`
- Create: `backend/src/routes/companyRoutes.ts`

### Step 5a: Criar companyController.ts

```typescript
// backend/src/controllers/companyController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyController");

/** GET /api/company/profile — perfil da empresa (dono ou membro) */
export async function getCompanyProfile(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const profile = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } } },
    });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    return res.json({ success: true, message: "Perfil obtido", data: profile });
  } catch (err) {
    log.error({ err }, "getCompanyProfile error");
    throw err;
  }
}

/** PUT /api/company/profile — atualizar perfil (requer company.settings) */
export async function updateCompanyProfile(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const { companyName, description, logo, coverImage, website, phone, address, industry, foundedAt } = req.body;

    const updated = await prisma.companyProfile.update({
      where: { id: companyId },
      data: { companyName, description, logo, coverImage, website, phone, address, industry, foundedAt: foundedAt ? new Date(foundedAt) : undefined },
    });
    return res.json({ success: true, message: "Perfil atualizado", data: updated });
  } catch (err) {
    log.error({ err }, "updateCompanyProfile error");
    throw err;
  }
}

/** GET /api/company/storefront/:companyId — vitrine pública (sem auth) */
export async function getCompanyStorefront(req: AuthRequest, res: Response) {
  try {
    const { companyId } = req.params;
    const profile = await prisma.companyProfile.findUnique({
      where: { id: Number(companyId) },
      include: {
        user: {
          select: {
            id: true, name: true, profileImage: true, ratingAverage: true, totalReviews: true,
            services: {
              where: { isAvailable: true },
              include: { category: true },
              take: 20,
            },
          },
        },
      },
    });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    return res.json({ success: true, message: "Vitrine obtida", data: profile });
  } catch (err) {
    log.error({ err }, "getCompanyStorefront error");
    throw err;
  }
}

/** GET /api/company/dashboard — stats da empresa */
export async function getCompanyDashboard(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId!;
    const profile = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { userId: true } });
    if (!profile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const [totalOrders, pendingOrders, inProgressOrders, completedOrders, totalServices, totalMembers, wallet] =
      await Promise.all([
        prisma.serviceOrder.count({ where: { providerId: profile.userId } }),
        prisma.serviceOrder.count({ where: { providerId: profile.userId, status: "PENDING" } }),
        prisma.serviceOrder.count({ where: { providerId: profile.userId, status: "IN_PROGRESS" } }),
        prisma.serviceOrder.count({ where: { providerId: profile.userId, status: "COMPLETED" } }),
        prisma.serviceListing.count({ where: { professionalId: profile.userId } }),
        prisma.companyMember.count({ where: { companyId } }),
        prisma.user.findUnique({ where: { id: profile.userId }, select: { balance: true } }),
      ]);

    return res.json({
      success: true,
      message: "Dashboard obtido",
      data: { totalOrders, pendingOrders, inProgressOrders, completedOrders, totalServices, totalMembers, availableBalance: wallet?.balance ?? 0 },
    });
  } catch (err) {
    log.error({ err }, "getCompanyDashboard error");
    throw err;
  }
}
```

### Step 5b: Criar companyRoutes.ts

```typescript
// backend/src/routes/companyRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyOwner, requireCompanyPermission } from "../middleware/companyPermission";
import { getCompanyProfile, updateCompanyProfile, getCompanyStorefront, getCompanyDashboard } from "../controllers/companyController";

const router = Router();

// Vitrine pública — sem auth
router.get("/storefront/:companyId", getCompanyStorefront);

// Rotas autenticadas
router.use(verifyToken);

router.get("/profile", requireCompanyOwner, getCompanyProfile);
router.put("/profile", requireCompanyPermission("company.settings"), updateCompanyProfile);
router.get("/dashboard", requireCompanyOwner, getCompanyDashboard);

export default router;
```

### Step 5c: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 5d: Commit

```bash
cd backend
git add src/controllers/companyController.ts src/routes/companyRoutes.ts
git commit -m "feat: add company profile, storefront and dashboard endpoints"
```

---

## Task 6: companyMemberRoutes — Membros e Cargos

**Files:**
- Create: `backend/src/controllers/companyMemberController.ts`
- Create: `backend/src/routes/companyMemberRoutes.ts`

### Step 6a: Criar companyMemberController.ts

```typescript
// backend/src/controllers/companyMemberController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyMemberController");

// ============ CARGOS ============

export async function getRoles(req: AuthRequest, res: Response) {
  const roles = await prisma.companyRole.findMany({
    where: { companyId: req.companyId! },
    include: { _count: { select: { members: true } } },
    orderBy: { level: "asc" },
  });
  return res.json({ success: true, message: "Cargos obtidos", data: roles });
}

export async function createRole(req: AuthRequest, res: Response) {
  try {
    const { name, level, permissions, color } = req.body;
    const role = await prisma.companyRole.create({
      data: { companyId: req.companyId!, name, level, permissions, color },
    });
    return res.status(201).json({ success: true, message: "Cargo criado", data: role });
  } catch (err) {
    log.error({ err }, "createRole error");
    throw err;
  }
}

export async function updateRole(req: AuthRequest, res: Response) {
  try {
    const { roleId } = req.params;
    const { name, level, permissions, color } = req.body;
    const role = await prisma.companyRole.update({
      where: { id: Number(roleId), companyId: req.companyId! },
      data: { name, level, permissions, color },
    });
    return res.json({ success: true, message: "Cargo atualizado", data: role });
  } catch (err) {
    log.error({ err }, "updateRole error");
    throw err;
  }
}

export async function deleteRole(req: AuthRequest, res: Response) {
  try {
    const { roleId } = req.params;
    const memberCount = await prisma.companyMember.count({ where: { roleId: Number(roleId) } });
    if (memberCount > 0) {
      return res.status(400).json({ success: false, message: "Não é possível excluir cargo com membros. Reatribua os membros primeiro." });
    }
    await prisma.companyRole.delete({ where: { id: Number(roleId), companyId: req.companyId! } });
    return res.json({ success: true, message: "Cargo excluído" });
  } catch (err) {
    log.error({ err }, "deleteRole error");
    throw err;
  }
}

// ============ MEMBROS ============

export async function getMembers(req: AuthRequest, res: Response) {
  const members = await prisma.companyMember.findMany({
    where: { companyId: req.companyId! },
    include: {
      user: { select: { id: true, name: true, email: true, profileImage: true } },
      role: true,
    },
    orderBy: { joinedAt: "asc" },
  });
  return res.json({ success: true, message: "Membros obtidos", data: members });
}

export async function inviteMember(req: AuthRequest, res: Response) {
  try {
    const { email, roleId } = req.body;
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) return res.status(404).json({ success: false, message: "Usuário não encontrado com esse email" });

    const existing = await prisma.companyMember.findFirst({
      where: { userId: targetUser.id, companyId: req.companyId! },
    });
    if (existing) return res.status(400).json({ success: false, message: "Usuário já é membro desta empresa" });

    const member = await prisma.companyMember.create({
      data: { companyId: req.companyId!, userId: targetUser.id, roleId: Number(roleId) },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } }, role: true },
    });
    return res.status(201).json({ success: true, message: "Membro adicionado", data: member });
  } catch (err) {
    log.error({ err }, "inviteMember error");
    throw err;
  }
}

export async function updateMember(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const { roleId, customPermissions, isActive } = req.body;
    const member = await prisma.companyMember.update({
      where: { id: Number(memberId), companyId: req.companyId! },
      data: { roleId: roleId ? Number(roleId) : undefined, customPermissions, isActive },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } }, role: true },
    });
    return res.json({ success: true, message: "Membro atualizado", data: member });
  } catch (err) {
    log.error({ err }, "updateMember error");
    throw err;
  }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    await prisma.companyMember.update({
      where: { id: Number(memberId), companyId: req.companyId! },
      data: { isActive: false },
    });
    return res.json({ success: true, message: "Membro removido" });
  } catch (err) {
    log.error({ err }, "removeMember error");
    throw err;
  }
}

export async function getMemberMetrics(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
      include: { user: { select: { id: true, name: true, ratingAverage: true, totalReviews: true } } },
    });
    if (!member) return res.status(404).json({ success: false, message: "Membro não encontrado" });

    const [assignedTeams, completedTeams] = await Promise.all([
      prisma.serviceTeamMember.count({ where: { memberId: member.id } }),
      prisma.serviceTeamMember.count({
        where: { memberId: member.id, team: { order: { status: "COMPLETED" } } },
      }),
    ]);

    return res.json({
      success: true,
      message: "Métricas obtidas",
      data: { member, assignedTeams, completedTeams },
    });
  } catch (err) {
    log.error({ err }, "getMemberMetrics error");
    throw err;
  }
}
```

### Step 6b: Criar companyMemberRoutes.ts

```typescript
// backend/src/routes/companyMemberRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { getRoles, createRole, updateRole, deleteRole, getMembers, inviteMember, updateMember, removeMember, getMemberMetrics } from "../controllers/companyMemberController";

const router = Router();
router.use(verifyToken);

// Cargos
router.get("/roles", requireCompanyPermission("team.view"), getRoles);
router.post("/roles", requireCompanyPermission("company.roles"), createRole);
router.put("/roles/:roleId", requireCompanyPermission("company.roles"), updateRole);
router.delete("/roles/:roleId", requireCompanyPermission("company.roles"), deleteRole);

// Membros
router.get("/", requireCompanyPermission("team.view"), getMembers);
router.post("/invite", requireCompanyPermission("team.invite"), inviteMember);
router.put("/:memberId", requireCompanyPermission("team.manage"), updateMember);
router.delete("/:memberId", requireCompanyPermission("team.manage"), removeMember);
router.get("/:memberId/metrics", requireCompanyPermission("metrics.viewTeam"), getMemberMetrics);

export default router;
```

### Step 6c: Checar tipos e commit

```bash
cd backend && npx tsc --noEmit
git add src/controllers/companyMemberController.ts src/routes/companyMemberRoutes.ts
git commit -m "feat: add company member and role management endpoints"
```

---

## Task 7: companySalaryRoutes — Gestão Salarial

**Files:**
- Create: `backend/src/controllers/companySalaryController.ts`
- Create: `backend/src/routes/companySalaryRoutes.ts`

### Step 7a: Criar companySalaryController.ts

```typescript
// backend/src/controllers/companySalaryController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companySalaryController");

export async function getSalaryRules(req: AuthRequest, res: Response) {
  const rules = await prisma.companySalaryRule.findMany({
    where: { companyId: req.companyId! },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ success: true, message: "Regras obtidas", data: rules });
}

export async function createSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { roleId, memberId, amount, dayOfMonth, description } = req.body;
    if (!roleId && !memberId) {
      return res.status(400).json({ success: false, message: "Informe roleId (por cargo) ou memberId (individual)" });
    }
    const rule = await prisma.companySalaryRule.create({
      data: {
        companyId: req.companyId!,
        roleId: roleId ? Number(roleId) : null,
        memberId: memberId ? Number(memberId) : null,
        amount: Number(amount),
        dayOfMonth: Number(dayOfMonth),
        description,
      },
    });
    return res.status(201).json({ success: true, message: "Regra criada", data: rule });
  } catch (err) {
    log.error({ err }, "createSalaryRule error");
    throw err;
  }
}

export async function updateSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { ruleId } = req.params;
    const { amount, dayOfMonth, description, isActive } = req.body;
    const rule = await prisma.companySalaryRule.update({
      where: { id: Number(ruleId) },
      data: { amount: amount ? Number(amount) : undefined, dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined, description, isActive },
    });
    return res.json({ success: true, message: "Regra atualizada", data: rule });
  } catch (err) {
    log.error({ err }, "updateSalaryRule error");
    throw err;
  }
}

export async function deleteSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { ruleId } = req.params;
    await prisma.companySalaryRule.update({ where: { id: Number(ruleId) }, data: { isActive: false } });
    return res.json({ success: true, message: "Regra desativada" });
  } catch (err) {
    log.error({ err }, "deleteSalaryRule error");
    throw err;
  }
}

export async function getSalaryHistory(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const payments = await prisma.companySalaryPayment.findMany({
      where: { memberId: Number(memberId) },
      include: { rule: true },
      orderBy: { paidAt: "desc" },
    });
    return res.json({ success: true, message: "Histórico obtido", data: payments });
  } catch (err) {
    log.error({ err }, "getSalaryHistory error");
    throw err;
  }
}

/** Transferência manual de salário para um membro */
export async function transferSalary(req: AuthRequest, res: Response) {
  try {
    const { memberId, amount, note } = req.body;
    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
      include: { user: true },
    });
    if (!member) return res.status(404).json({ success: false, message: "Membro não encontrado" });

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      include: { user: { select: { balance: true } } },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const companyBalance = companyProfile.user.balance;
    const transferAmount = Number(amount);
    if (companyBalance < transferAmount) {
      return res.status(400).json({ success: false, message: "Saldo insuficiente na wallet corporativa" });
    }

    // Transação atômica: debita empresa, credita membro
    await prisma.$transaction([
      prisma.user.update({ where: { id: companyProfile.userId }, data: { balance: { decrement: transferAmount } } }),
      prisma.user.update({ where: { id: member.userId }, data: { balance: { increment: transferAmount } } }),
    ]);

    // Registrar pagamento
    const rule = await prisma.companySalaryRule.findFirst({ where: { memberId: member.id, companyId: req.companyId! } });
    await prisma.companySalaryPayment.create({
      data: {
        ruleId: rule?.id ?? 0,
        memberId: member.id,
        amount: transferAmount,
        paidAt: new Date(),
        status: "PAID",
        note,
      },
    });

    return res.json({ success: true, message: `R$ ${transferAmount.toFixed(2)} transferido para ${member.user.name}` });
  } catch (err) {
    log.error({ err }, "transferSalary error");
    throw err;
  }
}
```

### Step 7b: Criar companySalaryRoutes.ts

```typescript
// backend/src/routes/companySalaryRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { getSalaryRules, createSalaryRule, updateSalaryRule, deleteSalaryRule, getSalaryHistory, transferSalary } from "../controllers/companySalaryController";

const router = Router();
router.use(verifyToken);

router.get("/rules", requireCompanyPermission("finance.salary"), getSalaryRules);
router.post("/rules", requireCompanyPermission("finance.salary"), createSalaryRule);
router.put("/rules/:ruleId", requireCompanyPermission("finance.salary"), updateSalaryRule);
router.delete("/rules/:ruleId", requireCompanyPermission("finance.salary"), deleteSalaryRule);
router.get("/history/:memberId", requireCompanyPermission("finance.salary"), getSalaryHistory);
router.post("/transfer", requireCompanyPermission("finance.transfer"), transferSalary);

export default router;
```

### Step 7c: Checar tipos e commit

```bash
cd backend && npx tsc --noEmit
git add src/controllers/companySalaryController.ts src/routes/companySalaryRoutes.ts
git commit -m "feat: add company salary rules and transfer endpoints"
```

---

## Task 8: companyTeamRoutes — Equipes por Pedido

**Files:**
- Create: `backend/src/controllers/companyTeamController.ts`
- Create: `backend/src/routes/companyTeamRoutes.ts`

### Step 8a: Criar companyTeamController.ts

```typescript
// backend/src/controllers/companyTeamController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyTeamController");

/** POST /api/company/teams — cria equipe para um pedido */
export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const { orderId, leaderId, memberIds } = req.body;

    if (!leaderId) {
      return res.status(400).json({ success: false, message: "Líder da equipe é obrigatório" });
    }
    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: "Equipe deve ter pelo menos um membro" });
    }

    // Validar que o pedido pertence à empresa
    const companyProfile = await prisma.companyProfile.findUnique({ where: { id: req.companyId! } });
    const order = await prisma.serviceOrder.findFirst({
      where: { id: Number(orderId), providerId: companyProfile?.userId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!order) return res.status(404).json({ success: false, message: "Pedido não encontrado" });

    const existing = await prisma.serviceTeam.findUnique({ where: { orderId: Number(orderId) } });
    if (existing) return res.status(400).json({ success: false, message: "Pedido já possui uma equipe" });

    // Criar equipe + membros + chat em grupo
    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.serviceTeam.create({
        data: {
          orderId: Number(orderId),
          leaderId: Number(leaderId),
          members: {
            create: (memberIds as number[]).map((id) => ({ memberId: id })),
          },
        },
        include: { members: { include: { member: { include: { user: true } } } }, leader: { include: { user: true } } },
      });

      // Buscar userIds dos membros para criar o chat em grupo
      const memberUserIds = newTeam.members.map((m) => m.member.userId);
      const allParticipants = [...new Set([order.clientId, ...memberUserIds])];

      // Criar mensagem de sistema para abrir o chat em grupo
      // (reusa o modelo Message existente com isGroup=true)
      await tx.message.create({
        data: {
          orderId: Number(orderId),
          senderId: companyProfile!.userId,
          receiverId: order.clientId,
          content: `Equipe designada para o serviço. Membros: ${newTeam.members.map((m) => m.member.user.name).join(", ")}`,
          isGroup: true,
          teamId: newTeam.id,
        },
      });

      return newTeam;
    });

    return res.status(201).json({ success: true, message: "Equipe criada e chat em grupo iniciado", data: team });
  } catch (err) {
    log.error({ err }, "createTeam error");
    throw err;
  }
}

/** GET /api/company/teams/:orderId — buscar equipe de um pedido */
export async function getTeamByOrder(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.params;
    const team = await prisma.serviceTeam.findUnique({
      where: { orderId: Number(orderId) },
      include: {
        leader: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
        members: { include: { member: { include: { user: { select: { id: true, name: true, profileImage: true } } } } } },
      },
    });
    if (!team) return res.status(404).json({ success: false, message: "Equipe não encontrada" });
    return res.json({ success: true, message: "Equipe obtida", data: team });
  } catch (err) {
    log.error({ err }, "getTeamByOrder error");
    throw err;
  }
}

/** POST /api/company/teams/:teamId/complete — líder confirma conclusão */
export async function confirmTeamCompletion(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const memberId = req.companyMemberId;

    const team = await prisma.serviceTeam.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ success: false, message: "Equipe não encontrada" });
    if (team.leaderId !== memberId) {
      return res.status(403).json({ success: false, message: "Apenas o líder pode confirmar a conclusão" });
    }

    // Atualiza status do pedido para AWAITING_CLIENT_CONFIRMATION
    await prisma.serviceOrder.update({
      where: { id: team.orderId },
      data: { status: "AWAITING_CLIENT_CONFIRMATION" },
    });

    return res.json({ success: true, message: "Conclusão confirmada pelo líder. Aguardando confirmação do cliente." });
  } catch (err) {
    log.error({ err }, "confirmTeamCompletion error");
    throw err;
  }
}
```

### Step 8b: Criar companyTeamRoutes.ts

```typescript
// backend/src/routes/companyTeamRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { createTeam, getTeamByOrder, confirmTeamCompletion } from "../controllers/companyTeamController";

const router = Router();
router.use(verifyToken);

router.post("/", requireCompanyPermission("orders.assign"), createTeam);
router.get("/order/:orderId", requireCompanyPermission("orders.view"), getTeamByOrder);
router.post("/:teamId/complete", confirmTeamCompletion); // membro verifica por designação
```

### Step 8c: Checar tipos e commit

```bash
cd backend && npx tsc --noEmit
git add src/controllers/companyTeamController.ts src/routes/companyTeamRoutes.ts
git commit -m "feat: add company team creation with group chat and leader completion flow"
```

---

## Task 9: Registrar Routers em index.ts

**Files:**
- Modify: `backend/src/index.ts`

### Step 9a: Adicionar imports dos novos routers

Localizar o bloco de imports de routers em `backend/src/index.ts` e adicionar após os imports existentes:
```typescript
import companyRoutes from "./routes/companyRoutes";
import companyMemberRoutes from "./routes/companyMemberRoutes";
import companySalaryRoutes from "./routes/companySalaryRoutes";
import companyTeamRoutes from "./routes/companyTeamRoutes";
```

### Step 9b: Registrar as rotas

Localizar onde as outras rotas são registradas (ex: `app.use("/api/wallet", ...)`) e adicionar:
```typescript
app.use("/api/company", companyRoutes);
app.use("/api/company/members", companyMemberRoutes);
app.use("/api/company/salary", companySalaryRoutes);
app.use("/api/company/teams", companyTeamRoutes);
```

### Step 9c: Checar tipos e testes

```bash
cd backend && npx tsc --noEmit && npm test
```
Esperado: sem erros, todos os testes passando.

### Step 9d: Commit

```bash
cd backend
git add src/index.ts
git commit -m "feat: register company routes in express app"
```

---

## Task 10: Dashboard Controller — Branch COMPANY

**Files:**
- Modify: `backend/src/controllers/dashboardController.ts`

### Step 10a: Localizar o branch de role no dashboardController

```bash
grep -n "Unsupported role\|role ===" backend/src/controllers/dashboardController.ts | head -10
```

### Step 10b: Adicionar branch para COMPANY

Localizar o bloco que retorna 403 para roles desconhecidos e adicionar antes dele:
```typescript
if (role === "COMPANY") {
  // Redirecionar para o endpoint específico de empresa
  return res.status(200).json({
    success: true,
    message: "Use /api/company/dashboard para dados da empresa",
    data: { redirectTo: "/api/company/dashboard" },
  });
}
```

### Step 10c: Checar e commit

```bash
cd backend && npx tsc --noEmit
git add src/controllers/dashboardController.ts
git commit -m "fix: handle COMPANY role in dashboard controller without 403"
```

---

## Task 11: Registro + Login Frontend

**Files:**
- Modify: `frontend/src/pages/Register.tsx`
- Modify: `frontend/src/context/AuthContext.tsx`

### Step 11a: Adicionar opção COMPANY em Register.tsx

Localizar a função `parseRoleParam` e atualizar:
```typescript
const parseRoleParam = (roleParam?: string | null): "CLIENT" | "PROFESSIONAL" | "COMPANY" => {
  const normalizedRole = roleParam?.toLowerCase().trim();
  if (normalizedRole === "professional" || normalizedRole === "profissional" || normalizedRole === "pro") return "PROFESSIONAL";
  if (normalizedRole === "company" || normalizedRole === "empresa") return "COMPANY";
  return "CLIENT";
};
```

Atualizar o estado inicial para incluir campos de empresa:
```typescript
const [formData, setFormData] = useState({
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  role: roleFromQuery as "CLIENT" | "PROFESSIONAL" | "COMPANY",
  document: "",
  companyName: "",
  cnpj: "",
});
```

Adicionar botão "Empresa" no seletor de roles (junto com Cliente e Profissional):
```tsx
<button
  type="button"
  onClick={() => setFormData(p => ({ ...p, role: "COMPANY" }))}
  className={clsx("flex flex-col items-center p-4 rounded-xl border-2 transition-all", {
    "border-blue-500 bg-blue-50 dark:bg-blue-900/20": formData.role === "COMPANY",
    "border-slate-200 dark:border-slate-700 hover:border-slate-300": formData.role !== "COMPANY",
  })}
>
  <Briefcase className="h-6 w-6 mb-2 text-blue-600" />
  <span className="font-semibold text-sm">Empresa</span>
  <span className="text-xs text-slate-500 mt-1">Ofereça serviços corporativos</span>
</button>
```

Adicionar campos condicionais (mostrar apenas se role === "COMPANY"):
```tsx
{formData.role === "COMPANY" && (
  <>
    <div>
      <label className="block text-sm font-medium mb-1">Nome da Empresa *</label>
      <input
        type="text"
        value={formData.companyName}
        onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
        placeholder="Razão social ou nome fantasia"
        className="input w-full"
      />
      {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">CNPJ *</label>
      <input
        type="text"
        value={formData.cnpj}
        onChange={e => setFormData(p => ({ ...p, cnpj: e.target.value.replace(/\D/g, "") }))}
        placeholder="00000000000000"
        maxLength={14}
        className="input w-full"
      />
      {errors.cnpj && <p className="text-red-500 text-xs mt-1">{errors.cnpj}</p>}
    </div>
  </>
)}
```

Atualizar a tipagem do `RegisterData` no submit para incluir `companyName` e `cnpj`.

### Step 11b: Atualizar AuthContext.tsx

Atualizar a interface `User` para incluir COMPANY:
```typescript
role: "CLIENT" | "PROFESSIONAL" | "COMPANY" | "ADMIN";
```

Atualizar a interface `RegisterData`:
```typescript
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CLIENT" | "PROFESSIONAL" | "COMPANY";
  document?: string;
  companyName?: string;
  cnpj?: string;
}
```

Atualizar o redirect pós-login (localizar o bloco de navigate por role):
```typescript
if (user.role === "PROFESSIONAL") navigate("/professional/dashboard");
else if (user.role === "CLIENT") navigate("/client/dashboard");
else if (user.role === "COMPANY") navigate("/company/dashboard");
else if (user.role === "ADMIN") navigate("/admin/dashboard");
```

Adicionar helper `isCompany` no contexto (junto com `isAuthenticated`):
```typescript
isCompany: user?.role === "COMPANY",
```

### Step 11c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 11d: Commit

```bash
cd frontend
git add src/pages/Register.tsx src/context/AuthContext.tsx
git commit -m "feat: add COMPANY role to registration flow and auth context"
```

---

## Task 12: App.tsx — Rotas /company/*

**Files:**
- Modify: `frontend/src/App.tsx`

### Step 12a: Adicionar imports das páginas company (placeholder temporário)

No topo do `App.tsx`, adicionar após os imports existentes:
```typescript
// Company pages (criadas nas tasks seguintes)
import CompanyDashboard from "./pages/company/Dashboard";
import CompanyProfile from "./pages/company/Profile";
import CompanyMembers from "./pages/company/Members";
import CompanyRoles from "./pages/company/Roles";
import CompanySalary from "./pages/company/Salary";
import CompanyOrders from "./pages/company/Orders";
import CompanyStorefront from "./pages/CompanyStorefront";
```

### Step 12b: Criar arquivos placeholder para as páginas (necessário para o import não quebrar)

Para cada página listada acima, criar um arquivo mínimo temporário. Exemplo para `Dashboard.tsx`:
```typescript
// frontend/src/pages/company/Dashboard.tsx
import React from "react";
const CompanyDashboard: React.FC = () => <div>Company Dashboard — Em construção</div>;
export default CompanyDashboard;
```
Repetir para: `Profile.tsx`, `Members.tsx`, `Roles.tsx`, `Salary.tsx`, `Orders.tsx`, e `../CompanyStorefront.tsx`.

### Step 12c: Adicionar bloco de rotas /company/* no App.tsx

Localizar o bloco de rotas `/admin/*` no App.tsx como referência e adicionar bloco similar antes dele:
```tsx
{/* COMPANY ROUTES */}
<Route
  path="company"
  element={
    <ProtectedRoute allowedRoles={[UserRole.COMPANY]}>
      <Layout />
    </ProtectedRoute>
  }
>
  <Route path="dashboard" element={<CompanyDashboard />} />
  <Route path="profile" element={<CompanyProfile />} />
  <Route path="members" element={<CompanyMembers />} />
  <Route path="roles" element={<CompanyRoles />} />
  <Route path="salary" element={<CompanySalary />} />
  <Route path="orders" element={<CompanyOrders />} />
</Route>

{/* Vitrine pública — sem proteção de role */}
<Route path="empresa/:companyId" element={<CompanyStorefront />} />
```

### Step 12d: Checar tipos e commit

```bash
cd frontend && npx tsc --noEmit
git add src/App.tsx src/pages/company/ src/pages/CompanyStorefront.tsx
git commit -m "feat: add company routes to App.tsx with protected layout"
```

---

## Task 13: Páginas company — Dashboard + Profile

**Files:**
- Modify: `frontend/src/pages/company/Dashboard.tsx`
- Modify: `frontend/src/pages/company/Profile.tsx`
- Create: `frontend/src/components/company/CompanyBadge.tsx`

### Step 13a: Criar CompanyBadge.tsx

```typescript
// frontend/src/components/company/CompanyBadge.tsx
import React from "react";
import { Building2, Clock } from "lucide-react";
import clsx from "clsx";

interface Props {
  isVerified: boolean;
  size?: "sm" | "md";
}

const CompanyBadge: React.FC<Props> = ({ isVerified, size = "md" }) => (
  <span className={clsx(
    "inline-flex items-center gap-1 rounded-full font-medium",
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
    isVerified
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
  )}>
    {isVerified ? <Building2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
    {isVerified ? "Empresa Verificada" : "Verificação Pendente"}
  </span>
);

export default CompanyBadge;
```

### Step 13b: Implementar Dashboard.tsx

Substituir o placeholder pelo componente real com:
- Cards de stats: pedidos ativos, concluídos, membros, saldo
- `useEffect` que chama `GET /api/company/dashboard`
- Botões de atalho para as seções principais
- `CompanyBadge` no topo

### Step 13c: Implementar Profile.tsx

Formulário de edição do perfil corporativo:
- Campos: nome da empresa, descrição, logo (URL), website, telefone, ramo de atuação
- `GET /api/company/profile` para carregar
- `PUT /api/company/profile` para salvar
- Upload de logo (reutilizar lógica existente de upload do projeto)

### Step 13d: Checar e commit

```bash
cd frontend && npx tsc --noEmit
git add src/pages/company/Dashboard.tsx src/pages/company/Profile.tsx src/components/company/CompanyBadge.tsx
git commit -m "feat: implement company dashboard and profile pages"
```

---

## Task 14: Páginas company — Members + Roles

**Files:**
- Modify: `frontend/src/pages/company/Members.tsx`
- Modify: `frontend/src/pages/company/Roles.tsx`
- Create: `frontend/src/components/company/MemberCard.tsx`
- Create: `frontend/src/components/company/PermissionToggle.tsx`
- Create: `frontend/src/components/company/PermissionGroup.tsx`

### Step 14a: Criar PermissionToggle.tsx

```typescript
// frontend/src/components/company/PermissionToggle.tsx
import React from "react";

interface Props {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const PermissionToggle: React.FC<Props> = ({ label, description, value, onChange, disabled }) => (
  <div className="flex items-start justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
    <div className="flex-1 mr-4">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
        value ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  </div>
);

export default PermissionToggle;
```

### Step 14b: Criar PermissionGroup.tsx

Componente que agrupa os toggles por área (Métricas, Canais, Pedidos, etc.) com header colapsável e descrição da área.

### Step 14c: Criar MemberCard.tsx

Card com avatar, nome, cargo (com cor do cargo), status ativo/inativo, e botões de ação (editar cargo, remover).

### Step 14d: Implementar Members.tsx

- Lista de membros via `GET /api/company/members`
- Botão "Convidar Membro" (modal com campo email + seletor de cargo)
- `MemberCard` para cada membro
- Link para `/company/members/:id` (métricas individuais — `MemberDetail.tsx`, implementar na mesma task como placeholder)

### Step 14e: Implementar Roles.tsx

- Lista de cargos via `GET /api/company/members/roles`
- Botão "Criar Cargo" (modal com nome, nível, cor)
- Ao clicar num cargo: expandir/abrir painel com `PermissionGroup` para cada área
- Salvar via `PUT /api/company/members/roles/:roleId`

### Step 14f: Checar e commit

```bash
cd frontend && npx tsc --noEmit
git add src/pages/company/Members.tsx src/pages/company/Roles.tsx src/components/company/
git commit -m "feat: implement company members and roles pages with permission toggles"
```

---

## Task 15: Página company — Salary

**Files:**
- Modify: `frontend/src/pages/company/Salary.tsx`
- Create: `frontend/src/components/company/SalaryRuleCard.tsx`

### Step 15a: Criar SalaryRuleCard.tsx

Card exibindo: tipo (por cargo ou individual), valor, dia do mês, status ativo/inativo, botões de editar/desativar.

### Step 15b: Implementar Salary.tsx

A página terá duas seções:
1. **Regras Salariais** — lista de regras por cargo + individuais, botão "Nova Regra" (modal), toggle ativo/inativo
2. **Transferência Manual** — seletor de membro + valor + nota, botão "Transferir"

Ao clicar num cargo na lista de regras → expandir para mostrar os membros daquele cargo e o histórico de pagamentos de cada um (via `GET /api/company/salary/history/:memberId`).

### Step 15c: Checar e commit

```bash
cd frontend && npx tsc --noEmit
git add src/pages/company/Salary.tsx src/components/company/SalaryRuleCard.tsx
git commit -m "feat: implement company salary management page"
```

---

## Task 16: Página company — Orders + TeamBuilder

**Files:**
- Modify: `frontend/src/pages/company/Orders.tsx`
- Create: `frontend/src/components/company/TeamBuilder.tsx`

### Step 16a: Criar TeamBuilder.tsx

Modal/painel que aparece ao clicar "Designar Equipe" num pedido:
- Lista de membros ativos da empresa (checkboxes)
- Seletor obrigatório de líder (radio button entre os selecionados)
- Botão "Criar Equipe" (desabilitado se não tiver líder)
- Validação: não pode confirmar sem líder → mensagem de erro clara

```typescript
// frontend/src/components/company/TeamBuilder.tsx
interface Props {
  orderId: number;
  members: CompanyMember[];
  onTeamCreated: () => void;
  onClose: () => void;
}
```

### Step 16b: Implementar Orders.tsx

- Lista de pedidos via `GET /api/services/orders` filtrado por providerId da empresa
- Para cada pedido: status, cliente, valor, botão "Designar Equipe" (abre TeamBuilder)
- Se já tiver equipe: mostrar membros designados e líder
- Filtros por status (PENDING, IN_PROGRESS, COMPLETED)

### Step 16c: Checar e commit

```bash
cd frontend && npx tsc --noEmit
git add src/pages/company/Orders.tsx src/components/company/TeamBuilder.tsx
git commit -m "feat: implement company orders page with team assignment"
```

---

## Task 17: CompanyStorefront — Vitrine Pública

**Files:**
- Modify: `frontend/src/pages/CompanyStorefront.tsx`

### Step 17a: Implementar CompanyStorefront.tsx

Vitrine pública acessível por qualquer visitante em `/empresa/:companyId`:
- Header com logo, nome, badge verificado, indústria
- Descrição e informações de contato
- Grid de serviços disponíveis (reutilizar `ServiceCard` existente se houver)
- Rating médio e total de avaliações
- Botão "Contratar" que leva ao fluxo normal de pedido

Dados via `GET /api/company/storefront/:companyId` (sem autenticação).

### Step 17b: Adicionar link para vitrine no catálogo geral

Em `frontend/src/pages/services/ServiceSearch.tsx` (ou onde os serviços são listados), adicionar: quando o provedor for `role=COMPANY`, exibir `CompanyBadge` e link para `/empresa/:companyProfileId`.

### Step 17c: Checar e commit

```bash
cd frontend && npx tsc --noEmit
git add src/pages/CompanyStorefront.tsx src/pages/services/ServiceSearch.tsx
git commit -m "feat: add company public storefront page and badge in service search"
```

---

## Task 18: Testes de Integração — Fluxo Empresa

**Files:**
- Create: `backend/tests/companyFlow.test.ts`

### Step 18a: Escrever testes

```typescript
// backend/tests/companyFlow.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "../src/lib/prisma";

describe("Company Flow Integration", () => {
  let companyToken: string;
  let companyUserId: number;

  beforeAll(async () => {
    // Limpar dados de teste
    await prisma.companyMember.deleteMany({ where: { company: { cnpj: "99999999000199" } } });
    await prisma.companyProfile.deleteMany({ where: { cnpj: "99999999000199" } });
    await prisma.user.deleteMany({ where: { email: "empresa-test@faztudo.com" } });
  });

  it("should register a company", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Empresa FazTudo Test",
      email: "empresa-test@faztudo.com",
      password: "Teste@123",
      role: "COMPANY",
      companyName: "Empresa FazTudo Test Ltda",
      cnpj: "99999999000199",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("COMPANY");
    companyUserId = res.body.data.user.id;
  });

  it("should login as company", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "empresa-test@faztudo.com",
      password: "Teste@123",
    });
    expect(res.status).toBe(200);
    companyToken = res.body.data.token;
  });

  it("should get company profile", async () => {
    const res = await request(app)
      .get("/api/company/profile")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.cnpj).toBe("99999999000199");
  });

  it("should create a company role", async () => {
    const res = await request(app)
      .post("/api/company/members/roles")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({
        name: "Operacional",
        level: 3,
        permissions: { metrics: { view: false, viewTeam: false }, chat: { view: true, respond: true, manage: false }, orders: { view: true, assign: false, manage: false }, finance: { view: false, transfer: false, salary: false }, team: { view: false, invite: false, manage: false }, catalog: { edit: false }, company: { settings: false, roles: false } },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Operacional");
  });

  it("should get company dashboard stats", async () => {
    const res = await request(app)
      .get("/api/company/dashboard")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalOrders");
    expect(res.body.data).toHaveProperty("totalMembers");
  });

  afterAll(async () => {
    await prisma.companyMember.deleteMany({ where: { company: { cnpj: "99999999000199" } } });
    await prisma.companyRole.deleteMany({ where: { company: { cnpj: "99999999000199" } } });
    await prisma.companyProfile.deleteMany({ where: { cnpj: "99999999000199" } });
    await prisma.user.deleteMany({ where: { email: "empresa-test@faztudo.com" } });
  });
});
```

### Step 18b: Rodar testes

```bash
cd backend && npx vitest run tests/companyFlow.test.ts
```
Esperado: todos passando.

### Step 18c: Rodar suite completa

```bash
cd backend && npm test
```
Esperado: todos passando, sem regressões.

### Step 18d: Commit

```bash
cd backend
git add tests/companyFlow.test.ts tests/companyRegistration.test.ts
git commit -m "test: add company registration and flow integration tests"
```

---

## Task 19: Seed — Empresa de Teste

**Files:**
- Modify: `backend/prisma/seed.ts`

### Step 19a: Adicionar empresa de teste ao seed

Localizar o bloco de criação de usuários em `backend/prisma/seed.ts` e adicionar após os profissionais existentes:

```typescript
// Empresa de teste
const empresaUser = await prisma.user.upsert({
  where: { email: "empresa@teste.com" },
  update: {},
  create: {
    email: "empresa@teste.com",
    name: "Empresa FazTudo Demo",
    password: await bcrypt.hash("Teste@123", 10),
    role: "COMPANY",
    status: "ACTIVE",
    isVerified: true,
  },
});

await prisma.companyProfile.upsert({
  where: { userId: empresaUser.id },
  update: {},
  create: {
    userId: empresaUser.id,
    companyName: "FazTudo Serviços Ltda",
    cnpj: "12345678000196",
    description: "Empresa de demonstração para serviços domésticos e empresariais.",
    isVerified: true,
    industry: "Serviços",
  },
});
```

### Step 19b: Rodar o seed

```bash
cd backend && npm run db:seed
```
Esperado: seed executado sem erros.

### Step 19c: Commit final

```bash
cd backend
git add prisma/seed.ts
git commit -m "feat: add company test user to seed data"
```

---

## Verificação Final

Após todas as tasks, executar:

```bash
# Backend
cd backend && npm test && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit && npm run build

# Subir ambiente
docker compose up
```

**Testar manualmente:**
1. Registrar uma conta como "Empresa" em http://localhost:5173/register
2. Verificar redirect para `/company/dashboard`
3. Criar um cargo em `/company/roles`
4. Adicionar um membro em `/company/members`
5. Acessar a vitrine pública em `/empresa/1`

---

## Resumo de Arquivos Criados/Modificados

### Backend (novos)
- `prisma/schema.prisma` — COMPANY enum, 7 novos modelos
- `src/middleware/companyPermission.ts` — middleware de permissões
- `src/controllers/companyController.ts`
- `src/controllers/companyMemberController.ts`
- `src/controllers/companySalaryController.ts`
- `src/controllers/companyTeamController.ts`
- `src/routes/companyRoutes.ts`
- `src/routes/companyMemberRoutes.ts`
- `src/routes/companySalaryRoutes.ts`
- `src/routes/companyTeamRoutes.ts`
- `tests/companyRegistration.test.ts`
- `tests/companyFlow.test.ts`

### Backend (modificados)
- `src/middleware/validation.ts` — registerSchema + COMPANY
- `src/middleware/auth.ts` — AuthRequest + companyId/companyMemberId
- `src/controllers/authController.ts` — criar CompanyProfile no registro
- `src/controllers/dashboardController.ts` — branch COMPANY
- `src/index.ts` — registrar 4 novos routers
- `prisma/seed.ts` — empresa de teste

### Frontend (novos)
- `src/types/company.ts` — todos os tipos empresa
- `src/pages/company/Dashboard.tsx`
- `src/pages/company/Profile.tsx`
- `src/pages/company/Members.tsx`
- `src/pages/company/Roles.tsx`
- `src/pages/company/Salary.tsx`
- `src/pages/company/Orders.tsx`
- `src/pages/CompanyStorefront.tsx`
- `src/components/company/CompanyBadge.tsx`
- `src/components/company/PermissionToggle.tsx`
- `src/components/company/PermissionGroup.tsx`
- `src/components/company/MemberCard.tsx`
- `src/components/company/SalaryRuleCard.tsx`
- `src/components/company/TeamBuilder.tsx`

### Frontend (modificados)
- `src/types/enums.ts` — COMPANY + SalaryStatus
- `src/types/index.ts` — re-export company types
- `src/context/AuthContext.tsx` — COMPANY role + isCompany + redirect
- `src/App.tsx` — rotas /company/*
- `src/pages/Register.tsx` — opção Empresa + campos CNPJ/nome
- `src/pages/services/ServiceSearch.tsx` — CompanyBadge + link vitrine
