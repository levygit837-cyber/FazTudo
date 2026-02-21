# Implementation Plan — Módulo Empresarial: Vitrine + Programa de Parceiro
**Claude**: Read every task sequentially. Each task has EXACT files, EXACT code (not pseudocode), EXACT test commands with expected output, and a git commit step. Do not skip or summarize. Do not move to the next task until the current one passes its verification command.

**Goal**: Implement Phase 1 of the Enterprise module — customizable storefront, partner tier system (EMPRESA→PARCEIRO→ELITE), invite-by-link, salary cron, and 3 new analytics KPIs.

**Architecture facts (read before touching any file)**:
- Company controllers live in `backend/src/controllers/` (NOT `controllers/service/`)
- Analytics routes are embedded in `companyRoutes.ts` (there is NO separate analyticsRoutes file)
- `CompanySalaryRule.companyId` exists in the DB but has NO Prisma back-relation to `CompanyProfile` — you must add it
- `getMembers` currently returns members without `ratingAverage` and `isVerified` — fix it while passing through
- `CompanyStorefront` page lives at `frontend/src/pages/CompanyStorefront.tsx` (root pages/, NOT pages/company/)
- Logger: always `import { createLogger } from "../lib/logger"` → `const log = createLogger("moduleName")` — NEVER console.log

**Tech Stack**:
- Backend: Express 5 + TypeScript + Prisma 7 + Zod 4 + Vitest 4 + Pino
- Frontend: React 19 + React Router 7 + Tailwind v4 + Axios + Lucide React + Recharts 3

---

## Task 1 — Schema: Storefront Models

**File**: `backend/prisma/schema.prisma`

Add the following enum and models. Place the enum near the other enums. Place the models at the end of the file (before the last closing brace if any).

```prisma
enum StorefrontBlockType {
  HERO
  ABOUT
  TESTIMONIALS
}

model CompanyStorefrontSection {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  title       String
  description String?
  order       Int
  isActive    Boolean  @default(true)
  items       CompanyStorefrontItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CompanyStorefrontItem {
  id          Int      @id @default(autoincrement())
  sectionId   Int
  section     CompanyStorefrontSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  listingId   Int
  listing     ServiceListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  order       Int
  isFeatured  Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model CompanyStorefrontBlock {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type        StorefrontBlockType
  order       Int
  isActive    Boolean  @default(true)
  content     Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CompanyPinnedTestimonial {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  reviewId    Int
  review      Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  order       Int
  createdAt   DateTime @default(now())
}
```

Also add the back-relations to `CompanyProfile`:

```prisma
// Inside model CompanyProfile { ... }
storefrontSections    CompanyStorefrontSection[]
storefrontBlocks      CompanyStorefrontBlock[]
pinnedTestimonials    CompanyPinnedTestimonial[]
```

Also add the back-relation to `Review`:

```prisma
// Inside model Review { ... }
pinnedBy              CompanyPinnedTestimonial[]
```

Also add the back-relation to `ServiceListing`:

```prisma
// Inside model ServiceListing { ... }
storefrontItems       CompanyStorefrontItem[]
```

**Verification**:
```bash
cd backend && npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

**Commit**:
```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add storefront models to prisma schema"
```

---

## Task 2 — Schema: Tier + Onboarding + InviteToken

**File**: `backend/prisma/schema.prisma`

Add the `CompanyTier` enum:

```prisma
enum CompanyTier {
  EMPRESA
  PARCEIRO
  ELITE
}
```

Add `CompanyInviteToken` model:

```prisma
model CompanyInviteToken {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  token       String   @unique
  role        CompanyRole @default(MEMBER)
  createdById Int
  createdBy   User     @relation("InviteTokenCreator", fields: [createdById], references: [id])
  usedById    Int?
  usedBy      User?    @relation("InviteTokenUser", fields: [usedById], references: [id])
  usedAt      DateTime?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}
```

Add new fields to `CompanyProfile` (inside the existing model):

```prisma
tier              CompanyTier @default(EMPRESA)
onboardingStep    Int         @default(0)
onboardingDone    Boolean     @default(false)
inviteTokens      CompanyInviteToken[]
```

Also add the `CompanySalaryRule` back-relation to `CompanyProfile` (it's missing):

```prisma
salaryRules       CompanySalaryRule[]
```

Add back-relations to `User` model:

```prisma
createdInviteTokens  CompanyInviteToken[] @relation("InviteTokenCreator")
usedInviteTokens     CompanyInviteToken[] @relation("InviteTokenUser")
```

After editing, apply the schema:

```bash
cd backend && npx prisma db push
```

**Verification**:
```bash
cd backend && npx prisma validate && npx tsc --noEmit
```
Expected: no errors.

**Commit**:
```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add CompanyTier enum, onboarding fields, invite token model"
```

---

## Task 3 — Backend: Storefront Controller

**File**: `backend/src/controllers/companyStorefrontController.ts` (create new)

```typescript
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { z } from "zod";

const log = createLogger("companyStorefront");

// ──────────────────────────────────────────────
// PUBLIC: get full storefront for a company slug
// ──────────────────────────────────────────────
export async function getPublicStorefront(req: Request, res: Response) {
  const { slug } = req.params;
  try {
    const company = await prisma.companyProfile.findUnique({
      where: { slug },
      include: {
        storefrontSections: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                listing: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    price: true,
                    coverImageUrl: true,
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        storefrontBlocks: {
          where: { isActive: true },
          orderBy: { order: "asc" },
        },
        pinnedTestimonials: {
          orderBy: { order: "asc" },
          include: {
            review: {
              select: {
                id: true,
                rating: true,
                comment: true,
                createdAt: true,
                reviewer: { select: { name: true, profileImageUrl: true } },
              },
            },
          },
        },
        user: { select: { name: true, profileImageUrl: true } },
        members: {
          where: { isActive: true },
          select: { id: true, role: true, user: { select: { name: true, profileImageUrl: true } } },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Empresa não encontrada" });
    }

    const ordersCount = await prisma.serviceOrder.count({
      where: { professional: { companyMemberships: { some: { companyId: company.id } } }, status: "COMPLETED" },
    });

    return res.json({
      success: true,
      message: "Vitrine carregada",
      data: { company, ordersCount },
    });
  } catch (err) {
    log.error({ err }, "getPublicStorefront error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// EDITOR: get storefront data for editing
// ──────────────────────────────────────────────
export async function getStorefrontEditor(req: Request, res: Response) {
  const userId = (req as any).user.id;
  try {
    const member = await prisma.companyMember.findFirst({
      where: { userId, isActive: true },
      include: {
        company: {
          include: {
            storefrontSections: {
              orderBy: { order: "asc" },
              include: { items: { orderBy: { order: "asc" }, include: { listing: true } } },
            },
            storefrontBlocks: { orderBy: { order: "asc" } },
            pinnedTestimonials: {
              orderBy: { order: "asc" },
              include: { review: { include: { reviewer: { select: { name: true } } } } },
            },
          },
        },
      },
    });

    if (!member) {
      return res.status(403).json({ success: false, message: "Sem permissão" });
    }

    return res.json({ success: true, message: "Editor carregado", data: member.company });
  } catch (err) {
    log.error({ err }, "getStorefrontEditor error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// SECTIONS
// ──────────────────────────────────────────────
const sectionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

export async function createSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const body = sectionSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos", data: body.error.flatten() });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.create({
      data: { ...body.data, companyId: member.companyId },
    });
    return res.status(201).json({ success: true, message: "Seção criada", data: section });
  } catch (err) {
    log.error({ err }, "createSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function updateSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId);
  const body = sectionSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section) return res.status(404).json({ success: false, message: "Seção não encontrada" });

    const updated = await prisma.companyStorefrontSection.update({
      where: { id: sectionId },
      data: body.data,
    });
    return res.json({ success: true, message: "Seção atualizada", data: updated });
  } catch (err) {
    log.error({ err }, "updateSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function deleteSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section) return res.status(404).json({ success: false, message: "Seção não encontrada" });

    await prisma.companyStorefrontSection.delete({ where: { id: sectionId } });
    return res.json({ success: true, message: "Seção removida" });
  } catch (err) {
    log.error({ err }, "deleteSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function addItemToSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId);
  const bodySchema = z.object({ listingId: z.number().int(), order: z.number().int(), isFeatured: z.boolean().optional() });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const section = await prisma.companyStorefrontSection.findFirst({
      where: { id: sectionId, companyId: member.companyId },
    });
    if (!section) return res.status(404).json({ success: false, message: "Seção não encontrada" });

    const item = await prisma.companyStorefrontItem.create({
      data: { sectionId, ...body.data },
    });
    return res.status(201).json({ success: true, message: "Item adicionado", data: item });
  } catch (err) {
    log.error({ err }, "addItemToSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function removeItemFromSection(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const sectionId = parseInt(req.params.sectionId);
  const itemId = parseInt(req.params.itemId);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const item = await prisma.companyStorefrontItem.findFirst({
      where: { id: itemId, sectionId },
      include: { section: true },
    });
    if (!item || item.section.companyId !== member.companyId) {
      return res.status(404).json({ success: false, message: "Item não encontrado" });
    }

    await prisma.companyStorefrontItem.delete({ where: { id: itemId } });
    return res.json({ success: true, message: "Item removido" });
  } catch (err) {
    log.error({ err }, "removeItemFromSection error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// BLOCKS (HERO, ABOUT, TESTIMONIALS)
// ──────────────────────────────────────────────
const blockSchema = z.object({
  type: z.enum(["HERO", "ABOUT", "TESTIMONIALS"]),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
  content: z.record(z.unknown()),
});

export async function upsertBlock(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const body = blockSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const existing = await prisma.companyStorefrontBlock.findFirst({
      where: { companyId: member.companyId, type: body.data.type },
    });

    let block;
    if (existing) {
      block = await prisma.companyStorefrontBlock.update({
        where: { id: existing.id },
        data: body.data,
      });
    } else {
      block = await prisma.companyStorefrontBlock.create({
        data: { ...body.data, companyId: member.companyId },
      });
    }

    return res.json({ success: true, message: "Bloco salvo", data: block });
  } catch (err) {
    log.error({ err }, "upsertBlock error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// PINNED TESTIMONIALS
// ──────────────────────────────────────────────
export async function pinTestimonial(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const bodySchema = z.object({ reviewId: z.number().int(), order: z.number().int().min(0) });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const count = await prisma.companyPinnedTestimonial.count({ where: { companyId: member.companyId } });
    if (count >= 6) {
      return res.status(400).json({ success: false, message: "Máximo de 6 depoimentos fixados" });
    }

    const pinned = await prisma.companyPinnedTestimonial.create({
      data: { companyId: member.companyId, ...body.data },
    });
    return res.status(201).json({ success: true, message: "Depoimento fixado", data: pinned });
  } catch (err) {
    log.error({ err }, "pinTestimonial error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function unpinTestimonial(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const pinnedId = parseInt(req.params.pinnedId);

  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const pinned = await prisma.companyPinnedTestimonial.findFirst({
      where: { id: pinnedId, companyId: member.companyId },
    });
    if (!pinned) return res.status(404).json({ success: false, message: "Depoimento não encontrado" });

    await prisma.companyPinnedTestimonial.delete({ where: { id: pinnedId } });
    return res.json({ success: true, message: "Depoimento removido" });
  } catch (err) {
    log.error({ err }, "unpinTestimonial error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep companyStorefrontController
```
Expected: no output (no errors in that file).

**Commit**:
```bash
git add backend/src/controllers/companyStorefrontController.ts
git commit -m "feat: add companyStorefrontController with sections, blocks, testimonials"
```

---

## Task 4 — Backend: Storefront Routes

**File**: `backend/src/routes/companyStorefrontRoutes.ts` (create new)

```typescript
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import {
  getStorefrontEditor,
  createSection,
  updateSection,
  deleteSection,
  addItemToSection,
  removeItemFromSection,
  upsertBlock,
  pinTestimonial,
  unpinTestimonial,
} from "../controllers/companyStorefrontController";

const router = Router();

// Editor (authenticated)
router.get("/editor", verifyToken, getStorefrontEditor);

// Sections
router.post("/sections", verifyToken, createSection);
router.patch("/sections/:sectionId", verifyToken, updateSection);
router.delete("/sections/:sectionId", verifyToken, deleteSection);

// Section items
router.post("/sections/:sectionId/items", verifyToken, addItemToSection);
router.delete("/sections/:sectionId/items/:itemId", verifyToken, removeItemFromSection);

// Blocks
router.put("/blocks", verifyToken, upsertBlock);

// Pinned testimonials
router.post("/testimonials/pin", verifyToken, pinTestimonial);
router.delete("/testimonials/:pinnedId", verifyToken, unpinTestimonial);

export default router;
```

**File**: `backend/src/index.ts`

Add the public route (no auth) and the authenticated routes. Find where company routes are registered and add below:

```typescript
// Add this import near the top with other route imports:
import companyStorefrontRoutes from "./routes/companyStorefrontRoutes";
import { getPublicStorefront } from "./controllers/companyStorefrontController";

// Add these route mounts (after existing company route mounts):
app.get("/api/storefront/:slug", getPublicStorefront);
app.use("/api/company/storefront", companyStorefrontRoutes);
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "companyStorefront|index"
```
Expected: no output.

**Commit**:
```bash
git add backend/src/routes/companyStorefrontRoutes.ts backend/src/index.ts
git commit -m "feat: register storefront routes in Express"
```

---

## Task 5 — Backend: Invite By Link Controller

**File**: `backend/src/controllers/companyInviteController.ts` (create new)

```typescript
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { z } from "zod";

const log = createLogger("companyInvite");

const INVITE_TTL_HOURS = 48;

export async function generateInviteLink(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const bodySchema = z.object({ role: z.enum(["MEMBER", "MANAGER", "ADMIN"]).optional() });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ success: false, message: "Dados inválidos" });

  try {
    const member = await prisma.companyMember.findFirst({
      where: { userId, isActive: true, role: { in: ["ADMIN", "MANAGER"] } },
    });
    if (!member) return res.status(403).json({ success: false, message: "Apenas admin/manager pode gerar convites" });

    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    const token = randomUUID();

    const invite = await prisma.companyInviteToken.create({
      data: {
        companyId: member.companyId,
        token,
        role: (body.data.role as any) ?? "MEMBER",
        createdById: userId,
        expiresAt,
      },
    });

    const link = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/invite/${invite.token}`;
    return res.status(201).json({ success: true, message: "Link gerado", data: { token: invite.token, link, expiresAt } });
  } catch (err) {
    log.error({ err }, "generateInviteLink error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function validateInviteToken(req: Request, res: Response) {
  const { token } = req.params;
  try {
    const invite = await prisma.companyInviteToken.findUnique({
      where: { token },
      include: { company: { select: { id: true, slug: true, displayName: true, user: { select: { profileImageUrl: true } } } } },
    });

    if (!invite) return res.status(404).json({ success: false, message: "Convite não encontrado" });
    if (invite.usedAt) return res.status(410).json({ success: false, message: "Convite já utilizado" });
    if (invite.expiresAt < new Date()) return res.status(410).json({ success: false, message: "Convite expirado" });

    return res.json({
      success: true,
      message: "Convite válido",
      data: { company: invite.company, role: invite.role, expiresAt: invite.expiresAt },
    });
  } catch (err) {
    log.error({ err }, "validateInviteToken error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

export async function acceptInvite(req: Request, res: Response) {
  const userId = (req as any).user.id;
  const { token } = req.params;

  try {
    const invite = await prisma.companyInviteToken.findUnique({ where: { token } });

    if (!invite) return res.status(404).json({ success: false, message: "Convite não encontrado" });
    if (invite.usedAt) return res.status(410).json({ success: false, message: "Convite já utilizado" });
    if (invite.expiresAt < new Date()) return res.status(410).json({ success: false, message: "Convite expirado" });

    const existing = await prisma.companyMember.findFirst({
      where: { companyId: invite.companyId, userId },
    });
    if (existing) return res.status(409).json({ success: false, message: "Você já é membro desta empresa" });

    await prisma.$transaction([
      prisma.companyMember.create({
        data: { companyId: invite.companyId, userId, role: invite.role as any, isActive: true },
      }),
      prisma.companyInviteToken.update({
        where: { token },
        data: { usedById: userId, usedAt: new Date() },
      }),
    ]);

    log.info({ companyId: invite.companyId, userId }, "User joined company via invite link");
    return res.json({ success: true, message: "Você entrou na empresa!", data: { companyId: invite.companyId } });
  } catch (err) {
    log.error({ err }, "acceptInvite error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}
```

**File**: `backend/src/routes/companyInviteRoutes.ts` (create new)

```typescript
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { generateInviteLink, validateInviteToken, acceptInvite } from "../controllers/companyInviteController";

const router = Router();

router.post("/generate", verifyToken, generateInviteLink);
router.get("/:token", validateInviteToken);              // public — validate before login
router.post("/:token/accept", verifyToken, acceptInvite);

export default router;
```

**File**: `backend/src/index.ts` — add mount:

```typescript
import companyInviteRoutes from "./routes/companyInviteRoutes";
// ...
app.use("/api/company/invite", companyInviteRoutes);
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "companyInvite"
```
Expected: no output.

**Commit**:
```bash
git add backend/src/controllers/companyInviteController.ts backend/src/routes/companyInviteRoutes.ts backend/src/index.ts
git commit -m "feat: invite-by-link controller and routes"
```

---

## Task 6 — Backend: Salary Cron Job

**File**: `backend/src/services/companyCronService.ts` (create new)

```typescript
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("companyCron");

async function processDailySalaries(): Promise<void> {
  log.info("companyCron: starting daily salary processing");
  const today = new Date();
  const dayOfMonth = today.getDate();

  // Find all active salary rules where payDay matches today
  const rules = await prisma.companySalaryRule.findMany({
    where: { payDay: dayOfMonth },
    include: {
      company: { select: { id: true, displayName: true } },
    },
  });

  log.info({ count: rules.length }, "companyCron: found salary rules to process");

  for (const rule of rules) {
    try {
      // Check if already processed today to avoid double-pay
      const alreadyProcessed = await prisma.transaction.findFirst({
        where: {
          userId: rule.memberId,
          type: "SALARY_PAYMENT",
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
          metadata: { path: ["companyId"], equals: rule.companyId },
        },
      });

      if (alreadyProcessed) {
        log.warn({ ruleId: rule.id }, "companyCron: salary already processed today, skipping");
        continue;
      }

      await prisma.transaction.create({
        data: {
          userId: rule.memberId,
          type: "SALARY_PAYMENT",
          amount: rule.amount,
          status: "COMPLETED",
          description: `Salário — ${rule.company.displayName}`,
          metadata: { companyId: rule.companyId, ruleId: rule.id },
        },
      });

      log.info({ ruleId: rule.id, memberId: rule.memberId, amount: rule.amount }, "companyCron: salary processed");
    } catch (err) {
      log.error({ err, ruleId: rule.id }, "companyCron: failed to process salary rule");
    }
  }

  log.info("companyCron: daily salary processing complete");
}

function scheduleDailySalaries(): void {
  const now = new Date();
  // Target: 08:00 BRT = 11:00 UTC
  const target = new Date(now);
  target.setUTCHours(11, 0, 0, 0);
  if (target <= now) {
    // Already past today's run — schedule for tomorrow
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const msUntilFirst = target.getTime() - now.getTime();
  log.info({ msUntilFirst }, "companyCron: salary cron scheduled");

  setTimeout(() => {
    processDailySalaries().catch((err) => log.error({ err }, "companyCron: unhandled error in salary cron"));
    // Then repeat every 24h
    setInterval(() => {
      processDailySalaries().catch((err) => log.error({ err }, "companyCron: unhandled error in salary cron interval"));
    }, 24 * 60 * 60 * 1000);
  }, msUntilFirst);
}

export { scheduleDailySalaries };
```

**File**: `backend/src/index.ts` — add startup call:

```typescript
import { scheduleDailySalaries } from "./services/companyCronService";
// ... (at the bottom, after app.listen):
scheduleDailySalaries();
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep companyCron
```
Expected: no output.

**Commit**:
```bash
git add backend/src/services/companyCronService.ts backend/src/index.ts
git commit -m "feat: daily salary cron service (08:00 BRT)"
```

---

## Task 7 — Backend: New Analytics KPIs

**File**: `backend/src/controllers/companyAnalyticsController.ts`

Add three new exported functions at the end of the file:

```typescript
// ──────────────────────────────────────────────
// NEW KPI 1: Conversion funnel
// ──────────────────────────────────────────────
export async function getConversionFunnel(req: Request, res: Response) {
  const userId = (req as any).user.id;
  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const memberIds = await prisma.companyMember.findMany({
      where: { companyId: member.companyId, isActive: true },
      select: { userId: true },
    });
    const userIds = memberIds.map((m) => m.userId);

    const [views, orders, paid, completed] = await Promise.all([
      // Views = StorefrontSection.items count (proxy for profile views via listing impressions)
      prisma.companyStorefrontItem.count({ where: { section: { companyId: member.companyId } } }),
      prisma.serviceOrder.count({ where: { professionalId: { in: userIds } } }),
      prisma.serviceOrder.count({ where: { professionalId: { in: userIds }, status: { in: ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"] } } }),
      prisma.serviceOrder.count({ where: { professionalId: { in: userIds }, status: "COMPLETED" } }),
    ]);

    return res.json({
      success: true,
      message: "Funil de conversão",
      data: { views, orders, paid, completed },
    });
  } catch (err) {
    log.error({ err }, "getConversionFunnel error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// NEW KPI 2: Team occupancy (orders in progress per member)
// ──────────────────────────────────────────────
export async function getTeamOccupancy(req: Request, res: Response) {
  const userId = (req as any).user.id;
  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const members = await prisma.companyMember.findMany({
      where: { companyId: member.companyId, isActive: true },
      include: { user: { select: { id: true, name: true, profileImageUrl: true } } },
    });

    const occupancy = await Promise.all(
      members.map(async (m) => {
        const activeOrders = await prisma.serviceOrder.count({
          where: { professionalId: m.userId, status: "IN_PROGRESS" },
        });
        return { userId: m.userId, name: m.user.name, profileImageUrl: m.user.profileImageUrl, activeOrders };
      })
    );

    return res.json({ success: true, message: "Ocupação da equipe", data: occupancy });
  } catch (err) {
    log.error({ err }, "getTeamOccupancy error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}

// ──────────────────────────────────────────────
// NEW KPI 3: NPS (Net Promoter Score from reviews)
// ──────────────────────────────────────────────
export async function getNPS(req: Request, res: Response) {
  const userId = (req as any).user.id;
  try {
    const member = await prisma.companyMember.findFirst({ where: { userId, isActive: true } });
    if (!member) return res.status(403).json({ success: false, message: "Sem permissão" });

    const memberIds = await prisma.companyMember.findMany({
      where: { companyId: member.companyId, isActive: true },
      select: { userId: true },
    });
    const userIds = memberIds.map((m) => m.userId);

    const reviews = await prisma.review.findMany({
      where: { reviewedId: { in: userIds } },
      select: { rating: true },
    });

    const total = reviews.length;
    if (total === 0) return res.json({ success: true, message: "NPS", data: { nps: null, total: 0 } });

    const promoters = reviews.filter((r) => r.rating === 5).length;
    const detractors = reviews.filter((r) => r.rating <= 3).length;
    const nps = Math.round(((promoters - detractors) / total) * 100);

    return res.json({
      success: true,
      message: "NPS calculado",
      data: { nps, promoters, detractors, passives: total - promoters - detractors, total },
    });
  } catch (err) {
    log.error({ err }, "getNPS error");
    return res.status(500).json({ success: false, message: "Erro interno" });
  }
}
```

**File**: `backend/src/routes/companyRoutes.ts`

Add the three new routes (inside the existing router, before `export default`):

```typescript
import { getConversionFunnel, getTeamOccupancy, getNPS } from "../controllers/companyAnalyticsController";

// New analytics routes
router.get("/analytics/conversion-funnel", verifyToken, getConversionFunnel);
router.get("/analytics/team-occupancy", verifyToken, getTeamOccupancy);
router.get("/analytics/nps", verifyToken, getNPS);
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "companyAnalytics|companyRoutes"
```
Expected: no output.

**Commit**:
```bash
git add backend/src/controllers/companyAnalyticsController.ts backend/src/routes/companyRoutes.ts
git commit -m "feat: add conversion funnel, team occupancy, NPS analytics endpoints"
```

---

## Task 8 — Backend: Tier Auto-Progression on Order Completion

**File**: `backend/src/controllers/service/orderController.ts`

Find the section where order status is updated to `COMPLETED`. After the order update, inject this tier check:

```typescript
// After saving order as COMPLETED, check if professional's company should tier up
if (newStatus === "COMPLETED") {
  try {
    const professionalMember = await prisma.companyMember.findFirst({
      where: { userId: order.professionalId, isActive: true },
      include: { company: true },
    });

    if (professionalMember) {
      const company = professionalMember.company;
      const completedCount = await prisma.serviceOrder.count({
        where: {
          professional: { companyMemberships: { some: { companyId: company.id } } },
          status: "COMPLETED",
        },
      });

      let newTier: "EMPRESA" | "PARCEIRO" | "ELITE" | null = null;

      if (company.tier === "EMPRESA" && completedCount >= 50) {
        newTier = "PARCEIRO";
      } else if (company.tier === "PARCEIRO" && completedCount >= 200) {
        // Also check average rating >= 4.5
        const memberIds = await prisma.companyMember.findMany({
          where: { companyId: company.id, isActive: true },
          select: { userId: true },
        });
        const uids = memberIds.map((m) => m.userId);
        const agg = await prisma.review.aggregate({
          where: { reviewedId: { in: uids } },
          _avg: { rating: true },
        });
        if ((agg._avg.rating ?? 0) >= 4.5) {
          newTier = "ELITE";
        }
      }

      if (newTier) {
        await prisma.companyProfile.update({
          where: { id: company.id },
          data: { tier: newTier },
        });
        log.info({ companyId: company.id, newTier }, "Company tier upgraded");
      }
    }
  } catch (tierErr) {
    // Non-fatal — log and continue
    log.error({ tierErr }, "Tier progression check failed (non-fatal)");
  }
}
```

**Verification**:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep orderController
```
Expected: no output.

**Commit**:
```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "feat: auto-promote company tier on order completion (EMPRESA→PARCEIRO→ELITE)"
```

---

## Task 9 — Backend: Tests for Storefront and Invite

**File**: `backend/tests/companyStorefront.test.ts` (create new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app"; // adjust if your app export is different
import prisma from "../src/lib/prisma";

// Use the seeded test company/user credentials
const PROFESSIONAL_EMAIL = "profissional@teste.com";
const PROFESSIONAL_PASS = "Teste@123";

let token: string;
let companySlug: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: PROFESSIONAL_EMAIL, password: PROFESSIONAL_PASS });
  token = loginRes.body.data?.token ?? loginRes.body.token;

  const company = await prisma.companyProfile.findFirst({
    where: { members: { some: { user: { email: PROFESSIONAL_EMAIL } } } },
  });
  companySlug = company?.slug ?? "test-company";
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Storefront — public route", () => {
  it("returns 404 for unknown slug", async () => {
    const res = await request(app).get("/api/storefront/slug-inexistente-xyz");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("Storefront — editor (authenticated)", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/company/storefront/editor");
    expect(res.status).toBe(401);
  });

  it("returns editor data with valid token", async () => {
    const res = await request(app)
      .get("/api/company/storefront/editor")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Storefront — sections CRUD", () => {
  let sectionId: number;

  it("creates a section", async () => {
    const res = await request(app)
      .post("/api/company/storefront/sections")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test Section", order: 0, isActive: true });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Test Section");
    sectionId = res.body.data.id;
  });

  it("updates the section", async () => {
    const res = await request(app)
      .patch(`/api/company/storefront/sections/${sectionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Section" });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated Section");
  });

  it("deletes the section", async () => {
    const res = await request(app)
      .delete(`/api/company/storefront/sections/${sectionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Storefront — blocks upsert", () => {
  it("creates HERO block", async () => {
    const res = await request(app)
      .put("/api/company/storefront/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "HERO", order: 0, isActive: true, content: { headline: "Test headline" } });
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe("HERO");
  });

  it("upserts HERO block (second call updates)", async () => {
    const res = await request(app)
      .put("/api/company/storefront/blocks")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "HERO", order: 0, isActive: true, content: { headline: "Updated headline" } });
    expect(res.status).toBe(200);
    expect(res.body.data.content).toMatchObject({ headline: "Updated headline" });
  });
});
```

**File**: `backend/tests/companyInvite.test.ts` (create new)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";

const MANAGER_EMAIL = "profissional@teste.com";
const MANAGER_PASS = "Teste@123";
const CLIENT_EMAIL = "cliente@teste.com";
const CLIENT_PASS = "Teste@123";

let managerToken: string;
let clientToken: string;
let inviteToken: string;

beforeAll(async () => {
  const [managerRes, clientRes] = await Promise.all([
    request(app).post("/api/auth/login").send({ email: MANAGER_EMAIL, password: MANAGER_PASS }),
    request(app).post("/api/auth/login").send({ email: CLIENT_EMAIL, password: CLIENT_PASS }),
  ]);
  managerToken = managerRes.body.data?.token ?? managerRes.body.token;
  clientToken = clientRes.body.data?.token ?? clientRes.body.token;
});

afterAll(async () => {
  // Clean up invite tokens created during tests
  await prisma.companyInviteToken.deleteMany({ where: { token: inviteToken } });
  await prisma.$disconnect();
});

describe("Invite — generate link", () => {
  it("returns 403 if caller is not admin/manager", async () => {
    // Use clientToken (no company membership with ADMIN/MANAGER role)
    const res = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(403);
  });

  it("generates invite link for manager", async () => {
    const res = await request(app)
      .post("/api/company/invite/generate")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.link).toContain("/invite/");
    inviteToken = res.body.data.token;
  });
});

describe("Invite — validate token", () => {
  it("validates a fresh token", async () => {
    const res = await request(app).get(`/api/company/invite/${inviteToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("MEMBER");
  });

  it("returns 404 for unknown token", async () => {
    const res = await request(app).get("/api/company/invite/token-inexistente");
    expect(res.status).toBe(404);
  });
});
```

**Run tests**:
```bash
cd backend && npm test -- --reporter=verbose tests/companyStorefront.test.ts tests/companyInvite.test.ts
```
Expected: all tests pass (green).

**Commit**:
```bash
git add backend/tests/companyStorefront.test.ts backend/tests/companyInvite.test.ts
git commit -m "test: storefront and invite-by-link integration tests"
```

---

## Task 10 — Frontend: Types Update

**File**: `frontend/src/types/company.ts`

Add the following types (append at the end of the file, before any closing export):

```typescript
// ── Storefront ────────────────────────────────
export type StorefrontBlockType = "HERO" | "ABOUT" | "TESTIMONIALS";

export interface CompanyStorefrontBlock {
  id: number;
  companyId: number;
  type: StorefrontBlockType;
  order: number;
  isActive: boolean;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyStorefrontItem {
  id: number;
  sectionId: number;
  listingId: number;
  listing: {
    id: number;
    title: string;
    description: string;
    price: number;
    coverImageUrl: string | null;
    category: { name: string };
  };
  order: number;
  isFeatured: boolean;
  createdAt: string;
}

export interface CompanyStorefrontSection {
  id: number;
  companyId: number;
  title: string;
  description: string | null;
  order: number;
  isActive: boolean;
  items: CompanyStorefrontItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPinnedTestimonial {
  id: number;
  companyId: number;
  reviewId: number;
  review: {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: { name: string; profileImageUrl: string | null };
  };
  order: number;
  createdAt: string;
}

export interface PublicStorefront {
  company: {
    id: number;
    slug: string;
    displayName: string;
    description: string | null;
    coverImageUrl: string | null;
    tier: CompanyTier;
    storefrontSections: CompanyStorefrontSection[];
    storefrontBlocks: CompanyStorefrontBlock[];
    pinnedTestimonials: CompanyPinnedTestimonial[];
    user: { name: string; profileImageUrl: string | null };
    members: { id: number; role: string; user: { name: string; profileImageUrl: string | null } }[];
  };
  ordersCount: number;
}

// ── Tier ─────────────────────────────────────
export type CompanyTier = "EMPRESA" | "PARCEIRO" | "ELITE";

// ── Invite ────────────────────────────────────
export interface CompanyInviteToken {
  token: string;
  link: string;
  expiresAt: string;
}

export interface InviteValidation {
  company: { id: number; slug: string; displayName: string; user: { profileImageUrl: string | null } };
  role: string;
  expiresAt: string;
}

// ── Analytics ─────────────────────────────────
export interface ConversionFunnel {
  views: number;
  orders: number;
  paid: number;
  completed: number;
}

export interface TeamOccupancyEntry {
  userId: number;
  name: string;
  profileImageUrl: string | null;
  activeOrders: number;
}

export interface NPSData {
  nps: number | null;
  promoters: number;
  detractors: number;
  passives: number;
  total: number;
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "company.ts"
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/types/company.ts
git commit -m "feat: add storefront, tier, invite and analytics types"
```

---

## Task 11 — Frontend: API Service for Storefront

**File**: `frontend/src/services/companyStorefrontService.ts` (create new)

```typescript
import api from "./api";
import type {
  PublicStorefront,
  CompanyStorefrontSection,
  CompanyStorefrontBlock,
  CompanyPinnedTestimonial,
  StorefrontBlockType,
  CompanyInviteToken,
  InviteValidation,
  ConversionFunnel,
  TeamOccupancyEntry,
  NPSData,
} from "../types";

// ── Public ─────────────────────────────────────
export async function getPublicStorefront(slug: string): Promise<PublicStorefront> {
  const { data } = await api.get(`/storefront/${slug}`);
  return data.data;
}

// ── Editor ─────────────────────────────────────
export async function getStorefrontEditor() {
  const { data } = await api.get("/company/storefront/editor");
  return data.data;
}

// ── Sections ───────────────────────────────────
export async function createSection(payload: { title: string; description?: string; order: number; isActive?: boolean }): Promise<CompanyStorefrontSection> {
  const { data } = await api.post("/company/storefront/sections", payload);
  return data.data;
}

export async function updateSection(sectionId: number, payload: Partial<CompanyStorefrontSection>): Promise<CompanyStorefrontSection> {
  const { data } = await api.patch(`/company/storefront/sections/${sectionId}`, payload);
  return data.data;
}

export async function deleteSection(sectionId: number): Promise<void> {
  await api.delete(`/company/storefront/sections/${sectionId}`);
}

export async function addItemToSection(sectionId: number, payload: { listingId: number; order: number; isFeatured?: boolean }) {
  const { data } = await api.post(`/company/storefront/sections/${sectionId}/items`, payload);
  return data.data;
}

export async function removeItemFromSection(sectionId: number, itemId: number): Promise<void> {
  await api.delete(`/company/storefront/sections/${sectionId}/items/${itemId}`);
}

// ── Blocks ─────────────────────────────────────
export async function upsertBlock(payload: {
  type: StorefrontBlockType;
  order: number;
  isActive?: boolean;
  content: Record<string, unknown>;
}): Promise<CompanyStorefrontBlock> {
  const { data } = await api.put("/company/storefront/blocks", payload);
  return data.data;
}

// ── Testimonials ───────────────────────────────
export async function pinTestimonial(reviewId: number, order: number): Promise<CompanyPinnedTestimonial> {
  const { data } = await api.post("/company/storefront/testimonials/pin", { reviewId, order });
  return data.data;
}

export async function unpinTestimonial(pinnedId: number): Promise<void> {
  await api.delete(`/company/storefront/testimonials/${pinnedId}`);
}

// ── Invite ─────────────────────────────────────
export async function generateInviteLink(role?: string): Promise<CompanyInviteToken> {
  const { data } = await api.post("/company/invite/generate", { role });
  return data.data;
}

export async function validateInviteToken(token: string): Promise<InviteValidation> {
  const { data } = await api.get(`/company/invite/${token}`);
  return data.data;
}

export async function acceptInvite(token: string): Promise<{ companyId: number }> {
  const { data } = await api.post(`/company/invite/${token}/accept`);
  return data.data;
}

// ── Analytics ──────────────────────────────────
export async function getConversionFunnel(): Promise<ConversionFunnel> {
  const { data } = await api.get("/company/analytics/conversion-funnel");
  return data.data;
}

export async function getTeamOccupancy(): Promise<TeamOccupancyEntry[]> {
  const { data } = await api.get("/company/analytics/team-occupancy");
  return data.data;
}

export async function getNPS(): Promise<NPSData> {
  const { data } = await api.get("/company/analytics/nps");
  return data.data;
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep companyStorefrontService
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/services/companyStorefrontService.ts
git commit -m "feat: companyStorefrontService API layer"
```

---

## Task 12 — Frontend: TierBadge Component

**File**: `frontend/src/components/company/TierBadge.tsx` (create new)

```tsx
import React from "react";
import { Award, Star, Zap } from "lucide-react";
import type { CompanyTier } from "../../types";

interface TierBadgeProps {
  tier: CompanyTier;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG: Record<CompanyTier, { label: string; icon: React.ReactNode; className: string }> = {
  EMPRESA: {
    label: "Empresa",
    icon: <Zap className="w-3 h-3" />,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  },
  PARCEIRO: {
    label: "Parceiro",
    icon: <Star className="w-3 h-3 fill-current" />,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  ELITE: {
    label: "Elite",
    icon: <Award className="w-3 h-3" />,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
};

const SIZE_CLASS = {
  sm: "text-xs px-1.5 py-0.5 gap-1",
  md: "text-sm px-2 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

export default function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${SIZE_CLASS[size]} ${config.className}`}
      title={`Nível ${config.label}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep TierBadge
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/components/company/TierBadge.tsx
git commit -m "feat: TierBadge component (EMPRESA/PARCEIRO/ELITE)"
```

---

## Task 13 — Frontend: OnboardingWizard Component

**File**: `frontend/src/components/company/OnboardingWizard.tsx` (create new)

```tsx
import React, { useState } from "react";
import { CheckCircle, Circle, ChevronRight, ChevronDown } from "lucide-react";
import { upsertBlock, createSection } from "../../services/companyStorefrontService";
import { useToast } from "../../context/ToastContext";

const STEPS = [
  { id: 0, label: "Complete o perfil da empresa", description: "Adicione descrição, foto de capa e localização." },
  { id: 1, label: "Adicione pelo menos um serviço", description: "Crie um listing para aparecer na sua vitrine." },
  { id: 2, label: "Configure o bloco HERO", description: "Personalize o banner principal da sua vitrine." },
  { id: 3, label: "Crie sua primeira seção de serviços", description: "Organize seus serviços em categorias visuais." },
  { id: 4, label: "Convide um membro da equipe", description: "Adicione colaboradores via link de convite." },
];

interface OnboardingWizardProps {
  currentStep: number;
  onStepComplete: (step: number) => void;
  onDismiss: () => void;
}

export default function OnboardingWizard({ currentStep, onStepComplete, onDismiss }: OnboardingWizardProps) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  const progress = Math.round((currentStep / STEPS.length) * 100);

  async function handleQuickAction(stepId: number) {
    setLoading(true);
    try {
      if (stepId === 2) {
        await upsertBlock({ type: "HERO", order: 0, isActive: true, content: { headline: "Bem-vindo à nossa empresa!" } });
        showToast("Bloco HERO criado! Edite na vitrine.", "success");
        onStepComplete(stepId);
      } else if (stepId === 3) {
        await createSection({ title: "Nossos Serviços", order: 0, isActive: true });
        showToast("Seção criada! Adicione serviços a ela.", "success");
        onStepComplete(stepId);
      } else {
        showToast("Complete este passo nas configurações.", "info");
      }
    } catch {
      showToast("Erro ao executar ação. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (currentStep >= STEPS.length) return null;

  return (
    <div className="card border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 mb-6">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            {currentStep}/{STEPS.length}
          </div>
          <div>
            <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Configure sua vitrine</p>
            <div className="w-48 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full mt-1">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Dispensar
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-blue-600" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2">
          {STEPS.map((step) => {
            const done = step.id < currentStep;
            const active = step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${active ? "bg-white dark:bg-slate-800 shadow-sm" : "opacity-60"}`}
              >
                {done ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className={`w-5 h-5 mt-0.5 shrink-0 ${active ? "text-blue-600" : "text-slate-400"}`} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200"}`}>
                    {step.label}
                  </p>
                  {active && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>}
                </div>
                {active && (
                  <button
                    onClick={() => handleQuickAction(step.id)}
                    disabled={loading}
                    className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                  >
                    {loading ? "..." : "Fazer agora"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep OnboardingWizard
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/components/company/OnboardingWizard.tsx
git commit -m "feat: OnboardingWizard component with quick-action buttons"
```

---

## Task 14 — Frontend: Company Dashboard Integration

**File**: `frontend/src/pages/company/Dashboard.tsx`

At the top of the file, add the imports:

```tsx
import TierBadge from "../../components/company/TierBadge";
import OnboardingWizard from "../../components/company/OnboardingWizard";
import type { CompanyTier } from "../../types";
```

In the component state, add:

```tsx
const [onboardingStep, setOnboardingStep] = useState<number>(0);
const [onboardingDone, setOnboardingDone] = useState<boolean>(false);
const [tier, setTier] = useState<CompanyTier>("EMPRESA");
```

When loading company data (in the existing `useEffect` or fetch call), extract and set these fields:

```tsx
setTier(company.tier ?? "EMPRESA");
setOnboardingStep(company.onboardingStep ?? 0);
setOnboardingDone(company.onboardingDone ?? false);
```

In the JSX, add `TierBadge` next to the company name and `OnboardingWizard` above the stats grid:

```tsx
{/* Next to company name */}
<TierBadge tier={tier} size="md" />

{/* Above stats grid */}
{!onboardingDone && (
  <OnboardingWizard
    currentStep={onboardingStep}
    onStepComplete={(step) => setOnboardingStep(step + 1)}
    onDismiss={() => setOnboardingDone(true)}
  />
)}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "company/Dashboard"
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/pages/company/Dashboard.tsx
git commit -m "feat: integrate TierBadge and OnboardingWizard into company Dashboard"
```

---

## Task 15 — Frontend: Members Page (Invite by Link)

**File**: `frontend/src/pages/company/Members.tsx`

Find the "Convidar membro" button or section. Replace or augment it with the following invite-by-link block. Add the import at the top:

```tsx
import { generateInviteLink } from "../../services/companyStorefrontService";
import type { CompanyInviteToken } from "../../types";
import { Copy, Link as LinkIcon, RefreshCw } from "lucide-react";
```

Add state:

```tsx
const [inviteData, setInviteData] = useState<CompanyInviteToken | null>(null);
const [inviteLoading, setInviteLoading] = useState(false);
const [copied, setCopied] = useState(false);
```

Add the handler:

```tsx
async function handleGenerateInvite() {
  setInviteLoading(true);
  try {
    const data = await generateInviteLink("MEMBER");
    setInviteData(data);
  } catch {
    showToast("Erro ao gerar link de convite.", "error");
  } finally {
    setInviteLoading(false);
  }
}

async function handleCopyLink() {
  if (!inviteData) return;
  await navigator.clipboard.writeText(inviteData.link);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

Add the UI block (inside the JSX, above the members list):

```tsx
<div className="card mb-6">
  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
    <LinkIcon className="w-4 h-4 text-blue-600" />
    Convidar via Link
  </h3>
  {inviteData ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <code className="text-xs flex-1 truncate text-slate-700 dark:text-slate-300">{inviteData.link}</code>
        <button onClick={handleCopyLink} className="btn btn-sm" title="Copiar link">
          <Copy className="w-4 h-4" />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Expira em: {new Date(inviteData.expiresAt).toLocaleString("pt-BR")}
      </p>
      <button onClick={handleGenerateInvite} disabled={inviteLoading} className="btn btn-sm text-slate-600">
        <RefreshCw className="w-3 h-3" /> Gerar novo link
      </button>
    </div>
  ) : (
    <button onClick={handleGenerateInvite} disabled={inviteLoading} className="btn bg-blue-600 text-white hover:bg-blue-700">
      {inviteLoading ? "Gerando..." : "Gerar Link de Convite"}
    </button>
  )}
</div>
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "company/Members"
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/pages/company/Members.tsx
git commit -m "feat: invite-by-link UI in Members page"
```

---

## Task 16 — Frontend: Analytics Page (New KPIs)

**File**: `frontend/src/pages/company/Analytics.tsx`

Add imports:

```tsx
import { getConversionFunnel, getTeamOccupancy, getNPS } from "../../services/companyStorefrontService";
import type { ConversionFunnel, TeamOccupancyEntry, NPSData } from "../../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Users, Star } from "lucide-react";
```

Add state:

```tsx
const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
const [occupancy, setOccupancy] = useState<TeamOccupancyEntry[]>([]);
const [nps, setNps] = useState<NPSData | null>(null);
```

In `useEffect`, fetch the new data:

```tsx
const [funnelRes, occupancyRes, npsRes] = await Promise.all([
  getConversionFunnel(),
  getTeamOccupancy(),
  getNPS(),
]);
setFunnel(funnelRes);
setOccupancy(occupancyRes);
setNps(npsRes);
```

Add the three KPI sections in the JSX (at the bottom, before closing `</div>`):

```tsx
{/* Conversion Funnel */}
{funnel && (
  <div className="card">
    <h3 className="font-semibold flex items-center gap-2 mb-4">
      <TrendingUp className="w-4 h-4 text-blue-600" /> Funil de Conversão
    </h3>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={[
        { name: "Na vitrine", value: funnel.views },
        { name: "Pedidos", value: funnel.orders },
        { name: "Em andamento", value: funnel.paid },
        { name: "Concluídos", value: funnel.completed },
      ]}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {["#3b82f6", "#6366f1", "#8b5cf6", "#10b981"].map((color, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
)}

{/* Team Occupancy */}
{occupancy.length > 0 && (
  <div className="card">
    <h3 className="font-semibold flex items-center gap-2 mb-4">
      <Users className="w-4 h-4 text-purple-600" /> Ocupação da Equipe
    </h3>
    <div className="space-y-3">
      {occupancy.map((m) => (
        <div key={m.userId} className="flex items-center gap-3">
          <img
            src={m.profileImageUrl ?? "/default-avatar.png"}
            alt={m.name}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.name}</p>
            <div className="flex items-center gap-1">
              <div
                className="h-1.5 bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(m.activeOrders * 20, 100)}%` }}
              />
              <span className="text-xs text-slate-500 ml-1">{m.activeOrders} ativo(s)</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{/* NPS */}
{nps && nps.nps !== null && (
  <div className="card">
    <h3 className="font-semibold flex items-center gap-2 mb-4">
      <Star className="w-4 h-4 text-amber-500" /> NPS — Satisfação dos Clientes
    </h3>
    <div className="text-center mb-4">
      <p className="text-5xl font-bold text-slate-800 dark:text-slate-100">{nps.nps}</p>
      <p className="text-sm text-slate-500 mt-1">Net Promoter Score (de -100 a 100)</p>
    </div>
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <p className="text-lg font-bold text-green-600">{nps.promoters}</p>
        <p className="text-xs text-green-700 dark:text-green-400">Promotores</p>
      </div>
      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{nps.passives}</p>
        <p className="text-xs text-slate-500">Neutros</p>
      </div>
      <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-lg font-bold text-red-600">{nps.detractors}</p>
        <p className="text-xs text-red-700 dark:text-red-400">Detratores</p>
      </div>
    </div>
  </div>
)}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "company/Analytics"
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/pages/company/Analytics.tsx
git commit -m "feat: add conversion funnel, team occupancy, NPS to Analytics page"
```

---

## Task 17 — Frontend: StorefrontEditor Page

**File**: `frontend/src/pages/company/StorefrontEditor.tsx` (create new)

```tsx
import React, { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Eye, Save } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  getStorefrontEditor,
  createSection,
  updateSection,
  deleteSection,
  upsertBlock,
} from "../../services/companyStorefrontService";
import type { CompanyStorefrontSection, CompanyStorefrontBlock, StorefrontBlockType } from "../../types";

type Tab = "sections" | "blocks";

export default function StorefrontEditor() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("sections");
  const [sections, setSections] = useState<CompanyStorefrontSection[]>([]);
  const [blocks, setBlocks] = useState<CompanyStorefrontBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [companySlug, setCompanySlug] = useState<string>("");

  useEffect(() => {
    loadEditor();
  }, []);

  async function loadEditor() {
    setLoading(true);
    try {
      const data = await getStorefrontEditor();
      setSections(data.storefrontSections ?? []);
      setBlocks(data.storefrontBlocks ?? []);
      setCompanySlug(data.slug ?? "");
    } catch {
      showToast("Erro ao carregar editor.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    setSaving(true);
    try {
      const section = await createSection({ title: newSectionTitle.trim(), order: sections.length });
      setSections((prev) => [...prev, section]);
      setNewSectionTitle("");
      showToast("Seção criada!", "success");
    } catch {
      showToast("Erro ao criar seção.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSection(id: number) {
    if (!confirm("Remover esta seção e todos os seus itens?")) return;
    try {
      await deleteSection(id);
      setSections((prev) => prev.filter((s) => s.id !== id));
      showToast("Seção removida.", "success");
    } catch {
      showToast("Erro ao remover seção.", "error");
    }
  }

  async function handleToggleSection(section: CompanyStorefrontSection) {
    try {
      const updated = await updateSection(section.id, { isActive: !section.isActive });
      setSections((prev) => prev.map((s) => (s.id === section.id ? updated : s)));
    } catch {
      showToast("Erro ao atualizar seção.", "error");
    }
  }

  async function handleSaveHero(headline: string, subtitle: string) {
    setSaving(true);
    try {
      const block = await upsertBlock({ type: "HERO", order: 0, isActive: true, content: { headline, subtitle } });
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.type === "HERO");
        if (idx >= 0) { const copy = [...prev]; copy[idx] = block; return copy; }
        return [...prev, block];
      });
      showToast("Bloco HERO salvo!", "success");
    } catch {
      showToast("Erro ao salvar bloco.", "error");
    } finally {
      setSaving(false);
    }
  }

  const heroBlock = blocks.find((b) => b.type === "HERO");
  const [heroHeadline, setHeroHeadline] = useState((heroBlock?.content as any)?.headline ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState((heroBlock?.content as any)?.subtitle ?? "");

  if (loading) return <div className="p-6 text-center text-slate-500">Carregando editor...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Editor de Vitrine</h1>
        {companySlug && (
          <a
            href={`/empresa/${companySlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm flex items-center gap-2 text-blue-600"
          >
            <Eye className="w-4 h-4" /> Ver vitrine
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        {(["sections", "blocks"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t === "sections" ? "Seções de Serviços" : "Blocos Especiais"}
          </button>
        ))}
      </div>

      {tab === "sections" && (
        <div className="space-y-4">
          {sections.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">Nenhuma seção criada. Adicione a primeira abaixo.</p>
          )}
          {sections.map((section) => (
            <div key={section.id} className="card flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{section.title}</p>
                <p className="text-xs text-slate-500">{section.items?.length ?? 0} itens</p>
              </div>
              <button
                onClick={() => handleToggleSection(section)}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  section.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                }`}
              >
                {section.isActive ? "Visível" : "Oculto"}
              </button>
              <button onClick={() => handleDeleteSection(section.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Nome da nova seção (ex: Limpeza Residencial)"
              className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
            />
            <button onClick={handleAddSection} disabled={saving || !newSectionTitle.trim()} className="btn bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      )}

      {tab === "blocks" && (
        <div className="space-y-6">
          {/* HERO Block */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">HERO</span>
              Banner Principal
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Título principal</label>
                <input
                  type="text"
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  placeholder="Ex: Limpeza profissional para sua casa"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  placeholder="Ex: Qualidade garantida desde 2020"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                />
              </div>
              <button onClick={() => handleSaveHero(heroHeadline, heroSubtitle)} disabled={saving} className="btn bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Salvar HERO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep StorefrontEditor
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/pages/company/StorefrontEditor.tsx
git commit -m "feat: StorefrontEditor page (sections + blocks tabs)"
```

---

## Task 18 — Frontend: Public Storefront Page (Full Rebuild)

**File**: `frontend/src/pages/CompanyStorefront.tsx` (overwrite existing)

```tsx
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Star, CheckCircle, Users, Award, MapPin, ExternalLink } from "lucide-react";
import { getPublicStorefront } from "../services/companyStorefrontService";
import TierBadge from "../components/company/TierBadge";
import type { PublicStorefront, CompanyStorefrontBlock } from "../types";

function HeroBlock({ block }: { block: CompanyStorefrontBlock }) {
  const content = block.content as { headline?: string; subtitle?: string; coverImageUrl?: string };
  return (
    <div className="relative w-full min-h-[280px] flex items-end bg-gradient-to-br from-slate-800 to-slate-600 rounded-2xl overflow-hidden mb-8">
      {content.coverImageUrl && (
        <img src={content.coverImageUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover opacity-40" />
      )}
      <div className="relative z-10 p-8 text-white">
        {content.headline && <h1 className="text-3xl font-bold mb-2">{content.headline}</h1>}
        {content.subtitle && <p className="text-lg text-white/80">{content.subtitle}</p>}
      </div>
    </div>
  );
}

function AboutBlock({ block }: { block: CompanyStorefrontBlock }) {
  const content = block.content as { text?: string; highlights?: string[] };
  return (
    <div className="card mb-6">
      <h2 className="text-xl font-bold mb-3">Sobre nós</h2>
      {content.text && <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{content.text}</p>}
      {content.highlights && content.highlights.length > 0 && (
        <ul className="mt-3 space-y-1">
          {content.highlights.map((h, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CompanyStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getPublicStorefront(slug)
      .then(setData)
      .catch(() => setError("Empresa não encontrada."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full w-10 h-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600 dark:text-slate-400 text-lg">{error ?? "Empresa não encontrada."}</p>
        <Link to="/" className="btn bg-blue-600 text-white hover:bg-blue-700">Voltar ao início</Link>
      </div>
    );
  }

  const { company, ordersCount } = data;
  const heroBlock = company.storefrontBlocks.find((b) => b.type === "HERO");
  const aboutBlock = company.storefrontBlocks.find((b) => b.type === "ABOUT");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        {heroBlock ? (
          <HeroBlock block={heroBlock} />
        ) : (
          <div className="flex items-center gap-4 mb-8 p-6 card">
            {company.user.profileImageUrl && (
              <img src={company.user.profileImageUrl} alt={company.displayName} className="w-16 h-16 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{company.displayName}</h1>
              <TierBadge tier={company.tier} size="sm" />
            </div>
          </div>
        )}

        {/* Company header (under hero) */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">{company.displayName}</h2>
              <TierBadge tier={company.tier} size="sm" />
            </div>
            {company.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-lg">{company.description}</p>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{ordersCount}</p>
            <p className="text-xs text-slate-500">Pedidos concluídos</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{company.members.length}</p>
            <p className="text-xs text-slate-500">Membros da equipe</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-amber-500">{company.tier}</p>
            <p className="text-xs text-slate-500">Nível</p>
          </div>
        </div>

        {/* About block */}
        {aboutBlock && <AboutBlock block={aboutBlock} />}

        {/* Service sections */}
        {company.storefrontSections.map((section) => (
          <div key={section.id} className="mb-8">
            <h3 className="text-lg font-bold mb-1">{section.title}</h3>
            {section.description && <p className="text-sm text-slate-500 mb-3">{section.description}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {section.items.map((item) => (
                <Link
                  key={item.id}
                  to={`/services/${item.listingId}`}
                  className="card hover:shadow-md transition-shadow group"
                >
                  {item.listing.coverImageUrl && (
                    <img
                      src={item.listing.coverImageUrl}
                      alt={item.listing.title}
                      className="w-full h-36 object-cover rounded-lg mb-3"
                    />
                  )}
                  {item.isFeatured && (
                    <span className="badge bg-amber-100 text-amber-700 text-xs mb-2">Destaque</span>
                  )}
                  <h4 className="font-semibold text-sm group-hover:text-blue-600 transition-colors">{item.listing.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.listing.description}</p>
                  <p className="text-sm font-bold text-blue-600 mt-2">
                    R$ {item.listing.price.toFixed(2).replace(".", ",")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Pinned testimonials */}
        {company.pinnedTestimonials.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-current" /> O que dizem sobre nós
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.pinnedTestimonials.map((pt) => (
                <div key={pt.id} className="card">
                  <div className="flex items-center gap-2 mb-2">
                    {pt.review.reviewer.profileImageUrl && (
                      <img
                        src={pt.review.reviewer.profileImageUrl}
                        alt={pt.review.reviewer.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{pt.review.reviewer.name}</p>
                      <div className="flex">
                        {Array.from({ length: pt.review.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-amber-500 fill-current" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{pt.review.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team members */}
        {company.members.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Nossa Equipe
            </h3>
            <div className="flex flex-wrap gap-3">
              {company.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  {m.user.profileImageUrl ? (
                    <img src={m.user.profileImageUrl} alt={m.user.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                      {m.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-slate-700 dark:text-slate-300">{m.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Verification**:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep CompanyStorefront
```
Expected: no output.

**Commit**:
```bash
git add frontend/src/pages/CompanyStorefront.tsx
git commit -m "feat: rebuild public CompanyStorefront page with storefront sections, blocks, testimonials"
```

---

## Task 19 — Frontend: Register Storefront Route in App.tsx

**File**: `frontend/src/App.tsx`

1. Add the import for the new page:

```tsx
import StorefrontEditor from "./pages/company/StorefrontEditor";
```

2. Add the two new routes (inside the authenticated routes section, alongside other company routes):

```tsx
<Route path="/company/storefront/editor" element={<StorefrontEditor />} />
<Route path="/empresa/:slug" element={<CompanyStorefront />} />
```

Note: `CompanyStorefront` is likely already imported. If not, add:
```tsx
import CompanyStorefront from "./pages/CompanyStorefront";
```

3. Add the "Vitrine" nav link to Layout.tsx for company users. In `frontend/src/components/Layout.tsx`, find the company navigation section and add:

```tsx
{ to: "/company/storefront/editor", label: "Vitrine", icon: <Store className="w-4 h-4" /> }
```

And import `Store` from lucide-react if not already imported.

**Verification**:
```bash
cd frontend && npx tsc --noEmit
```
Expected: exit 0, no errors.

**Commit**:
```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: register StorefrontEditor and public storefront routes; add Vitrine nav link"
```

---

## Task 20 — Final Integration Check

Run all backend tests to ensure nothing is broken:

```bash
cd backend && npm test
```
Expected: all test suites pass. Note any failures and fix them before proceeding.

Run type checks on both workspaces:

```bash
cd backend && npx tsc --noEmit && echo "Backend OK"
cd frontend && npx tsc --noEmit && echo "Frontend OK"
```
Expected: both print `OK`.

Run the full backend test suite with verbose output for the new tests:

```bash
cd backend && npm test -- --reporter=verbose tests/companyStorefront.test.ts tests/companyInvite.test.ts
```
Expected: all tests green.

Apply the final schema push if not done yet:

```bash
cd backend && npx prisma db push
```

Summary commit for the full feature:

```bash
git add -A
git commit -m "feat: empresa-vitrine-parceiro — storefront, tier system, invite link, salary cron, analytics KPIs (Phase 1 complete)"
```

---

## Checklist

- [ ] Task 1: Storefront models in schema
- [ ] Task 2: Tier + Onboarding + InviteToken in schema + db push
- [ ] Task 3: companyStorefrontController.ts
- [ ] Task 4: companyStorefrontRoutes.ts + index.ts mounts
- [ ] Task 5: companyInviteController.ts + companyInviteRoutes.ts
- [ ] Task 6: companyCronService.ts + scheduleDailySalaries() startup
- [ ] Task 7: getConversionFunnel + getTeamOccupancy + getNPS in analyticsController + routes
- [ ] Task 8: Tier auto-progression injected into orderController
- [ ] Task 9: Tests for storefront and invite (all green)
- [ ] Task 10: Types in frontend/src/types/company.ts
- [ ] Task 11: companyStorefrontService.ts
- [ ] Task 12: TierBadge.tsx component
- [ ] Task 13: OnboardingWizard.tsx component
- [ ] Task 14: Dashboard.tsx integration
- [ ] Task 15: Members.tsx invite-by-link UI
- [ ] Task 16: Analytics.tsx new KPI sections
- [ ] Task 17: StorefrontEditor.tsx page
- [ ] Task 18: CompanyStorefront.tsx full rebuild
- [ ] Task 19: App.tsx + Layout.tsx route and nav registration
- [ ] Task 20: Final integration check (all tests green, both tsc --noEmit OK)
