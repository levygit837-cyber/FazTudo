# Design: Async Processing, Payment Safety & Security Hardening

> **Data**: 2026-02-21
> **Status**: Aprovado
> **Escopo**: BullMQ queues, PostgreSQL migration, Payment event store, MFA TOTP, Secrets management, SLOs

---

## 1. Contexto e Problema

O FazTudo processa tudo de forma síncrona: notificações, emails, webhooks de pagamento e jobs agendados rodam inline nas requests HTTP ou via `node-cron` acoplado ao processo do Express. Isso causa:

- **Latência alta** em requests que disparam emails/notificações
- **Risco de duplicidade** em webhooks de pagamento (sem idempotência persistida)
- **Sem trilha de auditoria** para eventos financeiros
- **Scheduler acoplado** compete por CPU com a API
- **Sem MFA** para ações críticas e admins
- **Secrets em arquivos locais** (.env + VARIAVEIS/.env.mp)
- **SQLite** não suporta concorrência necessária para filas

## 2. Decisões de Arquitetura

| Decisão | Escolha | Alternativa rejeitada |
|---------|---------|----------------------|
| Fila/Jobs | BullMQ (mono-worker com filas nomeadas) | Redis Streams direto (perde retries/dashboard) |
| Event Store | Tabela PaymentEvent no PostgreSQL (append-only) | CQRS completo (overkill) |
| MFA | TOTP via otplib + backup codes | SMS OTP (custo recorrente + SIM swap) |
| Secrets | Cloud Provider Secrets Manager + Docker Secrets | HashiCorp Vault self-hosted (complexidade operacional) |
| Banco | PostgreSQL 16 | Manter SQLite (não escala) |

## 3. Arquitetura de Processos

```
┌─────────────┐     ┌─────────┐     ┌──────────────────┐
│  API Server │────▶│  Redis  │◀────│  Worker Process  │
│  (Express)  │     │ (BullMQ)│     │  (bullmq worker) │
│  port 3001  │     └─────────┘     └──────────────────┘
│             │          ▲
│  - Routes   │          │          ┌──────────────────┐
│  - Auth     │          └──────────│ Scheduler Process│
│  - Validate │                     │  (bullmq repeat) │
│  - Socket.io│                     └──────────────────┘
└─────────────┘
```

### 3.1 Filas BullMQ

| Fila | Jobs | Retry | DLQ |
|------|------|-------|-----|
| `notifications` | Criar notificação, emitir socket, enviar push | 3x (backoff exponencial) | Sim |
| `emails` | Enviar email SMTP (verificação, reset, notificação) | 5x (30s, 1m, 5m, 15m, 1h) | Sim |
| `payments` | Processar webhook MP, liberar escrow, reembolso | 3x | Sim — alerta admin |
| `reconciliation` | Diff MercadoPago vs local, gerar relatório | 1x | Sim — alerta admin |
| `anti-fraud` | Validar padrões suspeitos (múltiplos saques, velocidade) | 2x | Sim |

### 3.2 Jobs Recorrentes (Scheduler)

| Job | Cron | Fila |
|-----|------|------|
| Auto-release escrow | `0 * * * *` (hourly) | `payments` |
| Expired orders | `0 */6 * * *` | `notifications` |
| Deadline warnings | `0 */12 * * *` | `notifications` |
| Reconciliação MP | `0 3 * * *` (3AM) | `reconciliation` |
| Cleanup notificações | `0 4 * * 0` (domingo 4AM) | `notifications` |
| Late professionals | `* * * * *` | `notifications` |
| Salários companies | Existente (companyCronService) | `payments` |

### 3.3 Estrutura de Arquivos Novos

```
backend/src/
├── queues/
│   ├── connection.ts          # Redis connection config (IORedis)
│   ├── queues.ts              # Queue instances
│   └── producers.ts           # Helper functions to enqueue jobs
├── workers/
│   ├── index.ts               # Worker entry point
│   ├── notificationWorker.ts
│   ├── emailWorker.ts
│   ├── paymentWorker.ts
│   ├── reconciliationWorker.ts
│   └── antiFraudWorker.ts
├── scheduler/
│   └── index.ts               # Registra repeat jobs
```

### 3.4 Graceful Degradation

Se Redis estiver indisponível, o sistema cai automaticamente para modo síncrono (comportamento atual). Implementado via try/catch no enqueue: se falhar, executa inline + log WARN.

## 4. Event Store e Idempotência de Pagamentos

### 4.1 Modelo PaymentEvent

```prisma
model PaymentEvent {
  id              Int              @id @default(autoincrement())
  paymentId       Int
  payment         Payment          @relation(fields: [paymentId], references: [id])
  eventType       PaymentEventType
  previousStatus  PaymentStatus?
  newStatus       PaymentStatus
  idempotencyKey  String           @unique
  amount          Float?
  metadata        Json?
  source          EventSource
  actorId         Int?
  ipAddress       String?
  createdAt       DateTime         @default(now())

  @@index([paymentId, createdAt])
  @@index([eventType, createdAt])
}

enum PaymentEventType {
  CREATED
  HELD
  APPROVED
  RELEASED
  REFUNDED
  PARTIALLY_REFUNDED
  FAILED
  EXPIRED
  DISPUTED
  RECONCILED
  MANUAL_OVERRIDE
}

enum EventSource {
  WEBHOOK
  INTERNAL
  ADMIN
  SCHEDULER
}
```

### 4.2 State Machine

```
PENDING → HELD | FAILED
HELD → RELEASED | REFUNDED | PARTIALLY_REFUNDED | DISPUTED
DISPUTED → RELEASED | REFUNDED
```

Função `transitionPaymentStatus()` valida transições, cria evento, atualiza status atomicamente.

### 4.3 Webhook Idempotente (2 camadas)

1. **Redis**: TTL 5min — rejeita duplicatas imediatas (barato)
2. **PostgreSQL**: UNIQUE constraint em `idempotencyKey` — garante idempotência durável

Fluxo: Webhook → Valida HMAC → Check Redis → Enfileira → Worker → Check DB → Processa

### 4.4 Reconciliação Diária

- 3AM: busca payments HELD/PENDING > 24h
- Consulta API MercadoPago para cada um
- Compara status local vs remoto
- Cria PaymentEvent RECONCILED para divergências
- Alerta admins se divergências > 0

## 5. Segurança

### 5.1 MFA (TOTP)

**Modelo:**
```prisma
model UserMFA {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique
  user            User      @relation(fields: [userId], references: [id])
  secret          String    // AES-256-GCM encrypted
  isEnabled       Boolean   @default(false)
  isVerified      Boolean   @default(false)
  backupCodes     String?   // JSON array de codes hasheados
  backupCodesUsed Int       @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Endpoints novos:**
- `POST /api/auth/mfa/setup` — Gera secret + QR code
- `POST /api/auth/mfa/verify-setup` — Confirma primeiro código, gera backup codes
- `POST /api/auth/mfa/validate` — Valida código no login
- `POST /api/auth/mfa/disable` — Desativa (requer código atual)
- `POST /api/auth/mfa/backup-codes/regenerate` — Novos backup codes

**Onde é obrigatório:**
- Login de admins
- Saques da wallet
- Alteração de senha/email
- Exclusão de conta

**Bibliotecas:** `otplib`, `qrcode`

### 5.2 Secrets Management

| Ambiente | Método |
|----------|--------|
| Dev local | `.env` (como hoje) |
| CI/CD | GitHub Actions Secrets |
| Produção | Cloud Provider Secrets Manager |

Novo `config/secrets.ts` com interface unificada `getSecret()`. Carregamento no boot, cache em memória, reload a cada 1h.

### 5.3 SLOs

| Serviço | SLI | SLO |
|---------|-----|-----|
| API geral | % requests != 5xx | 99.5% |
| API latência | p99 response time | < 500ms |
| Webhooks | Tempo até processamento | 99.9% em < 5min |
| Notificações | % entregues | 99% em < 30s |
| Reconciliação | Divergências resolvidas | 100% em 24h |

Endpoint `GET /metrics` (Prometheus format).

## 6. Migração PostgreSQL

- `schema.prisma`: provider → `postgresql`
- Remover `@prisma/adapter-libsql` e `@libsql/client`
- Docker Compose com PostgreSQL 16 + Redis 7
- Script de migração de dados SQLite → PostgreSQL
- Setup completo automatizado (install + seed)

## 7. Melhorias Adicionais

### 7.1 Circuit Breaker para MercadoPago
Biblioteca `opossum`. Após 5 falhas consecutivas, abre circuito por 30s. Retorna erro imediato em vez de esperar timeout.

### 7.2 Health Checks Estendidos
```json
{
  "api": "ok",
  "database": "ok",
  "redis": "ok",
  "queues": {
    "notifications": { "active": 0, "waiting": 5 },
    "payments": { "active": 1, "waiting": 0 }
  }
}
```

### 7.3 Audit Log
```prisma
model AuditLog {
  id          Int      @id @default(autoincrement())
  action      String
  actorId     Int
  actor       User     @relation(fields: [actorId], references: [id])
  targetType  String
  targetId    Int
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
}
```

### 7.4 Rate Limiting para Webhooks
100 webhooks/min por `external_reference`. Rejeita excedente com 429.

## 8. Arquivos Impactados

### Novos
- `backend/src/queues/connection.ts`
- `backend/src/queues/queues.ts`
- `backend/src/queues/producers.ts`
- `backend/src/workers/index.ts`
- `backend/src/workers/notificationWorker.ts`
- `backend/src/workers/emailWorker.ts`
- `backend/src/workers/paymentWorker.ts`
- `backend/src/workers/reconciliationWorker.ts`
- `backend/src/workers/antiFraudWorker.ts`
- `backend/src/scheduler/index.ts`
- `backend/src/config/secrets.ts`
- `backend/src/lib/circuitBreaker.ts`
- `backend/src/lib/paymentStateMachine.ts`
- `backend/src/middleware/mfa.ts`
- `backend/src/controllers/mfaController.ts`
- `backend/src/routes/mfaRoutes.ts`
- `backend/src/middleware/auditLog.ts`
- `docker-compose.yml` (atualizar)

### Modificados
- `backend/prisma/schema.prisma` — PostgreSQL + PaymentEvent + UserMFA + AuditLog
- `backend/src/index.ts` — remover node-cron, adicionar health checks
- `backend/src/services/notificationService.ts` — enfileirar em vez de executar inline
- `backend/src/services/emailService.ts` — enfileirar jobs
- `backend/src/services/mercadopagoService.ts` — circuit breaker
- `backend/src/services/escrowService.ts` — usar paymentStateMachine
- `backend/src/controllers/service/paymentController.ts` — webhook idempotente
- `backend/src/middleware/rateLimiter.ts` — webhook rate limit
- `backend/src/middleware/auth.ts` — MFA support
- `backend/src/controllers/authController.ts` — MFA flow
- `backend/src/config/env.ts` — novas vars (REDIS_URL, MFA_ENCRYPTION_KEY, etc.)
- `backend/package.json` — novas deps + scripts

### Removidos
- `backend/src/lib/scheduler.ts` — substituído por scheduler BullMQ
- Dependência de `@prisma/adapter-libsql`, `@libsql/client`

## 9. Dependências Novas

```json
{
  "bullmq": "^5.x",
  "ioredis": "^5.x",
  "otplib": "^12.x",
  "qrcode": "^1.x",
  "opossum": "^8.x",
  "prom-client": "^15.x"
}
```

## 10. Ordem de Implementação Sugerida

1. **PostgreSQL**: Instalar, migrar schema, seed, validar testes
2. **Redis + BullMQ**: Infra base (connection, queues, worker entry point)
3. **Migrar Scheduler**: node-cron → BullMQ repeat jobs
4. **Migrar Notificações/Emails**: Para filas
5. **Payment Event Store**: Modelo, state machine, idempotency
6. **Webhook Idempotente**: Redis dedup + DB dedup + enqueue
7. **Reconciliação**: Worker + job recorrente
8. **MFA TOTP**: Modelo, endpoints, middleware
9. **Secrets Management**: config/secrets.ts
10. **Circuit Breaker**: MercadoPago
11. **Health Checks + Metrics**: Endpoint /metrics, /health estendido
12. **Audit Log**: Modelo, middleware
13. **Anti-Fraud Worker**: Regras básicas
14. **SLOs**: Dashboard, alertas
15. **Testes**: Para cada componente novo
