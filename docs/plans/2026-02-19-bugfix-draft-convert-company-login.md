# Bugfix: Draft Convert → Checkout + Company Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two bugs: (1) "Contratar Serviço" no DRAFT chat deve criar uma mensagem de sistema contextual e direcionar o cliente ao checkout; (2) Login como COMPANY resulta em erro "cannot read property length of undefined" (acesso a `state.user` inválido no CompanyDashboard).

**Architecture:**
- Bug 1: O backend `convertDraftToOrder` ignora o campo `action` e converte imediatamente para PENDING. A UX correta é: ao clicar "Contratar Serviço", o backend (action=propose) cria uma mensagem SYSTEM no chat com resumo do pedido + link de pagamento. O cliente vê o link no próprio chat e clica para ir ao checkout.
- Bug 2: `CompanyDashboard.tsx` usa `const { state } = useAuth() as any`, mas o AuthContext não expõe `state` — só expõe propriedades do estado diretamente (`user`, `isAuthenticated`, etc.). Isso causa TypeError ao tentar acessar `state.user.name`.

**Tech Stack:** TypeScript, React (Vite), Express, Prisma, Socket.io

---

## Bug 1 — "Contratar Serviço" no Chat DRAFT

### Análise do problema

**Fluxo atual:**
1. Cliente clica "Contratar serviço" → `convertDraftOrder(orderId, "propose")`
2. Backend recebe `POST /services/orders/:id/convert` com `{ action: "propose" }` — mas o backend ignora `action` e converte direto para `PENDING`
3. O frontend escuta `order:convertAccepted` via Socket para redirecionar, mas o backend nunca emite esse evento com `action=propose` — ele emite `order:statusChanged` com `status: PENDING`
4. O frontend mostra "Proposta enviada! Aguardando confirmação." mas a requisição já converteu — inconsistência

**Comportamento desejado (conforme spec):**
- Ao clicar "Contratar Serviço": backend envia **mensagem SYSTEM** no chat com: resumo do pedido (título, preço), histórico da conversa como contexto, e um link de pagamento (`/client/orders/:id/checkout`) visível para ambos
- O cliente vê a mensagem no chat e clica no link para pagar
- A conversa **não é convertida automaticamente** — só vai para PENDING quando o pagamento é confirmado (fluxo já existente)

**Solução simplificada (YAGNI):**
- Mudar o backend: quando `action === "propose"`, **não converter para PENDING** — em vez disso, criar uma mensagem SYSTEM no chat com o resumo + link de checkout
- O cliente clica no link dentro do chat → vai para `/client/orders/:id/checkout` (que já existe)
- Quando o pagamento é confirmado via webhook do MercadoPago, o status muda normalmente

---

### Task 1: Refatorar backend `convertDraftToOrder` para suportar `action`

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts` (função `convertDraftToOrder`)

**Step 1: Localizar a função `convertDraftToOrder`**

Abra `backend/src/controllers/service/orderController.ts` e localize a função `convertDraftToOrder` (por volta da linha 1402). Ela começa com:
```ts
export const convertDraftToOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
```

**Step 2: Substituir o corpo da função**

Substitua **toda** a função `convertDraftToOrder` pelo código abaixo. O novo código:
- Se `action === "propose"`: cria uma mensagem SYSTEM no chat com resumo + link de checkout e emite via Socket — **não converte o pedido**
- Se `action === "accept"` ou ausente: converte para PENDING (comportamento antigo, usado pelo profissional ao aceitar)
- Se `action === "reject"`: apenas notifica (descarta proposta)

```ts
// Converter DRAFT em pedido real (PENDING) — ou propor/aceitar/rejeitar conversão
export const convertDraftToOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { action = "accept", title, description, scheduledDate, price } = req.body;

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { id: true, name: true, profileImage: true } },
        professional: { select: { id: true, name: true, profileImage: true } },
        serviceListing: { select: { id: true, title: true, price: true } },
        messages: {
          where: { type: "TEXT" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { content: true, senderId: true, createdAt: true },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.status !== "DRAFT") {
      res.status(400).json(errorResponse("Only draft orders can be converted"));
      return;
    }

    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;

    if (!isClient && !isProfessional) {
      res.status(403).json(errorResponse("You are not part of this order"));
      return;
    }

    // ── ACTION: propose ──────────────────────────────────────────────────────
    // Cria mensagem SYSTEM no chat com resumo do pedido + link de checkout.
    // Não converte o pedido ainda — o pagamento faz isso.
    if (action === "propose") {
      const serviceTitle = serviceOrder.serviceListing?.title || serviceOrder.title;
      const servicePrice = (serviceOrder.price ?? 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const proposerName = req.user.name;

      const systemContent =
        `💼 ${proposerName} quer contratar este serviço!\n\n` +
        `📋 Serviço: ${serviceTitle}\n` +
        `💰 Valor: ${servicePrice}\n\n` +
        `Para continuar, o cliente deve realizar o pagamento. ` +
        `Clique no botão abaixo para prosseguir com a contratação.`;

      const systemMessage = await prisma.message.create({
        data: {
          content: systemContent,
          type: "SYSTEM",
          senderId: req.user.id,
          recipientId: isClient
            ? serviceOrder.professionalId!
            : serviceOrder.clientId,
          serviceOrderId: orderId,
          metadata: {
            action: "hire_proposal",
            checkoutUrl: `/client/orders/${orderId}/checkout`,
            proposedBy: req.user.id,
            proposerName,
          },
        },
      });

      // Notificar a outra parte
      const notifyUserId = isClient
        ? serviceOrder.professionalId!
        : serviceOrder.clientId;

      await createNotification(
        notifyUserId,
        NotificationType.ORDER_CREATED,
        `${proposerName} quer contratar o serviço`,
        `${proposerName} propôs a contratação de "${serviceTitle}". Veja o chat para detalhes.`,
        orderId,
        { proposedBy: req.user.id },
      );

      // Emitir proposta via Socket para que o outro lado veja o card de aceitar/recusar
      emitToOrder(orderId, "chat:message", {
        ...systemMessage,
        metadata: systemMessage.metadata,
      });
      emitToOrder(orderId, "order:convertProposal", {
        orderId,
        proposedBy: req.user.id,
        proposerName,
      });

      res.status(200).json(
        successResponse(
          { message: systemMessage },
          "Proposta enviada com sucesso. O cliente pode prosseguir com o pagamento no chat.",
        ),
      );
      return;
    }

    // ── ACTION: reject ───────────────────────────────────────────────────────
    if (action === "reject") {
      const notifyUserId = isClient
        ? serviceOrder.professionalId!
        : serviceOrder.clientId;

      await createNotification(
        notifyUserId,
        NotificationType.SYSTEM_ALERT,
        "Proposta recusada",
        `${req.user.name} recusou a proposta de contratação.`,
        orderId,
      );

      emitToOrder(orderId, "order:convertRejected", { orderId });

      res.status(200).json(successResponse(null, "Proposta recusada."));
      return;
    }

    // ── ACTION: accept (ou padrão) ──────────────────────────────────────────
    // Converte DRAFT → PENDING (comportamento original)
    let scheduledDateObj: Date | undefined;
    if (scheduledDate) {
      scheduledDateObj = new Date(scheduledDate);
      if (isNaN(scheduledDateObj.getTime())) {
        res.status(400).json(errorResponse("Invalid scheduled date"));
        return;
      }
    }

    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "PENDING",
        title: title || serviceOrder.title,
        description: description || serviceOrder.description,
        price: price || serviceOrder.price,
        scheduledDate: scheduledDateObj || serviceOrder.scheduledDate,
      },
      include: {
        client: { select: { id: true, name: true, profileImage: true } },
        professional: { select: { id: true, name: true, profileImage: true } },
        serviceListing: { select: { id: true, title: true, price: true } },
      },
    });

    const notifyUserId = isClient
      ? serviceOrder.professionalId!
      : serviceOrder.clientId;
    const actorLabel = isClient ? "cliente" : "profissional";

    await createNotification(
      notifyUserId,
      NotificationType.ORDER_CREATED,
      "Conversa convertida em pedido",
      `O ${actorLabel} ${req.user.name} formalizou o pedido "${updatedOrder.title}"`,
      orderId,
      { convertedBy: req.user.id },
    );

    emitToOrder(orderId, "order:statusChanged", { orderId, status: "PENDING" });
    emitToOrder(orderId, "order:convertAccepted", { orderId });

    res.status(200).json(
      successResponse(
        { serviceOrder: updatedOrder },
        "Draft converted to order successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Convert draft to order error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 3: Verificar que `metadata` existe no model Message do Prisma**

Execute:
```bash
grep -n "metadata" /home/levybonito/faztudo-main/backend/prisma/schema.prisma | head -20
```

Se o campo `metadata` **não existir** no model `Message`, pule o campo `metadata` na criação da mensagem e use apenas `content`. Se existir (tipo `Json?`), mantenha como está.

**Step 4: Build do backend para verificar erros de TS**

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | head -50
```

Esperado: sem erros (ou apenas erros pré-existentes não relacionados).

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add backend/src/controllers/service/orderController.ts
git commit -m "fix: convertDraftToOrder — propose cria mensagem SYSTEM com link de checkout no chat"
```

---

### Task 2: Atualizar `ServiceChat.tsx` para renderizar mensagem SYSTEM de proposta com botão de checkout

**Files:**
- Modify: `frontend/src/pages/services/ServiceChat.tsx`

**Step 1: Localizar o case "SYSTEM" no `renderMessageContent`**

No arquivo `ServiceChat.tsx`, localize o switch case `"SYSTEM"` dentro da função `renderMessageContent`. Atualmente é:

```tsx
case "SYSTEM":
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-xs text-slate-500 dark:text-slate-400">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{message.content}</span>
      </div>
    </div>
  );
```

**Step 2: Substituir o case "SYSTEM" para detectar mensagens de proposta de contratação**

Substitua o case `"SYSTEM"` por:

```tsx
case "SYSTEM": {
  // Detectar se é uma mensagem de proposta de contratação
  const metadata = (message as any).metadata as Record<string, any> | null;
  const isHireProposal = metadata?.action === "hire_proposal";
  const checkoutUrl = metadata?.checkoutUrl as string | undefined;

  if (isHireProposal && checkoutUrl) {
    // Mensagem especial: proposta de contratação com botão de checkout
    return (
      <div className="flex items-center justify-center py-3 px-2">
        <div className="w-full max-w-sm rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Proposta de Contratação
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line mb-3">
            {message.content}
          </div>
          {/* Só mostra o botão de pagamento para o cliente */}
          {!isProfessionalRoute && (
            <button
              onClick={() => navigate(checkoutUrl)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Realizar Pagamento
            </button>
          )}
          {isProfessionalRoute && (
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              Aguardando o cliente realizar o pagamento…
            </p>
          )}
          <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-slate-500">
            {formatRelativeTime(message.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  // Mensagem de sistema padrão
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-xs text-slate-500 dark:text-slate-400">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
```

**Step 3: Verificar imports no topo do arquivo**

O arquivo já importa `ShoppingCart` e `navigate` e `useNavigate`? Verifique:
- `ShoppingCart` já está importado (linha ~11)
- `navigate` já existe no componente (linha ~36: `const navigate = useNavigate()`)
- `isProfessionalRoute` já existe (linha ~52)

Se algum import estiver faltando, adicione na seção de imports do lucide-react.

**Step 4: Verificar types — adicionar `metadata` ao tipo Message**

Localize o tipo `Message` em `frontend/src/types/entities.ts` (ou `frontend/src/types/index.ts`). Execute:

```bash
grep -n "metadata\|type Message\|interface Message" /home/levybonito/faztudo-main/frontend/src/types/entities.ts
```

Se o tipo `Message` não tiver o campo `metadata`, adicione `metadata?: Record<string, any> | null;` ao tipo. Se o campo já existir, não precisa fazer nada.

**Step 5: Build de verificação**

```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | head -50
```

Esperado: sem novos erros.

**Step 6: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/services/ServiceChat.tsx frontend/src/types/entities.ts
git commit -m "fix: chat DRAFT — mensagem SYSTEM de proposta exibe botão de checkout para cliente"
```

---

### Task 3: Ajuste UX no botão "Contratar Serviço" — feedback melhorado

**Files:**
- Modify: `frontend/src/pages/services/ServiceChat.tsx` (parte do banner DRAFT)

**Context:** Atualmente o botão "Contratar serviço" mostra "Proposta enviada! Aguardando confirmação." via toast. Com a nova implementação, a proposta gera uma mensagem no chat, então o toast deve ser mais claro.

**Step 1: Localizar o handler do botão "Contratar servico" no banner DRAFT**

No arquivo `ServiceChat.tsx`, localize o `onClick` do botão "Contratar servico" (por volta da linha 286-305):

```tsx
onClick={async () => {
  if (!orderId) return;
  setConverting(true);
  try {
    await convertDraftOrder(orderId, "propose");
    toast.success("Proposta enviada! Aguardando confirmacao.");
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Erro ao propor pedido");
  } finally {
    setConverting(false);
  }
}}
```

**Step 2: Atualizar o toast e recarregar mensagens após proposta**

Substitua o bloco `try` do handler:

```tsx
try {
  await convertDraftOrder(orderId, "propose");
  toast.success("Proposta enviada! Veja a mensagem no chat para prosseguir com o pagamento.");
  // Recarregar mensagens para mostrar a nova mensagem SYSTEM
  await loadMessages(orderId);
} catch (err: any) {
  toast.error(err?.response?.data?.message || "Erro ao propor pedido");
}
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/services/ServiceChat.tsx
git commit -m "fix: recarregar mensagens após proposta de contratação"
```

---

## Bug 2 — Login como Company: `cannot read property length of undefined`

### Análise do problema

**Raiz do erro:** `frontend/src/pages/company/Dashboard.tsx` linha ~46:

```tsx
const { state } = useAuth() as any;
```

O hook `useAuth()` retorna as propriedades do estado **diretamente** (por spreading em `AuthContext.tsx` linha ~188: `const value: AuthContextType = { ...state, login, register, ... }`). Não existe propriedade `state` no contexto. Ao tentar acessar `state.user.name` no template (linha ~112), `state` é `undefined`, logo `state.user` lança TypeError.

O erro acontece apenas no login porque o componente é montado logo após o redirect para `/company/dashboard`.

**Solução:** Substituir `state.user` por `user` (que é exposto diretamente pelo contexto).

---

### Task 4: Corrigir `CompanyDashboard.tsx` — remover acesso inválido a `state`

**Files:**
- Modify: `frontend/src/pages/company/Dashboard.tsx`

**Step 1: Abrir o arquivo e localizar o problema**

Abra `frontend/src/pages/company/Dashboard.tsx`. Localize:

```tsx
const { state } = useAuth() as any;
```

(linha ~46, dentro do componente `CompanyDashboard`)

**Step 2: Substituir pelo destructuring correto**

Substitua a linha problemática por:

```tsx
const { user } = useAuth();
```

**Step 3: Localizar onde `state.user` é usado no template**

Busque por `state?.user` ou `state.user` no arquivo. Você vai encontrar algo como:

```tsx
Bem-vindo, {state?.user?.name}.
```

(linha ~112 do arquivo, dentro do `<p>` do header)

**Step 4: Substituir `state?.user?.name` por `user?.name`**

```tsx
Bem-vindo, {user?.name}.
```

**Step 5: Verificar se há outros usos de `state` no arquivo**

Execute:
```bash
grep -n "state" /home/levybonito/faztudo-main/frontend/src/pages/company/Dashboard.tsx
```

Se houver outros usos de `state.xxx`, substitua cada um pelo equivalente direto (`user`, `isAuthenticated`, etc.) do hook `useAuth()`.

**Step 6: Build de verificação**

```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "Dashboard\|company" | head -20
```

Esperado: sem erros relacionados ao Dashboard.

**Step 7: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/company/Dashboard.tsx
git commit -m "fix: company dashboard — substituir state.user por user (TypeError no login)"
```

---

### Task 5: Verificar outros arquivos de company pages com mesmo padrão

**Files:**
- Read (verificação): todos os arquivos em `frontend/src/pages/company/`

**Context:** O mesmo bug pode existir em outros arquivos company que usam `useAuth() as any` e acessam `state`.

**Step 1: Buscar o padrão em todo o diretório company**

```bash
grep -rn "state.*useAuth\|useAuth.*state\|{ state }" /home/levybonito/faztudo-main/frontend/src/pages/company/
```

**Step 2: Para cada arquivo com o padrão**, aplicar a mesma correção:
- `const { state } = useAuth() as any;` → `const { user } = useAuth();`
- Qualquer `state?.user` → `user`
- Qualquer `state?.isAuthenticated` → `isAuthenticated`

**Step 3: Commit (se houver arquivos adicionais)**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/company/
git commit -m "fix: remover acesso inválido a state em páginas da company"
```

---

## Task 6: Verificar campo `metadata` no schema Prisma do Message

**Files:**
- Read: `backend/prisma/schema.prisma`

**Context:** A Task 1 usa `metadata` na criação de Message. Precisamos garantir que o campo existe.

**Step 1: Verificar o model Message no schema**

```bash
grep -A 30 "model Message" /home/levybonito/faztudo-main/backend/prisma/schema.prisma
```

**Step 2a: Se `metadata` JÁ EXISTE** (tipo `Json?`) → nada a fazer, pule para Task 7.

**Step 2b: Se `metadata` NÃO EXISTE:**

Adicione o campo ao model `Message` no schema:

```prisma
  metadata          Json?
```

Depois execute migration:

```bash
cd /home/levybonito/faztudo-main/backend
npx prisma migrate dev --name add_message_metadata
```

**Step 2c: Se não for possível rodar migration (produção):**

Remova o campo `metadata` da criação de mensagem na Task 1 e armazene as informações de checkout apenas no `content` da mensagem como texto simples. A lógica de renderização do frontend (Task 2) pode detectar mensagens de proposta pelo prefixo do `content` em vez de `metadata`.

**Implementação alternativa sem metadata:**

No backend (Task 1), prefixar o content com um marcador:
```ts
const systemContent = `[HIRE_PROPOSAL:${orderId}] 💼 ${proposerName} quer contratar...`;
```

No frontend (Task 2), detectar pelo prefixo:
```tsx
const isHireProposal = message.content.startsWith("[HIRE_PROPOSAL:");
const orderIdMatch = message.content.match(/\[HIRE_PROPOSAL:(\d+)\]/);
const checkoutUrl = orderIdMatch ? `/client/orders/${orderIdMatch[1]}/checkout` : undefined;
```

**Step 3: Build de verificação**

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit (se houve alteração)**

```bash
cd /home/levybonito/faztudo-main
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: adicionar campo metadata ao model Message"
```

---

## Task 7: Teste manual end-to-end

**Bug 1 — Contratar Serviço:**

1. Login como cliente → navegar para um serviço → clicar "Tirar Dúvidas" → chat DRAFT abre
2. No banner amarelo, clicar "Contratar serviço"
3. **Esperado:** toast "Proposta enviada! Veja a mensagem no chat..." + nova mensagem aparece no chat com card verde "Proposta de Contratação" + botão "Realizar Pagamento"
4. Clicar "Realizar Pagamento" → **esperado:** navegar para `/client/orders/:id/checkout`
5. Login como profissional no mesmo chat → **esperado:** ver o card de proposta + "Aguardando o cliente realizar o pagamento…"

**Bug 2 — Login Company:**

1. Login como usuário com role COMPANY
2. **Esperado:** redirect para `/company/dashboard` sem erro, nome do usuário exibido corretamente no header
3. Navegar por outras páginas company (Members, Orders, etc.) — **esperado:** sem erros

---

## Notas Importantes

### Sobre o campo `metadata` no tipo `Message` do frontend

O tipo `Message` em `frontend/src/types/entities.ts` provavelmente não tem o campo `metadata`. Use `(message as any).metadata` no frontend para evitar erros de TypeScript no curto prazo, ou adicione o campo ao tipo como `metadata?: Record<string, any> | null`.

### Sobre o checkout após proposta

O checkout (`/client/orders/:id/checkout`) já existe e já processa pagamentos. Quando o pagamento é confirmado pelo webhook do MercadoPago, o pedido já tem lógica para mudar de status. A conversão de DRAFT → PENDING não é mais necessária via "Contratar Serviço" — o pagamento resolve isso naturalmente.

### Sobre a rota de checkout para pedidos DRAFT

Verificar se o componente `Checkout.tsx` aceita pedidos com status `DRAFT`. Se ele verificar `order.status === 'PENDING'` como pré-requisito, será necessário ajustá-lo para também aceitar `DRAFT`. Isso pode ser uma task adicional se encontrar problemas.

```bash
grep -n "DRAFT\|PENDING\|status" /home/levybonito/faztudo-main/frontend/src/pages/checkout/Checkout.tsx | head -20
```
