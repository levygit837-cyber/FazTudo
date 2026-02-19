# Correção: Dashboard Profissional, Meus Serviços, Carteira e Banco de Dados

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 3 bugs críticos na área do profissional (pedidos não listados, "Meus Serviços" com erro, carteira com warning) e garantir que o seed do banco de dados preenche adequadamente todos os modelos necessários para testes.

**Architecture:** Os bugs 1 e 2 compartilham a mesma causa raiz: a rota wildcard `/:id` em `serviceRoutes.ts` intercepta rotas como `/orders`, `/chat`, etc. antes que seus respectivos routers possam processá-las. O fix principal é restringir o `/:id` para aceitar apenas dígitos numéricos. O bug 3 (carteira) provavelmente falha quando o backend não está rodando ou há um erro no endpoint. O bug 4 (seed) requer enriquecer o seed com dados de teste para ServiceOrder, Payment, Transaction, Review e ProfessionalSchedule.

**Tech Stack:** Express 5, TypeScript, Prisma 7.3, SQLite, React 18, Vite

---

## Bug 1: Pedidos do Profissional Não Aparecem

### Causa Raiz

Em `backend/src/index.ts` (linhas 134-135):
```ts
app.use("/api/services", serviceRoutes);    // Registrado PRIMEIRO
app.use("/api/services", orderRoutes);      // Registrado SEGUNDO
```

Em `serviceRoutes.ts` (linha 52):
```ts
router.get("/:id", serviceController.getService);  // Captura QUALQUER path
```

Quando o frontend faz `GET /api/services/orders?role=professional`:
1. Express tenta `serviceRoutes` primeiro
2. `/:id` captura `/orders` (com `req.params.id = "orders"`)
3. `parseInt("orders")` → `NaN` → retorna 400 "Invalid service ID"
4. Request **nunca chega** no `orderRoutes`

O dashboard funciona porque usa `GET /api/dashboard/stats` (prefixo diferente).

## Bug 2: "Meus Serviços" com Erro de Carregamento

### Causa Raiz

A mesma rota wildcard `/:id` também afeta **outras rotas** montadas em `/api/services`. Embora o endpoint `GET /api/services` (listagem pública) funcione (é `router.get("/")`, não usa `/:id`), o erro "Verifique se o servidor está acessível" indica que o backend não está respondendo (`!err.response` em Axios, significando connection refused).

Se o backend estiver rodando, este endpoint funciona. O fix principal é garantir que a rota `/:id` não intercepte rotas nomeadas, E criar um `.env` no frontend se não existir.

## Bug 3: Carteira com Warning Laranja

### Causa Raiz

O endpoint `GET /api/wallet/summary` existe e está correto. O warning aparece quando `walletService.getSummary()` falha no `.catch(() => null)`, setando `summaryError = true`. Possíveis causas:
1. Backend não está rodando (mesma causa que bug 2)
2. Se `.env` do frontend tem `VITE_API_URL=http://localhost:3001` (sem `/api`), a URL fica errada
3. O endpoint funciona mas retorna dados vazios (sem transações) — isso NÃO causa erro, retorna zeros

## Bug 4: Seed Incompleto

### Análise

12 de 21 modelos NÃO têm seed data:
- **ServiceOrder** (CRÍTICO — afeta dashboard, carteira, chat, reviews)
- **Payment** (CRÍTICO — afeta fluxo financeiro e carteira)
- **Transaction** (CRÍTICO — afeta histórico da carteira)
- **Review** (MÉDIO — rating 4.8 está hardcoded mas sem reviews reais)
- **ProfessionalSchedule** (MÉDIO — agenda vazia)
- Notification, Message, File, Certification, OrderBrief, Proposal, ScheduleBlock, Dispute (BAIXO)

Também: CLAUDE.md diz senha `Teste@123` mas seed usa `teste123`.

---

### Task 1: Fix route wildcard — restringir `/:id` para apenas dígitos

**Files:**
- Modify: `backend/src/routes/serviceRoutes.ts:52,55,64`

**Step 1: Write the failing test**

Não há teste específico para este bug. Vamos verificar manualmente após a mudança.

**Step 2: Modificar serviceRoutes.ts para usar regex no `:id`**

Em `backend/src/routes/serviceRoutes.ts`, substituir TODAS as ocorrências de `"/:id"` por `"/:id(\\d+)"`:

```typescript
// Linha 52 — ANTES:
router.get("/:id", serviceController.getService);
// DEPOIS:
router.get("/:id(\\d+)", serviceController.getService);

// Linha 55 — ANTES:
router.put(
  "/:id",
// DEPOIS:
router.put(
  "/:id(\\d+)",

// Linha 64 — ANTES:
router.delete(
  "/:id",
// DEPOIS:
router.delete(
  "/:id(\\d+)",
```

**Step 3: Verificar que o backend compila**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: PASS sem erros

**Step 4: Testar manualmente a rota**

Run: `cd /home/levybonito/faztudo-main/backend && npm run dev` (em background)
Run: `curl -s http://localhost:3001/api/services/orders -H "Authorization: Bearer <token>" | jq .`
Expected: Deve retornar lista de orders (não "Invalid service ID")

Run: `curl -s http://localhost:3001/api/services/1 | jq .success`
Expected: `true` — rota numérica continua funcionando

**Step 5: Commit**

```bash
git add backend/src/routes/serviceRoutes.ts
git commit -m "fix: restrict /:id route to numeric-only to prevent wildcard interception"
```

---

### Task 2: Criar `frontend/.env` se não existir

**Files:**
- Create: `frontend/.env`

**Step 1: Criar o arquivo `.env`**

```
VITE_API_URL=http://localhost:3001/api
```

**IMPORTANTE:** Notar que o `.env.example` diz `http://localhost:3001` (sem `/api`), mas o código em `api.ts` (linha 5) adiciona `/api` no fallback. Para consistência, o `.env` DEVE incluir `/api` no final, pois `api.ts` usa `VITE_API_URL` diretamente como `baseURL` do Axios.

**Step 2: Corrigir `.env.example` para ser consistente**

Em `frontend/.env.example`:
```
VITE_API_URL=http://localhost:3001/api
```

**Step 3: Commit**

```bash
git add frontend/.env frontend/.env.example
git commit -m "fix: create frontend .env with correct API URL including /api suffix"
```

---

### Task 3: Enriquecer o seed com ServiceOrders completos

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Adicionar seed de ServiceOrders após a criação de listings**

Após a criação de `listings` em `seedTestUsers()` (após linha ~874), adicionar:

```typescript
// Criar pedidos de teste (4 PENDING para profissional1, cobrindo o "4 pendentes" do dashboard)
console.log("\n  Criando pedidos de teste...");

// Buscar listings criados
const prof1Listings = await prisma.serviceListing.findMany({
  where: { professionalId: professional.id },
  take: 4,
});

const orders = [];
for (let i = 0; i < Math.min(4, prof1Listings.length); i++) {
  const listing = prof1Listings[i];
  const existingOrder = await prisma.serviceOrder.findFirst({
    where: {
      serviceListingId: listing.id,
      clientId: client.id,
      status: "PENDING",
    },
  });

  if (!existingOrder) {
    const order = await prisma.serviceOrder.create({
      data: {
        serviceListingId: listing.id,
        clientId: client.id,
        professionalId: professional.id,
        status: "PENDING",
        price: listing.price,
        description: `Pedido de teste para: ${listing.title}`,
        scheduledDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000), // 1-4 semanas no futuro
      },
    });
    orders.push(order);
  }
}

// Criar 1 pedido COMPLETED (para testar reviews e transações)
const completedListing = prof1Listings[0];
if (completedListing) {
  const existingCompleted = await prisma.serviceOrder.findFirst({
    where: {
      serviceListingId: completedListing.id,
      clientId: client.id,
      status: "COMPLETED",
    },
  });

  if (!existingCompleted) {
    const completedOrder = await prisma.serviceOrder.create({
      data: {
        serviceListingId: completedListing.id,
        clientId: client.id,
        professionalId: professional.id,
        status: "COMPLETED",
        price: completedListing.price,
        description: "Pedido concluido de teste",
        scheduledDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 semanas atrás
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 semana atrás
      },
    });
    orders.push(completedOrder);
  }
}

// Criar 1 pedido IN_PROGRESS
if (prof1Listings[1]) {
  const existingInProgress = await prisma.serviceOrder.findFirst({
    where: {
      serviceListingId: prof1Listings[1].id,
      clientId: client.id,
      status: "IN_PROGRESS",
    },
  });

  if (!existingInProgress) {
    const inProgressOrder = await prisma.serviceOrder.create({
      data: {
        serviceListingId: prof1Listings[1].id,
        clientId: client.id,
        professionalId: professional.id,
        status: "IN_PROGRESS",
        price: prof1Listings[1].price,
        description: "Pedido em andamento de teste",
        scheduledDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    orders.push(inProgressOrder);
  }
}

console.log(`  - ${orders.length} pedidos de teste criados!`);
```

**Step 2: Verificar que compila**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add ServiceOrder seed data with PENDING, COMPLETED, and IN_PROGRESS orders"
```

---

### Task 4: Adicionar seed de Payments e Transactions

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Adicionar seed de Payment e Transaction para o pedido COMPLETED**

Após a criação de orders (Task 3), adicionar:

```typescript
// Criar pagamentos e transações para pedidos concluídos
console.log("  Criando pagamentos e transacoes de teste...");

const completedOrders = await prisma.serviceOrder.findMany({
  where: { status: "COMPLETED", professionalId: professional.id },
  include: { serviceListing: true },
});

for (const order of completedOrders) {
  const existingPayment = await prisma.payment.findFirst({
    where: { serviceOrderId: order.id },
  });

  if (!existingPayment) {
    const payment = await prisma.payment.create({
      data: {
        amount: order.price,
        status: "RELEASED",
        paymentMethod: "pix",
        transactionId: `test_txn_${order.id}_${Date.now()}`,
        serviceOrderId: order.id,
        clientId: order.clientId,
        professionalId: order.professionalId,
        paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        releasedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });

    // Transação de pagamento para o profissional (90%)
    const professionalAmount = order.price * 0.9;
    const platformFee = order.price * 0.1;

    await prisma.transaction.create({
      data: {
        type: "PAYMENT",
        amount: professionalAmount,
        description: `Pagamento por: ${order.description}`,
        userId: professional.id,
        paymentId: payment.id,
      },
    });

    // Transação de taxa da plataforma
    await prisma.transaction.create({
      data: {
        type: "FEE",
        amount: platformFee,
        description: `Taxa plataforma (10%) - Pedido #${order.id}`,
        userId: professional.id,
        paymentId: payment.id,
      },
    });

    // Transação de gasto do cliente
    await prisma.transaction.create({
      data: {
        type: "PAYMENT",
        amount: order.price,
        description: `Pagamento por: ${order.description}`,
        userId: client.id,
        paymentId: payment.id,
      },
    });
  }
}

// Atualizar saldo do profissional
const profTransactions = await prisma.transaction.aggregate({
  where: { userId: professional.id, type: "PAYMENT" },
  _sum: { amount: true },
});
const profFees = await prisma.transaction.aggregate({
  where: { userId: professional.id, type: "FEE" },
  _sum: { amount: true },
});
const newBalance = (profTransactions._sum.amount || 0) - (profFees._sum.amount || 0);
await prisma.user.update({
  where: { id: professional.id },
  data: { balance: newBalance },
});

console.log("  - Pagamentos e transacoes criados!");
```

**Step 2: Verificar que compila**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add Payment and Transaction seed data for completed orders"
```

---

### Task 5: Adicionar seed de Reviews

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Adicionar seed de Review para o pedido COMPLETED**

```typescript
// Criar review para pedido concluído
console.log("  Criando reviews de teste...");

for (const order of completedOrders) {
  const existingReview = await prisma.review.findFirst({
    where: { serviceOrderId: order.id },
  });

  if (!existingReview) {
    await prisma.review.create({
      data: {
        rating: 5,
        comment: "Excelente servico! Profissional muito competente e pontual. Recomendo!",
        serviceOrderId: order.id,
        reviewerId: client.id,
        reviewedId: professional.id,
      },
    });
  }
}

console.log("  - Reviews de teste criados!");
```

**Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add Review seed data for completed orders"
```

---

### Task 6: Adicionar seed de ProfessionalSchedule e Notifications

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Adicionar ProfessionalSchedule**

```typescript
// Criar agenda do profissional
console.log("  Criando agenda profissional de teste...");

const existingSchedule = await prisma.professionalSchedule.findFirst({
  where: { userId: professional.id },
});

if (!existingSchedule) {
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 1, // Segunda
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
  });
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 2, // Terça
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
  });
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 3, // Quarta
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
  });
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 4, // Quinta
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
  });
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 5, // Sexta
      startTime: "08:00",
      endTime: "17:00",
      isAvailable: true,
    },
  });
  await prisma.professionalSchedule.create({
    data: {
      userId: professional.id,
      dayOfWeek: 6, // Sábado
      startTime: "09:00",
      endTime: "13:00",
      isAvailable: true,
    },
  });
}

console.log("  - Agenda profissional criada!");

// Criar notificações de teste
console.log("  Criando notificacoes de teste...");

const existingNotification = await prisma.notification.findFirst({
  where: { userId: professional.id },
});

if (!existingNotification) {
  await prisma.notification.create({
    data: {
      type: "ORDER_CREATED",
      title: "Novo pedido recebido",
      message: "Voce recebeu um novo pedido de servico eletrico.",
      userId: professional.id,
      status: "UNREAD",
    },
  });

  await prisma.notification.create({
    data: {
      type: "ORDER_CREATED",
      title: "Novo pedido recebido",
      message: "Voce recebeu um novo pedido de conserto.",
      userId: professional.id,
      status: "UNREAD",
    },
  });

  await prisma.notification.create({
    data: {
      type: "PAYMENT_RECEIVED",
      title: "Pagamento recebido",
      message: "Pagamento de R$ 150,00 foi liberado para sua carteira.",
      userId: professional.id,
      status: "READ",
    },
  });

  // Notificação para o cliente
  await prisma.notification.create({
    data: {
      type: "ORDER_ACCEPTED",
      title: "Pedido aceito",
      message: "Seu pedido foi aceito pelo profissional Joao Santos.",
      userId: client.id,
      status: "UNREAD",
    },
  });
}

console.log("  - Notificacoes de teste criadas!");
```

**Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add ProfessionalSchedule and Notification seed data"
```

---

### Task 7: Corrigir senha no seed e atualizar CLAUDE.md

**Files:**
- Modify: `backend/prisma/seed.ts:545`
- Modify: `CLAUDE.md` (seção "Usuarios de Teste")

**Step 1: Corrigir a senha no seed para usar `Teste@123` (compatível com CLAUDE.md)**

Em `backend/prisma/seed.ts`, linha 545:

```typescript
// ANTES:
const hashedPassword = await bcrypt.hash("teste123", 10);
// DEPOIS:
const hashedPassword = await bcrypt.hash("Teste@123", 10);
```

**Step 2: Atualizar CLAUDE.md se necessário**

Verificar que CLAUDE.md já diz `Teste@123`. Se sim, não precisa mudar. Caso contrário, atualizar.

**Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "fix: align seed password with CLAUDE.md documentation (Teste@123)"
```

---

### Task 8: Rodar seed e verificar tudo funciona

**Step 1: Resetar e popular o banco**

Run: `cd /home/levybonito/faztudo-main/backend && npm run db:push`
Expected: Schema aplicado sem erros

Run: `cd /home/levybonito/faztudo-main/backend && npm run db:seed`
Expected: Seed completo com pedidos, pagamentos, transações, reviews, agenda e notificações

**Step 2: Verificar dados**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma studio`
Verificar em cada tabela:
- ServiceOrder: 6+ registros (4 PENDING, 1 COMPLETED, 1 IN_PROGRESS)
- Payment: 1+ registro (RELEASED para o COMPLETED)
- Transaction: 3+ registros
- Review: 1+ registro
- ProfessionalSchedule: 6 registros (seg-sab)
- Notification: 4+ registros

**Step 3: Rodar testes do backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: Todos os testes passam

**Step 4: Verificar tipo check**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: PASS

---

### Task 9: Verificação E2E com o frontend

**Step 1: Subir backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm run dev`

**Step 2: Subir frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run dev`

**Step 3: Testar no navegador**

1. Acessar `http://localhost:5173`
2. Login como `profissional@teste.com` / `Teste@123`
3. Verificar Dashboard: "4 pedidos pendentes" ✅
4. Clicar em "Pedidos Recebidos": lista com 4+ pedidos visíveis ✅
5. Clicar em "Meus Serviços": 5 listings do profissional ✅
6. Clicar em "Carteira": dados financeiros sem warning laranja ✅

Se algum teste falhar, investigar o log do backend (`pino-pretty`) para o erro específico.

**Step 4: Commit final**

```bash
git commit -m "test: verify all professional dashboard features working"
```

---

## Resumo de Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `backend/src/routes/serviceRoutes.ts` | Fix | Restringir `/:id` para `/:id(\d+)` |
| `frontend/.env` | Create | Definir `VITE_API_URL` correto |
| `frontend/.env.example` | Fix | Corrigir URL para incluir `/api` |
| `backend/prisma/seed.ts` | Feature | Adicionar seed completo: Orders, Payments, Transactions, Reviews, Schedule, Notifications |
| `CLAUDE.md` | Fix (se necessário) | Verificar consistência da senha |

## Dependências Entre Tasks

```
Task 1 (routes fix) ─── independente ───→ pode ser feita isoladamente
Task 2 (.env)       ─── independente ───→ pode ser feita isoladamente
Task 3 (orders)     ───→ Task 4 (payments) ───→ Task 5 (reviews) ───→ Task 6 (schedule/notif) ───→ Task 7 (senha)
Task 8 (seed run)   ─── depende de Tasks 1-7
Task 9 (E2E)        ─── depende de Task 8
```
