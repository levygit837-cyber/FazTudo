# Order Progress Stepper & Timeout System — Design

> **Data**: 2026-02-23
> **Escopo**: Barra de progresso unificada + timeout automatico + reembolso
> **Impacto**: Backend (schema, rotas, worker) + Frontend (OrderDetails, OrderStepper)

---

## 1. Contexto e Problema

### Problemas Identificados

1. **Steppers nao aparecem nos pedidos**: Existem 3 implementacoes de stepper (`CheckoutStepper` inline, `OrderProgressStepper` inline, `ServiceFlowStepper` componente) mas nao estao sendo exibidos corretamente.
2. **Passos incompletos**: Os steppers atuais nao cobrem todo o ciclo de vida do pedido.
3. **Sem timeout para aceite**: Se profissional nao responde, cliente fica preso com dinheiro no escrow.
4. **Visoes identicas**: Cliente e profissional veem a mesma coisa, mas tem necessidades diferentes.

### Modelo de Negocio: Vitrine + Agenda

O FazTudo opera como marketplace de vitrines:
- **Profissional** cria servicos na vitrine (preco, descricao, horarios)
- **Cliente** busca, seleciona servico, escolhe horario, paga
- **Profissional** confirma ou recusa o pedido ja pago

Solicitacoes de servico pelo cliente sao mantidas como opcao secundaria mas nao priorizadas.

---

## 2. Novo Fluxo de Pedido

```
Cliente navega vitrine
  → Seleciona servico + horario
  → Paga (MercadoPago)
  → Pedido criado como PENDING (escrow HELD)
  → Profissional recebe notificacao
     ├─ Confirma → ACCEPTED
     │   → EN_ROUTE (profissional marca "a caminho")
     │   → IN_PROGRESS (servico iniciado)
     │   → AWAITING_PROFESSIONAL_CONFIRMATION (cliente confirma)
     │   → COMPLETED (profissional confirma → escrow RELEASED 90/10)
     ├─ Recusa → CANCELLED + reembolso automatico
     └─ Timeout → EXPIRED + reembolso automatico
```

### Mudanca-chave: Pagamento ANTES do aceite

O fluxo atual faz pagamento apos aceite. O novo fluxo inverte:
- Cliente paga ao criar pedido → dinheiro no escrow
- Profissional aceita ou recusa com dinheiro ja garantido
- Se nao aceitar → reembolso automatico

---

## 3. Stepper Horizontal — Visoes por Role

### Visao do CLIENTE (7 passos)

```
●────●────●────○────○────○────○
Pedido   Pago   Aguard.  A cam.  Execucao  Confirm.  Concluido
Criado          Prof.
14:30   14:32   ...timer
```

| # | Passo | Ativa quando (status) | Info extra |
|---|-------|----------------------|------------|
| 1 | Pedido Criado | PENDING | Data/hora criacao |
| 2 | Pagamento Realizado | Payment HELD | Valor, metodo |
| 3 | Aguardando Profissional | PENDING (pago) | Countdown do timeout + botao "Cancelar" apos 1h se agendado |
| 4 | Profissional a Caminho | EN_ROUTE | Mapa com localizacao |
| 5 | Servico em Andamento | IN_PROGRESS | Hora de inicio |
| 6 | Aguardando Confirmacao | AWAITING_PROFESSIONAL_CONFIRMATION | Quem ja confirmou |
| 7 | Concluido | COMPLETED | Botao "Avaliar Profissional" |

### Visao do PROFISSIONAL (7 passos)

```
●────●────○────○────○────○────○
Pedido   Aceitar   Agenda   A cam.  Execucao  Confirm.  Concluido
Recebido  check/x
```

| # | Passo | Ativa quando (status) | Info extra |
|---|-------|----------------------|------------|
| 1 | Pedido Recebido | PENDING | Detalhes do servico, valor |
| 2 | Aceitar/Recusar | PENDING (acao) | Botoes Aceitar/Recusar + countdown |
| 3 | Detalhes do Agendamento | ACCEPTED | Data, horario, endereco, observacoes |
| 4 | A Caminho | EN_ROUTE | Botao "Estou a caminho" + compartilha localizacao |
| 5 | Servico em Andamento | IN_PROGRESS | Botao "Iniciar Servico" |
| 6 | Aguardando Confirmacao | AWAITING_PROFESSIONAL_CONFIRMATION | Botao "Confirmar Conclusao" |
| 7 | Concluido | COMPLETED | Valor recebido (90%), avaliacao |

### Estados especiais (substituem o stepper)

- **CANCELLED/EXPIRED**: Banner vermelho com motivo + status do reembolso
- **DISPUTED**: Banner amarelo com link para detalhes

### Componente unificado

Substituir os 3 steppers existentes por **um unico `OrderStepper`** em `components/orders/OrderStepper.tsx`:
- Props: `order`, `userRole`, `payment`
- Calcula passos automaticamente baseado em status + role
- Timestamps de cada passo completado
- Animacao de pulsacao no passo atual
- Responsivo: horizontal em desktop, vertical compacto em mobile

---

## 4. Sistema de Timeout e Reembolso

### Regras

| Tipo | Criterio | Timeout | Cancelamento cliente | Auto-expire |
|------|----------|---------|---------------------|-------------|
| Urgente | Data agendada = hoje ou amanha | 1h | Imediato | 1h → EXPIRED + reembolso |
| Agendado | Data agendada = depois de amanha+ | 24h | Apos 1h sem resposta | 24h → EXPIRED + reembolso |

### Notificacoes ao profissional (3 lembretes)

1. **Imediata**: "Novo pedido! Confirme em X horas"
2. **50% do tempo**: "Lembrete: pedido aguardando sua confirmacao"
3. **80% do tempo**: "Ultimo aviso: pedido sera cancelado em X minutos"

### Fluxo de reembolso

```
Timeout ou Cancelamento
  → Status: EXPIRED ou CANCELLED
  → Payment: HELD → REFUNDED (via paymentStateMachine)
  → MercadoPago API: refund
  → Notifica cliente: "Reembolso de R$ X processado"
  → Notifica profissional: "Pedido expirado por falta de confirmacao"
```

### Protecao contra abuso

- 3+ pedidos expirados em 30 dias → flag `lowResponseRate: true`
- Flag visivel na vitrine como aviso (nao bloqueia o profissional)
- Contador resetado mensalmente via scheduler

---

## 5. Mudancas Tecnicas

### 5.1 Prisma Schema

```prisma
// Novo valor no enum
enum ServiceOrderStatus {
  DRAFT
  PENDING
  ACCEPTED
  EN_ROUTE          // NOVO
  IN_PROGRESS
  AWAITING_CLIENT_CONFIRMATION
  AWAITING_PROFESSIONAL_CONFIRMATION
  COMPLETED
  CANCELLED
  EXPIRED
  DISPUTED
}

// Novos campos em ServiceOrder
model ServiceOrder {
  // ... existentes ...
  enRouteAt       DateTime?
  timeoutAt       DateTime?
  timeoutJobId    String?
}

// Novos campos em User
model User {
  // ... existentes ...
  expiredOrderCount  Int       @default(0)
  lastExpiredReset   DateTime?
}
```

### 5.2 Rotas / Endpoints

| Endpoint | Mudanca |
|----------|---------|
| `POST /orders` | Cria job de timeout no BullMQ. Inclui `timeoutAt` |
| `POST /orders/:id/accept` | Cancela job de timeout. PENDING → ACCEPTED |
| `POST /orders/:id/reject` | Nova rota. PENDING → CANCELLED + reembolso |
| `POST /orders/:id/en-route` | Ja existe. Adicionar transicao ACCEPTED → EN_ROUTE |
| `POST /orders/:id/cancel` | Permitir cliente cancelar PENDING apos 1h (agendados) |
| `GET /orders/:id` | Incluir `timeoutAt` na resposta |

### 5.3 Novo Worker: Order Timeout

Arquivo: `backend/src/workers/orderTimeoutWorker.ts`
- Fila: `order-timeout`
- Processa: verifica se pedido ainda PENDING → EXPIRED + reembolso
- Idempotente: ignora se ja aceito/cancelado

### 5.4 Scheduler

- Job mensal: reseta `expiredOrderCount` de todos os profissionais
- Mantem `lastExpiredReset` para auditoria

### 5.5 Frontend

- Novo componente: `OrderStepper.tsx` (unificado)
- Remover: `CheckoutStepper` inline, `OrderProgressStepper` inline do `OrderDetails.tsx`
- Atualizar: `ServiceFlowStepper` → deprecar em favor do novo `OrderStepper`
- Atualizar: `enums.ts` com `EN_ROUTE`
- Atualizar: tipos de `ServiceOrder` com novos campos

---

## 6. O Que NAO Muda

- Payment state machine (PENDING → HELD → RELEASED/REFUNDED)
- Escrow service (logica de split 90/10)
- Chat/mensagens
- Sistema de disputas
- Solicitacoes (mantidas como opcao secundaria)
- MercadoPago integration
- Socket.io events (mantidos, adicionados novos para timeout)
