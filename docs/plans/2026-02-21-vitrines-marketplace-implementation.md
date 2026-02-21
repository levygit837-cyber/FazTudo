# Vitrines Marketplace — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor FazTudo from standalone service listings to a storefront/vitrine system (iFood-style) for professionals and companies.

**Architecture:** New Prisma models (Storefront, StorefrontCategory, StorefrontService, StorefrontServiceOption, ServiceOrderItem). New API routes under `/api/storefronts`. New frontend pages (Explore, StorefrontView) and components. Migration script for existing ServiceListings. Client-side cart with 1h inactivity reset.

**Tech Stack:** Express 5 + Prisma 7 + React 19 + TypeScript 5.9 + TailwindCSS v4 + Zod v4

---

## Task 1: Prisma Schema — New Storefront Models

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add Storefront model to schema**

Add after the existing `CompanyInviteToken` model at the end of schema.prisma:

```prisma
// ============================================
// VITRINE (STOREFRONT) MODELS — v2
// ============================================

model Storefront {
  id          Int      @id @default(autoincrement())
  userId      Int      @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  slug        String   @unique
  description String?
  logo        String?
  banner      String?

  isActive    Boolean  @default(true)
  isPublished Boolean  @default(false)

  mainCategoryId  Int?
  mainCategory    ServiceCategory? @relation("StorefrontMainCategory", fields: [mainCategoryId], references: [id])

  ratingAverage   Float   @default(0.0)
  totalReviews    Int     @default(0)
  totalServices   Int     @default(0)

  categories  StorefrontCategory[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([slug])
  @@index([isActive, isPublished])
  @@index([mainCategoryId])
}

model StorefrontCategory {
  id           Int        @id @default(autoincrement())
  storefrontId Int
  storefront   Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade)

  name         String
  order        Int
  isActive     Boolean    @default(true)

  services     StorefrontService[]

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([storefrontId, order])
}

model StorefrontService {
  id           Int                @id @default(autoincrement())
  categoryId   Int
  category     StorefrontCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  title        String
  description  String?
  price        Float
  images       Json?
  isAvailable  Boolean            @default(true)
  order        Int

  options      StorefrontServiceOption[]
  orderItems   ServiceOrderItem[]

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([categoryId, order])
  @@index([isAvailable])
}

model StorefrontServiceOption {
  id         Int               @id @default(autoincrement())
  serviceId  Int
  service    StorefrontService @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  name       String
  price      Float?
  isDefault  Boolean   @default(false)
  order      Int

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([serviceId, order])
}

model ServiceOrderItem {
  id              Int               @id @default(autoincrement())
  serviceOrderId  Int
  serviceOrder    ServiceOrder      @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  serviceId       Int
  service         StorefrontService @relation(fields: [serviceId], references: [id])

  quantity        Int     @default(1)
  unitPrice       Float
  totalPrice      Float
  optionsSnapshot Json?   // Snapshot of selected options at time of purchase

  createdAt       DateTime @default(now())

  @@index([serviceOrderId])
  @@index([serviceId])
}
```

**Step 2: Add relations to existing models**

In the `User` model, add:
```prisma
storefront         Storefront?
```

In the `ServiceOrder` model, add:
```prisma
items             ServiceOrderItem[]
```

In the `ServiceCategory` model, add:
```prisma
storefronts       Storefront[] @relation("StorefrontMainCategory")
```

**Step 3: Run db push**

Run: `cd backend && npx prisma db push`
Expected: Schema applied successfully

**Step 4: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Client generated

**Step 5: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (no errors)

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add storefront/vitrine Prisma models"
```

---

## Task 2: Backend — Zod Validation Schemas

**Files:**
- Create: `backend/src/middleware/storefrontValidation.ts`

**Step 1: Create validation schemas**

```typescript
import { z } from "zod";

// ── Storefront ─────────────────────────────────────────
export const createStorefrontSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Nome deve ter no minimo 2 caracteres").max(100),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens").optional(),
    description: z.string().max(500).optional(),
    mainCategoryId: z.number().int().positive().optional(),
  }),
});

export const updateStorefrontSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug invalido").optional(),
    description: z.string().max(500).optional(),
    logo: z.string().url().optional().nullable(),
    banner: z.string().url().optional().nullable(),
    mainCategoryId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const publishStorefrontSchema = z.object({
  body: z.object({
    isPublished: z.boolean(),
  }),
});

// ── StorefrontCategory ─────────────────────────────────
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Nome obrigatorio").max(100),
    order: z.number().int().min(0).optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const reorderCategoriesSchema = z.object({
  body: z.object({
    order: z.array(z.object({
      id: z.number().int().positive(),
      order: z.number().int().min(0),
    })),
  }),
});

// ── StorefrontService ──────────────────────────────────
export const createServiceSchema = z.object({
  body: z.object({
    categoryId: z.number().int().positive(),
    title: z.string().min(2, "Titulo deve ter no minimo 2 caracteres").max(200),
    description: z.string().max(2000).optional(),
    price: z.number().positive("Preco deve ser positivo"),
    images: z.array(z.string().url()).max(10).optional(),
    order: z.number().int().min(0).optional(),
  }),
});

export const updateServiceSchema = z.object({
  body: z.object({
    categoryId: z.number().int().positive().optional(),
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    price: z.number().positive().optional(),
    images: z.array(z.string().url()).max(10).optional(),
    isAvailable: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
});

// ── StorefrontServiceOption ────────────────────────────
export const createOptionSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Nome obrigatorio").max(200),
    price: z.number().min(0).optional().nullable(),
    isDefault: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
});

export const updateOptionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    price: z.number().min(0).optional().nullable(),
    isDefault: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
});

// ── Cart Checkout ──────────────────────────────────────
export const cartCheckoutSchema = z.object({
  body: z.object({
    storefrontId: z.number().int().positive(),
    items: z.array(z.object({
      serviceId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(99).default(1),
      selectedOptionIds: z.array(z.number().int().positive()).optional(),
    })).min(1, "Carrinho deve ter pelo menos 1 item"),
  }),
});
```

**Step 2: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/src/middleware/storefrontValidation.ts
git commit -m "feat: add Zod validation schemas for storefront"
```

---

## Task 3: Backend — Storefront Public Controller

**Files:**
- Create: `backend/src/controllers/storefrontController.ts`

**Step 1: Write the public controller**

```typescript
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("storefrontController");

// GET /api/storefronts — List published storefronts (public)
export async function listStorefronts(req: Request, res: Response) {
  try {
    const {
      page = "1",
      limit = "20",
      search,
      categoryId,
      sortBy = "relevance",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      isActive: true,
      isPublished: true,
    };

    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        {
          categories: {
            some: {
              services: {
                some: { title: { contains: search } },
              },
            },
          },
        },
      ];
    }

    if (categoryId) {
      where.mainCategoryId = parseInt(categoryId as string, 10);
    }

    let orderBy: any = {};
    switch (sortBy) {
      case "rating":
        orderBy = { ratingAverage: "desc" };
        break;
      case "recent":
        orderBy = { createdAt: "desc" };
        break;
      case "services":
        orderBy = { totalServices: "desc" };
        break;
      default: // relevance
        orderBy = [{ ratingAverage: "desc" }, { totalServices: "desc" }];
    }

    const [storefronts, total] = await Promise.all([
      prisma.storefront.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          user: {
            select: { id: true, name: true, profileImage: true, isVerified: true },
          },
          mainCategory: {
            select: { id: true, name: true, icon: true },
          },
        },
      }),
      prisma.storefront.count({ where }),
    ]);

    res.json({
      success: true,
      message: "Vitrines carregadas",
      data: {
        items: storefronts,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    log.error({ err: error }, "Error listing storefronts");
    res.status(500).json({ success: false, message: "Erro ao listar vitrines" });
  }
}

// GET /api/storefronts/:slug — Get storefront by slug (public)
export async function getStorefrontBySlug(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    const storefront = await prisma.storefront.findUnique({
      where: { slug, isActive: true, isPublished: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            bio: true,
            isVerified: true,
            ratingAverage: true,
            totalReviews: true,
          },
        },
        mainCategory: {
          select: { id: true, name: true, icon: true },
        },
        categories: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: {
            services: {
              where: { isAvailable: true },
              orderBy: { order: "asc" },
              include: {
                options: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!storefront) {
      res.status(404).json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    res.json({
      success: true,
      message: "Vitrine carregada",
      data: storefront,
    });
  } catch (error: any) {
    log.error({ err: error }, "Error fetching storefront");
    res.status(500).json({ success: false, message: "Erro ao carregar vitrine" });
  }
}
```

**Step 2: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/src/controllers/storefrontController.ts
git commit -m "feat: add storefront public controller (list, getBySlug)"
```

---

## Task 4: Backend — Storefront Management Controller

**Files:**
- Create: `backend/src/controllers/storefrontManageController.ts`

**Step 1: Write the management controller**

This is a large file. Implement the following functions:

- `getMyStorefront` — GET /mine
- `createStorefront` — POST /
- `updateStorefront` — PUT /mine
- `publishStorefront` — PUT /mine/publish
- `listMyCategories` — GET /mine/categories
- `createCategory` — POST /mine/categories
- `updateCategory` — PUT /mine/categories/:id
- `reorderCategories` — PUT /mine/categories/reorder
- `deleteCategory` — DELETE /mine/categories/:id
- `listMyServices` — GET /mine/services
- `createService` — POST /mine/services
- `updateService` — PUT /mine/services/:id
- `deleteService` — DELETE /mine/services/:id
- `createOption` — POST /mine/services/:id/options
- `updateOption` — PUT /mine/options/:id
- `deleteOption` — DELETE /mine/options/:id

All functions must:
- Check user owns the storefront via `req.user.id`
- Use structured logging via `createLogger("storefrontManage")`
- Return `{ success, message, data? }` format
- Auto-generate slug from name if not provided (using slugify logic)

**Step 2: Verify types compile**

Run: `cd backend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add backend/src/controllers/storefrontManageController.ts
git commit -m "feat: add storefront management controller (CRUD)"
```

---

## Task 5: Backend — Storefront Routes

**Files:**
- Create: `backend/src/routes/storefrontRoutes.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create route file**

```typescript
import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createStorefrontSchema,
  updateStorefrontSchema,
  publishStorefrontSchema,
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  createServiceSchema,
  updateServiceSchema,
  createOptionSchema,
  updateOptionSchema,
} from "../middleware/storefrontValidation";
import { listStorefronts, getStorefrontBySlug } from "../controllers/storefrontController";
import {
  getMyStorefront,
  createStorefront,
  updateStorefront,
  publishStorefront,
  listMyCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  listMyServices,
  createService,
  updateService,
  deleteService,
  createOption,
  updateOption,
  deleteOption,
} from "../controllers/storefrontManageController";

const router = Router();

// ── Public routes ──────────────────────────────────────
router.get("/", listStorefronts);
router.get("/:slug", getStorefrontBySlug);

// ── Authenticated routes ───────────────────────────────
router.use(verifyToken);
router.use(requireRole("PROFESSIONAL", "COMPANY"));

router.get("/mine", getMyStorefront);
router.post("/", validate(createStorefrontSchema), createStorefront);
router.put("/mine", validate(updateStorefrontSchema), updateStorefront);
router.put("/mine/publish", validate(publishStorefrontSchema), publishStorefront);

// Categories
router.get("/mine/categories", listMyCategories);
router.post("/mine/categories", validate(createCategorySchema), createCategory);
router.put("/mine/categories/reorder", validate(reorderCategoriesSchema), reorderCategories);
router.put("/mine/categories/:id", validate(updateCategorySchema), updateCategory);
router.delete("/mine/categories/:id", deleteCategory);

// Services
router.get("/mine/services", listMyServices);
router.post("/mine/services", validate(createServiceSchema), createService);
router.put("/mine/services/:id", validate(updateServiceSchema), updateService);
router.delete("/mine/services/:id", deleteService);

// Options
router.post("/mine/services/:id/options", validate(createOptionSchema), createOption);
router.put("/mine/options/:id", validate(updateOptionSchema), updateOption);
router.delete("/mine/options/:id", deleteOption);

export default router;
```

**Step 2: Register in index.ts**

In `backend/src/index.ts`, add import:
```typescript
import storefrontRoutes from "./routes/storefrontRoutes";
```

Add route registration (BEFORE the error handlers):
```typescript
app.use("/api/storefronts", storefrontRoutes);
```

**IMPORTANT**: Place the `/mine` routes so they don't conflict with `/:slug`. The route order in the Router already handles this (literal paths match before parameterized).

**Step 3: Verify types compile**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Test server starts**

Run: `cd backend && npm run dev` (verify no crash)

**Step 5: Commit**

```bash
git add backend/src/routes/storefrontRoutes.ts backend/src/index.ts
git commit -m "feat: register storefront routes in Express"
```

---

## Task 6: Backend — Cart Checkout Endpoint

**Files:**
- Create: `backend/src/controllers/cartCheckoutController.ts`
- Modify: `backend/src/routes/orderRoutes.ts`

**Step 1: Create cart checkout controller**

The controller should:
1. Receive `{ storefrontId, items: [{ serviceId, quantity, selectedOptionIds }] }`
2. Validate all services belong to the specified storefront
3. Calculate total price (sum of service prices with option price overrides * quantities)
4. Create a `ServiceOrder` with `items: ServiceOrderItem[]`
5. Set `ServiceOrder.price` to the total
6. Return the created order

**Step 2: Add route in orderRoutes.ts**

```typescript
import { createOrderFromCart } from "../controllers/cartCheckoutController";
import { cartCheckoutSchema } from "../middleware/storefrontValidation";

// Add to orderRoutes.ts (authenticated):
router.post("/orders/from-cart", validate(cartCheckoutSchema), createOrderFromCart);
```

**Step 3: Verify types compile**

Run: `cd backend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add backend/src/controllers/cartCheckoutController.ts backend/src/routes/orderRoutes.ts
git commit -m "feat: add cart checkout endpoint for storefront orders"
```

---

## Task 7: Backend — Update Seed with New Categories

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Replace categories array**

Replace the existing `categories` array with the expanded 20-category structure (see design doc Section 4). Keep the same `seedCategories()` function logic — it already handles parent/child creation via upsert.

**Step 2: Run seed**

Run: `cd backend && npm run db:seed`
Expected: All 20 categories + subcategories created

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: expand service categories to 20 main + subcategories for Iguatu-CE"
```

---

## Task 8: Backend — Migration Script (ServiceListing → Storefront)

**Files:**
- Create: `backend/prisma/migrate-to-storefronts.ts`

**Step 1: Write migration script**

The script should:
1. Find all users who have ServiceListings
2. For each user, create a Storefront with name=user.name, slug=slugify(user.name)
3. Create a StorefrontCategory "Geral" for each storefront
4. Convert each ServiceListing into a StorefrontService inside "Geral"
5. Update totalServices counter on each Storefront
6. Log progress

**Step 2: Add npm script**

In `backend/package.json`, add:
```json
"db:migrate-storefronts": "tsx prisma/migrate-to-storefronts.ts"
```

**Step 3: Run migration**

Run: `cd backend && npm run db:migrate-storefronts`

**Step 4: Commit**

```bash
git add backend/prisma/migrate-to-storefronts.ts backend/package.json
git commit -m "feat: add migration script from ServiceListing to Storefront"
```

---

## Task 9: Frontend — Types for Storefront

**Files:**
- Create: `frontend/src/types/storefront.ts`
- Modify: `frontend/src/types/index.ts`

**Step 1: Create storefront types**

```typescript
// frontend/src/types/storefront.ts

export interface Storefront {
  id: number;
  userId: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  isActive: boolean;
  isPublished: boolean;
  mainCategoryId?: number | null;
  ratingAverage: number;
  totalReviews: number;
  totalServices: number;
  createdAt: string;
  updatedAt: string;
  // Includes
  user?: {
    id: number;
    name: string;
    profileImage?: string | null;
    bio?: string | null;
    isVerified: boolean;
    ratingAverage?: number;
    totalReviews?: number;
  };
  mainCategory?: {
    id: number;
    name: string;
    icon?: string | null;
  } | null;
  categories?: StorefrontCategoryWithServices[];
}

export interface StorefrontCategory {
  id: number;
  storefrontId: number;
  name: string;
  order: number;
  isActive: boolean;
}

export interface StorefrontCategoryWithServices extends StorefrontCategory {
  services: StorefrontServiceWithOptions[];
}

export interface StorefrontService {
  id: number;
  categoryId: number;
  title: string;
  description?: string | null;
  price: number;
  images?: string[] | null;
  isAvailable: boolean;
  order: number;
}

export interface StorefrontServiceWithOptions extends StorefrontService {
  options: StorefrontServiceOption[];
}

export interface StorefrontServiceOption {
  id: number;
  serviceId: number;
  name: string;
  price?: number | null;
  isDefault: boolean;
  order: number;
}

// Cart types (client-side)
export interface CartItem {
  serviceId: number;
  title: string;
  price: number; // effective price (base or option override)
  quantity: number;
  selectedOptionIds: number[];
  selectedOptionNames: string[];
}

export interface StorefrontCart {
  storefrontId: number;
  storefrontName: string;
  items: CartItem[];
  lastActivity: number; // timestamp ms
}

// API request
export interface CartCheckoutRequest {
  storefrontId: number;
  items: {
    serviceId: number;
    quantity: number;
    selectedOptionIds?: number[];
  }[];
}

// Paginated list response
export interface StorefrontListResponse {
  items: Storefront[];
  total: number;
  page: number;
  totalPages: number;
}
```

**Step 2: Re-export from index.ts**

Add to `frontend/src/types/index.ts`:
```typescript
export * from "./storefront";
```

**Step 3: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/types/storefront.ts frontend/src/types/index.ts
git commit -m "feat: add frontend TypeScript types for storefront"
```

---

## Task 10: Frontend — Storefront API Service

**Files:**
- Create: `frontend/src/services/storefrontService.ts`

**Step 1: Create API service**

```typescript
import api from "./api";
import type {
  Storefront,
  StorefrontListResponse,
  StorefrontCategory,
  StorefrontService,
  StorefrontServiceOption,
  CartCheckoutRequest,
} from "../types";

// ── Public ─────────────────────────────────────────
export async function listStorefronts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  sortBy?: string;
}): Promise<StorefrontListResponse> {
  const { data } = await api.get("/storefronts", { params });
  return data.data;
}

export async function getStorefrontBySlug(slug: string): Promise<Storefront> {
  const { data } = await api.get(`/storefronts/${slug}`);
  return data.data;
}

// ── Management (authenticated) ─────────────────────
export async function getMyStorefront(): Promise<Storefront | null> {
  const { data } = await api.get("/storefronts/mine");
  return data.data;
}

export async function createStorefront(payload: {
  name: string;
  slug?: string;
  description?: string;
  mainCategoryId?: number;
}): Promise<Storefront> {
  const { data } = await api.post("/storefronts", payload);
  return data.data;
}

export async function updateStorefront(payload: Partial<Storefront>): Promise<Storefront> {
  const { data } = await api.put("/storefronts/mine", payload);
  return data.data;
}

export async function publishStorefront(isPublished: boolean): Promise<Storefront> {
  const { data } = await api.put("/storefronts/mine/publish", { isPublished });
  return data.data;
}

// ── Categories ─────────────────────────────────────
export async function listMyCategories(): Promise<StorefrontCategory[]> {
  const { data } = await api.get("/storefronts/mine/categories");
  return data.data;
}

export async function createCategory(payload: { name: string; order?: number }): Promise<StorefrontCategory> {
  const { data } = await api.post("/storefronts/mine/categories", payload);
  return data.data;
}

export async function updateCategory(id: number, payload: { name?: string; isActive?: boolean }): Promise<StorefrontCategory> {
  const { data } = await api.put(`/storefronts/mine/categories/${id}`, payload);
  return data.data;
}

export async function reorderCategories(order: { id: number; order: number }[]): Promise<void> {
  await api.put("/storefronts/mine/categories/reorder", { order });
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/storefronts/mine/categories/${id}`);
}

// ── Services ───────────────────────────────────────
export async function createServiceInStorefront(payload: {
  categoryId: number;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  order?: number;
}): Promise<StorefrontService> {
  const { data } = await api.post("/storefronts/mine/services", payload);
  return data.data;
}

export async function updateServiceInStorefront(id: number, payload: Partial<StorefrontService>): Promise<StorefrontService> {
  const { data } = await api.put(`/storefronts/mine/services/${id}`, payload);
  return data.data;
}

export async function deleteServiceInStorefront(id: number): Promise<void> {
  await api.delete(`/storefronts/mine/services/${id}`);
}

// ── Options ────────────────────────────────────────
export async function createOption(serviceId: number, payload: {
  name: string;
  price?: number | null;
  isDefault?: boolean;
  order?: number;
}): Promise<StorefrontServiceOption> {
  const { data } = await api.post(`/storefronts/mine/services/${serviceId}/options`, payload);
  return data.data;
}

export async function updateOption(id: number, payload: Partial<StorefrontServiceOption>): Promise<StorefrontServiceOption> {
  const { data } = await api.put(`/storefronts/mine/options/${id}`, payload);
  return data.data;
}

export async function deleteOption(id: number): Promise<void> {
  await api.delete(`/storefronts/mine/options/${id}`);
}

// ── Cart Checkout ──────────────────────────────────
export async function checkoutFromCart(payload: CartCheckoutRequest) {
  const { data } = await api.post("/services/orders/from-cart", payload);
  return data.data;
}
```

**Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/services/storefrontService.ts
git commit -m "feat: add storefront API service (frontend)"
```

---

## Task 11: Frontend — Cart Hook (useStorefrontCart)

**Files:**
- Create: `frontend/src/hooks/useStorefrontCart.ts`

**Step 1: Create the hook**

The hook should:
- Store cart in `localStorage` as `cart_storefront_{id}`
- Track `lastActivity` timestamp
- Auto-clear after 1h of inactivity (check on mount and on each operation)
- Expose: `items`, `total`, `itemCount`, `addItem`, `removeItem`, `updateQuantity`, `clearCart`
- `addItem` takes a StorefrontService + selected options and creates a CartItem

**Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/hooks/useStorefrontCart.ts
git commit -m "feat: add useStorefrontCart hook with 1h inactivity reset"
```

---

## Task 12: Frontend — Explore Page

**Files:**
- Create: `frontend/src/pages/explore/Explore.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Explore page**

The page should implement:
1. Search bar at top
2. Category cards (scroll horizontal) — main categories only, with photo/image + name
3. Feed of storefronts (all types mixed, filterable by category)
4. Ordering dropdown (relevance, rating, recent)
5. Infinite scroll / "Carregar mais"
6. Responsive grid: 1 col mobile, 2 cols tablet, 3-4 cols desktop

Use: `StorefrontCard` component (create inline initially, extract later)

**Step 2: Add route to App.tsx**

Add `<Route path="explorar" element={<Explore />} />` inside the Layout routes.
Import the component.

**Step 3: Update navigation**

In `components/Layout.tsx`, change the "Servicos" nav link to "Explorar" pointing to `/explorar`.

**Step 4: Verify build**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/pages/explore/Explore.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: add Explore page with storefront grid (iFood-style)"
```

---

## Task 13: Frontend — Storefront View Page

**Files:**
- Create: `frontend/src/pages/explore/StorefrontView.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create StorefrontView page**

The page should implement:
1. Header with banner + logo + name + rating + description
2. Category navigation (horizontal scroll tabs)
3. Service list by category with prices
4. Clicking a service opens ServiceDetailModal
5. Floating cart bottom bar (from useStorefrontCart)
6. "Tirar duvidas" button (creates DRAFT order)

**Step 2: Add route**

Add `<Route path="vitrine/:slug" element={<StorefrontView />} />` to App.tsx.

**Step 3: Create supporting components**

Create the following components (can be inline in the page initially):
- `StorefrontHeader` — banner + logo + info
- `StorefrontCategoryNav` — horizontal category tabs
- `ServiceItemCard` — service card in list
- `ServiceDetailModal` — service detail with options
- `OptionSelector` — option radio/checkbox selector
- `ServiceCart` — floating cart bottom bar

**Step 4: Verify build**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/pages/explore/StorefrontView.tsx frontend/src/App.tsx frontend/src/components/storefront/
git commit -m "feat: add StorefrontView page with categories, services, options and cart"
```

---

## Task 14: Frontend — Storefront Setup Page (Professional/Company)

**Files:**
- Create: `frontend/src/pages/professional/StorefrontSetup.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create StorefrontSetup page**

Form with:
- Name input
- Description textarea
- Logo upload
- Banner upload
- Main category dropdown (from ServiceCategory API)
- "Publicar" toggle
- Save button

**Step 2: Add routes**

```tsx
<Route path="professional/storefront" element={<StorefrontSetup />} />
<Route path="company/storefront" element={<StorefrontSetup />} />
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/professional/StorefrontSetup.tsx frontend/src/App.tsx
git commit -m "feat: add storefront setup page for professionals/companies"
```

---

## Task 15: Frontend — Storefront Manager Page

**Files:**
- Create: `frontend/src/pages/professional/StorefrontManager.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create StorefrontManager page**

CRUD interface for:
- Categories (add/edit/reorder/delete)
- Services within categories (add/edit/delete)
- Options within services (add/edit/delete)
- Drag-to-reorder (or up/down buttons)
- Toggle service availability

**Step 2: Add routes**

```tsx
<Route path="professional/storefront/manage" element={<StorefrontManager />} />
<Route path="company/storefront/manage" element={<StorefrontManager />} />
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/pages/professional/StorefrontManager.tsx frontend/src/App.tsx
git commit -m "feat: add storefront manager page (categories, services, options CRUD)"
```

---

## Task 16: Backend Tests

**Files:**
- Create: `backend/tests/storefront.test.ts`

**Step 1: Write integration tests**

Test the following scenarios:
1. Create storefront (POST /api/storefronts)
2. Get my storefront (GET /api/storefronts/mine)
3. Update storefront (PUT /api/storefronts/mine)
4. Create category (POST /api/storefronts/mine/categories)
5. Create service (POST /api/storefronts/mine/services)
6. Create option (POST /api/storefronts/mine/services/:id/options)
7. List public storefronts (GET /api/storefronts)
8. Get storefront by slug (GET /api/storefronts/:slug)
9. Cart checkout (POST /api/services/orders/from-cart)
10. Publish/unpublish (PUT /api/storefronts/mine/publish)

**Step 2: Run tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add backend/tests/storefront.test.ts
git commit -m "test: add storefront integration tests"
```

---

## Task 17: Final Integration & Navigation Updates

**Files:**
- Modify: `frontend/src/components/Layout.tsx` — navigation links
- Modify: `frontend/src/App.tsx` — redirect `/services` to `/explorar`

**Step 1: Update navigation**

Change all nav links from "Servicos" to "Explorar" and from `/services` to `/explorar`.

**Step 2: Add redirect**

Add `<Route path="services" element={<Navigate to="/explorar" replace />} />` for backward compatibility.

**Step 3: Verify full build**

Run: `cd frontend && npm run build`

**Step 4: Run backend tests**

Run: `cd backend && npm test`

**Step 5: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat: update navigation to Explorar and add /services redirect"
```

---

## Summary of Files

### Created (new):
| File | Purpose |
|------|---------|
| `backend/src/middleware/storefrontValidation.ts` | Zod schemas |
| `backend/src/controllers/storefrontController.ts` | Public endpoints |
| `backend/src/controllers/storefrontManageController.ts` | CRUD endpoints |
| `backend/src/controllers/cartCheckoutController.ts` | Cart → Order |
| `backend/src/routes/storefrontRoutes.ts` | Route definitions |
| `backend/prisma/migrate-to-storefronts.ts` | Data migration |
| `backend/tests/storefront.test.ts` | Integration tests |
| `frontend/src/types/storefront.ts` | TypeScript types |
| `frontend/src/services/storefrontService.ts` | API service |
| `frontend/src/hooks/useStorefrontCart.ts` | Cart hook |
| `frontend/src/pages/explore/Explore.tsx` | Explore page |
| `frontend/src/pages/explore/StorefrontView.tsx` | Storefront page |
| `frontend/src/pages/professional/StorefrontSetup.tsx` | Setup page |
| `frontend/src/pages/professional/StorefrontManager.tsx` | Manager page |
| `frontend/src/components/storefront/*.tsx` | Storefront components |

### Modified:
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | New models + relations |
| `backend/prisma/seed.ts` | Expanded categories |
| `backend/src/index.ts` | Register storefront routes |
| `backend/src/routes/orderRoutes.ts` | Add cart checkout route |
| `frontend/src/types/index.ts` | Re-export storefront types |
| `frontend/src/App.tsx` | New routes + redirects |
| `frontend/src/components/Layout.tsx` | Nav link updates |
