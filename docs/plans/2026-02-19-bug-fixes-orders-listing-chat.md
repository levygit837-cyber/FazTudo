# Bug Fixes: Orders, Listings & Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 distinct bugs spanning order status i18n, accept-order 304, listing pause/activate/delete 400, professional chat 403, and draft-order redirect to `/orders/undefined/chat`.

**Architecture:** All fixes are surgical — no new files, no schema changes. Bugs span: (1) missing `ACCEPTED` key in `formatOrderStatus()`, (2) accept-order route returning stale `304` due to Axios cache, (3) listing PUT/DELETE returning `400` due to Zod schema mismatch between `estimatedDuration` (schema) vs `estimatedHours` (body) + missing `isAvailable`/`images`/`tags` fields, (4) professional sending to DRAFT chat returning `403` because `createDraftOrder` is CLIENT-only so the professional-initiated "tirar duvidas" path creates no DRAFT, (5) `createDraftOrder` on the frontend extracts the wrong level of the API response (`{ serviceOrder }` object vs the order itself), causing `draft.id === undefined` → redirect to `/orders/undefined/chat`, (6) session heartbeat/404 is a separate Red Herring caused by bug #5 (navigating to a non-existent order page).

**Tech Stack:** TypeScript, Express 5, Zod 4, React 19, Axios 1.13, React Router 7

---

## Bug Inventory

| # | Bug | File(s) | Root Cause |
|---|-----|---------|-----------|
| 1 | Status badges show "accepted" in English | `frontend/src/utils/formatters.ts` | `ACCEPTED` key missing from `statusMap` in `formatOrderStatus` |
| 2 | Accept order returns 304 | `frontend/src/services/serviceService.ts` | Axios GET cache; the POST itself is fine — need to verify, likely a frontend stale-read after accept |
| 3 | Pause/Activate returns 400 | `backend/src/middleware/validation.ts` + `backend/src/routes/serviceRoutes.ts` | `updateServiceSchema` uses `estimatedDuration` (string) not `estimatedHours` (number); also lacks `isAvailable`, `images`, `tags` fields that the controller accepts |
| 4 | Delete listing returns 400 | Same as #3 — the route uses `validateBody(updateServiceSchema)` but delete sends no body; also the frontend may be hitting a wrong endpoint |
| 5 | Professional "tirar duvidas" returns 403 | `backend/src/controllers/service/orderController.ts` (createDraftOrder requires CLIENT) + `backend/src/routes/orderRoutes.ts` | `createDraftOrder` is restricted to `requireRole("CLIENT")`. When a PROFESSIONAL visits a service page and clicks "Tirar dúvidas", no DRAFT is created; the chat controller then hits the payment gate (no payment + not DRAFT = 403) |
| 6 | Redirect to `/orders/undefined/chat` | `frontend/src/services/serviceService.ts` + `frontend/src/pages/services/ServiceDetails.tsx` | `createDraftOrder` frontend fn calls `extractData(response)` which gives `{ serviceOrder: {...} }`, but `ServiceDetails.tsx` uses `draft.id` — the id is on `draft.serviceOrder.id`, not `draft.id` |

---

## Task 1: Fix missing `ACCEPTED` key in `formatOrderStatus`

**Files:**
- Modify: `frontend/src/utils/formatters.ts`

**Step 1: Locate the `statusMap` in `formatOrderStatus`**

In `frontend/src/utils/formatters.ts`, around line 140:
```typescript
const statusMap: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT_CONFIRMATION: "Aguardando sua confirmação",
  AWAITING_PROFESSIONAL_CONFIRMATION: "Aguardando confirmação do profissional",
  COMPLETED: "Concluido",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  DISPUTED: "Em disputa",
};
```
Note: `ACCEPTED` is **missing**.

**Step 2: Add `ACCEPTED` to the map**

Replace the `statusMap` with:
```typescript
const statusMap: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT_CONFIRMATION: "Aguardando sua confirmação",
  AWAITING_PROFESSIONAL_CONFIRMATION: "Aguardando confirmação do profissional",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  DISPUTED: "Em disputa",
};
```

**Step 3: Verify no other hardcoded English status strings exist in OrderCard or ServiceOrdersList**

Search for `"accepted"` and `"ACCEPTED"` in:
- `frontend/src/components/orders/OrderCard.tsx` — the `statusConfig` object uses enum values (not strings), so it's already correct
- `frontend/src/components/orders/ServiceOrdersList.tsx` — tabs use enum values, already correct
- `frontend/src/components/orders/FlowStatusBanner.tsx` — uses `status === "ACCEPTED"` checks (correct, not display text)

**Step 4: Commit**
```bash
cd /home/levybonito/faztudo-main
git add frontend/src/utils/formatters.ts
git commit -m "fix: add ACCEPTED to formatOrderStatus pt-BR status map"
```

---

## Task 2: Fix Zod validation schema for listing update (causes Pause/Activate 400)

**Files:**
- Modify: `backend/src/middleware/validation.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`

**Step 1: Understand the mismatch**

`updateServiceSchema` is derived from `createServiceSchema`, which uses `estimatedDuration: z.string().max(100).optional()`. But the controller (`listingController.ts`) reads `estimatedHours` (a number) from `req.body`, and the `UpdateServiceListingBody` interface has `estimatedHours?: number`.

The `updateServiceSchema` also lacks `isAvailable`, `images`, and `tags` — all fields the controller reads and the frontend sends.

**Step 2: Fix `createServiceSchema` and create a separate `updateServiceSchema`**

In `backend/src/middleware/validation.ts`, find:
```typescript
export const createServiceSchema = z.object({
  title: sanitizedString
    .pipe(z.string().min(5, 'Titulo deve ter no minimo 5 caracteres').max(150, 'Titulo muito longo')),
  description: sanitizedString
    .pipe(z.string().min(20, 'Descricao deve ter no minimo 20 caracteres').max(2000, 'Descricao muito longa')),
  price: positiveAmountSchema.pipe(z.number().max(999999.99, 'Valor maximo excedido')),
  categoryId: z.number().int().positive('Categoria invalida'),
  estimatedDuration: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateServiceSchema = createServiceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Pelo menos um campo deve ser fornecido' },
);
```

Replace with:
```typescript
export const createServiceSchema = z.object({
  title: sanitizedString
    .pipe(z.string().min(5, 'Titulo deve ter no minimo 5 caracteres').max(150, 'Titulo muito longo')),
  description: sanitizedString
    .pipe(z.string().min(20, 'Descricao deve ter no minimo 20 caracteres').max(2000, 'Descricao muito longa')),
  price: positiveAmountSchema.pipe(z.number().max(999999.99, 'Valor maximo excedido')),
  categoryId: z.number().int().positive('Categoria invalida'),
  estimatedHours: z.number().positive().optional(),
  images: z.array(z.string()).max(20).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateServiceSchema = z.object({
  title: sanitizedString
    .pipe(z.string().min(5, 'Titulo deve ter no minimo 5 caracteres').max(150, 'Titulo muito longo'))
    .optional(),
  description: sanitizedString
    .pipe(z.string().min(20, 'Descricao deve ter no minimo 20 caracteres').max(2000, 'Descricao muito longa'))
    .optional(),
  price: positiveAmountSchema.pipe(z.number().max(999999.99, 'Valor maximo excedido')).optional(),
  categoryId: z.number().int().positive('Categoria invalida').optional(),
  estimatedHours: z.number().positive().optional(),
  isAvailable: z.boolean().optional(),
  images: z.array(z.string()).max(20).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Pelo menos um campo deve ser fornecido' },
);
```

**Step 3: Fix the DELETE route — it incorrectly uses `validateBody(updateServiceSchema)`**

In `backend/src/routes/serviceRoutes.ts`, check if the DELETE route passes `validateBody(updateServiceSchema)`. If so, remove it — DELETE requests have no body.

Check the current DELETE route definition. It likely looks like:
```typescript
router.delete(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  validateBody(updateServiceSchema),   // ← REMOVE THIS LINE
  serviceController.deleteServiceListing,
);
```

Remove the `validateBody(updateServiceSchema)` middleware from the DELETE route.

**Step 4: Run TypeScript check**
```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
```
Expected: No errors

**Step 5: Run existing tests**
```bash
cd /home/levybonito/faztudo-main/backend && npm test
```
Expected: All tests pass

**Step 6: Commit**
```bash
cd /home/levybonito/faztudo-main
git add backend/src/middleware/validation.ts backend/src/routes/serviceRoutes.ts
git commit -m "fix: update listing schema to include isAvailable/images/tags and fix estimatedHours type"
```

---

## Task 3: Fix accept order 304 issue

**Files:**
- Modify: `frontend/src/services/serviceService.ts`

**Step 1: Understand the 304 issue**

HTTP 304 means "Not Modified" — Axios or the browser is caching the response. The `POST /orders/:id/accept` itself is correct on the backend. The 304 is from a subsequent GET (e.g. `listOrders`) returning cached data, making it look like nothing changed.

The `acceptOrder` function in `serviceService.ts` sends a POST to `/services/orders/:id/accept`. After the POST, `ServiceOrdersList.tsx` does an optimistic update + revert on error — this part is correct.

The 304 is triggered because the subsequent GET for orders is returning cached results. The fix is to add a cache-busting parameter or configure Axios to not cache GET requests.

**Step 2: Check the Axios instance**

In `frontend/src/services/api.ts`, look at the Axios instance configuration. Add cache-busting headers if not already present.

Read `frontend/src/services/api.ts` — if it doesn't have `Cache-Control: no-cache` or `Pragma: no-cache`, add them to the default headers.

Find the api instance creation (likely `axios.create({...})`):
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001",
  // ...existing config
});
```

Add a request interceptor to bust cache on GET requests if not already present:
```typescript
api.interceptors.request.use((config) => {
  if (config.method === 'get') {
    config.headers = config.headers || {};
    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';
  }
  return config;
});
```

**Step 3: Also verify `acceptOrder` returns the correct response**

The frontend `handleAcceptOrder` in `ServiceOrdersList.tsx` calls `acceptOrder(orderId)` but does not use the return value — it relies on optimistic update. The accept itself should work; we just need to ensure there's no stale cache on subsequent loads.

**Step 4: Run frontend type check**
```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
```

**Step 5: Commit**
```bash
cd /home/levybonito/faztudo-main
git add frontend/src/services/api.ts
git commit -m "fix: disable GET cache on API requests to prevent stale 304 responses"
```

---

## Task 4: Fix professional "Tirar dúvidas" 403 — allow PROFESSIONAL to create DRAFT orders

**Files:**
- Modify: `backend/src/routes/orderRoutes.ts`
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Understand the root cause**

Currently `POST /orders/draft` has `requireRole("CLIENT")`. A PROFESSIONAL viewing a service listing (another professional's listing) and clicking "Tirar dúvidas" tries to create a DRAFT, but gets rejected at the role gate.

The backend `createDraftOrder` handler also hardcodes `if (req.user.role !== "CLIENT")` check that returns 403.

**Step 2: Remove the CLIENT-only restriction on DRAFT creation**

In `backend/src/routes/orderRoutes.ts`, find:
```typescript
router.post(
  "/orders/draft",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  serviceController.createDraftOrder,
);
```

Change to allow both CLIENT and PROFESSIONAL:
```typescript
router.post(
  "/orders/draft",
  verifyToken,
  requireRole("CLIENT", "PROFESSIONAL"),
  requireVerified,
  serviceController.createDraftOrder,
);
```

**Step 3: Update `createDraftOrder` controller to allow PROFESSIONAL initiators**

In `backend/src/controllers/service/orderController.ts`, find the `createDraftOrder` handler:

```typescript
if (req.user.role !== "CLIENT") {
  res.status(403).json(errorResponse("Only clients can create draft orders"));
  return;
}
```

Replace with:
```typescript
if (req.user.role !== "CLIENT" && req.user.role !== "PROFESSIONAL") {
  res.status(403).json(errorResponse("Only clients and professionals can create draft orders"));
  return;
}
```

**Step 4: Handle the case where a PROFESSIONAL creates a DRAFT (they are the client-side party)**

When a professional creates a draft to contact another professional, the current logic sets `clientId: req.user.id` and `professionalId: serviceListing.professionalId`. This is still valid — the PROFESSIONAL who is *buying* a service acts as the "client" in that order, which is correct business logic. No further changes needed in the data layer.

**Step 5: Also handle the case where a professional tries to contact their OWN listing**

In `createDraftOrder`, after fetching the `serviceListing`, add a guard:
```typescript
if (serviceListing.professionalId === req.user.id) {
  res.status(400).json(errorResponse("Você não pode criar um pedido no seu próprio serviço"));
  return;
}
```

This prevents a professional from creating a draft on their own listing.

**Step 6: Run TypeScript check**
```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
```

**Step 7: Commit**
```bash
cd /home/levybonito/faztudo-main
git add backend/src/routes/orderRoutes.ts backend/src/controllers/service/orderController.ts
git commit -m "fix: allow PROFESSIONAL role to create DRAFT orders for tirar-duvidas flow"
```

---

## Task 5: Fix `/orders/undefined/chat` redirect — fix `createDraftOrder` response extraction

**Files:**
- Modify: `frontend/src/services/serviceService.ts`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`

**Step 1: Understand the data flow**

The backend `createDraftOrder` responds with:
```json
{
  "success": true,
  "message": "Draft order created successfully",
  "data": {
    "serviceOrder": { "id": 42, ... }
  }
}
```

`extractData(response)` in `serviceService.ts` extracts `response.data.data`, giving:
```json
{ "serviceOrder": { "id": 42, ... } }
```

The frontend `createDraftOrder` function returns this as `ServiceOrder`:
```typescript
export const createDraftOrder = async (
  serviceListingId: number,
  message: string,
): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>("/services/orders/draft", {
    serviceListingId,
    message,
  });
  return extractData(response);  // ← returns { serviceOrder: {...} }, NOT the order itself
};
```

Then in `ServiceDetails.tsx`:
```typescript
const draft = await createDraftOrder(service.id, contactMessage.trim());
navigate(`${basePath}/${draft.id}/chat`);  // ← draft.id is undefined!
```

**Step 2: Fix `createDraftOrder` in `serviceService.ts`**

Find the `createDraftOrder` function:
```typescript
export const createDraftOrder = async (
  serviceListingId: number,
  message: string,
): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>("/services/orders/draft", {
    serviceListingId,
    message,
  });
  return extractData(response);
};
```

Replace with (unwrap the `serviceOrder` key, same pattern as `acceptOrder` which does `payload.serviceOrder || payload`):
```typescript
export const createDraftOrder = async (
  serviceListingId: number,
  message: string,
): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>("/services/orders/draft", {
    serviceListingId,
    message,
  });
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};
```

**Step 3: Verify `ServiceDetails.tsx` navigation is correct after fix**

After the fix, `draft` will now be the actual `ServiceOrder` object with an `id` field. The navigate call:
```typescript
navigate(`${basePath}/${draft.id}/chat`);
```
will correctly produce e.g. `/client/orders/42/chat` or `/professional/services/42/chat`.

**Step 4: Verify the chat route exists in App.tsx**

Check `frontend/src/App.tsx` for routes like:
- `/client/orders/:id/chat` → should render `ServiceChat`
- `/professional/services/:id/chat` → should render `ServiceChat`

If these routes don't exist, the navigation will show a 404. But based on the existing `ServiceChat.tsx` which uses `useParams<{ id: string }>()` and checks `location.pathname.includes("/professional/")`, these routes should already be registered. Confirm they exist.

**Step 5: Run type check**
```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
```

**Step 6: Commit**
```bash
cd /home/levybonito/faztudo-main
git add frontend/src/services/serviceService.ts
git commit -m "fix: unwrap serviceOrder from createDraftOrder response to fix undefined chat redirect"
```

---

## Task 6: Verify `serviceRoutes.ts` DELETE route and add error feedback for Pause/Activate/Delete

**Files:**
- Read: `backend/src/routes/serviceRoutes.ts` (to confirm DELETE route structure)
- Modify: `frontend/src/pages/services/ServiceSearch.tsx` (add user-facing error messages for toggle/delete failures)

**Step 1: Read `serviceRoutes.ts` to confirm DELETE route**

Read `backend/src/routes/serviceRoutes.ts` in full to confirm whether `validateBody(updateServiceSchema)` is applied to the DELETE route. If so, that's why delete returns 400 (Zod sees no body and the `.refine()` check fails because `Object.keys({}).length === 0`).

**Step 2: If DELETE route has `validateBody`, remove it**

The DELETE route should look like this (no body validation):
```typescript
router.delete(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.deleteServiceListing,
);
```

**Step 3: Improve error feedback in `ServiceSearch.tsx`**

The current `handleToggleAvailability` only logs the error:
```typescript
} catch (err) {
  console.error("Erro ao alterar disponibilidade:", err);
}
```

Replace with user-facing toast:
```typescript
} catch (err: any) {
  toast.error("Erro ao alterar disponibilidade", err?.response?.data?.message || "Tente novamente.");
}
```

**Step 4: Run TypeScript check**
```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
```

**Step 5: Commit**
```bash
cd /home/levybonito/faztudo-main
git add backend/src/routes/serviceRoutes.ts frontend/src/pages/services/ServiceSearch.tsx
git commit -m "fix: remove validateBody from DELETE listing route and improve toggle error feedback"
```

---

## Task 7: Final verification checklist

**Step 1: Run all backend tests**
```bash
cd /home/levybonito/faztudo-main/backend && npm test
```
Expected: All 11 test files pass.

**Step 2: Run full TypeScript check on both workspaces**
```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
```
Expected: Zero errors.

**Step 3: Manual smoke test checklist**
- [ ] Go to any order in client view — status badge shows "Aceito" (not "accepted")
- [ ] Go to professional service orders — all status badges in Portuguese
- [ ] Professional can click Pausar on a service listing → service becomes grayed out with "Pausado" badge
- [ ] Professional can click Ativar on a paused listing → service becomes active
- [ ] Professional can delete a service with no active orders → success toast
- [ ] Professional can accept a pending order from the orders tab → optimistic update works
- [ ] Client clicks "Tirar dúvidas" on a service → message sent → redirected to `/client/orders/[REAL_ID]/chat`
- [ ] Professional (acting as buyer) clicks "Tirar dúvidas" → message sent → redirected to `/professional/services/[REAL_ID]/chat`
- [ ] Chat page loads correctly (no infinite skeleton loading)

**Step 4: Final commit (if any remaining cleanup)**
```bash
cd /home/levybonito/faztudo-main
git log --oneline -7
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `frontend/src/utils/formatters.ts` | Add `ACCEPTED: "Aceito"` to `formatOrderStatus` statusMap |
| `backend/src/middleware/validation.ts` | Fix `createServiceSchema` (`estimatedHours` not `estimatedDuration`), fix `updateServiceSchema` to include `isAvailable`/`images`/`tags` |
| `backend/src/routes/serviceRoutes.ts` | Remove `validateBody(updateServiceSchema)` from DELETE route |
| `frontend/src/services/api.ts` | Add `Cache-Control: no-cache` interceptor on GET requests |
| `backend/src/routes/orderRoutes.ts` | Allow `PROFESSIONAL` role on `POST /orders/draft` |
| `backend/src/controllers/service/orderController.ts` | Allow `PROFESSIONAL` role in `createDraftOrder`; guard against own-listing drafts |
| `frontend/src/services/serviceService.ts` | Fix `createDraftOrder` to unwrap `payload.serviceOrder || payload` |
| `frontend/src/pages/services/ServiceSearch.tsx` | Improve toggle availability error feedback with toast |
