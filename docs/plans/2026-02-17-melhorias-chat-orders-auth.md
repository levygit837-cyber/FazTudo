# Melhorias: Chat, Orders, Reagendamento, Perfil & Auth Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 issues: chat ordering + unread badges, stepper line overlap, order rejection, reschedule approval flow, profile reviews link, and refresh token authentication.

**Architecture:** Fix existing bugs across backend and frontend. The refresh token issue is the highest priority — register endpoint doesn't issue a refresh token, and the error-catch ordering in auth middleware has a dead code path. Reschedule approval requires a new `RESCHEDULE_PENDING` state on orders and a client-facing approval UI.

**Tech Stack:** Express 5, React 18, TypeScript, Prisma, SQLite, Tailwind CSS, Axios

---

## Task 1: Fix Refresh Token — Register Endpoint (CRITICAL)

**Why first:** Users lose access to the entire site. This is the highest priority.

**Root cause analysis:**
- `POST /api/auth/refresh` endpoint EXISTS and works (authRoutes.ts line 34)
- `login` correctly generates + stores refresh token
- **BUG:** `register` (authController.ts:157-199) only calls `generateToken()` — never `generateRefreshToken()` — so registered users have NO refresh token stored
- **BUG:** `verifyToken` middleware (auth.ts:115-129) catches `TokenExpiredError` BEFORE `JsonWebTokenError` check — but since `TokenExpiredError extends JsonWebTokenError`, the first `instanceof` catches expired tokens too, making the second branch dead code. The fix: swap the order.
- **BUG:** `AuthResponse` type in AuthContext doesn't include `refreshToken` field — code uses `as any` cast

**Files:**
- Modify: `backend/src/controllers/authController.ts` (register function, lines 157-199)
- Modify: `backend/src/middleware/auth.ts` (verifyToken catch blocks, lines 114-129)
- Modify: `frontend/src/context/AuthContext.tsx` (AuthResponse type, lines 50-57)

### Step 1: Fix register to issue refresh token

In `backend/src/controllers/authController.ts`, the `register` function at line 157-199 needs to:
1. Import `generateRefreshToken` (already imported at top)
2. After `generateToken()` on line 158, add `generateRefreshToken()` call
3. Store the refresh token in the DB
4. Include `refreshToken` in the response

Replace lines 157-199 (from `// Generate JWT token` to end of response):

```typescript
    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tokenVersion: user.tokenVersion,
    });

    // Generate refresh token
    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
    });

    // Store refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        emailVerifyToken: hashedVerifyToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
```

And in the response, add `refreshToken`:
```typescript
    res.status(201).json(
      successResponse(
        {
          user,
          token,
          refreshToken,
        },
        "User registered successfully",
      ),
    );
```

**Note:** Merge the two `prisma.user.update` calls (emailVerifyToken + refreshToken) into one to avoid double DB write.

### Step 2: Fix verifyToken catch order in auth middleware

In `backend/src/middleware/auth.ts`, swap the `instanceof` checks at lines 114-129. `TokenExpiredError` must be checked BEFORE `JsonWebTokenError` because it's a subclass:

```typescript
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expirado",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Token inválido",
      });
      return;
    }

    log.error({ err: error }, "Erro na verificação de token");
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
```

### Step 3: Fix AuthResponse type in frontend

In `frontend/src/context/AuthContext.tsx`, update the `AuthResponse` interface (lines 50-57):

```typescript
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
    refreshToken?: string;
  };
}
```

Then replace all `(response.data.data as any).refreshToken` with `response.data.data.refreshToken`.

### Step 3b: Fix changePassword to revoke refresh token (security)

In `backend/src/controllers/authController.ts`, the `changePassword` function (line 457-463) increments `tokenVersion` but does NOT clear `refreshToken`. After a password change, old refresh tokens should be invalidated.

Change lines 457-463 from:
```typescript
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });
```

To:
```typescript
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        refreshToken: null,  // Revoke refresh token on password change
      },
    });
```

### Step 4: Run backend tests

Run: `cd backend && npm test`
Expected: All tests pass

### Step 5: Commit

```bash
git add backend/src/controllers/authController.ts backend/src/middleware/auth.ts frontend/src/context/AuthContext.tsx
git commit -m "fix: register issues refresh token, fix token error catch order, type AuthResponse"
```

---

## Task 2: Chat — Sort by Most Recent Message + Unread Badge

**Problem:** Chat conversations don't sort by most recent activity. Need newest messages at top.

**Current state:** Backend (`chatController.ts` line 98-100) sorts by `updatedAt: "desc"` which is close but `updatedAt` on ServiceOrder changes for many reasons, not just new messages. Frontend (`Messages.tsx`) renders `filteredChats` in the order received — no explicit client-side sort.

**Also:** The unread count badge ALREADY EXISTS in Messages.tsx (lines 155-159) — a badge with `chat.unreadCount`. The backend already returns `unreadCount`. So this might already work. Need to verify the backend actually calculates it correctly.

**Files:**
- Modify: `backend/src/controllers/service/chatController.ts` (sorting logic, ~line 95-100)
- Verify: `frontend/src/pages/Messages.tsx` (confirm sorting works)

### Step 1: Fix backend chat sorting to use last message time

In `backend/src/controllers/service/chatController.ts`, the query at lines 60-101 sorts by `updatedAt` of the ServiceOrder. Change the sorting to be based on last message time. After fetching orders, sort in application code by the `lastMessage.createdAt`:

After the Prisma query that fetches orders (around line 101), add post-processing sort. Find the section where `conversations` array is built and sort it:

```typescript
    // Sort conversations by last message time (most recent first)
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return timeB - timeA;
    });
```

### Step 2: Verify unread count badge works in frontend

The frontend already has the badge UI at `Messages.tsx` lines 155-159. Verify the backend query is counting unread messages correctly — it should count messages where `isRead: false` AND the recipient is the current user (not messages sent BY the current user that are unread by the other party).

Check the backend query includes:
```prisma
_count: {
  messages: {
    where: {
      isRead: false,
      recipientId: userId,  // <-- must filter by current user as recipient
    }
  }
}
```

### Step 3: Run and verify

Run: `cd backend && npm test`
Expected: Pass

### Step 4: Commit

```bash
git add backend/src/controllers/service/chatController.ts
git commit -m "fix: sort chat conversations by last message time"
```

---

## Task 3: Fix Stepper Progress Line Overlapping Icon (Vertical Steppers)

**Problem:** In the vertical `OrderProgressStepper` (inline in `OrderDetails.tsx` lines 112-209), when a step is completed (green), the connector line visually passes through the next step's circular icon — specifically the `<User>` icon ("bonequinho humano") at step index 1.

**Root cause (detailed):** Each step row is `position: relative`. The green connector line is `absolute left-4 top-8 w-0.5 h-[calc(100%-8px)]` — it extends downward from the current step and overlaps into the next step's circle area. The circle has `relative z-10` but because each step row creates its own stacking context, the line from step N overlaps step N+1's circle visually. The `bg-green-100` circle background is light enough that the darker `bg-green-300` line shows through.

The `OrderTimeline.tsx` component uses the **exact same pattern** and has the same bug.

**Fix strategy:**
1. Add explicit `z-0` to connector lines to ensure they're below circles
2. Add an opaque white/dark background ring to circles so the line is fully hidden behind them

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (OrderProgressStepper, lines 112-209)
- Modify: `frontend/src/components/orders/OrderTimeline.tsx` (same pattern, lines 80-117)

### Step 1: Fix OrderProgressStepper in OrderDetails.tsx

In `frontend/src/pages/orders/OrderDetails.tsx`, find the vertical stepper's connector line (around line 173-181):

```tsx
{index < steps.length - 1 && (
  <div
    className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] ${
      step.done
        ? "bg-green-300 dark:bg-green-700"
        : "bg-slate-200 dark:bg-slate-700"
    }`}
  />
)}
```

Add `z-0` to the connector line:
```tsx
{index < steps.length - 1 && (
  <div
    className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] z-0 ${
      step.done
        ? "bg-green-300 dark:bg-green-700"
        : "bg-slate-200 dark:bg-slate-700"
    }`}
  />
)}
```

Then find the step circle (around line 182-190):
```tsx
<div
  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
    step.done
      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
  }`}
>
```

Add a `ring` or `shadow` to create an opaque backing behind the circle, ensuring the line is fully obscured:
```tsx
<div
  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ring-2 ring-white dark:ring-slate-900 ${
    step.done
      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
  }`}
>
```

The `ring-2 ring-white dark:ring-slate-900` creates a 2px opaque border around the circle that matches the page background, fully hiding the connector line behind it.

### Step 2: Apply the same fix to OrderTimeline.tsx

In `frontend/src/components/orders/OrderTimeline.tsx`, apply the same two changes:
1. Add `z-0` to the connector line class
2. Add `ring-2 ring-white dark:ring-slate-900` to the step circle class

### Step 3: Verify visually

Run: `cd frontend && npm run dev`
Navigate to any order detail page with at least 2 completed steps. Verify:
- The green connector line does NOT show through the step icons
- The `<User>` icon circle is clean with no line crossing through it
- Both light and dark mode look correct

### Step 4: Commit

```bash
git add frontend/src/pages/orders/OrderDetails.tsx frontend/src/components/orders/OrderTimeline.tsx
git commit -m "fix: stepper connector line no longer overlaps step icon circles"
```

---

## Task 4: Fix Order Rejection + Red Status for Cancelled/Rejected

**Problem 1:** Professional clicks "Recusar" → "Erro ao executar ação". The frontend calls `cancelOrder(orderId, "Recusado pelo profissional")` (ServiceOrdersList.tsx:132) which hits `POST /services/orders/:id/cancel`. The backend `cancelServiceOrder` (orderController.ts:1105-1240) should handle this — BUT it uses the `serviceController` import in `orderRoutes.ts:80` which references `service/index.ts`. Need to verify the cancel function is exported.

**Root cause investigation:** `cancelServiceOrder` is exported from `orderController.ts` and re-exported via `service/index.ts`. The route at `orderRoutes.ts:77-81` exists. Possible issues:
1. The cancel endpoint checks `cancellableStatuses = ["PENDING", "ACCEPTED"]` — this is correct for rejection
2. BUT the route does NOT have `requireRole` middleware — any authenticated user can call it
3. The controller checks `isClient || isProfessional || isAdmin` — that's correct
4. **Possible issue**: If there's a validation middleware blocking the request, or if the error is a frontend type mismatch

Let me trace more carefully: `ServiceOrdersList.tsx:130-138` calls `cancelOrder(orderId, "Recusado pelo profissional")`. In `serviceService.ts:354-361`, `cancelOrder` does `api.post('/services/orders/${id}/cancel', { reason })`. The backend expects `req.body.reason`.

**Most likely cause**: Check if there's a Zod validation schema on the cancel route that requires specific fields. Looking at `orderRoutes.ts:77-81`, there's NO `validateBody` middleware — so the request should go through. The backend should work. The error might be a CORS issue, or the professional's token might be expired (ties back to Task 1). Let's add better error logging and verify.

**Problem 2:** Cancelled/Rejected orders show gray badge instead of red.

**Files:**
- Modify: `frontend/src/components/orders/OrderCard.tsx` (status color map, lines 97-100)
- Modify: `frontend/src/components/orders/OrderCard.tsx` (border color, line 58)
- Modify: `frontend/src/components/orders/ServiceOrdersList.tsx` (error handling in reject, lines 130-138)
- Possibly: `backend/src/controllers/service/orderController.ts` (debug cancel endpoint)

### Step 1: Change CANCELLED badge color to red

In `frontend/src/components/orders/OrderCard.tsx`, the status config at lines 97-100:

```typescript
  [ServiceOrderStatus.CANCELLED]: {
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
```

Change to:
```typescript
  [ServiceOrderStatus.CANCELLED]: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
```

Also change the border-left color at line 58:
```typescript
  [ServiceOrderStatus.CANCELLED]: "border-l-slate-400",
```
To:
```typescript
  [ServiceOrderStatus.CANCELLED]: "border-l-red-500",
```

### Step 2: Improve reject error handling

In `frontend/src/components/orders/ServiceOrdersList.tsx`, improve `handleRejectOrder` (lines 130-138) to show the actual server error message:

```typescript
  const handleRejectOrder = async (orderId: number) => {
    try {
      await cancelOrder(orderId, "Recusado pelo profissional");
      toast.info("Pedido recusado");
      loadOrders();
    } catch (err: any) {
      const message = err?.response?.data?.message || "Erro ao recusar pedido";
      toast.error(message);
    }
  };
```

### Step 3: Verify the cancel backend route works

Run this test manually:
1. Login as `profissional@teste.com` / `Teste@123`
2. Go to a PENDING order
3. Click "Recusar"
4. Verify it succeeds now (after Task 1 auth fix)

If it still fails, check the backend logs for the actual error.

### Step 4: Commit

```bash
git add frontend/src/components/orders/OrderCard.tsx frontend/src/components/orders/ServiceOrdersList.tsx
git commit -m "fix: red badge for cancelled orders, improve rejection error handling"
```

---

## Task 5: Reschedule Approval Flow (Professional → Client)

**Problem:** Currently, when a professional reschedules, it directly changes the date (`scheduleController.ts:266-271`) and just sends a notification. The client is NOT asked for approval.

**Required:** When professional reschedules → order enters a "pending reschedule" state → client gets notification → client approves or rejects the new date.

**Architecture:**
1. Add `rescheduleProposedDate`, `rescheduleReason`, `rescheduleStatus` fields to ServiceOrder model
2. When professional reschedules: store proposed date (don't change actual `scheduledDate`), set `rescheduleStatus = "PENDING"`, notify client
3. Client sees a banner/modal asking to accept or reject
4. On accept: apply the new date, clear reschedule fields, notify professional
5. On reject: clear reschedule fields, cancel order (or keep current date), notify professional

**Files:**
- Modify: `backend/prisma/schema.prisma` (add reschedule fields to ServiceOrder)
- Modify: `backend/src/controllers/service/scheduleController.ts` (rescheduleOrder — propose instead of apply)
- Create: new functions `acceptReschedule` and `rejectReschedule` in scheduleController
- Modify: `backend/src/routes/orderRoutes.ts` (add accept/reject reschedule routes)
- Modify: `frontend/src/components/orders/RescheduleModal.tsx` (no changes needed — it already works)
- Create: `frontend/src/components/orders/RescheduleApprovalBanner.tsx` (client-facing banner)
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (show approval banner for client)
- Modify: `frontend/src/services/serviceService.ts` (add acceptReschedule, rejectReschedule)
- Modify: `frontend/src/types/entities.ts` (add reschedule fields to ServiceOrder)

### Step 1: Add reschedule fields to Prisma schema

In `backend/prisma/schema.prisma`, add to the `ServiceOrder` model:

```prisma
  rescheduleProposedDate DateTime?
  rescheduleReason       String?
  rescheduleStatus       String?    // "PENDING", null (cleared after accept/reject)
  rescheduleRequestedBy  Int?       // userId who requested
```

Then run: `cd backend && npx prisma db push`

### Step 2: Modify rescheduleOrder to propose instead of directly applying

In `backend/src/controllers/service/scheduleController.ts`, replace lines 266-286:

```typescript
    // If professional reschedules, propose to client (don't apply immediately)
    // If client reschedules, apply directly (they own the order)
    if (isProfessional) {
      // Store proposal, don't change actual date
      await prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          rescheduleProposedDate: new Date(newDate),
          rescheduleReason: reason || null,
          rescheduleStatus: "PENDING",
          rescheduleRequestedBy: req.user.id,
        },
      });

      // Notify client about proposed reschedule
      await prisma.notification.create({
        data: {
          userId: serviceOrder.clientId,
          type: "SYSTEM_ALERT",
          title: "Solicitação de reagendamento",
          message: `O profissional propôs reagendar o pedido "${serviceOrder.title}" para ${new Date(newDate).toLocaleDateString("pt-BR")}${reason ? `. Motivo: ${reason}` : ""}. Acesse o pedido para aceitar ou recusar.`,
          serviceOrderId: orderId,
          metadata: { newDate, reason, requestedBy: req.user.id },
        },
      });

      res.status(200).json(successResponse(null, "Reschedule proposal sent to client"));
    } else {
      // Client reschedules directly
      const updatedOrder = await prisma.serviceOrder.update({
        where: { id: orderId },
        data: { scheduledDate: new Date(newDate) },
      });

      // Notify professional
      if (serviceOrder.professionalId) {
        await prisma.notification.create({
          data: {
            userId: serviceOrder.professionalId,
            type: "SYSTEM_ALERT",
            title: "Pedido reagendado",
            message: `O cliente reagendou o pedido "${serviceOrder.title}" para ${new Date(newDate).toLocaleDateString("pt-BR")}${reason ? `. Motivo: ${reason}` : ""}`,
            serviceOrderId: orderId,
            metadata: { newDate, reason, rescheduledBy: req.user.id },
          },
        });
      }

      res.status(200).json(successResponse({ serviceOrder: updatedOrder }, "Order rescheduled"));
    }
```

### Step 3: Add acceptReschedule and rejectReschedule endpoints

Add to `backend/src/controllers/service/scheduleController.ts`:

```typescript
// POST /api/services/orders/:id/reschedule/accept
export const acceptReschedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) { res.status(400).json(errorResponse("Invalid order ID")); return; }

    const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    if (!serviceOrder) { res.status(404).json(errorResponse("Order not found")); return; }

    // Only the client can accept
    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("Only the client can accept reschedule proposals"));
      return;
    }

    if (serviceOrder.rescheduleStatus !== "PENDING" || !serviceOrder.rescheduleProposedDate) {
      res.status(400).json(errorResponse("No pending reschedule proposal"));
      return;
    }

    // Apply the proposed date
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        scheduledDate: serviceOrder.rescheduleProposedDate,
        rescheduleProposedDate: null,
        rescheduleReason: null,
        rescheduleStatus: null,
        rescheduleRequestedBy: null,
      },
    });

    // Notify professional
    if (serviceOrder.professionalId) {
      await prisma.notification.create({
        data: {
          userId: serviceOrder.professionalId,
          type: "SYSTEM_ALERT",
          title: "Reagendamento aceito",
          message: `O cliente aceitou o novo horário para "${serviceOrder.title}".`,
          serviceOrderId: orderId,
        },
      });
    }

    res.status(200).json(successResponse({ serviceOrder: updatedOrder }, "Reschedule accepted"));
  } catch (error) {
    log.error({ err: error }, "Accept reschedule error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/:id/reschedule/reject
export const rejectReschedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json(errorResponse("Not authenticated")); return; }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) { res.status(400).json(errorResponse("Invalid order ID")); return; }

    const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    if (!serviceOrder) { res.status(404).json(errorResponse("Order not found")); return; }

    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("Only the client can reject reschedule proposals"));
      return;
    }

    if (serviceOrder.rescheduleStatus !== "PENDING") {
      res.status(400).json(errorResponse("No pending reschedule proposal"));
      return;
    }

    // Clear reschedule fields (keep original date)
    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        rescheduleProposedDate: null,
        rescheduleReason: null,
        rescheduleStatus: null,
        rescheduleRequestedBy: null,
      },
    });

    // Notify professional
    if (serviceOrder.professionalId) {
      await prisma.notification.create({
        data: {
          userId: serviceOrder.professionalId,
          type: "SYSTEM_ALERT",
          title: "Reagendamento recusado",
          message: `O cliente recusou o reagendamento para "${serviceOrder.title}". O horário original será mantido.`,
          serviceOrderId: orderId,
        },
      });
    }

    res.status(200).json(successResponse(null, "Reschedule rejected"));
  } catch (error) {
    log.error({ err: error }, "Reject reschedule error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

### Step 4: Add routes

In `backend/src/routes/orderRoutes.ts`, add after the reschedule route (line 88):

```typescript
// Aceitar reagendamento proposto (apenas cliente)
router.post(
  "/orders/:id/reschedule/accept",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  serviceController.acceptReschedule,
);

// Recusar reagendamento proposto (apenas cliente)
router.post(
  "/orders/:id/reschedule/reject",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  serviceController.rejectReschedule,
);
```

### Step 5: Add frontend types

In `frontend/src/types/entities.ts`, add to the `ServiceOrder` interface:

```typescript
  rescheduleProposedDate?: string;
  rescheduleReason?: string;
  rescheduleStatus?: string; // "PENDING" | null
  rescheduleRequestedBy?: number;
```

### Step 6: Add frontend API functions

In `frontend/src/services/serviceService.ts`, add:

```typescript
/**
 * Aceita uma proposta de reagendamento
 */
export const acceptReschedule = async (orderId: number): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/reschedule/accept`,
  );
  return extractData(response);
};

/**
 * Recusa uma proposta de reagendamento
 */
export const rejectReschedule = async (orderId: number): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/reschedule/reject`,
  );
  return extractData(response);
};
```

### Step 7: Create RescheduleApprovalBanner component

Create `frontend/src/components/orders/RescheduleApprovalBanner.tsx`:

```tsx
import React, { useState } from "react";
import { Calendar, Check, X, Loader2 } from "lucide-react";
import { acceptReschedule, rejectReschedule } from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";
import { formatDateTime } from "../../utils/formatters";

interface Props {
  orderId: number;
  proposedDate: string;
  reason?: string;
  onResolved: () => void;
}

const RescheduleApprovalBanner: React.FC<Props> = ({ orderId, proposedDate, reason, onResolved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);

  const handleAccept = async () => {
    try {
      setLoading("accept");
      await acceptReschedule(orderId);
      toast.success("Reagendamento aceito!");
      onResolved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao aceitar reagendamento");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    try {
      setLoading("reject");
      await rejectReschedule(orderId);
      toast.info("Reagendamento recusado. Horário original mantido.");
      onResolved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao recusar reagendamento");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 p-4">
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-300">
            Proposta de reagendamento
          </h4>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            O profissional propôs uma nova data: <strong>{formatDateTime(proposedDate)}</strong>
            {reason && <span> — Motivo: {reason}</span>}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAccept}
              disabled={loading !== null}
              className="btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5"
            >
              {loading === "accept" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Aceitar
            </button>
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="btn btn-sm btn-outline text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 flex items-center gap-1.5"
            >
              {loading === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Recusar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleApprovalBanner;
```

### Step 8: Show banner in OrderDetails for client

In `frontend/src/pages/orders/OrderDetails.tsx`:
1. Import `RescheduleApprovalBanner`
2. After the `FlowStatusBanner` component, add:

```tsx
{/* Reschedule approval (client only) */}
{isOrderClient && order.rescheduleStatus === "PENDING" && order.rescheduleProposedDate && (
  <RescheduleApprovalBanner
    orderId={order.id}
    proposedDate={order.rescheduleProposedDate}
    reason={order.rescheduleReason}
    onResolved={loadOrder}
  />
)}
```

### Step 9: Run DB migration and test

Run: `cd backend && npx prisma db push && npm test`
Expected: Schema updates, tests pass

### Step 10: Commit

```bash
git add backend/prisma/schema.prisma backend/src/controllers/service/scheduleController.ts backend/src/routes/orderRoutes.ts frontend/src/types/entities.ts frontend/src/services/serviceService.ts frontend/src/components/orders/RescheduleApprovalBanner.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: reschedule approval flow — professional proposes, client approves/rejects"
```

---

## Task 6: Fix "Avaliações" Link + Profile Reviews → "Minha Reputação"

**Problem:** The "Avaliações" menu item in Layout dropdown AND the rating section on the profile page don't navigate to the reputation page.

**Root causes found:**
1. **Layout.tsx line 216**: "Minhas Avaliações" links to `/profile/reviews` — **this route does NOT exist in App.tsx** → results in 404!
2. **Profile.tsx**: Rating stats section (lines 394-403) is a static `<div>` with no click handler
3. **Profile.tsx**: No "Avaliações" tab in the profile tab list

**The route exists:** `App.tsx:118` has `<Route path="reputacao" element={<ProfessionalReputation />} />`

**Fix:** Change the dropdown link path to `/professional/reputacao`, make the rating stats clickable, and add an "Avaliações" tab.

**Files:**
- Modify: `frontend/src/components/Layout.tsx` (dropdown menu item path, line 216)
- Modify: `frontend/src/pages/Profile.tsx` (rating stats section + tabs)

### Step 1: Fix Layout dropdown menu link (THE MAIN BUG)

In `frontend/src/components/Layout.tsx`, find the "Minhas Avaliacoes" menu item (around line 215-218):

```tsx
{
  label: "Minhas Avaliacoes",
  icon: <Star size={18} />,
  path: "/profile/reviews",
}
```

Change `path` to the actual reputation route:
```tsx
{
  label: "Minhas Avaliacoes",
  icon: <Star size={18} />,
  path: "/professional/reputacao",
}
```

**Note:** This menu item should only appear for PROFESSIONAL users. Verify that the dropdown conditionally shows it based on role.

### Step 2: Make rating section clickable on Profile page

In `frontend/src/pages/Profile.tsx`, wrap the rating stats in a clickable element. Find the rating section (around line 393-403):

```tsx
          {profile.ratingAverage > 0 && (
            <div className="flex items-center gap-1">
```

Change to:
```tsx
          {profile.ratingAverage > 0 && (
            <button
              onClick={() => navigate("/professional/reputacao")}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
              title="Ver minha reputação"
            >
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {profile.ratingAverage.toFixed(1)}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">
                ({profile.totalReviews} avaliacoes)
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>
          )}
```

Import `ArrowRight` from lucide-react and ensure `useNavigate` is already imported (it should be).

### Step 3: Add "Avaliações" tab for professionals

In the `profileTabs` useMemo (around line 266-276), add:
```typescript
    if (profile?.role === "PROFESSIONAL") {
      tabs.splice(1, 0, { id: "services", label: "Servicos" });
      tabs.push({ id: "reviews", label: "Avaliações" });
    }
```

Then in the tab content rendering, handle the "reviews" tab by redirecting:
```tsx
{activeTab === "reviews" && (
  <div className="text-center py-8">
    <p className="text-slate-600 dark:text-slate-400 mb-4">
      Veja sua reputação completa e análise de avaliações
    </p>
    <button
      onClick={() => navigate("/professional/reputacao")}
      className="btn btn-primary"
    >
      Ver Minha Reputação
    </button>
  </div>
)}
```

### Step 4: Verify navigation works

Run: `cd frontend && npm run dev`
- Click "Minhas Avaliações" in the user dropdown → Should go to `/professional/reputacao` (NOT 404)
- Login as professional → Profile → Click rating → Should also go to `/professional/reputacao`
- Click "Avaliações" tab → Should show redirect button

### Step 5: Commit

```bash
git add frontend/src/components/Layout.tsx frontend/src/pages/Profile.tsx
git commit -m "fix: reviews link navigates to reputation page instead of 404"
```

---

## Summary of All Changes

| Task | Priority | Files Modified | Type |
|------|----------|---------------|------|
| 1. Refresh Token Fix | **CRITICAL** | authController.ts, auth.ts, AuthContext.tsx | Bug fix |
| 2. Chat Sorting | HIGH | chatController.ts | Bug fix |
| 3. Stepper Overlap | MEDIUM | OrderDetails.tsx (inline stepper), OrderTimeline.tsx | CSS/z-index fix |
| 4. Order Rejection + Red Badge | HIGH | OrderCard.tsx, ServiceOrdersList.tsx | Bug fix + UI |
| 5. Reschedule Approval | MEDIUM | schema.prisma, scheduleController.ts, orderRoutes.ts, entities.ts, serviceService.ts, RescheduleApprovalBanner.tsx (new), OrderDetails.tsx | Feature |
| 6. Profile → Reputation | LOW | Layout.tsx, Profile.tsx | Bug fix (404) + UI |

**Execution order matters:** Task 1 (auth) must be first — it may fix Task 4's rejection error since the "Erro ao executar ação" could be caused by an expired token that can't refresh.
