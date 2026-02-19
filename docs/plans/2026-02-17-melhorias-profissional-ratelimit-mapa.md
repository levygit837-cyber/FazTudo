# Melhorias: Fluxo de Confirmação, UI de Pedidos, Rate Limiter e Mapa — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 4 issues: (1) Impedir profissional de marcar "Entregue" antes do cliente confirmar — invertendo o fluxo para cliente confirmar primeiro; (2) Redesign da UI de pedidos recebidos do profissional; (3) Bug de rate limiting 429 após ~12 minutos; (4) Investigar e corrigir mapa do Google aparecendo em vez do mapa customizado.

**Architecture:** O fluxo atual é `IN_PROGRESS → [profissional marca entregue] → AWAITING_CLIENT_CONFIRMATION → [cliente confirma] → AWAITING_PROFESSIONAL_CONFIRMATION → [profissional confirma] → COMPLETED`. O novo fluxo será: `IN_PROGRESS → [cliente marca como concluído] → AWAITING_PROFESSIONAL_CONFIRMATION → [profissional confirma] → COMPLETED`, eliminando o estado `AWAITING_CLIENT_CONFIRMATION` do fluxo (ou invertendo quem inicia). O rate limiter global tem apenas 100 req/15min e o polling de chat (5s), notificações (60s) e location (5s) esgotam esse budget. O mapa customizado existe (`InteractiveMap`, `ProfessionalMarker`, etc.) mas NÃO é usado em `ServiceDetails.tsx`.

**Tech Stack:** Express 5, React 18, TypeScript, Prisma, express-rate-limit v8, @vis.gl/react-google-maps, TailwindCSS

---

## Issue 1: Inverter Fluxo de Confirmação (Cliente Primeiro)

### Contexto Atual

O fluxo atual quando um serviço está `IN_PROGRESS`:

```
IN_PROGRESS
  → Profissional clica "Marcar como Entregue" (submitOrderCompletion)
    → Status vira AWAITING_CLIENT_CONFIRMATION (professionalConfirmedAt = now)
      → Cliente confirma (confirmOrderCompletion)
        → Status vira AWAITING_PROFESSIONAL_CONFIRMATION (clientConfirmedAt = now)
          → Profissional confirma final (confirmProfessionalCompletion)
            → Status vira COMPLETED (pagamento liberado)
```

**Problema**: O profissional pode marcar "Entregue" sem o serviço ter sido realmente concluído. O cliente deveria iniciar a confirmação.

### Novo Fluxo Desejado

```
IN_PROGRESS
  → Cliente clica "Confirmar que serviço foi realizado"
    → Status vira AWAITING_PROFESSIONAL_CONFIRMATION (clientConfirmedAt = now)
      → Profissional confirma final
        → Status vira COMPLETED (pagamento liberado)
```

O profissional NÃO pode mais iniciar a entrega. Apenas o cliente pode dizer "o serviço foi feito".

**Arquivos afetados:**
- Backend: `backend/src/controllers/service/orderController.ts` (funções `completeServiceOrder` e `confirmServiceOrderCompletion`)
- Backend: `backend/src/routes/orderRoutes.ts` (roles das rotas)
- Frontend: `frontend/src/pages/orders/OrderDetails.tsx` (botões de ação)
- Frontend: `frontend/src/components/orders/DualConfirmation.tsx` (textos)
- Frontend: `frontend/src/components/orders/FlowStatusBanner.tsx` (textos)
- Frontend: `frontend/src/utils/formatters.ts` (label do status)

### Task 1: Inverter o controller `completeServiceOrder` (backend)

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts:708-830`
- Modify: `backend/src/routes/orderRoutes.ts:55-62`

**Step 1: Alterar a rota `/orders/:id/submit-completion` para permitir CLIENT em vez de PROFESSIONAL**

No arquivo `backend/src/routes/orderRoutes.ts`, alterar a linha 58 de:
```typescript
requireRole("PROFESSIONAL", "ADMIN"),
```
para:
```typescript
requireRole("CLIENT", "ADMIN"),
```

**Step 2: Alterar o controller `completeServiceOrder` para ser do cliente**

No arquivo `backend/src/controllers/service/orderController.ts`, na função `completeServiceOrder` (~linha 708):

Trocar a verificação de role de `PROFESSIONAL` para `CLIENT`:
```typescript
// ANTES:
if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
  ...
}
// Trocar por:
if (req.user.role !== "CLIENT" && req.user.role !== "ADMIN") {
  res.status(403).json(errorResponse("Only clients can submit service completion"));
  return;
}
```

Trocar a verificação de permissão de `professionalId` para `clientId`:
```typescript
// ANTES:
if (serviceOrder.professionalId !== req.user.id && req.user.role !== "ADMIN") {
// DEPOIS:
const isClient = serviceOrder.clientId === req.user.id;
const isAdmin = req.user.role === "ADMIN";
if (!isClient && !isAdmin) {
```

Trocar o status de destino de `AWAITING_CLIENT_CONFIRMATION` para `AWAITING_PROFESSIONAL_CONFIRMATION`:
```typescript
data: {
  status: "AWAITING_PROFESSIONAL_CONFIRMATION",
  clientConfirmedAt: new Date(),
},
```

Atualizar a notificação para notificar o profissional (em vez do cliente):
```typescript
if (serviceOrder.professionalId) {
  await createNotification(
    serviceOrder.professionalId,
    NotificationType.ORDER_COMPLETED,
    "Cliente confirmou o serviço",
    `O cliente confirmou que o serviço "${serviceOrder.title}" foi realizado. Confirme para liberar o pagamento.`,
    orderId,
    { clientId: req.user.id, clientName: req.user.name },
  );
}
```

**Step 3: Remover/desativar a rota e controller `confirmServiceOrderCompletion`**

Esta rota (`/orders/:id/confirm-completion`) não é mais necessária pois o cliente agora inicia via `submit-completion`.

Em `backend/src/routes/orderRoutes.ts`, comentar ou remover as linhas 64-71:
```typescript
// REMOVER este bloco - o fluxo agora é:
// Cliente → submit-completion → AWAITING_PROFESSIONAL_CONFIRMATION → confirm-professional → COMPLETED
// router.post(
//   "/orders/:id/confirm-completion",
//   verifyToken,
//   requireRole("CLIENT", "ADMIN"),
//   requireVerified,
//   serviceController.confirmServiceOrderCompletion,
// );
```

**Step 4: Verificar que `confirmProfessionalCompletion` continua correto**

A função `confirmProfessionalCompletion` no controller (~ linha 955) já espera o status `AWAITING_PROFESSIONAL_CONFIRMATION` e já faz o release do pagamento. **NÃO precisa de mudança.**

**Step 5: Commit**

```bash
git add backend/src/controllers/service/orderController.ts backend/src/routes/orderRoutes.ts
git commit -m "feat: invert order confirmation flow - client initiates completion"
```

---

### Task 2: Atualizar frontend para novo fluxo (OrderDetails.tsx)

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx:586-649`

**Step 1: Mover o botão "Marcar como Entregue" do profissional para o cliente**

No bloco `{isOrderProfessional && (` (~ linha 442), o trecho `IN_PROGRESS` (~ linha 587-617) atualmente mostra "Marcar como Entregue" para o profissional. **Remover** este botão do bloco do profissional.

No bloco `{isOrderClient && (` (~ linha 671), adicionar um novo botão para `IN_PROGRESS`:

```tsx
{order.status === "IN_PROGRESS" && (
  <button
    onClick={() =>
      setConfirmAction({
        title: "Confirmar conclusão do serviço",
        message: "Confirme que o serviço foi realizado conforme combinado. Após sua confirmação, o profissional poderá finalizar o pedido e o pagamento será liberado.",
        variant: "warning",
        confirmLabel: "Confirmar que foi realizado",
        action: () => submitOrderCompletion(order.id),
      })
    }
    disabled={actionLoading}
    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
  >
    <CheckCircle className="w-4 h-4" />
    Confirmar que o serviço foi realizado
  </button>
)}
```

**Step 2: Atualizar o bloco IN_PROGRESS do profissional para mostrar mensagem de espera**

No bloco `{isOrderProfessional && (`, substituir o botão "Marcar como Entregue" no status `IN_PROGRESS` por uma mensagem informativa:

```tsx
{order.status === "IN_PROGRESS" && (
  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
    <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
    <p className="text-sm text-blue-700 dark:text-blue-400">
      Serviço em andamento. Aguarde o cliente confirmar que o serviço foi realizado.
    </p>
  </div>
)}
```

Manter os botões de "Reagendar" e "Abrir Disputa" para o profissional no status IN_PROGRESS.

**Step 3: Remover import e uso de `confirmOrderCompletion` (não mais necessário)**

A função `confirmOrderCompletion` não é mais chamada pelo frontend. Remover do import.

**Step 4: Atualizar o bloco AWAITING_CLIENT_CONFIRMATION do profissional**

Este status não será mais atingido no novo fluxo, mas por segurança manter o tratamento (para ordens legadas). Pode ficar como está.

**Step 5: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: update OrderDetails UI for client-first confirmation flow"
```

---

### Task 3: Atualizar DualConfirmation e FlowStatusBanner

**Files:**
- Modify: `frontend/src/components/orders/DualConfirmation.tsx`
- Modify: `frontend/src/components/orders/FlowStatusBanner.tsx`

**Step 1: Atualizar DualConfirmation.tsx**

Inverter a lógica: agora o **cliente** confirma primeiro, depois o profissional. Trocar a ordem dos cards para que o card do cliente apareça primeiro.

No bloco de status messages (~ linha 144), trocar:
- `professionalDone && !clientDone && isClient` → `clientDone && !professionalDone && !isClient` (profissional vê botão de confirmar)
- `professionalDone && !clientDone && !isClient` → `clientDone && !professionalDone && isClient` (cliente vê "aguardando profissional")

**Step 2: Atualizar textos no FlowStatusBanner.tsx**

Buscar no FlowStatusBanner os textos relacionados a `AWAITING_CLIENT_CONFIRMATION` e `AWAITING_PROFESSIONAL_CONFIRMATION` e inverter as descrições de quem deve agir.

**Step 3: Atualizar formatOrderStatus em formatters.ts**

```typescript
AWAITING_CLIENT_CONFIRMATION: "Aguardando confirmação do cliente",  // Status legado
AWAITING_PROFESSIONAL_CONFIRMATION: "Aguardando confirmação do profissional",
```

Estes labels já estão corretos, não precisam mudar.

**Step 4: Commit**

```bash
git add frontend/src/components/orders/DualConfirmation.tsx frontend/src/components/orders/FlowStatusBanner.tsx
git commit -m "feat: update DualConfirmation and FlowStatusBanner for new flow"
```

---

### Task 4: Escrever teste para o novo fluxo de confirmação

**Files:**
- Create: `backend/tests/orderConfirmationFlow.test.ts`

**Step 1: Escrever teste que verifica que profissional NÃO pode mais chamar submit-completion**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Order Confirmation Flow (Client-First)", () => {
  it("should reject professional from calling submit-completion", async () => {
    // POST /api/services/orders/:id/submit-completion como profissional
    // Deve retornar 403
  });

  it("should allow client to call submit-completion", async () => {
    // POST /api/services/orders/:id/submit-completion como cliente
    // Deve mudar status para AWAITING_PROFESSIONAL_CONFIRMATION
    // Deve setar clientConfirmedAt
  });

  it("should allow professional to confirm-professional after client submitted", async () => {
    // POST /api/services/orders/:id/confirm-professional como profissional
    // Deve mudar status para COMPLETED
    // Deve liberar pagamento
  });
});
```

**Step 2: Rodar o teste**

Run: `cd backend && npm test -- --testPathPattern=orderConfirmationFlow`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/tests/orderConfirmationFlow.test.ts
git commit -m "test: add order confirmation flow test (client-first)"
```

---

## Issue 2: Redesign UI de Pedidos Recebidos (Profissional)

### Diagnóstico Atual

**Componente atual**: `ServiceOrdersList` renderiza `OrderCard` para cada pedido.
**Problemas identificados**:
1. Cards com muito espaçamento (`space-y-6` + `space-y-4` + `p-4/p-6`)
2. Informações insuficientes (sem descrição, categoria, localização, ações rápidas)
3. Sem diferenciação visual por status
4. 8 tabs com labels longos causando overflow horizontal
5. Sem ações inline (aceitar/rejeitar direto da lista)

### Task 5: Redesign do OrderCard para profissionais

**Files:**
- Modify: `frontend/src/components/orders/OrderCard.tsx`

**Step 1: Redesenhar o OrderCard**

O novo design deve ter:

```
┌─[borda esquerda colorida por status]──────────────────────┐
│ ┌──────────────────────────────────┐ ┌──────────────────┐ │
│ │ 🟡 Novo Pedido                   │ │ R$ 150,00        │ │
│ │ Instalação de Ar Condicionado    │ │ [Aceitar] [Ver]  │ │
│ │ "Preciso instalar 2 splits..."   │ │                  │ │
│ │                                  │ │ 📅 15/02 às 14h  │ │
│ │ 👤 João Silva · ⭐ 4.8           │ │ ⏰ Prazo: 3 dias  │ │
│ │ 📍 Centro, Iguatu-CE             │ │                  │ │
│ └──────────────────────────────────┘ └──────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

Principais mudanças:
- **Borda esquerda colorida** por status (amarelo=pending, verde=accepted, azul=in_progress)
- **Layout 2 colunas** (info à esquerda, ações/preço à direita)
- **Descrição truncada** (2 linhas max)
- **Info do cliente** com rating
- **Localização** (cidade, bairro)
- **Botões de ação inline** para PENDING (Aceitar/Recusar direto do card)
- **Padding reduzido** de `p-4 sm:p-6` para `p-3 sm:p-4`
- **Gap entre cards reduzido** de `space-y-4` para `space-y-3`

**Step 2: Adicionar prop `onAccept` e `onReject` ao OrderCard**

```tsx
interface OrderCardProps {
  order: ServiceOrder;
  role: "client" | "professional";
  onAccept?: (id: number) => void;
  onReject?: (id: number) => void;
}
```

**Step 3: Implementar o novo design**

```tsx
export default function OrderCard({ order, role, onAccept, onReject }: OrderCardProps) {
  const statusColors: Record<string, string> = {
    PENDING: "border-l-amber-400",
    ACCEPTED: "border-l-emerald-400",
    IN_PROGRESS: "border-l-blue-400",
    AWAITING_CLIENT_CONFIRMATION: "border-l-purple-400",
    AWAITING_PROFESSIONAL_CONFIRMATION: "border-l-indigo-400",
    COMPLETED: "border-l-emerald-500",
    CANCELLED: "border-l-red-400",
    DISPUTED: "border-l-red-500",
  };

  const isProfessional = role === "professional";
  const otherUser = isProfessional ? order.client : order.professional;
  const description = order.description
    ? truncateText(order.description, 100)
    : null;

  return (
    <Link
      to={/* ... */}
      className={clsx(
        "card card-hover block border-l-4 p-3 sm:p-4",
        statusColors[order.status] || "border-l-slate-300"
      )}
    >
      <div className="flex gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Status badge + title */}
          <div className="flex items-start gap-2">
            <StatusBadge status={order.status} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {order.title}
            </h3>
          </div>

          {/* Description preview */}
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {description}
            </p>
          )}

          {/* Other user info */}
          {otherUser && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <img
                src={otherUser.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}&size=20&background=random`}
                className="w-5 h-5 rounded-full"
                alt=""
              />
              <span className="font-medium truncate">{otherUser.name}</span>
              {otherUser.ratingAverage > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {otherUser.ratingAverage.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {order.address && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {order.address.neighborhood}, {order.address.city}
            </p>
          )}
        </div>

        {/* Right: Price + dates + actions */}
        <div className="flex flex-col items-end justify-between text-right flex-shrink-0">
          <p className="text-base font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(order.price)}
          </p>

          <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            {order.scheduledDate && (
              <p className="flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3" />
                {formatDate(order.scheduledDate)}
              </p>
            )}
            {order.deadlineDate && (
              <p className={clsx("flex items-center gap-1 justify-end",
                new Date(order.deadlineDate) < new Date() && "text-red-500"
              )}>
                <Clock className="w-3 h-3" />
                Prazo: {formatDate(order.deadlineDate)}
              </p>
            )}
          </div>

          {/* Quick actions for PENDING orders (professional only) */}
          {isProfessional && order.status === "PENDING" && onAccept && (
            <div className="flex gap-1.5 mt-2" onClick={(e) => e.preventDefault()}>
              <button
                onClick={(e) => { e.preventDefault(); onAccept(order.id); }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                Aceitar
              </button>
              {onReject && (
                <button
                  onClick={(e) => { e.preventDefault(); onReject(order.id); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Recusar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/orders/OrderCard.tsx
git commit -m "feat: redesign OrderCard with colored border, 2-column layout, inline actions"
```

---

### Task 6: Atualizar ServiceOrdersList — espaçamento e tabs

**Files:**
- Modify: `frontend/src/components/orders/ServiceOrdersList.tsx`

**Step 1: Reduzir espaçamento entre cards**

Trocar `space-y-4` para `space-y-2.5` no container da lista de ordens.

**Step 2: Encurtar labels dos tabs para profissional**

Para o role `professional`, usar labels mais curtos:

```typescript
const professionalTabs = [
  { label: "Todos", value: "" },
  { label: "Novos", value: "PENDING" },
  { label: "Aceitos", value: "ACCEPTED" },
  { label: "Em Andamento", value: "IN_PROGRESS" },
  { label: "Aguard. Cliente", value: "AWAITING_CLIENT_CONFIRMATION" },
  { label: "Aguard. Você", value: "AWAITING_PROFESSIONAL_CONFIRMATION" },
  { label: "Concluídos", value: "COMPLETED" },
  { label: "Cancelados", value: "CANCELLED" },
];
```

**Step 3: Passar callbacks `onAccept` e `onReject` para OrderCard**

Implementar handlers no ServiceOrdersList que chamam `acceptOrder` e `cancelOrder` diretamente, com toast de sucesso e reload da lista.

**Step 4: Reduzir espaçamento geral da página**

Trocar `space-y-6` para `space-y-4` no container principal.

**Step 5: Commit**

```bash
git add frontend/src/components/orders/ServiceOrdersList.tsx
git commit -m "feat: reduce spacing, shorten tabs, add inline accept/reject in ServiceOrdersList"
```

---

## Issue 3: Bug de Rate Limiting (429 após ~12 minutos)

### Diagnóstico

**Causa raiz**: O `generalLimiter` permite apenas **100 requisições por 15 minutos** por IP, aplicado globalmente via `app.use(generalLimiter)`. O polling do chat (5s = ~180 req/15min), notificações (60s = 15 req/15min), e location tracking (5s = ~180 req/15min) esgotam o budget rapidamente.

**Cálculo**: Se o chat está aberto, apenas o polling de mensagens gera ~180 requisições em 15 min. Somando CORS preflight (OPTIONS = 2x), o limit de 100 é atingido em ~4-6 min com chat aberto, ou ~12 min com apenas notificações + navegação normal.

### Task 7: Corrigir rate limiter para suportar SPA com polling

**Files:**
- Modify: `backend/src/middleware/rateLimiter.ts`
- Modify: `backend/src/index.ts`

**Step 1: Criar um limiter dedicado para polling e aumentar o global**

Editar `backend/src/middleware/rateLimiter.ts`:

```typescript
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * General API rate limiter.
 * 500 req/15min — generous enough for SPAs with periodic fetches.
 * Per-route limiters handle sensitive endpoints separately.
 */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,                // 15 min
  max: env.RATE_LIMIT_MAX_REQUESTS,                   // Ler do env (mudar default)
  standardHeaders: true,
  legacyHeaders: false,
  // Skip OPTIONS (CORS preflight) — these should NOT count
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    message: 'Muitas requisicoes. Tente novamente mais tarde.',
    statusCode: 429,
  },
});

// authLimiter, sensitiveLimiter, financialLimiter — sem mudança
```

**Step 2: Aumentar o default de RATE_LIMIT_MAX_REQUESTS**

Editar `backend/src/config/env.ts`, trocar o default de `100` para `500`:

```typescript
RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10),
```

**Step 3: Mover static files ANTES do rate limiter no index.ts**

Editar `backend/src/index.ts`. Encontrar onde `express.static` é aplicado para `/uploads` e movê-lo para ANTES de `app.use(generalLimiter)`:

```typescript
// Static files (antes do rate limiter para não contar)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate limiting (depois de static)
app.use(generalLimiter);
```

**Step 4: Atualizar o .env e .env.example**

Em `backend/.env`, atualizar:
```
RATE_LIMIT_MAX_REQUESTS=500
```

Em `backend/.env.example`, atualizar:
```
RATE_LIMIT_MAX_REQUESTS=500
```

**Step 5: Verificar que o rate limiter funciona**

Run: `cd backend && npm run dev`

Em outro terminal, simular muitas requests:
```bash
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/auth/login; done
```

Expected: Todas retornam 401 (not authenticated), nenhuma 429 para 50 requests.

**Step 6: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/config/env.ts backend/src/index.ts backend/.env.example
git commit -m "fix: increase rate limit to 500 req/15min, skip OPTIONS, move static before limiter"
```

---

## Issue 4: Mapa do Google vs Mapa Customizado

### Diagnóstico

**Descobertas**:

1. **`ServiceDetails.tsx` NÃO TEM nenhum componente de mapa**. Zero. Nenhum `<InteractiveMap>`, nenhum iframe, nenhum Google Maps embed.

2. **Componentes de mapa customizados EXISTEM** em `frontend/src/components/map/`:
   - `InteractiveMap.tsx` — componente principal usando `@vis.gl/react-google-maps`
   - `ProfessionalMarker.tsx`, `DestinationMarker.tsx`, `LandmarkMarker.tsx` — markers customizados FazTudo
   - `MapLegend.tsx`, `RouteTracker.tsx` — overlays

3. **Estes componentes são usados em**:
   - `MapView.tsx` — página demo em `/mapa`
   - `OrderLocationMap.tsx` — tracking em pedidos

4. **A "visualização 3D do Google Maps" que o usuário vê no serviço 14** provavelmente é:
   - Na página de **order details** (não service details), onde `OrderLocationMap` renderiza o mapa
   - O `mapId="faztudo-route-map"` passa para o Google Maps JS API, que pode renderizar em 3D se configurado no Google Cloud Console
   - O `@vis.gl/react-google-maps` É o Google Maps SDK — ele renderiza o mapa do Google por design

5. **Conclusão**: O "nosso mapa" USA o Google Maps API por baixo (`@vis.gl/react-google-maps`). Os componentes customizados (markers, legend, route) são overlays sobre o mapa do Google. A visualização 3D vem da configuração do `mapId` no Google Cloud Console. Para ter um mapa totalmente customizado (não Google), seria necessário migrar para Mapbox, Leaflet, ou outro provider — que é uma mudança arquitetural grande.

### Task 8: Desabilitar 3D no Google Maps e garantir mapa 2D com estilo customizado

**Files:**
- Modify: `frontend/src/components/map/InteractiveMap.tsx`
- Modify: `frontend/src/components/orders/OrderLocationMap.tsx`

**Step 1: Forçar renderização 2D no InteractiveMap**

No `InteractiveMap.tsx`, no componente `<Map>`, adicionar `mapTypeId="roadmap"` para forçar 2D e remover o `mapId` que pode estar ativando 3D:

```tsx
<Map
  defaultCenter={defaultCenter}
  defaultZoom={zoom}
  gestureHandling="greedy"
  disableDefaultUI={true}
  zoomControl={true}
  mapTypeControl={false}
  streetViewControl={false}
  fullscreenControl={false}
  mapTypeId="roadmap"  // FORÇAR 2D
  // Remover mapId se estiver ativando 3D
  // mapId={mapId || "faztudo-interactive-map"}
  style={{ width: "100%", height: "100%" }}
  styles={customMapStyles}  // Aplicar estilo customizado aqui
>
```

**Step 2: Adicionar estilos customizados FazTudo ao mapa**

Criar um array de `google.maps.MapTypeStyle` com cores da marca FazTudo (azul primário, fundo claro/escuro dependendo do tema):

```typescript
const customMapStyles: google.maps.MapTypeStyle[] = [
  // Cores base mais suaves
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  // Estradas com cor primária sutil
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8eaed" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadce0" }] },
  // Água azulada
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  // POI desabilitados (menos poluição visual)
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  // Parques verdes suaves
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5f5e0" }] },
];
```

**Step 3: Fazer o mesmo no OrderLocationMap.tsx**

O `OrderLocationMap.tsx` (~ linha 287) tem `mapId="faztudo-route-map"`. Remover e aplicar `mapTypeId="roadmap"` + estilos customizados.

**Step 4: Commit**

```bash
git add frontend/src/components/map/InteractiveMap.tsx frontend/src/components/orders/OrderLocationMap.tsx
git commit -m "fix: force 2D roadmap view with custom FazTudo map styles, disable 3D"
```

---

### Task 9: Adicionar mapa de localização no ServiceDetails.tsx

**Files:**
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`

**Step 1: Importar o InteractiveMap**

O componente `InteractiveMap` já existe e funciona. Adicionar ao ServiceDetails.tsx para mostrar a localização do profissional (se disponível) ou a área de cobertura.

```tsx
import { InteractiveMap } from "../../components/map";
```

**Step 2: Adicionar seção de mapa após a descrição do serviço**

Se o listing tem um endereço ou coordenadas do profissional, renderizar o mapa:

```tsx
{/* Mapa de localização */}
{listing.professional?.addresses?.[0] && (
  <div className="card">
    <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
      Localização do Profissional
    </h2>
    <div className="rounded-xl overflow-hidden" style={{ height: "250px" }}>
      <InteractiveMap
        height="250px"
        center={{
          lat: listing.professional.addresses[0].latitude || -6.3614,
          lng: listing.professional.addresses[0].longitude || -39.2994,
        }}
        zoom={14}
        markers={[{
          position: {
            lat: listing.professional.addresses[0].latitude || -6.3614,
            lng: listing.professional.addresses[0].longitude || -39.2994,
          },
          label: listing.professional.name,
          type: "professional",
        }]}
      />
    </div>
  </div>
)}
```

**Nota**: Verificar se o endpoint da API que retorna o listing inclui as coordenadas do profissional. Se não incluir, esse passo pode ser adiado.

**Step 3: Commit**

```bash
git add frontend/src/pages/services/ServiceDetails.tsx
git commit -m "feat: add professional location map to ServiceDetails page"
```

---

## Resumo de Tasks

| # | Issue | Task | Estimativa |
|---|-------|------|------------|
| 1 | Confirmação | Inverter controller backend (cliente primeiro) | 15 min |
| 2 | Confirmação | Atualizar OrderDetails.tsx frontend | 15 min |
| 3 | Confirmação | Atualizar DualConfirmation + FlowStatusBanner | 10 min |
| 4 | Confirmação | Escrever testes | 15 min |
| 5 | UI Pedidos | Redesign OrderCard | 25 min |
| 6 | UI Pedidos | Atualizar ServiceOrdersList | 15 min |
| 7 | Rate Limit | Corrigir rate limiter | 10 min |
| 8 | Mapa | Desabilitar 3D, adicionar estilos | 15 min |
| 9 | Mapa | Adicionar mapa ao ServiceDetails | 10 min |

**Total estimado**: ~2 horas 10 minutos
