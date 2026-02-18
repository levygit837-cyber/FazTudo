# UX Refinement: Socket.io, Flash Fix, Chat DRAFT & Delay Disputes — Design Document

> **Data**: 2026-02-17
> **Status**: Aprovado
> **Escopo**: 4 features interligadas para melhorar a experiencia do fluxo profissional-cliente

---

## Resumo

Este documento descreve o design de 4 melhorias no FazTudo:

1. **Infraestrutura Socket.io** — comunicacao em tempo real (base para todas as outras)
2. **Fix Flash + OrderBrief** — eliminar flashes visuais + mostrar instrucoes do cliente ao profissional
3. **Chat DRAFT** — chat pre-pagamento via "Tirar Duvidas" com conversao em pedido
4. **Fluxo de Atraso + Disputa** — timer 15min, notificacao em 2 etapas, disputa automatica

---

## Secao 1: Infraestrutura Socket.io

### Backend
- **Novo**: `backend/src/lib/socket.ts` — singleton Socket.io server, autenticacao JWT
- **Modificar**: `backend/src/index.ts` — integrar HTTP server com Socket.io
- **Eventos emitidos**:
  - `order:statusChanged` — mudanca de status
  - `order:accepted` — aceitacao (para cliente)
  - `notification:new` — nova notificacao
  - `chat:message` — nova mensagem
  - `chat:typing` — indicador de digitacao
- **Rooms**: `user:{userId}` (pessoal), `order:{orderId}` (participantes)

### Frontend
- **Novo**: `frontend/src/context/SocketContext.tsx` — context provider
- **Novo**: `frontend/src/hooks/useSocket.ts` — hook para escutar eventos
- **Modificar**: `Layout.tsx` — wrappear com SocketProvider, badge real-time
- **Modificar**: `ServiceChat.tsx` — substituir polling 5s por Socket.io
- **Modificar**: `Notifications.tsx` — substituir polling 5min por Socket.io
- Polling mantido como fallback (intervalo aumentado para 60s)

---

## Secao 2: Fix Flash + OrderBrief

### 2A. Eliminar Flash

**3 tecnicas combinadas**:
1. **Optimistic updates**: atualizar estado local imediatamente (reverter se API falhar)
2. **Loading condicional**: skeleton so na primeira carga, re-fetchs silenciosos
3. **Socket.io**: `order:statusChanged` atualiza sem re-fetch

**Arquivos**: `OrderDetails.tsx`, `ServiceOrdersList.tsx`, `OrderCard.tsx`

### 2B. OrderBrief Visivel ao Profissional

**Backend**: incluir `brief: true` no Prisma include de `getServiceOrder()` e `acceptServiceOrder()`

**Frontend**: novo bloco "Instrucoes do Cliente" em OrderDetails quando status=ACCEPTED + role=PROFESSIONAL:
- Nivel de urgencia (badges coloridos)
- Faixa de preco (R$ min - max)
- Dados do briefing (JSON renderizado)
- Fotos/videos (thumbnails)
- Notas adicionais
- Botao "Iniciar conversa com o cliente"

---

## Secao 3: Chat DRAFT (Pre-Pagamento)

### Conceito
"Tirar Duvidas" cria ServiceOrder com status DRAFT. Chat funciona sem pagamento (so texto). Conversao em pedido requer confirmacao de ambas as partes.

### Backend
- Adicionar `DRAFT` ao enum `ServiceOrderStatus`
- `POST /orders/draft` — cria pedido DRAFT
- `POST /orders/:id/convert-to-order` — propoe conversao (requer confirmacao dupla)
- `POST /orders/:id/convert-response` — aceitar/rejeitar proposta de conversao
- Modificar `sendMessage()` — permitir TEXT em DRAFT (sem ATTACHMENT/LOCATION)
- Modificar `getUserChats()` — incluir pedidos DRAFT

### Conversao com Confirmacao Dupla
1. Qualquer parte clica "Contratar servico"
2. Campo `convertProposedBy` setado, `convertStatus: "PROPOSED"`
3. Mensagem SYSTEM no chat informando
4. Notificacao Socket.io para a outra parte
5. Outra parte aceita → DRAFT → PENDING → checkout
6. Outra parte recusa → conversa continua normalmente

### Frontend
- `ServiceDetails.tsx` — modal ativado, cria DRAFT + envia mensagem + navega pro chat
- `ServiceChat.tsx` — para DRAFT: sem upload/localizacao, banner "conversa de duvidas", botao "Contratar"
- `Messages.tsx` — badge "Duvidas" para DRAFTs
- `OrderCard.tsx` — sem aceitar/recusar para DRAFTs

---

## Secao 4: Fluxo de Atraso + Disputa

### Campos Novos
- `ServiceOrder.enRouteAt: DateTime?` — quando profissional clicou "Iniciar trajeto"

### Backend
- **Novo**: `backend/src/services/schedulerService.ts` — verifica atrasos a cada 60s
- `POST /orders/:id/en-route` — profissional marca trajeto
- `POST /orders/:id/delay-response` — cliente responde
- Disputa automatica seta `status: DISPUTED`

### Fluxo Completo
```
scheduledDate + 15min sem enRouteAt
    → Socket.io: order:delayAlert para cliente
    → "O profissional ja chegou?" [Sim] [Nao]

Sim → fecha notificacao
Nao → "Que pena! Deseja enviar mensagem ou abrir disputa?"
    [Enviar mensagem] → abre chat + msg SYSTEM + notifica profissional
    [Abrir disputa] → cria Dispute + status DISPUTED + msg SYSTEM + notifica ambos
```

### Frontend
- **Novo**: `DelayAlertModal.tsx` — modal 2 etapas
- `OrderDetails.tsx` — botao "Iniciar trajeto" para profissional + countdown visual
- Notificacao imediata de aceitacao via Socket.io
