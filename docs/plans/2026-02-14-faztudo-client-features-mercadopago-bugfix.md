# FazTudo — Client Features, MercadoPago Integration & Bug Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical Express 5 bug, integrate MercadoPago payment gateway, and build client-facing features: intelligent order brief, proposal comparator, real-time scheduling, protected payment flow with timeline, order tracking with chat, and post-service review system.

**Architecture:** Backend is Express 5 + Prisma 7 + SQLite (TypeScript). Frontend is React 18 + Vite + Tailwind CSS. Payments go through MercadoPago SDK creating Checkout Pro preferences. Escrow is managed internally — MercadoPago handles money collection, platform manages lifecycle. New Prisma models extend existing schema for briefs, proposals, scheduling, and disputes.

**Tech Stack:** Express 5.2.1, Prisma 7.3.0, React 18.2, TypeScript, Vite 5, Tailwind CSS 3.3, MercadoPago Node.js SDK, Zod 4, Vitest 4, lucide-react icons.

---

## Phase 0: Critical Bug Fix (Express 5 req.query Readonly)

### Task 1: Fix XSS Sanitizer Middleware — Express 5 Compatibility

**Files:**
- Modify: `backend/src/middleware/sanitize.ts:28-43`
- Test: `backend/tests/middleware/sanitize.test.ts`

**Context:** In Express 5, `req.query` and `req.params` are getter-only properties. The current `xssSanitizer` middleware at line 37 tries `req.query = sanitizeValue(req.query)` which throws `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`. This breaks login and all authenticated routes.

**Step 1: Write the failing test**

Create `backend/tests/middleware/sanitize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { xssSanitizer } from "../../src/middleware/sanitize";

describe("xssSanitizer middleware (Express 5)", () => {
  const app = express();
  app.use(express.json());
  app.use(xssSanitizer);

  app.get("/test", (req, res) => {
    res.json({ query: req.query, success: true });
  });

  app.post("/test", (req, res) => {
    res.json({ body: req.body, success: true });
  });

  it("should not crash on GET with query params", async () => {
    const res = await request(app).get("/test?search=hello&page=1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should sanitize XSS in body", async () => {
    const res = await request(app)
      .post("/test")
      .send({ name: '<script>alert("xss")</script>' });
    expect(res.status).toBe(200);
    expect(res.body.body.name).not.toContain("<script>");
  });

  it("should handle query strings without throwing", async () => {
    const res = await request(app).get('/test?q=<img src=x onerror=alert(1)>');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/middleware/sanitize.test.ts`
Expected: FAIL with `Cannot set property query`

**Step 3: Write minimal implementation**

Replace `backend/src/middleware/sanitize.ts` entirely:

```typescript
import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Recursively sanitize all string values in an object to prevent XSS.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Mutate object values in-place by sanitizing each string property.
 * This avoids reassigning read-only properties (Express 5 req.query/req.params).
 */
function sanitizeInPlace(obj: Record<string, any>): void {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = xss(obj[key]);
    } else if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map(sanitizeValue);
    } else if (obj[key] !== null && typeof obj[key] === "object") {
      sanitizeInPlace(obj[key]);
    }
  }
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * against XSS attacks. Compatible with Express 5 (read-only query/params).
 */
export const xssSanitizer = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // req.body is mutable — safe to reassign
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  // req.query is read-only in Express 5 — mutate values in-place
  if (req.query && typeof req.query === "object") {
    sanitizeInPlace(req.query as Record<string, any>);
  }
  // req.params is read-only in Express 5 — mutate values in-place
  if (req.params && typeof req.params === "object") {
    sanitizeInPlace(req.params as Record<string, any>);
  }
  next();
};
```

**Step 4: Run test to verify it passes**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/middleware/sanitize.test.ts`
Expected: PASS — all 3 tests green

**Step 5: Verify login works end-to-end**

Run: `cd /home/levybonito/faztudo-main/backend && npx ts-node -e "
const express = require('express');
// Quick smoke test that sanitizer doesn't crash
" `

**Step 6: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/src/middleware/sanitize.ts backend/tests/middleware/sanitize.test.ts
git commit -m "fix: Express 5 req.query readonly — mutate XSS sanitizer in-place

Express 5 makes req.query and req.params getter-only properties.
Replaced full-object reassignment with in-place mutation to fix
'Cannot set property query of #<IncomingMessage>' crash."
```

---

## Phase 1: MercadoPago Integration

### Task 2: Install MercadoPago SDK & Configure Environment

**Files:**
- Modify: `backend/package.json` (add dependency)
- Modify: `backend/src/config/env.ts` (add MP env vars)
- Create: `backend/src/config/mercadopago.ts`

**Step 1: Install MercadoPago SDK**

Run: `cd /home/levybonito/faztudo-main/backend && npm install mercadopago`

**Step 2: Add MercadoPago env vars to config**

Add to `backend/src/config/env.ts` in the `EnvConfig` interface after the Escrow System section:

```typescript
  // MercadoPago
  MP_ACCESS_TOKEN: string;
  MP_PUBLIC_KEY: string;
  MP_CLIENT_ID: string;
  MP_CLIENT_SECRET: string;
  MP_WEBHOOK_SECRET: string;
  MP_SANDBOX: boolean;
```

Add to the `config` object in `getEnvConfig()`:

```typescript
    // MercadoPago
    MP_ACCESS_TOKEN: process.env.ACESS_TOKEN_MP || process.env.MP_ACCESS_TOKEN || '',
    MP_PUBLIC_KEY: process.env.PUBLIC_KEY_MP || process.env.MP_PUBLIC_KEY || '',
    MP_CLIENT_ID: process.env.CLIENT_ID || process.env.MP_CLIENT_ID || '',
    MP_CLIENT_SECRET: process.env.CLIENT_SECRET || process.env.MP_CLIENT_SECRET || '',
    MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
    MP_SANDBOX: process.env.MP_SANDBOX !== 'false',
```

**Step 3: Create MercadoPago client module**

Create `backend/src/config/mercadopago.ts`:

```typescript
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { env } from "./env";

let mpClient: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!mpClient) {
    if (!env.MP_ACCESS_TOKEN) {
      throw new Error(
        "MercadoPago access token not configured. Set ACESS_TOKEN_MP in VARIAVEIS/.env.mp"
      );
    }
    mpClient = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
      options: { timeout: 10000 },
    });
  }
  return mpClient;
}

export function getPreferenceClient(): Preference {
  return new Preference(getMercadoPagoClient());
}

export function getPaymentClient(): Payment {
  return new Payment(getMercadoPagoClient());
}
```

**Step 4: Load .env.mp credentials in dev startup**

Modify `backend/src/config/env.ts` — add at the very top, before `import 'dotenv/config'`:

```typescript
import path from 'path';
import fs from 'fs';

// Load MercadoPago credentials from VARIAVEIS/.env.mp if it exists
const mpEnvPath = path.resolve(__dirname, '../../../VARIAVEIS/.env.mp');
if (fs.existsSync(mpEnvPath)) {
  const mpEnvContent = fs.readFileSync(mpEnvPath, 'utf8');
  for (const line of mpEnvContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
```

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/package.json backend/package-lock.json backend/src/config/env.ts backend/src/config/mercadopago.ts
git commit -m "feat: add MercadoPago SDK config and credential loading

Installs mercadopago SDK, loads VARIAVEIS/.env.mp credentials,
creates typed MP client factory for Preference and Payment APIs."
```

---

### Task 3: Refactor Payment Controller to Use MercadoPago

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts`
- Create: `backend/src/services/mercadopagoService.ts`
- Modify: `backend/src/routes/serviceRoutes.ts` (add webhook route)
- Modify: `backend/src/index.ts` (add webhook raw body parser)

**Step 1: Create MercadoPago service layer**

Create `backend/src/services/mercadopagoService.ts`:

```typescript
import { getPreferenceClient, getPaymentClient } from "../config/mercadopago";
import { env } from "../config/env";

export interface CreateMPPreferenceParams {
  orderId: number;
  title: string;
  description: string;
  amount: number;
  payerEmail: string;
  payerName: string;
  externalReference: string;
}

export interface MPPreferenceResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

/**
 * Creates a MercadoPago Checkout Pro preference for an order payment.
 */
export async function createPaymentPreference(
  params: CreateMPPreferenceParams
): Promise<MPPreferenceResult> {
  const preference = getPreferenceClient();

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${env.PORT}`;
  const frontendUrl = env.CORS_ORIGIN.split(",")[0] || "http://localhost:5173";

  const response = await preference.create({
    body: {
      items: [
        {
          id: `order-${params.orderId}`,
          title: params.title,
          description: params.description || params.title,
          quantity: 1,
          unit_price: params.amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: params.payerEmail,
        name: params.payerName,
      },
      back_urls: {
        success: `${frontendUrl}/client/orders/${params.orderId}?payment=success`,
        failure: `${frontendUrl}/client/orders/${params.orderId}?payment=failure`,
        pending: `${frontendUrl}/client/orders/${params.orderId}?payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${backendUrl}/api/payments/webhook`,
      external_reference: params.externalReference,
      statement_descriptor: "FAZTUDO",
    },
  });

  return {
    preferenceId: response.id!,
    initPoint: response.init_point!,
    sandboxInitPoint: response.sandbox_init_point!,
  };
}

/**
 * Fetches a payment from MercadoPago by its ID to verify status.
 */
export async function getMPPaymentStatus(mpPaymentId: string) {
  const payment = getPaymentClient();
  const response = await payment.get({ id: mpPaymentId });
  return {
    id: response.id,
    status: response.status,
    statusDetail: response.status_detail,
    externalReference: response.external_reference,
    transactionAmount: response.transaction_amount,
    paymentMethodId: response.payment_method_id,
    payerEmail: response.payer?.email,
    dateApproved: response.date_approved,
  };
}
```

**Step 2: Refactor createPayment controller**

Replace the `createPayment` function in `backend/src/controllers/service/paymentController.ts`:

```typescript
// At top, add import:
import { createPaymentPreference } from "../../services/mercadopagoService";

// Replace createPayment body — after all validation, instead of directly creating HELD payment:
export const createPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create payments"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const { paymentMethod }: CreatePaymentBody = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!paymentMethod) {
      res.status(400).json(errorResponse("Payment method is required"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        professional: true,
        client: true,
        serviceListing: true,
        payments: {
          where: {
            status: { in: ["PENDING", "HELD"] },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("You don't have permission to pay for this order"));
      return;
    }

    if (serviceOrder.status !== "PENDING" && serviceOrder.status !== "ACCEPTED") {
      res.status(400).json(errorResponse(`Payment cannot be processed. Order status: ${serviceOrder.status}`));
      return;
    }

    if (serviceOrder.payments.length > 0) {
      res.status(400).json(errorResponse("There is already an active payment for this order"));
      return;
    }

    // Calcular taxa da plataforma
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;

    // Criar preferência MercadoPago
    const externalReference = `order-${orderId}-${Date.now()}`;

    let mpPreference: any = null;
    try {
      mpPreference = await createPaymentPreference({
        orderId,
        title: serviceOrder.title,
        description: serviceOrder.description || serviceOrder.title,
        amount: serviceOrder.price,
        payerEmail: serviceOrder.client.email,
        payerName: serviceOrder.client.name,
        externalReference,
      });
    } catch (mpError) {
      console.error("MercadoPago preference creation failed:", mpError);
      // Fallback: create payment record without MP (for development)
      if (env.NODE_ENV !== "production") {
        console.warn("⚠️ MercadoPago unavailable — creating local payment record");
      } else {
        res.status(502).json(errorResponse("Payment gateway unavailable. Try again later.", 502));
        return;
      }
    }

    // Criar pagamento PENDING (será atualizado via webhook quando MP confirmar)
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: mpPreference ? "PENDING" : "HELD", // PENDING if MP, HELD if fallback
        paymentMethod,
        transactionId: mpPreference?.preferenceId || null,
        metadata: {
          externalReference,
          preferenceId: mpPreference?.preferenceId || null,
          initPoint: mpPreference?.initPoint || null,
          sandboxInitPoint: mpPreference?.sandboxInitPoint || null,
          platformFee,
          professionalAmount,
          platformFeePercentage,
        },
        paidAt: mpPreference ? null : now, // Only set paidAt if fallback (no MP)
        heldUntil: mpPreference ? null : heldUntil,
        serviceOrderId: orderId,
        clientId: req.user.id,
        professionalId: serviceOrder.professionalId || undefined,
      },
      include: {
        serviceOrder: { select: { title: true, price: true } },
        client: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
      },
    });

    // Se fallback (sem MP), criar transação e notificar
    if (!mpPreference) {
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: serviceOrder.price,
          description: `Payment for order #${orderId}: ${serviceOrder.title}`,
          balanceBefore: 0,
          balanceAfter: 0,
          userId: req.user.id,
          paymentId: payment.id,
        },
      });

      if (serviceOrder.professionalId) {
        await createNotification(
          serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "Pagamento recebido",
          `Pagamento de R$${serviceOrder.price.toFixed(2)} recebido para "${serviceOrder.title}"`,
          orderId,
          { amount: serviceOrder.price, platformFee, professionalAmount },
        );
      }
    }

    res.status(201).json(
      successResponse(
        {
          payment,
          checkout: mpPreference
            ? {
                preferenceId: mpPreference.preferenceId,
                checkoutUrl: env.MP_SANDBOX
                  ? mpPreference.sandboxInitPoint
                  : mpPreference.initPoint,
              }
            : null,
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
          },
        },
        mpPreference
          ? "Payment preference created. Redirect user to checkout."
          : "Payment created successfully. Amount held in escrow.",
      ),
    );
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 3: Create MercadoPago webhook handler**

Add to `backend/src/controllers/service/paymentController.ts`:

```typescript
import { getMPPaymentStatus } from "../../services/mercadopagoService";

// Webhook do MercadoPago
export const mercadoPagoWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { type, data } = req.body;

    // MercadoPago envia notificações de diferentes tipos
    if (type !== "payment") {
      res.status(200).json({ received: true });
      return;
    }

    const mpPaymentId = data?.id;
    if (!mpPaymentId) {
      res.status(200).json({ received: true });
      return;
    }

    // Buscar status do pagamento no MercadoPago
    let mpPayment;
    try {
      mpPayment = await getMPPaymentStatus(String(mpPaymentId));
    } catch (err) {
      console.error("Failed to fetch MP payment status:", err);
      res.status(200).json({ received: true });
      return;
    }

    if (!mpPayment.externalReference) {
      res.status(200).json({ received: true });
      return;
    }

    // Extrair orderId do external_reference (formato: "order-{id}-{timestamp}")
    const refParts = mpPayment.externalReference.split("-");
    const orderId = parseInt(refParts[1], 10);

    if (isNaN(orderId)) {
      console.error("Invalid external_reference:", mpPayment.externalReference);
      res.status(200).json({ received: true });
      return;
    }

    // Buscar pagamento pendente para esta ordem
    const payment = await prisma.payment.findFirst({
      where: {
        serviceOrderId: orderId,
        status: "PENDING",
      },
      include: {
        serviceOrder: true,
      },
    });

    if (!payment) {
      res.status(200).json({ received: true });
      return;
    }

    // Processar baseado no status do MP
    if (mpPayment.status === "approved") {
      const now = new Date();
      const heldUntil = new Date();
      heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

      // Atualizar pagamento para HELD (escrow)
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "HELD",
            transactionId: String(mpPaymentId),
            paidAt: now,
            heldUntil,
            metadata: {
              ...(payment.metadata as any || {}),
              mpPaymentId,
              mpStatus: mpPayment.status,
              mpStatusDetail: mpPayment.statusDetail,
              mpPaymentMethod: mpPayment.paymentMethodId,
              mpDateApproved: mpPayment.dateApproved,
            },
          },
        }),
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: payment.amount,
            description: `Payment confirmed via MercadoPago for order #${orderId}`,
            balanceBefore: 0,
            balanceAfter: 0,
            userId: payment.clientId,
            paymentId: payment.id,
          },
        }),
      ]);

      // Notificar profissional
      if (payment.serviceOrder.professionalId) {
        const platformFee = (payment.amount * env.PLATFORM_FEE_PERCENTAGE) / 100;
        await createNotification(
          payment.serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "Pagamento confirmado",
          `Pagamento de R$${payment.amount.toFixed(2)} confirmado para "${payment.serviceOrder.title}"`,
          orderId,
          { amount: payment.amount, platformFee },
        );
      }
    } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: {
            ...(payment.metadata as any || {}),
            mpPaymentId,
            mpStatus: mpPayment.status,
            mpStatusDetail: mpPayment.statusDetail,
          },
        },
      });
    }
    // For "pending" or "in_process", we keep the payment as PENDING

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("MercadoPago webhook error:", error);
    // Always return 200 to MP to avoid retries on our errors
    res.status(200).json({ received: true });
  }
};
```

**Step 4: Add webhook route**

Add to `backend/src/routes/serviceRoutes.ts` before the export:

```typescript
// ============================================
// MERCADOPAGO WEBHOOK (público — validado por assinatura)
// ============================================

router.post(
  "/payments/webhook",
  serviceController.mercadoPagoWebhook,
);
```

Also add `mercadoPagoWebhook` to the imports from `serviceController`.

**Step 5: Export webhook from controller index**

Modify `backend/src/controllers/service/index.ts` to export `mercadoPagoWebhook` from `paymentController.ts`.

**Step 6: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/src/services/mercadopagoService.ts backend/src/controllers/service/paymentController.ts backend/src/controllers/service/index.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: integrate MercadoPago Checkout Pro for payments

Creates MP preference on payment creation, returns checkout URL.
Webhook handler processes approved/rejected/pending notifications.
Fallback to local escrow in development when MP is unavailable."
```

---

### Task 4: Frontend MercadoPago Checkout Integration

**Files:**
- Modify: `frontend/src/services/serviceService.ts` (update createPayment response handling)
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (redirect to MP checkout)
- Modify: `frontend/src/types/index.ts` (add checkout types)

**Step 1: Add checkout types**

Add to `frontend/src/types/index.ts` in the API section:

```typescript
export interface CheckoutResponse {
  payment: Payment;
  checkout: {
    preferenceId: string;
    checkoutUrl: string;
  } | null;
  feeBreakdown: {
    totalAmount: number;
    platformFeePercentage: number;
    platformFee: number;
    professionalAmount: number;
  };
}
```

**Step 2: Update createPayment service to return checkout URL**

Modify `frontend/src/services/serviceService.ts` — update `createPayment`:

```typescript
import { CheckoutResponse } from "../types";

export const createPayment = async (
  orderId: number,
  paymentMethod: string,
): Promise<CheckoutResponse> => {
  const response = await api.post<ApiResponse<CheckoutResponse>>(
    `/services/orders/${orderId}/payments`,
    { paymentMethod },
  );
  return extractData(response);
};
```

**Step 3: Update OrderDetails to redirect to MercadoPago**

In `frontend/src/pages/orders/OrderDetails.tsx`, modify the payment button handler:

Replace the `handleAction(() => createPayment(order.id, paymentMethod))` call with:

```typescript
const handlePayment = async () => {
  try {
    setActionLoading(true);
    setError(null);
    const result = await createPayment(order.id, paymentMethod);
    if (result.checkout?.checkoutUrl) {
      // Redirect to MercadoPago checkout
      window.location.href = result.checkout.checkoutUrl;
    } else {
      // Fallback: payment processed locally
      await loadOrder();
      toast.success("Pagamento realizado com sucesso!");
    }
  } catch (err: any) {
    const msg = err?.response?.data?.message || "Erro ao processar pagamento";
    setError(msg);
    toast.error("Erro", msg);
  } finally {
    setActionLoading(false);
  }
};
```

Update the payment button onClick to use `handlePayment` instead of `handleAction`.

**Step 4: Handle payment return query params**

Add to the `useEffect` in OrderDetails:

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");
  if (paymentStatus === "success") {
    toast.success("Pagamento aprovado! Aguardando confirmação.");
  } else if (paymentStatus === "failure") {
    toast.error("Pagamento", "Pagamento não foi aprovado. Tente novamente.");
  } else if (paymentStatus === "pending") {
    toast.info("Pagamento pendente. Você será notificado quando for confirmado.");
  }
  // Clean URL params
  if (paymentStatus) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);
```

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/types/index.ts frontend/src/services/serviceService.ts frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: frontend MercadoPago checkout redirect

Redirects client to MP Checkout Pro on payment creation.
Handles return URLs with success/failure/pending toast messages."
```

---

## Phase 2: Smart Order Brief System (Novo Pedido)

### Task 5: Schema Migration — Add Brief Fields to ServiceOrder + New OrderBrief Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add new models and fields to schema.prisma**

Add after the `ServiceOrder` model:

```prisma
model OrderBrief {
  id             Int      @id @default(autoincrement())
  serviceOrderId Int      @unique
  categoryId     Int?
  urgencyLevel   String   @default("NORMAL") // LOW, NORMAL, HIGH, URGENT
  priceRangeMin  Float?
  priceRangeMax  Float?
  briefData      Json     // Category-specific form data as JSON
  mediaUrls      Json?    // Array of photo/video URLs
  notes          String?

  serviceOrder ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  category     ServiceCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceOrderId])
  @@index([categoryId])
}
```

Add relation to `ServiceOrder`:
```prisma
  brief         OrderBrief?
```

Add relation to `ServiceCategory`:
```prisma
  orderBriefs   OrderBrief[]
```

Also add a `Proposal` model for the proposal comparator:

```prisma
model Proposal {
  id              Int      @id @default(autoincrement())
  serviceOrderId  Int
  professionalId  Int
  price           Float
  estimatedDays   Int?
  estimatedHours  Int?
  description     String
  guaranteeDays   Int?     // Warranty period in days
  status          String   @default("PENDING") // PENDING, ACCEPTED, REJECTED, WITHDRAWN
  metadata        Json?

  serviceOrder ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  professional User         @relation("ProposalProfessional", fields: [professionalId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([serviceOrderId, professionalId])
  @@index([serviceOrderId])
  @@index([professionalId])
  @@index([status])
}
```

Add relation to `User`:
```prisma
  proposals          Proposal[] @relation("ProposalProfessional")
```

Add relation to `ServiceOrder`:
```prisma
  proposals     Proposal[]
```

Also add a `ProfessionalSchedule` model:

```prisma
model ProfessionalSchedule {
  id              Int      @id @default(autoincrement())
  professionalId  Int
  dayOfWeek       Int      // 0=Sunday, 6=Saturday
  startTime       String   // "08:00"
  endTime         String   // "18:00"
  isAvailable     Boolean  @default(true)

  professional User @relation("ProfessionalSchedule", fields: [professionalId], references: [id], onDelete: Cascade)

  @@unique([professionalId, dayOfWeek])
  @@index([professionalId])
}

model ScheduleBlock {
  id              Int      @id @default(autoincrement())
  professionalId  Int
  startDateTime   DateTime
  endDateTime     DateTime
  reason          String?  // "Pedido #123", "Folga", etc.
  serviceOrderId  Int?

  professional   User          @relation("ScheduleBlocks", fields: [professionalId], references: [id], onDelete: Cascade)
  serviceOrder   ServiceOrder? @relation(fields: [serviceOrderId], references: [id], onDelete: SetNull)

  @@index([professionalId])
  @@index([startDateTime, endDateTime])
}
```

Add relations to `User`:
```prisma
  schedule           ProfessionalSchedule[] @relation("ProfessionalSchedule")
  scheduleBlocks     ScheduleBlock[]        @relation("ScheduleBlocks")
```

Add relation to `ServiceOrder`:
```prisma
  scheduleBlock ScheduleBlock?
```

Also add a `Dispute` model:

```prisma
model Dispute {
  id              Int      @id @default(autoincrement())
  serviceOrderId  Int
  initiatorId     Int
  reason          String
  description     String
  status          String   @default("OPEN") // OPEN, UNDER_REVIEW, RESOLVED, CLOSED
  resolution      String?
  attachments     Json?    // Array of file URLs
  metadata        Json?

  serviceOrder ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  initiator    User         @relation("DisputeInitiator", fields: [initiatorId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([serviceOrderId])
  @@index([initiatorId])
  @@index([status])
}
```

Add relations to `User`:
```prisma
  disputesInitiated  Dispute[] @relation("DisputeInitiator")
```

Add to `ServiceOrder`:
```prisma
  disputes      Dispute[]
```

**Step 2: Run migration**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`

**Step 3: Regenerate Prisma client**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma generate`

**Step 4: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/prisma/schema.prisma
git commit -m "feat: add OrderBrief, Proposal, Schedule, Dispute models

Extends schema for intelligent briefs, proposal comparison,
professional scheduling, and dispute resolution system."
```

---

### Task 6: Backend — Smart Brief API (Create Order with Brief)

**Files:**
- Create: `backend/src/controllers/service/briefController.ts`
- Modify: `backend/src/controllers/service/index.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`
- Modify: `backend/src/middleware/validation.ts` (add schemas)

**Step 1: Create brief controller**

Create `backend/src/controllers/service/briefController.ts`:

```typescript
import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";

const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

// Category-specific brief templates
const BRIEF_TEMPLATES: Record<string, { fields: { name: string; label: string; type: string; required: boolean; options?: string[] }[] }> = {
  eletrica: {
    fields: [
      { name: "serviceType", label: "Tipo de serviço", type: "select", required: true, options: ["Instalação", "Reparo", "Troca", "Inspeção", "Projeto"] },
      { name: "area", label: "Área (m²)", type: "number", required: false },
      { name: "hasBlueprint", label: "Possui planta?", type: "boolean", required: false },
      { name: "details", label: "Descreva o problema/necessidade", type: "textarea", required: true },
    ],
  },
  design: {
    fields: [
      { name: "designType", label: "Tipo de design", type: "select", required: true, options: ["Logo", "Identidade Visual", "UI/UX", "Material Impresso", "Social Media"] },
      { name: "hasReferences", label: "Tem referências?", type: "boolean", required: false },
      { name: "deadline", label: "Prazo desejado (dias)", type: "number", required: false },
      { name: "details", label: "Briefing do projeto", type: "textarea", required: true },
    ],
  },
  limpeza: {
    fields: [
      { name: "propertyType", label: "Tipo de imóvel", type: "select", required: true, options: ["Casa", "Apartamento", "Escritório", "Comércio", "Galpão"] },
      { name: "area", label: "Área (m²)", type: "number", required: true },
      { name: "rooms", label: "Número de cômodos", type: "number", required: false },
      { name: "frequency", label: "Frequência", type: "select", required: false, options: ["Única vez", "Semanal", "Quinzenal", "Mensal"] },
      { name: "details", label: "Observações", type: "textarea", required: false },
    ],
  },
  default: {
    fields: [
      { name: "details", label: "Descreva o serviço desejado", type: "textarea", required: true },
    ],
  },
};

// GET /api/services/briefs/templates/:categorySlug
export const getBriefTemplate = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { categorySlug } = req.params;
    const template = BRIEF_TEMPLATES[categorySlug.toLowerCase()] || BRIEF_TEMPLATES.default;
    res.status(200).json(successResponse({ template, categorySlug }));
  } catch (error) {
    console.error("Get brief template error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/with-brief — Create order + brief in one shot
export const createOrderWithBrief = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create orders"));
      return;
    }

    const {
      title,
      description,
      categoryId,
      urgencyLevel,
      priceRangeMin,
      priceRangeMax,
      briefData,
      mediaUrls,
      notes,
      addressId,
      addressNotes,
      scheduledDate,
      serviceListingId,
    } = req.body;

    if (!title) {
      res.status(400).json(errorResponse("Title is required"));
      return;
    }

    // Verificar categoria
    let category = null;
    if (categoryId) {
      category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        res.status(404).json(errorResponse("Category not found"));
        return;
      }
    }

    // Verificar endereço
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId: req.user.id },
      });
      if (!address) {
        res.status(404).json(errorResponse("Address not found"));
        return;
      }
    }

    // Se serviceListingId fornecido, vincular ao profissional
    let professionalId: number | null = null;
    let price = 0;
    if (serviceListingId) {
      const listing = await prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
      });
      if (listing) {
        professionalId = listing.professionalId;
        price = listing.price;
      }
    }

    // Use faixa de preço se disponível
    if (!price && priceRangeMin) {
      price = priceRangeMin;
    }

    // Calcular deadline
    const deadlineDays = urgencyLevel === "URGENT" ? 1 : urgencyLevel === "HIGH" ? 3 : 7;
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);

    // Criar order + brief numa transação
    const result = await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          title,
          description: description || notes || null,
          price,
          status: "PENDING",
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          deadlineDays,
          deadlineDate,
          clientId: req.user!.id,
          professionalId,
          serviceListingId: serviceListingId || null,
          addressId: addressId || null,
          addressNotes: addressNotes || null,
        },
      });

      const orderBrief = await tx.orderBrief.create({
        data: {
          serviceOrderId: serviceOrder.id,
          categoryId: categoryId || null,
          urgencyLevel: urgencyLevel || "NORMAL",
          priceRangeMin: priceRangeMin || null,
          priceRangeMax: priceRangeMax || null,
          briefData: briefData || {},
          mediaUrls: mediaUrls || [],
          notes: notes || null,
        },
      });

      return { serviceOrder, orderBrief };
    });

    // Notificar profissional se atribuído
    if (professionalId) {
      await prisma.notification.create({
        data: {
          userId: professionalId,
          type: NotificationType.ORDER_CREATED,
          title: "Novo pedido recebido",
          message: `Novo pedido "${title}" de ${req.user.name}`,
          serviceOrderId: result.serviceOrder.id,
          metadata: { clientId: req.user.id, urgencyLevel },
        },
      });
    }

    res.status(201).json(successResponse(result, "Order with brief created successfully"));
  } catch (error) {
    console.error("Create order with brief error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 2: Export from controller index and add routes**

Add to `backend/src/controllers/service/index.ts`:
```typescript
export { getBriefTemplate, createOrderWithBrief } from "./briefController";
```

Add routes to `backend/src/routes/serviceRoutes.ts`:
```typescript
// Brief templates
router.get("/briefs/templates/:categorySlug", serviceController.getBriefTemplate);

// Create order with brief
router.post(
  "/orders/with-brief",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  serviceController.createOrderWithBrief,
);
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/src/controllers/service/briefController.ts backend/src/controllers/service/index.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: smart brief API with category-specific templates

Category-aware brief forms (eletrica, design, limpeza, etc.)
with urgency levels, price ranges, and media uploads."
```

---

### Task 7: Frontend — "Novo Pedido" Page with Smart Brief

**Files:**
- Create: `frontend/src/pages/client/NewOrder.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/services/serviceService.ts` (add API calls)
- Modify: `frontend/src/components/Layout.tsx` (add CTA button)

**Step 1: Add service functions**

Add to `frontend/src/services/serviceService.ts`:

```typescript
// Brief templates
export const getBriefTemplate = async (categorySlug: string): Promise<any> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/briefs/templates/${categorySlug}`,
  );
  return extractData(response);
};

// Create order with brief
export const createOrderWithBrief = async (data: {
  title: string;
  description?: string;
  categoryId?: number;
  urgencyLevel?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  briefData?: Record<string, any>;
  mediaUrls?: string[];
  notes?: string;
  addressId?: number;
  addressNotes?: string;
  scheduledDate?: string;
  serviceListingId?: number;
}): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    "/services/orders/with-brief",
    data,
  );
  return extractData(response);
};
```

**Step 2: Create NewOrder page**

Create `frontend/src/pages/client/NewOrder.tsx` — this is a multi-step wizard with:
1. Category selection (grid of category cards)
2. Dynamic brief form based on selected category
3. Media upload, address selection, urgency level
4. Price range estimator
5. Review & submit

This is a large component (~400 lines). The implementor should use the `frontend-design` skill for the UI. Key features:
- Step indicator ("stepper" component)
- Category grid using existing `CategoryGrid` pattern
- Dynamic form rendered from `getBriefTemplate` API response
- Urgency selector: "Normal", "Alta", "Urgente" with colored badges
- Price range slider or min/max inputs
- Address picker from user's saved addresses
- Final review card showing all selected options

**Step 3: Add route to App.tsx**

Add import and route:
```typescript
import NewOrder from "./pages/client/NewOrder";

// Inside client routes:
<Route path="orders/new" element={<NewOrder />} />
```

**Step 4: Add "Pedir Serviço" CTA to header**

In `frontend/src/components/Layout.tsx`, add after the logo in the header:

```tsx
{isAuthenticated && isClient && (
  <Link
    to="/client/orders/new"
    className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-primary text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all no-underline"
  >
    <FileText size={16} />
    Pedir Serviço
  </Link>
)}
```

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/client/NewOrder.tsx frontend/src/App.tsx frontend/src/services/serviceService.ts frontend/src/components/Layout.tsx
git commit -m "feat: 'Novo Pedido' multi-step wizard with smart brief

Category-aware form, urgency levels, price estimation,
media upload placeholder, CTA button always visible in header."
```

---

## Phase 3: Proposal Comparator

### Task 8: Backend — Proposal CRUD API

**Files:**
- Create: `backend/src/controllers/service/proposalController.ts`
- Modify: `backend/src/controllers/service/index.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`

**Step 1: Create proposal controller**

Create `backend/src/controllers/service/proposalController.ts` with:
- `createProposal` — Professional submits proposal for an open order
- `getOrderProposals` — Client/professional fetches proposals for an order
- `acceptProposal` — Client accepts a proposal (updates order price + assigns professional)
- `rejectProposal` — Client rejects a proposal
- `withdrawProposal` — Professional withdraws their proposal

Each proposal includes: price, estimatedDays, estimatedHours, description, guaranteeDays.

**Step 2: Add routes**

```typescript
router.post("/orders/:orderId/proposals", verifyToken, requireRole("PROFESSIONAL"), requireVerified, serviceController.createProposal);
router.get("/orders/:orderId/proposals", verifyToken, serviceController.getOrderProposals);
router.post("/orders/:orderId/proposals/:proposalId/accept", verifyToken, requireRole("CLIENT"), serviceController.acceptProposal);
router.post("/orders/:orderId/proposals/:proposalId/reject", verifyToken, requireRole("CLIENT"), serviceController.rejectProposal);
router.post("/orders/:orderId/proposals/:proposalId/withdraw", verifyToken, requireRole("PROFESSIONAL"), serviceController.withdrawProposal);
```

**Step 3: Commit**

```bash
git add backend/src/controllers/service/proposalController.ts backend/src/controllers/service/index.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: proposal CRUD — create, compare, accept, reject, withdraw"
```

---

### Task 9: Frontend — Proposal Comparison UI

**Files:**
- Create: `frontend/src/components/orders/ProposalComparator.tsx`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Modify: `frontend/src/services/serviceService.ts`

**Step 1: Add proposal API functions**

Add to `serviceService.ts`:
```typescript
export const getProposals = async (orderId: number): Promise<any[]> => { ... };
export const createProposal = async (orderId: number, data: any): Promise<any> => { ... };
export const acceptProposal = async (orderId: number, proposalId: number): Promise<any> => { ... };
export const rejectProposal = async (orderId: number, proposalId: number): Promise<any> => { ... };
```

**Step 2: Create ProposalComparator component**

`ProposalComparator.tsx` — Side-by-side comparison table:
- Columns: Price, Prazo, Nota, Distância, Garantias, Últimos Jobs
- Highlight badges: "Melhor custo-benefício" (green), "Mais rápido" (blue), "Melhor avaliado" (gold)
- Accept/Reject buttons per proposal
- Responsive: stack on mobile, table on desktop

**Step 3: Integrate into OrderDetails**

Add ProposalComparator section to OrderDetails when order status is PENDING and has proposals.

**Step 4: Commit**

```bash
git add frontend/src/components/orders/ProposalComparator.tsx frontend/src/pages/orders/OrderDetails.tsx frontend/src/services/serviceService.ts
git commit -m "feat: proposal comparison UI with best-value/fastest/top-rated badges"
```

---

## Phase 4: Professional Schedule & Real-Time Availability

### Task 10: Backend — Schedule API

**Files:**
- Create: `backend/src/controllers/service/scheduleController.ts`
- Modify: `backend/src/controllers/service/index.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`

**Step 1: Create schedule controller**

Endpoints:
- `GET /api/services/professionals/:id/schedule` — Get availability grid
- `PUT /api/services/professionals/schedule` — Set weekly schedule (professional)
- `GET /api/services/professionals/:id/available-slots?date=YYYY-MM-DD` — Get available time slots
- `POST /api/services/orders/:id/reschedule` — Reschedule an order

**Step 2: Add routes and commit**

```bash
git add backend/src/controllers/service/scheduleController.ts backend/src/controllers/service/index.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: professional schedule API with availability slots and reschedule"
```

---

### Task 11: Frontend — Availability Calendar & Reschedule

**Files:**
- Create: `frontend/src/components/orders/AvailabilityCalendar.tsx`
- Create: `frontend/src/components/orders/RescheduleModal.tsx`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx` (show availability)
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (reschedule button)

**Step 1: Build AvailabilityCalendar**

Week-view calendar showing available slots. Green = available, gray = busy. Click to select.

**Step 2: Build RescheduleModal**

Modal with: reason picker, new date/time selection via AvailabilityCalendar, confirm button.

**Step 3: Commit**

```bash
git add frontend/src/components/orders/AvailabilityCalendar.tsx frontend/src/components/orders/RescheduleModal.tsx frontend/src/pages/services/ServiceDetails.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: availability calendar and self-service reschedule"
```

---

## Phase 5: Enhanced Order Tracking, Chat & Disputes

### Task 12: Backend — Dispute API

**Files:**
- Create: `backend/src/controllers/service/disputeController.ts`
- Modify: `backend/src/controllers/service/index.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`

**Step 1: Create dispute controller**

Endpoints:
- `POST /api/services/orders/:orderId/disputes` — Open dispute (reason + description + attachments)
- `GET /api/services/orders/:orderId/disputes` — Get disputes for order

**Step 2: Commit**

```bash
git add backend/src/controllers/service/disputeController.ts backend/src/controllers/service/index.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: dispute API with contextual reasons and attachments"
```

---

### Task 13: Backend — Chat Content Filtering Middleware

**Files:**
- Create: `backend/src/middleware/chatFilter.ts`
- Modify: `backend/src/controllers/service/messageController.ts`

**Step 1: Create chat filter**

`chatFilter.ts` — Middleware/utility that:
- Blocks phone numbers (regex: `\d{2}[\s.-]?\d{4,5}[\s.-]?\d{4}`)
- Blocks emails (regex for @domain patterns)
- Blocks social media handles (@username, instagram.com, facebook.com, etc.)
- Blocks CPF/CNPJ patterns
- Returns sanitized message + list of blocked content types

**Step 2: Apply filter in sendMessage controller**

Before saving message, run through `chatFilter`. If blocked content detected, return 400 with explanation of what was blocked and why.

**Step 3: Commit**

```bash
git add backend/src/middleware/chatFilter.ts backend/src/controllers/service/messageController.ts
git commit -m "feat: chat content filter — blocks phone, email, social, CPF/CNPJ"
```

---

### Task 14: Frontend — Enhanced Order Tracking Page

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Create: `frontend/src/components/orders/OrderTimeline.tsx`
- Create: `frontend/src/components/orders/DisputeModal.tsx`

**Step 1: Extract OrderTimeline component**

Move the timeline logic from OrderDetails into a dedicated `OrderTimeline.tsx` with:
- Stepper format with color coding: green (on time), yellow (near deadline), red (overdue)
- SLA indicator showing time remaining
- Each step shows date + attachments if any

**Step 2: Create DisputeModal**

Modal with:
- Reason picker (predefined options: "Serviço não entregue", "Qualidade insatisfatória", "Profissional não compareceu", "Outro")
- Description textarea
- File attachment upload area
- Submit button

**Step 3: Integrate into OrderDetails**

Add "Abrir Disputa" button (contextual — only shows when order is IN_PROGRESS or AWAITING_CLIENT_CONFIRMATION).

**Step 4: Commit**

```bash
git add frontend/src/components/orders/OrderTimeline.tsx frontend/src/components/orders/DisputeModal.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: enhanced order tracking with SLA timeline and dispute button"
```

---

## Phase 6: Post-Service & UI Polish

### Task 15: Frontend — Enhanced Review System with Criteria

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (review section)

**Step 1: Enhance review form**

Replace the single rating with 3 criteria:
- **Qualidade** (star rating 1-5)
- **Pontualidade** (star rating 1-5)
- **Comunicação** (star rating 1-5)

Overall rating = average of 3. Comment field remains.

Add "Recontratar" button (1-click reorder) that:
- Calls `createOrder` with same serviceListingId
- Navigates to new order page

**Step 2: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: multi-criteria review (quality, punctuality, communication) + re-hire"
```

---

### Task 16: Frontend — Trust Signal Cards for Professionals

**Files:**
- Modify: `frontend/src/components/services/ServiceCard.tsx`
- Modify: `frontend/src/components/common/TrustBadge.tsx`

**Step 1: Enhance ServiceCard with trust signals**

Add to each professional card:
- Verified badge (checkmark icon) if `isVerified`
- Completion rate: "98% concluídos"
- Average response time: "Responde em ~2h"
- Price display: "R$50-150/serviço" or "A partir de R$X"

**Step 2: Commit**

```bash
git add frontend/src/components/services/ServiceCard.tsx frontend/src/components/common/TrustBadge.tsx
git commit -m "feat: trust signal cards — verified badge, completion rate, response time"
```

---

## Phase 7: Final Integration & Smoke Test

### Task 17: Full Integration Test

**Files:**
- Test: `backend/tests/integration/orderFlow.test.ts`

**Step 1: Write integration test**

Test the complete flow:
1. Client creates order with brief
2. Professional creates proposal
3. Client compares proposals and accepts one
4. Client creates payment (MP preference or fallback)
5. Professional accepts, starts, completes
6. Client confirms completion
7. Payment released
8. Both parties leave reviews

**Step 2: Run all tests**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add backend/tests/integration/orderFlow.test.ts
git commit -m "test: full order lifecycle integration test"
```

---

### Task 18: Build & Smoke Test Frontend

**Step 1: Build frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 2: Manual smoke test checklist**

- [ ] Login works (bug fix verified)
- [ ] Service search loads without crash
- [ ] "Pedir Serviço" CTA visible in header for clients
- [ ] New order wizard loads with category selection
- [ ] Order details page loads with timeline
- [ ] Payment button redirects to MP checkout (or creates fallback)
- [ ] Chat sends messages (with filter working)
- [ ] Review form shows 3 criteria

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: build verification and smoke test pass"
```

---

Plan complete and saved to `docs/plans/2026-02-14-faztudo-client-features-mercadopago-bugfix.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
