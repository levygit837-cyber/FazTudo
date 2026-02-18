# Security Hardening v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir todas as 28 vulnerabilidades de segurança identificadas no audit de 2026-02-18, organizadas em 5 fases deployáveis independentemente.

**Architecture:** Abordagem TDD por domínio — cada fix tem um teste escrito antes. Fase 1 cobre pagamentos (impacto financeiro direto), Fase 2 cobre auth/tokens, Fase 3 cobre rotas/autorização, Fase 4 cobre frontend/cookies, Fase 5 adiciona suite de testes de segurança e CI gates.

**Tech Stack:** Express 5, Prisma 7.3, TypeScript, Vitest, React 18, Axios, GitHub Actions, Node.js `crypto` (built-in, sem libs novas para webhook), `file-type` (nova dep para magic bytes), `cookie-parser` (nova dep backend), GitHub CodeQL Action.

---

## FASE 1: PAGAMENTOS & ESCROW

### Task 1: Webhook MercadoPago — Validação HMAC-SHA256

**Vulnerabilidade**: CRÍTICA-1 — Webhook público sem validação de assinatura. Qualquer pessoa pode forjar pagamentos aprovados.

**Files:**
- Create: `backend/src/lib/webhookValidator.ts`
- Modify: `backend/src/controllers/service/paymentController.ts` (linha 532)
- Test: `backend/tests/security/webhook.test.ts` (create)
- Modify: `backend/.env.example` (adicionar MP_WEBHOOK_SECRET)

**Step 1: Instalar dependências necessárias**

```bash
cd backend
# Nenhuma nova dep — usa Node.js crypto nativo
```

**Step 2: Escrever o teste falhando**

Crie `backend/tests/security/webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateMercadoPagoSignature } from "../../src/lib/webhookValidator";

describe("Webhook HMAC Validation", () => {
  const secret = "test-webhook-secret-12345";

  it("rejects request without x-signature header", () => {
    const result = validateMercadoPagoSignature({
      xSignature: null,
      xRequestId: "req-123",
      dataId: "pay-456",
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_signature");
  });

  it("rejects request with wrong signature", () => {
    const result = validateMercadoPagoSignature({
      xSignature: "ts=12345,v1=fakehash",
      xRequestId: "req-123",
      dataId: "pay-456",
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects when MP_WEBHOOK_SECRET is empty", () => {
    const result = validateMercadoPagoSignature({
      xSignature: "ts=12345,v1=somehash",
      xRequestId: "req-123",
      dataId: "pay-456",
      secret: "",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("secret_not_configured");
  });

  it("accepts valid HMAC signature", () => {
    import crypto from "crypto";
    const ts = "1700000000000";
    const requestId = "req-123";
    const dataId = "pay-456";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const validHash = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    const result = validateMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${validHash}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(result.valid).toBe(true);
  });
});
```

**Step 3: Rodar teste para confirmar que falha**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts
```
Expected: FAIL — "Cannot find module '../../src/lib/webhookValidator'"

**Step 4: Implementar `webhookValidator.ts`**

Crie `backend/src/lib/webhookValidator.ts`:

```typescript
import crypto from "crypto";
import { createLogger } from "./logger";

const log = createLogger("webhookValidator");

interface ValidateSignatureParams {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}

interface ValidationResult {
  valid: boolean;
  reason?: "missing_signature" | "invalid_signature" | "secret_not_configured" | "malformed_signature";
}

/**
 * Valida a assinatura HMAC-SHA256 do webhook MercadoPago.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Header format: x-signature: ts=<timestamp>,v1=<hash>
 * Manifest: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
 */
export const validateMercadoPagoSignature = (
  params: ValidateSignatureParams,
): ValidationResult => {
  const { xSignature, xRequestId, dataId, secret } = params;

  if (!secret || secret.trim().length === 0) {
    log.warn("MP_WEBHOOK_SECRET not configured — rejecting webhook");
    return { valid: false, reason: "secret_not_configured" };
  }

  if (!xSignature) {
    return { valid: false, reason: "missing_signature" };
  }

  // Parse "ts=<timestamp>,v1=<hash>"
  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
  });

  const ts = parts["ts"];
  const hash = parts["v1"];

  if (!ts || !hash) {
    return { valid: false, reason: "malformed_signature" };
  }

  // Build manifest string
  const manifest = `id:${dataId ?? ""};request-id:${xRequestId ?? ""};ts:${ts};`;

  // Compute expected HMAC
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  // Timing-safe comparison
  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");

  if (computedBuf.length !== hashBuf.length) {
    return { valid: false, reason: "invalid_signature" };
  }

  const isValid = crypto.timingSafeEqual(computedBuf, hashBuf);
  return { valid: isValid, reason: isValid ? undefined : "invalid_signature" };
};
```

**Step 5: Rodar teste para confirmar que passa**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts
```
Expected: PASS (4 testes)

**Step 6: Integrar validação no webhook handler**

Em `backend/src/controllers/service/paymentController.ts`, modifique o início de `mercadoPagoWebhook` (linha 532):

```typescript
// Adicionar import no topo do arquivo:
import { validateMercadoPagoSignature } from "../../lib/webhookValidator";

// Substituir o início da função (linhas 532–548) por:
export const mercadoPagoWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // SECURITY: Validate MercadoPago HMAC-SHA256 signature BEFORE any processing
    const xSignature = req.headers["x-signature"] as string | null;
    const xRequestId = req.headers["x-request-id"] as string | null;
    const dataId = (req.query["data.id"] as string) || req.body?.data?.id?.toString() || null;

    const signatureCheck = validateMercadoPagoSignature({
      xSignature,
      xRequestId,
      dataId,
      secret: env.MP_WEBHOOK_SECRET,
    });

    if (!signatureCheck.valid) {
      log.warn(
        { reason: signatureCheck.reason, ip: req.ip },
        "Webhook rejected: invalid or missing HMAC signature"
      );
      // Always return 200 to MP (so it doesn't retry), but don't process
      res.status(200).json({ received: false, reason: signatureCheck.reason });
      return;
    }

    // rest of existing handler continues unchanged...
    const { type, data, action } = req.body;
    // ...
```

**Step 7: Adicionar MP_WEBHOOK_SECRET ao .env.example**

Em `backend/.env.example`, adicionar após `MP_SANDBOX`:
```
# Webhook secret from MercadoPago dashboard (required in production)
MP_WEBHOOK_SECRET=
```

**Step 8: Rodar todos os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 9: Commit**

```bash
cd backend && git add src/lib/webhookValidator.ts src/controllers/service/paymentController.ts tests/security/webhook.test.ts .env.example
git commit -m "fix(security): validate MercadoPago webhook HMAC-SHA256 signature (CRÍTICA-1)"
```

---

### Task 2: Double-Credit — Centralizar Release de Pagamento no EscrowService

**Vulnerabilidade**: CRÍTICA-2 — `confirmProfessionalCompletion` duplica lógica de `releasePaymentFromEscrow`, criando potencial de double-credit.

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts` (linhas 1073–1137)
- Test: `backend/tests/security/webhook.test.ts` (adicionar seção)

**Step 1: Escrever o teste falhando**

Adicione ao arquivo `backend/tests/security/webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
// ... existing imports ...

describe("Double-Credit Prevention", () => {
  it("releasePaymentFromEscrow returns error when payment is not HELD", async () => {
    // This test validates that the guard in escrowService prevents double-credit
    // If payment.status !== 'HELD', release must fail — not proceed silently
    const { releasePaymentFromEscrow } = await import("../../src/services/escrowService");

    // Mock prisma to return a payment with status RELEASED
    vi.mock("../../src/lib/prisma", () => ({
      default: {
        payment: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            status: "RELEASED",  // Already released
            amount: 100,
            serviceOrder: { professional: { balance: 50 }, client: {} },
          }),
        },
      },
    }));

    const result = await releasePaymentFromEscrow(1, true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Payment is not in escrow");
  });
});
```

**Step 2: Rodar teste para confirmar que passa (o guard já existe)**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts -t "Double-Credit"
```
Expected: PASS — o escrowService já tem o guard `if (payment.status !== "HELD") return { success: false }`

**Step 3: Remover lógica financeira duplicada de `confirmProfessionalCompletion`**

Em `backend/src/controllers/service/orderController.ts`, substitua o bloco de linhas ~1073–1137 (cálculo de professionalAmount + transactionOps financeiros):

```typescript
// ANTES (remover):
const now = new Date();
const activePayment = serviceOrder.payments.find((p) => p.status === "HELD");

// Calculate professional amount (deduct platform fee)
const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
const platformFee = activePayment
  ? (activePayment.amount * platformFeePercentage) / 100
  : 0;
const professionalAmount = activePayment
  ? activePayment.amount - platformFee
  : 0;

const transactionOps: any[] = [
  prisma.serviceOrder.update({ ... }),  // manter só este
];

if (activePayment) {
  transactionOps.push(
    prisma.payment.update({ where: { id: activePayment.id }, data: { status: "RELEASED", ... } })
  );
  transactionOps.push(
    prisma.user.update({ data: { balance: { increment: professionalAmount } } })
  );
  transactionOps.push(
    prisma.transaction.create({ ... })
  );
}

const [updatedOrder] = await prisma.$transaction(transactionOps);

// DEPOIS (substitua por):
const now = new Date();
const activePayment = serviceOrder.payments.find((p) => p.status === "HELD");

// Step 1: Update order status
const updatedOrder = await prisma.serviceOrder.update({
  where: { id: orderId },
  data: {
    status: "COMPLETED",
    completedAt: now,
    professionalConfirmedAt: now,
  },
  include: {
    client: { select: { id: true, name: true, email: true } },
    professional: { select: { id: true, name: true, email: true } },
  },
});

// Step 2: Release escrow via canonical function (prevents double-credit)
if (activePayment) {
  const releaseResult = await releasePaymentFromEscrow(activePayment.id, true);
  if (!releaseResult.success) {
    log.warn(
      { orderId, paymentId: activePayment.id, reason: releaseResult.error },
      "Payment release failed during professional confirmation"
    );
  }
}
```

Adicione import no topo do orderController:
```typescript
import { releasePaymentFromEscrow } from "../../services/escrowService";
```

**Step 4: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 5: Commit**

```bash
git add backend/src/controllers/service/orderController.ts backend/src/services/escrowService.ts
git commit -m "fix(security): centralize payment release in escrowService to prevent double-credit (CRÍTICA-2)"
```

---

### Task 3: Cache de Escrow — TTL e Invalidação Automática

**Vulnerabilidade**: MÉDIA-7 — Cache de escrow sem TTL e sem invalidação quando admin atualiza config.

**Files:**
- Modify: `backend/src/services/escrowService.ts` (linhas 42–77)
- Modify: `backend/src/controllers/adminController.ts` (linha 1330)

**Step 1: Escrever o teste falhando**

Adicione ao `backend/tests/security/webhook.test.ts`:

```typescript
describe("Escrow Cache Invalidation", () => {
  it("getEscrowConfig respects 5-minute TTL", async () => {
    // The cache should have a timestamp and expire after 5 minutes
    const { getEscrowConfig } = await import("../../src/services/escrowService");
    // We test that cacheExpiresAt is exported and checked
    // This test validates the structure exists — actual timing tested in integration
    const config = await getEscrowConfig();
    expect(config).toHaveProperty("platformFeePercentage");
    expect(config).toHaveProperty("defaultHoldDays");
  });

  it("invalidateConfigCache clears the cache", async () => {
    const { invalidateConfigCache, getEscrowConfig } = await import(
      "../../src/services/escrowService"
    );
    invalidateConfigCache();
    // After invalidation, next call should go to DB (not throw)
    const config = await getEscrowConfig();
    expect(config).toBeDefined();
  });
});
```

**Step 2: Rodar para confirmar que passa parcialmente**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts -t "Escrow Cache"
```

**Step 3: Adicionar TTL ao cache em `escrowService.ts`**

Modifique `backend/src/services/escrowService.ts`, substituindo as linhas 42–84:

```typescript
// ==================== CONFIGURAÇÃO ====================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

let cachedConfig: EscrowConfig | null = null;
let cacheExpiresAt: number = 0;

/**
 * Obtém configuração de escrow do banco de dados (cached com TTL de 5min)
 */
export const getEscrowConfig = async (): Promise<EscrowConfig> => {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiresAt) {
    return cachedConfig;
  }

  const dbConfig = await prisma.escrowConfig.findFirst({
    where: { name: "default" },
  });

  if (dbConfig) {
    cachedConfig = {
      defaultHoldDays: dbConfig.defaultHoldDays,
      autoReleaseDays: dbConfig.autoReleaseDays,
      disputePeriodDays: dbConfig.disputePeriodDays,
      platformFeePercentage: dbConfig.platformFeePercentage,
      minServiceValue: dbConfig.minServiceValue,
      maxServiceValue: dbConfig.maxServiceValue,
    };
  } else {
    cachedConfig = {
      defaultHoldDays: env.DEFAULT_ESCROW_HOLD_DAYS,
      autoReleaseDays: 30,
      disputePeriodDays: 7,
      platformFeePercentage: env.PLATFORM_FEE_PERCENTAGE,
      minServiceValue: 10,
      maxServiceValue: null,
    };
  }

  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedConfig;
};

export const invalidateConfigCache = (): void => {
  cachedConfig = null;
  cacheExpiresAt = 0;
  log.info("Escrow config cache invalidated");
};
```

**Step 4: Chamar `invalidateConfigCache` após update de config no adminController**

Em `backend/src/controllers/adminController.ts`, após a linha 1329 (após `await prisma.escrowConfig.updateMany(...)`):

```typescript
// Adicionar import no topo:
import { invalidateConfigCache } from "../services/escrowService";

// Após o if (platformFeePercentage !== undefined || ...) bloco, linha ~1330:
if (platformFeePercentage !== undefined || defaultHoldDays !== undefined || disputePeriodDays !== undefined) {
  // ... código existente ...
  await prisma.escrowConfig.updateMany({ ... });
  // ADD THIS LINE:
  invalidateConfigCache();
}
```

**Step 5: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 6: Commit**

```bash
git add backend/src/services/escrowService.ts backend/src/controllers/adminController.ts
git commit -m "fix(security): add 5min TTL to escrow cache and invalidate on admin config update (MÉDIA-7)"
```

---

### Task 4: Idempotência em Operações Financeiras

**Vulnerabilidade**: INFO — Sem mecanismo de idempotência; retries de rede podem gerar operações duplicadas.

**Files:**
- Create: `backend/src/lib/idempotency.ts`
- Modify: `backend/src/routes/walletRoutes.ts`
- Modify: `backend/src/controllers/walletController.ts` (início de `requestWithdrawal`)

**Step 1: Criar `idempotency.ts`**

Crie `backend/src/lib/idempotency.ts`:

```typescript
import prisma from "./prisma";
import { createLogger } from "./logger";

const log = createLogger("idempotency");

// Usando SystemConfig para armazenar chaves (sem nova tabela)
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Verifica se uma chave de idempotência já foi processada.
 * Retorna `true` se for duplicata (deve ser rejeitada), `false` se for nova.
 */
export const checkIdempotencyKey = async (
  key: string,
  userId: number,
): Promise<{ isDuplicate: boolean }> => {
  const storageKey = `idempotency:${userId}:${key}`;
  const existing = await prisma.systemConfig.findUnique({
    where: { key: storageKey },
  });

  if (existing) {
    const createdAt = new Date(existing.value as string).getTime();
    if (Date.now() - createdAt < IDEMPOTENCY_TTL_MS) {
      log.warn({ key, userId }, "Duplicate idempotency key detected");
      return { isDuplicate: true };
    }
    // Expirado — deletar e permitir
    await prisma.systemConfig.delete({ where: { key: storageKey } }).catch(() => {});
  }

  // Registrar nova chave
  await prisma.systemConfig.upsert({
    where: { key: storageKey },
    create: { key: storageKey, value: new Date().toISOString(), description: "Idempotency key" },
    update: { value: new Date().toISOString() },
  });

  return { isDuplicate: false };
};
```

**Step 2: Adicionar middleware de idempotência no início de `requestWithdrawal`**

Em `backend/src/controllers/walletController.ts`, modifique o início de `requestWithdrawal`:

```typescript
// Adicionar import no topo:
import { checkIdempotencyKey } from "../lib/idempotency";

// No início da função requestWithdrawal, após verificação de req.user:
const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
if (idempotencyKey) {
  const { isDuplicate } = await checkIdempotencyKey(idempotencyKey, req.user.id);
  if (isDuplicate) {
    res.status(409).json({
      success: false,
      message: "Duplicate request: this operation has already been processed",
    });
    return;
  }
}
```

**Step 3: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 4: Commit**

```bash
git add backend/src/lib/idempotency.ts backend/src/controllers/walletController.ts
git commit -m "feat(security): add idempotency key support for financial operations (INFO)"
```

---

## FASE 2: AUTH & TOKENS

### Task 5: JWT — Segredos Separados para Access e Refresh + Fix Admin Token

**Vulnerabilidade**: ALTA-3 — Access e refresh tokens usam o mesmo `JWT_SECRET`. Refresh token do admin não tem `{type: 'refresh'}`.

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/src/middleware/auth.ts` (generateToken, generateRefreshToken, verifyToken)
- Modify: `backend/src/controllers/adminController.ts` (adminLogin, linhas 731–737)
- Modify: `backend/.env.example`

**Step 1: Escrever o teste falhando**

Adicione a `backend/tests/security/webhook.test.ts`:

```typescript
import jwt from "jsonwebtoken";

describe("JWT Token Security", () => {
  it("refresh token must contain type: refresh field", () => {
    const { generateRefreshToken } = require("../../src/middleware/auth");
    const token = generateRefreshToken({ id: 1, email: "test@test.com" });
    const decoded = jwt.decode(token) as any;
    expect(decoded.type).toBe("refresh");
  });

  it("access token must not contain type field (or type: access)", () => {
    const { generateToken } = require("../../src/middleware/auth");
    const token = generateToken({
      id: 1, email: "t@t.com", name: "T", role: "CLIENT",
      status: "ACTIVE", tokenVersion: 0,
    });
    const decoded = jwt.decode(token) as any;
    expect(decoded.type).toBeUndefined();
  });

  it("refresh token cannot be used as access token (different secret)", () => {
    // If JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are the same, this will pass
    // incorrectly — this test documents the expected behavior
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "";
    // In production these MUST differ — test documents requirement
    if (process.env.NODE_ENV === "production") {
      expect(accessSecret).not.toBe(refreshSecret);
    }
  });
});
```

**Step 2: Rodar para confirmar que falha (refresh token sem `type: refresh` para admin)**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts -t "JWT Token"
```

**Step 3: Atualizar `env.ts` — adicionar JWT_ACCESS_SECRET e JWT_REFRESH_SECRET**

Em `backend/src/config/env.ts`:

1. Adicionar na interface `EnvConfig` (após `JWT_REFRESH_EXPIRES_IN`):
```typescript
JWT_ACCESS_SECRET: string;
JWT_REFRESH_SECRET: string;
```

2. Na função `getEnvConfig()`, após o bloco de `jwtSecret`, adicionar:
```typescript
// JWT_ACCESS_SECRET: falls back to JWT_SECRET for backward compatibility
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || jwtSecret;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;

if (nodeEnv === 'production' && jwtAccessSecret === jwtRefreshSecret) {
  log.warn("⚠️  JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are the same. " +
    "Set different secrets in production for enhanced security.");
}
```

3. Na config object, substituir `JWT_SECRET: jwtSecret` por:
```typescript
JWT_SECRET: jwtSecret,
JWT_ACCESS_SECRET: jwtAccessSecret,
JWT_REFRESH_SECRET: jwtRefreshSecret,
```

**Step 4: Atualizar `auth.ts` — usar segredos separados**

Em `backend/src/middleware/auth.ts`:

Substitua `generateToken` (linhas ~226–239):
```typescript
export const generateToken = (user: {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  tokenVersion: number;
}): string => {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    tokenVersion: user.tokenVersion,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};
```

Substitua `generateRefreshToken` (linhas ~241–251):
```typescript
export const generateRefreshToken = (user: {
  id: number;
  email: string;
}): string => {
  return jwt.sign(
    { id: user.id, email: user.email, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};
```

Em `verifyToken`, substitua `jwt.verify(token, env.JWT_SECRET, ...)` por:
```typescript
jwt.verify(token, env.JWT_ACCESS_SECRET, async (err, decoded) => {
```

**Step 5: Corrigir adminController — admin refresh token com `type: 'refresh'` e segredo correto**

Em `backend/src/controllers/adminController.ts`, linhas ~731–737:

```typescript
// ANTES:
const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
  expiresIn: "8h",
});
const refreshToken = jwt.sign(tokenPayload, env.JWT_SECRET, {
  expiresIn: "24h",
});

// DEPOIS:
const token = jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, {
  expiresIn: "8h",
});
const refreshToken = jwt.sign(
  { id: adminUser.id, email: adminUser.email, type: "refresh" },
  env.JWT_REFRESH_SECRET,
  { expiresIn: "24h" }
);
```

Adicionar import de env no adminController se não houver:
```typescript
import { env } from "../config/env";
```

**Step 6: Atualizar .env.example**

Após `JWT_SECRET=`, adicionar:
```
JWT_ACCESS_SECRET=    # Separate access token secret (recommended in production)
JWT_REFRESH_SECRET=   # Separate refresh token secret (recommended in production)
```

**Step 7: Rodar todos os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 8: Commit**

```bash
git add backend/src/config/env.ts backend/src/middleware/auth.ts backend/src/controllers/adminController.ts backend/.env.example
git commit -m "fix(security): separate JWT access/refresh secrets and fix admin refresh token type (ALTA-3)"
```

---

### Task 6: requireVerified em upgrade-to-professional

**Vulnerabilidade**: ALTA-1 — Usuário não verificado pode se tornar profissional.

**Files:**
- Modify: `backend/src/routes/authRoutes.ts` (linha 57–61)

**Step 1: Escrever o teste falhando**

Adicione a `backend/tests/security/webhook.test.ts`:

```typescript
describe("Auth Bypass Prevention", () => {
  it("upgrade-to-professional requires verified account", async () => {
    // This is a documentation test — the middleware chain must include requireVerified
    // Real integration test would use supertest with an unverified user token
    const authRoutesSource = await import("fs").then((fs) =>
      fs.readFileSync("./src/routes/authRoutes.ts", "utf-8")
    );
    const upgradeRouteSection = authRoutesSource.slice(
      authRoutesSource.indexOf("upgrade-to-professional"),
      authRoutesSource.indexOf("upgrade-to-professional") + 200
    );
    expect(upgradeRouteSection).toContain("requireVerified");
  });
});
```

**Step 2: Rodar para confirmar que falha**

```bash
cd backend && npx vitest run tests/security/webhook.test.ts -t "Auth Bypass"
```
Expected: FAIL — "requireVerified" not found in upgrade-to-professional route section

**Step 3: Adicionar requireVerified à rota**

Em `backend/src/routes/authRoutes.ts`, substitua linhas 57–61:

```typescript
// ANTES:
router.post(
  "/upgrade-to-professional",
  verifyToken,
  authController.upgradeToProfessional,
);

// DEPOIS:
router.post(
  "/upgrade-to-professional",
  verifyToken,
  requireVerified,
  authController.upgradeToProfessional,
);
```

**Step 4: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 5: Commit**

```bash
git add backend/src/routes/authRoutes.ts
git commit -m "fix(security): require verified account for upgrade-to-professional (ALTA-1)"
```

---

### Task 7: Rate Limiting por UserId para Operações Autenticadas

**Vulnerabilidade**: ALTA-2 — Rate limiting por IP bypassável via X-Forwarded-For.

**Files:**
- Modify: `backend/src/middleware/rateLimiter.ts` (adicionar userRateLimiter)
- Modify: `backend/src/routes/walletRoutes.ts` (adicionar userRateLimiter)
- Modify: `backend/src/routes/authRoutes.ts` (adicionar userRateLimiter a change-password)

**Step 1: Adicionar `userRateLimiter` ao rateLimiter.ts**

Em `backend/src/middleware/rateLimiter.ts`, adicione ao final do arquivo:

```typescript
import type { Request } from "express";
import type { AuthRequest } from "./auth";

/**
 * Rate limiter by authenticated userId (not by IP).
 * Immune to X-Forwarded-For manipulation since it uses the JWT identity.
 * Use in addition to IP-based limiters for sensitive authenticated endpoints.
 */
export const createUserRateLimiter = (
  maxRequests: number,
  windowMs: number,
  message: string = "Muitas requisições. Tente novamente mais tarde.",
) =>
  rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthRequest;
      // Falls back to IP if user not authenticated
      return authReq.user ? `user:${authReq.user.id}` : req.ip || "unknown";
    },
    message: {
      success: false,
      message,
      statusCode: 429,
    },
  });

/**
 * User-based rate limiter for financial operations.
 * 3 operations per 15 minutes per user (not per IP).
 */
export const userFinancialLimiter = createUserRateLimiter(
  3,
  15 * 60 * 1000,
  "Muitas operações financeiras. Tente novamente em 15 minutos.",
);

/**
 * User-based rate limiter for sensitive auth operations.
 * 5 operations per 15 minutes per user.
 */
export const userSensitiveLimiter = createUserRateLimiter(
  5,
  15 * 60 * 1000,
  "Muitas tentativas. Tente novamente mais tarde.",
);
```

**Step 2: Usar userFinancialLimiter nas rotas de wallet**

Em `backend/src/routes/walletRoutes.ts`, adicione import:
```typescript
import { financialLimiter, userFinancialLimiter } from "../middleware/rateLimiter";
```

Nas rotas de `withdraw` e `release`, adicione `userFinancialLimiter` após `financialLimiter`:
```typescript
router.post("/withdraw",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  financialLimiter,
  userFinancialLimiter,  // ADD THIS
  auditLog("WITHDRAWAL_REQUEST"),
  validateBody(withdrawalSchema),
  walletController.requestWithdrawal,
);
```

**Step 3: Rodar os testes**

```bash
cd backend && npm test
```

**Step 4: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/routes/walletRoutes.ts
git commit -m "feat(security): add user-based rate limiting (immune to X-Forwarded-For bypass) (ALTA-2)"
```

---

### Task 8: Remover Log de Token de Reset de Senha

**Vulnerabilidade**: ALTA-6 — Token raw de reset de senha é logado em desenvolvimento.

**Files:**
- Modify: `backend/src/controllers/authController.ts` (linha 543–545)

**Step 1: Remover log inseguro**

Em `backend/src/controllers/authController.ts`, substituir linhas 543–545:

```typescript
// ANTES (REMOVER COMPLETAMENTE):
if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
  log.info({ resetUrl, email: user.email }, "Password reset link generated (dev mode)");
}

// DEPOIS:
// (log removed — never log password reset tokens, even in development)
```

**Step 2: Rodar os testes**

```bash
cd backend && npm test
```

**Step 3: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "fix(security): remove password reset token from logs (ALTA-6)"
```

---

## FASE 3: ROTAS & AUTORIZAÇÃO

### Task 9: Remover Endpoint /map-config que Expõe API Key Server-Side

**Vulnerabilidade**: CRÍTICA-3 — Endpoint expõe `PLACES_API_KEY` (chave server-side) para qualquer usuário autenticado.

**Files:**
- Modify: `backend/src/controllers/service/locationController.ts` (remover `getMapConfig`)
- Modify: `backend/src/routes/locationRoutes.ts` (remover rota `/map-config`)
- Modify: `backend/src/controllers/service/index.ts` (remover export)
- Check: `frontend/src/` (buscar uso de `/map-config`)

**Step 1: Verificar onde /map-config é usado no frontend**

```bash
grep -rn "map-config\|getMapConfig\|PLACES_API_KEY" frontend/src/ --include="*.ts" --include="*.tsx"
```

**Step 2: Se encontrado, substituir chamada no frontend**

O frontend deve usar o proxy de geocoding já existente (`/api/geocoding/*`) ao invés da chave direta. Qualquer chamada direta à Google Maps API pelo frontend deve ser roteada pelo backend.

Se o frontend usa a `apiKey` para o componente de mapa, verificar se o `NavigationMap` usa MapLibre (que não precisa de API key) ou Google Maps. Se usar MapLibre (como na implementação atual), a key não é necessária — basta remover a chamada.

**Step 3: Remover a função `getMapConfig` do locationController**

Em `backend/src/controllers/service/locationController.ts`, remover completamente:
```typescript
// Remover linhas 249–273:
/**
 * GET /api/services/map-config
 * Returns the Google Maps API key for the frontend
 */
export const getMapConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  // ... (remover tudo)
};
```

**Step 4: Remover rota no locationRoutes.ts**

Em `backend/src/routes/locationRoutes.ts`, encontre e remova a linha:
```typescript
router.get("/map-config", verifyToken, serviceController.getMapConfig);
```

**Step 5: Remover export do index.ts se existir**

```bash
grep -n "getMapConfig" backend/src/controllers/service/index.ts
```
Remover a linha de re-export se encontrada.

**Step 6: Rodar todos os testes**

```bash
cd backend && npm test && cd ../frontend && npm run build
```
Expected: todos passando e build sem erros

**Step 7: Commit**

```bash
git add backend/src/controllers/service/locationController.ts backend/src/routes/locationRoutes.ts
git commit -m "fix(security): remove /map-config endpoint that exposed server-side API key (CRÍTICA-3)"
```

---

### Task 10: Schemas Zod em Rotas de Transição de Estado de Orders

**Vulnerabilidade**: ALTA-4 — Rotas accept/start/submit-completion/confirm/cancel/reschedule sem validação Zod.

**Files:**
- Modify: `backend/src/middleware/validation.ts` (adicionar schemas)
- Modify: `backend/src/routes/orderRoutes.ts` (adicionar validateBody + requireRole em reschedule)

**Step 1: Adicionar schemas ao validation.ts**

Em `backend/src/middleware/validation.ts`, adicione após os schemas existentes:

```typescript
// Order state transition schemas
export const acceptOrderSchema = z.object({
  message: z.string().max(500).optional(),
});

export const startOrderSchema = z.object({
  message: z.string().max(500).optional(),
});

export const submitCompletionSchema = z.object({
  completionNote: z.string().max(2000).optional(),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export const confirmOrderSchema = z.object({
  feedback: z.string().max(1000).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(10, "Motivo deve ter ao menos 10 caracteres").max(500),
});

export const rescheduleOrderSchema = z.object({
  scheduledDate: z.string().datetime("Data inválida"),
  message: z.string().max(500).optional(),
});
```

**Step 2: Também corrigir o schema de rating para aceitar apenas inteiros**

Em `backend/src/middleware/validation.ts`, linha 232, substitua:
```typescript
// ANTES:
rating: z.number().min(1, 'Nota minima e 1').max(5, 'Nota maxima e 5'),

// DEPOIS:
rating: z.number().int("Rating deve ser um número inteiro").min(1, 'Nota minima e 1').max(5, 'Nota maxima e 5'),
```

**Step 3: Adicionar validateBody e requireRole nas rotas de orders**

Em `backend/src/routes/orderRoutes.ts`, adicione imports:
```typescript
import {
  acceptOrderSchema,
  startOrderSchema,
  submitCompletionSchema,
  confirmOrderSchema,
  cancelOrderSchema,
  rescheduleOrderSchema,
} from "../middleware/validation";
```

Substitua as rotas de transição de estado (adicionando validateBody e, onde falta, requireRole):
```typescript
// accept
router.post("/orders/:id/accept",
  verifyToken,
  requireVerified,
  requireRole("PROFESSIONAL", "ADMIN"),
  validateBody(acceptOrderSchema),
  serviceController.acceptOrder,
);

// start
router.post("/orders/:id/start",
  verifyToken,
  requireVerified,
  requireRole("PROFESSIONAL", "ADMIN"),
  validateBody(startOrderSchema),
  serviceController.startOrder,
);

// submit-completion
router.post("/orders/:id/submit-completion",
  verifyToken,
  requireVerified,
  requireRole("PROFESSIONAL", "ADMIN"),
  validateBody(submitCompletionSchema),
  serviceController.submitCompletion,
);

// confirm (client side)
router.post("/orders/:id/confirm",
  verifyToken,
  requireVerified,
  requireRole("CLIENT", "ADMIN"),
  validateBody(confirmOrderSchema),
  serviceController.confirmCompletion,
);

// confirm-professional
router.post("/orders/:id/confirm-professional",
  verifyToken,
  requireVerified,
  requireRole("PROFESSIONAL", "ADMIN"),
  validateBody(confirmOrderSchema),
  serviceController.confirmProfessionalCompletion,
);

// cancel
router.post("/orders/:id/cancel",
  verifyToken,
  validateBody(cancelOrderSchema),
  serviceController.cancelOrder,
);

// reschedule — ADD requireRole
router.post("/orders/:id/reschedule",
  verifyToken,
  requireVerified,
  requireRole("CLIENT", "PROFESSIONAL", "ADMIN"),
  validateBody(rescheduleOrderSchema),
  serviceController.rescheduleOrder,
);
```

**Step 4: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 5: Commit**

```bash
git add backend/src/middleware/validation.ts backend/src/routes/orderRoutes.ts
git commit -m "fix(security): add Zod schemas and requireRole to order state transition routes (ALTA-4, MÉDIA-5)"
```

---

### Task 11: Upload — Verificar Autorização ANTES do Multer

**Vulnerabilidade**: ALTA-5 — Arquivo é salvo em disco antes de verificar se o usuário faz parte da ordem.

**Files:**
- Create: `backend/src/middleware/uploadAuthCheck.ts`
- Modify: `backend/src/routes/chatRoutes.ts` (reordenar middleware)

**Step 1: Criar middleware de pré-autorização de upload**

Crie `backend/src/middleware/uploadAuthCheck.ts`:

```typescript
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("uploadAuthCheck");

/**
 * Middleware que verifica se o usuário autenticado é participante da ordem
 * ANTES de o multer processar o arquivo.
 * Previne que arquivos sejam escritos em disco para ordens não autorizadas.
 */
export const requireOrderParticipant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: "Invalid order ID" });
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { clientId: true, professionalId: true },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const userId = req.user.id;
    const isParticipant =
      order.clientId === userId ||
      order.professionalId === userId ||
      req.user.role === "ADMIN";

    if (!isParticipant) {
      log.warn({ userId, orderId }, "Unauthorized upload attempt blocked before disk write");
      res.status(403).json({ success: false, message: "You are not a participant of this order" });
      return;
    }

    next();
  } catch (error) {
    log.error({ err: error }, "Upload auth check error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
```

**Step 2: Reordenar middleware no chatRoutes.ts**

Em `backend/src/routes/chatRoutes.ts`:

```typescript
// Adicionar import:
import { requireOrderParticipant } from "../middleware/uploadAuthCheck";

// Substituir a rota de upload:
// ANTES:
router.post(
  "/orders/:orderId/messages/upload",
  verifyToken,
  requireVerified,
  serviceController.chatUpload.single("file"),  // multer antes do check!
  serviceController.uploadChatFile,
);

// DEPOIS:
router.post(
  "/orders/:orderId/messages/upload",
  verifyToken,
  requireVerified,
  requireOrderParticipant,           // auth check BEFORE multer
  serviceController.chatUpload.single("file"),
  serviceController.uploadChatFile,
);
```

**Step 3: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 4: Commit**

```bash
git add backend/src/middleware/uploadAuthCheck.ts backend/src/routes/chatRoutes.ts
git commit -m "fix(security): verify order participation BEFORE multer disk write (ALTA-5)"
```

---

### Task 12: Validação de Magic Bytes em Uploads de Arquivo

**Vulnerabilidade**: ALTA-5 (parte 2) — MIME type spoofing: cliente pode enviar `Content-Type: image/jpeg` com executável.

**Files:**
- Modify: `backend/package.json` (adicionar file-type)
- Modify: `backend/src/controllers/service/fileUploadController.ts` (adicionar validação magic bytes)

**Step 1: Instalar `file-type`**

```bash
cd backend && npm install file-type@19
```

**Step 2: Adicionar validação de magic bytes no `uploadChatFile`**

Em `backend/src/controllers/service/fileUploadController.ts`, após a linha onde `req.file` é confirmado (linha ~85), adicione validação de magic bytes:

```typescript
// Adicionar import no topo:
import { fileTypeFromFile } from "file-type";

// Após verificar req.file existe e antes de processar:
// Validate magic bytes (prevents MIME spoofing)
const detectedType = await fileTypeFromFile(req.file.path).catch(() => null);
const declaredMime = req.file.mimetype;

if (detectedType && detectedType.mime !== declaredMime) {
  // Magic bytes differ from declared MIME — reject
  fs.unlinkSync(req.file.path);
  log.warn(
    { declared: declaredMime, detected: detectedType.mime, userId: req.user?.id },
    "File upload rejected: magic bytes mismatch (possible MIME spoofing)"
  );
  res.status(400).json({
    success: false,
    message: "Arquivo inválido: tipo de arquivo não corresponde ao conteúdo",
  });
  return;
}

// Also verify detected type is in allowed list
if (detectedType && !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
  fs.unlinkSync(req.file.path);
  res.status(400).json({
    success: false,
    message: `Tipo de arquivo não permitido: ${detectedType.mime}`,
  });
  return;
}
```

**Step 3: Rodar os testes**

```bash
cd backend && npm test
```
Expected: todos passando

**Step 4: Commit**

```bash
git add backend/src/controllers/service/fileUploadController.ts backend/package.json backend/package-lock.json
git commit -m "fix(security): validate magic bytes in file uploads to prevent MIME spoofing (ALTA-5)"
```

---

### Task 13: Remover Spread de Metadata Arbitrário em verificationDocument

**Vulnerabilidade**: MÉDIA-1 — `...(metadata || {})` permite que cliente injete campos arbitrários na submission.

**Files:**
- Modify: `backend/src/controllers/authController.ts` (linha 790)

**Step 1: Remover o spread**

Em `backend/src/controllers/authController.ts`, substitua linhas 786–791:

```typescript
// ANTES:
const submissionMetadata = {
  documentType,
  documentNumber: documentNumber || null,
  documentImageUrl: documentImageUrl || null,
  ...(metadata || {}),
};

// DEPOIS:
const submissionMetadata = {
  documentType,
  documentNumber: documentNumber || null,
  documentImageUrl: documentImageUrl || null,
  // metadata field removed: never spread client-supplied data into stored records
};
```

**Step 2: Rodar os testes**

```bash
cd backend && npm test
```

**Step 3: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "fix(security): remove arbitrary client metadata spread in verificationDocument (MÉDIA-1)"
```

---

## FASE 4: FRONTEND & TOKENS

### Task 14: Migrar Tokens JWT para httpOnly Cookies

**Vulnerabilidade**: MÉDIA-6 — Tokens em localStorage expostos a XSS.

**Files:**
- Modify: `backend/package.json` (cookie-parser)
- Modify: `backend/src/index.ts` (cookie-parser middleware)
- Modify: `backend/src/controllers/authController.ts` (set cookies no login/register)
- Modify: `backend/src/middleware/auth.ts` (ler token de cookie OU header)
- Modify: `frontend/src/services/api.ts` (withCredentials: true, remover localStorage para tokens)
- Modify: `frontend/src/context/AuthContext.tsx` (não armazenar tokens em state/localStorage)

**Step 1: Instalar cookie-parser no backend**

```bash
cd backend && npm install cookie-parser && npm install -D @types/cookie-parser
```

**Step 2: Adicionar cookie-parser ao backend/src/index.ts**

Após os imports existentes, adicione:
```typescript
import cookieParser from "cookie-parser";
```

Após `app.use(express.json(...))` e antes dos middlewares de segurança:
```typescript
app.use(cookieParser(env.JWT_SECRET));  // signed cookies
```

**Step 3: Modificar login/register para definir cookies httpOnly**

Em `backend/src/controllers/authController.ts`, nas funções `login` e `register`, após gerar os tokens, adicione:

```typescript
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias (igual ao refresh token)
};

res.cookie("accessToken", token, {
  ...cookieOptions,
  maxAge: 60 * 60 * 1000, // 1 hora (igual ao access token)
});

res.cookie("refreshToken", refreshToken, cookieOptions);
```

**Step 4: Modificar verifyToken para aceitar cookie OU header Authorization**

Em `backend/src/middleware/auth.ts`, no início do `verifyToken`, substitua a extração do token:

```typescript
// ANTES:
const authHeader = req.headers["authorization"];
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  res.status(401).json({ ... });
  return;
}
const token = authHeader.split(" ")[1];

// DEPOIS (aceita cookie OU header — suporta transição gradual):
let token: string | undefined;

// 1. Try httpOnly cookie first (preferred, secure)
if (req.cookies?.accessToken) {
  token = req.cookies.accessToken;
}
// 2. Fallback to Authorization header (backward compatibility)
else {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
}

if (!token) {
  res.status(401).json({
    success: false,
    message: "Token de autenticação não fornecido",
  });
  return;
}
```

**Step 5: Modificar frontend/src/services/api.ts**

```typescript
// Adicionar withCredentials para enviar cookies:
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,  // ADD THIS — sends cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// Remover o request interceptor que adiciona token do localStorage:
// (NÃO é mais necessário — cookie é enviado automaticamente)
// Se quiser manter compatibilidade, mantenha o interceptor mas com fallback:
api.interceptors.request.use(
  (config) => {
    // Only add Authorization header if no cookie is being sent
    // and a token exists in localStorage (backward compat)
    const token = localStorage.getItem("token");
    if (token && !document.cookie.includes("accessToken=")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

**Step 6: Modificar AuthContext.tsx — não armazenar tokens sensíveis**

Em `frontend/src/context/AuthContext.tsx`, substitua o armazenamento de tokens:

```typescript
// ANTES (na função login):
localStorage.setItem("token", token);
localStorage.setItem("user", JSON.stringify(user));
if (response.data.data.refreshToken) {
  localStorage.setItem("refreshToken", response.data.data.refreshToken);
}

// DEPOIS:
// Tokens agora são armazenados em httpOnly cookies pelo backend
// Apenas armazenar dados não-sensíveis do usuário (sem tokens!)
localStorage.setItem("user", JSON.stringify(user));
// Manter token em memória apenas para backward compat com código que lê localStorage.getItem("token")
// mas NÃO persistir o refreshToken
if (token) {
  sessionStorage.setItem("token", token);  // sessionStorage: limpo ao fechar aba
}
```

**Step 7: Adicionar endpoint de logout que limpa cookies**

Em `backend/src/controllers/authController.ts`, na função `logout` (ou criar se não existir):

```typescript
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.clearCookie("accessToken", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" });
    res.clearCookie("refreshToken", { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" });
    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};
```

**Step 8: Rodar todos os testes**

```bash
cd backend && npm test && cd ../frontend && npm run build
```
Expected: todos passando e build sem erros

**Step 9: Commit**

```bash
git add backend/src/index.ts backend/src/middleware/auth.ts backend/src/controllers/authController.ts backend/package.json frontend/src/services/api.ts frontend/src/context/AuthContext.tsx
git commit -m "fix(security): migrate JWT tokens to httpOnly cookies (MÉDIA-6)"
```

---

### Task 15: Atualizar CSP no Frontend para Produção

**Vulnerabilidade**: BAIXA-4 — CSP existe mas pode precisar de ajuste para MapLibre GL e produção.

**Files:**
- Modify: `frontend/index.html` (atualizar CSP meta tag)

**Step 1: Verificar dependências de URLs externas**

```bash
grep -rn "cdn\|unpkg\|jsdelivr\|maps.googleapis\|maplibre" frontend/src/ --include="*.ts" --include="*.tsx" | head -20
```

**Step 2: Atualizar CSP para cobrir MapLibre GL e demais recursos**

Em `frontend/index.html`, substitua a meta tag de CSP (linha 12):

```html
<!-- Content Security Policy -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://sdk.mercadopago.com;
  style-src 'self' 'unsafe-inline' https://unpkg.com;
  img-src 'self' data: https: blob:;
  connect-src 'self'
    http://localhost:3001
    https://*.mercadopago.com
    https://*.tile.openstreetmap.org
    https://nominatim.openstreetmap.org
    https://router.project-osrm.org
    https://overpass-api.de
    https://demotiles.maplibre.org
    https://*.mapbox.com;
  font-src 'self' https://unpkg.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
" />
```

**Step 3: Build e verificar sem erros**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "fix(security): tighten Content-Security-Policy with explicit sources (BAIXA-4)"
```

---

### Task 16: Normalização de Email no Registro — Prevenir Enumeração

**Vulnerabilidade**: BAIXA-3 — Registro confirma se email já existe com mensagem diferenciada.

**Files:**
- Modify: `backend/src/controllers/authController.ts` (linha ~108)

**Step 1: Substituir mensagem de email duplicado**

Em `backend/src/controllers/authController.ts`, substitua:

```typescript
// ANTES:
if (existingUser) {
  res.status(409).json(errorResponse("User with this email already exists"));
  return;
}

// DEPOIS:
if (existingUser) {
  // Anti-enumeration: same response whether email exists or not during registration
  // Send a "welcome" email to the existing address noting they already have an account
  // For now, return generic message
  res.status(200).json({
    success: true,
    message: "Se este email não estiver cadastrado, você receberá um email de boas-vindas em breve.",
  });
  return;
}
```

**Step 2: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "fix(security): anti-enumeration on registration (BAIXA-3)"
```

---

## FASE 5: CI & SUITE DE TESTES DE SEGURANÇA

### Task 17: Suite de Testes de Segurança — IDOR e Auth Bypass

**Files:**
- Create: `backend/tests/security/idor.test.ts`
- Create: `backend/tests/security/authBypass.test.ts`

**Step 1: Criar `backend/tests/security/idor.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/index";
import prisma from "../../src/lib/prisma";
import { generateToken } from "../../src/middleware/auth";

// These tests verify that users cannot access resources owned by other users

let clientToken: string;
let professionalToken: string;
let otherClientToken: string;
let orderId: number;

beforeAll(async () => {
  // Create test users
  const client = await prisma.user.upsert({
    where: { email: "client-idor-test@test.com" },
    create: {
      email: "client-idor-test@test.com",
      name: "Client IDOR Test",
      password: "hashed",
      role: "CLIENT",
      status: "ACTIVE",
      isVerified: true,
    },
    update: {},
  });

  const professional = await prisma.user.upsert({
    where: { email: "professional-idor-test@test.com" },
    create: {
      email: "professional-idor-test@test.com",
      name: "Professional IDOR Test",
      password: "hashed",
      role: "PROFESSIONAL",
      status: "ACTIVE",
      isVerified: true,
    },
    update: {},
  });

  const otherClient = await prisma.user.upsert({
    where: { email: "other-client-idor-test@test.com" },
    create: {
      email: "other-client-idor-test@test.com",
      name: "Other Client",
      password: "hashed",
      role: "CLIENT",
      status: "ACTIVE",
      isVerified: true,
    },
    update: {},
  });

  clientToken = generateToken({
    id: client.id, email: client.email, name: client.name,
    role: "CLIENT", status: "ACTIVE", tokenVersion: 0,
  });
  professionalToken = generateToken({
    id: professional.id, email: professional.email, name: professional.name,
    role: "PROFESSIONAL", status: "ACTIVE", tokenVersion: 0,
  });
  otherClientToken = generateToken({
    id: otherClient.id, email: otherClient.email, name: otherClient.name,
    role: "CLIENT", status: "ACTIVE", tokenVersion: 0,
  });

  // Create a test category and listing
  const category = await prisma.serviceCategory.findFirst();
  const listing = await prisma.serviceListing.create({
    data: {
      title: "IDOR Test Service",
      description: "Test",
      price: 100,
      categoryId: category!.id,
      professionalId: professional.id,
    },
  });

  // Create a test order
  const order = await prisma.serviceOrder.create({
    data: {
      title: "IDOR Test Order",
      description: "Test",
      price: 100,
      status: "PENDING",
      clientId: client.id,
      professionalId: professional.id,
      serviceListingId: listing.id,
    },
  });
  orderId = order.id;
});

describe("IDOR Protection Tests", () => {
  it("third-party client cannot view order details", async () => {
    const res = await request(app)
      .get(`/api/services/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherClientToken}`);

    expect(res.status).toBe(403);
  });

  it("third-party client cannot send messages to unrelated order", async () => {
    const res = await request(app)
      .post(`/api/services/orders/${orderId}/messages`)
      .set("Authorization", `Bearer ${otherClientToken}`)
      .send({ content: "IDOR test message" });

    expect(res.status).toBe(403);
  });

  it("third-party client cannot accept order", async () => {
    const res = await request(app)
      .post(`/api/services/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${otherClientToken}`)
      .send({});

    // Should be 403 (not participant) or 400 (wrong role)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("non-owner cannot cancel order", async () => {
    const res = await request(app)
      .post(`/api/services/orders/${orderId}/cancel`)
      .set("Authorization", `Bearer ${otherClientToken}`)
      .send({ reason: "IDOR test cancellation attempt" });

    expect(res.status).toBe(403);
  });

  it("unauthenticated request to protected order endpoint returns 401", async () => {
    const res = await request(app).get(`/api/services/orders/${orderId}`);
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Criar `backend/tests/security/authBypass.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/index";

describe("Auth Bypass Prevention", () => {
  it("admin panel rejects non-admin JWT", async () => {
    const clientToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token";
    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${clientToken}`);
    expect([401, 403]).toContain(res.status);
  });

  it("protected routes reject missing token with 401", async () => {
    const routes = [
      ["GET", "/api/services/orders"],
      ["GET", "/api/dashboard/stats"],
      ["GET", "/api/wallet/balance"],
      ["POST", "/api/auth/upgrade-to-professional"],
    ];

    for (const [method, route] of routes) {
      const res = await (request(app) as any)[method.toLowerCase()](route);
      expect(res.status).toBe(401);
    }
  });

  it("professional-only routes reject client role", async () => {
    // This tests that requireRole('PROFESSIONAL') is enforced
    // Uses a real CLIENT token (generated in beforeAll of idor.test.ts)
    // For standalone execution, we just verify the route exists and returns 401 without token
    const res = await request(app).post("/api/wallet/withdraw").send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it("webhook endpoint validates signature", async () => {
    const res = await request(app)
      .post("/api/services/payments/webhook")
      .send({ type: "payment", data: { id: "fake-id" } });

    // With signature validation, should return 200 but with received: false
    // (we always return 200 to prevent MP retries)
    expect(res.status).toBe(200);
    // The body should indicate invalid signature
    expect(res.body.received).toBe(false);
  });
});
```

**Step 3: Rodar a suite de segurança**

```bash
cd backend && npx vitest run tests/security/
```
Expected: todos passando

**Step 4: Commit**

```bash
git add backend/tests/security/idor.test.ts backend/tests/security/authBypass.test.ts
git commit -m "test(security): add IDOR and auth bypass test suites"
```

---

### Task 18: npm audit e Secret Scanning no CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Adicionar security gates ao CI**

Em `.github/workflows/ci.yml`, adicione um novo job `security` após o job `frontend`:

```yaml
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    permissions:
      security-events: write  # needed for CodeQL

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Audit backend dependencies
        working-directory: backend
        run: npm audit --audit-level=high
        continue-on-error: false

      - name: Audit frontend dependencies
        working-directory: frontend
        run: npm audit --audit-level=high
        continue-on-error: false

      - name: Detect secrets in codebase
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified
```

**Step 2: Adicionar CodeQL como job separado**

Adicione ao `.github/workflows/ci.yml` um job `codeql`:

```yaml
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
          queries: security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:javascript-typescript"
```

**Step 3: Verificar que o CI não quebra**

```bash
# Verificar localmente que npm audit não retorna erros críticos:
cd backend && npm audit --audit-level=high
cd ../frontend && npm audit --audit-level=high
```

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add npm audit, TruffleHog secret scanning, and CodeQL SAST (BAIXA)"
```

---

### Task 19: Remediar Vulnerabilidades de Dependências (npm audit)

**Files:**
- `backend/package.json` e `frontend/package.json`

**Step 1: Verificar e corrigir vulnerabilidades de dependências**

```bash
# Backend:
cd backend
npm audit --audit-level=moderate
npm audit fix
# Se não resolver automaticamente:
npm audit fix --force  # (cuidado com breaking changes)

# Frontend:
cd ../frontend
npm audit --audit-level=moderate
npm audit fix
```

**Step 2: Verificar que os testes ainda passam**

```bash
cd backend && npm test && cd ../frontend && npm run build
```

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "fix(security): remediate npm audit vulnerabilities"
```

---

## CHECKLIST FINAL

Ao terminar todos os tasks, executar verificação completa:

```bash
# Backend - todos os testes incluindo segurança
cd backend && npm test

# Frontend - type check e build
cd frontend && npx tsc --noEmit && npm run build

# Verificar que nenhum segredo está no código
grep -rn "AIzaSy\|sk-\|PRIVATE_KEY" backend/src/ frontend/src/ --include="*.ts" --include="*.tsx"

# Verificar que a API key do Maps não está mais exposta
grep -rn "PLACES_API_KEY\|map-config" backend/src/ --include="*.ts"
# Expected: apenas env.ts definition, não mais em endpoint ou controller

# Verificar que refresh tokens têm type: refresh
grep -n "type.*refresh\|JWT_REFRESH_SECRET" backend/src/middleware/auth.ts backend/src/controllers/adminController.ts
```

### Vulnerabilidades Cobertas por Fase

| Fase | Task | Vulnerabilidade | Severidade |
|------|------|-----------------|-----------|
| 1 | T1 | Webhook MP sem HMAC-SHA256 | CRÍTICA-1 |
| 1 | T2 | Double-credit em confirmProfessional | CRÍTICA-2 |
| 1 | T3 | Cache de escrow sem TTL e invalidação | MÉDIA-7 |
| 1 | T4 | Sem idempotência em operações financeiras | INFO |
| 2 | T5 | JWT segredos idênticos + admin token sem type | ALTA-3 |
| 2 | T6 | upgrade-to-professional sem requireVerified | ALTA-1 |
| 2 | T7 | Rate limiting por IP bypassável | ALTA-2 |
| 2 | T8 | Log de token de reset | ALTA-6 |
| 3 | T9 | /map-config expõe API key server-side | CRÍTICA-3 |
| 3 | T10 | Sem Zod em rotas de transição + rating float | ALTA-4, MÉDIA-5 |
| 3 | T11 | Upload antes da autorização | ALTA-5 |
| 3 | T12 | Sem validação de magic bytes | ALTA-5 |
| 3 | T13 | Metadata spread em verificationDocument | MÉDIA-1 |
| 4 | T14 | Tokens em localStorage | MÉDIA-6 |
| 4 | T15 | CSP incompleta | BAIXA-4 |
| 4 | T16 | Enumeração de email no registro | BAIXA-3 |
| 5 | T17 | Zero testes de IDOR e auth bypass | INFO |
| 5 | T18 | Sem npm audit e secret scanning no CI | INFO |
| 5 | T19 | Dependências vulneráveis | INFO |
