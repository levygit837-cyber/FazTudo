# Analise Completa do Projeto FazTudo - Plano de Trabalho Colaborativo

> **Data**: 2026-02-16
> **Objetivo**: Mapear funcionalidades, identificar problemas e definir estrategia para desenvolvimento em equipe com agentes de IA

---

## 1. RESUMO EXECUTIVO

O FazTudo e um marketplace de servicos funcional com ~39.000 linhas de TypeScript divididas entre backend (Express 5 + Prisma + SQLite) e frontend (React 18 + Vite + TailwindCSS). O projeto tem uma boa base arquitetural, mas apresenta pontos criticos que precisam ser resolvidos ANTES de iniciar trabalho colaborativo com dois agentes de IA para evitar conflitos destrutivos.

**Numeros do Projeto**:
- 44 arquivos backend TypeScript
- 93 arquivos frontend TypeScript/TSX
- 21 modelos no banco de dados
- 60+ endpoints REST
- 11 arquivos de teste (backend apenas)
- 7 planos de implementacao em docs/plans/

---

## 2. MAPEAMENTO COMPLETO DE FUNCIONALIDADES

### 2.1 Autenticacao e Usuarios

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Registro de usuario (CLIENT/PROFESSIONAL) | Implementado | `authController.ts`, `Register.tsx` |
| Login com JWT + refresh token | Implementado | `authController.ts`, `Login.tsx`, `AuthContext.tsx` |
| Logout e invalidacao de token | Implementado | `authController.ts` |
| Perfil do usuario (ver/editar) | Implementado | `authController.ts`, `Profile.tsx`, `Settings.tsx` |
| Verificacao de conta (documento + facial) | Implementado | `adminController.ts`, `VerifyAccount.tsx` |
| Roles: CLIENT, PROFESSIONAL, ADMIN | Implementado | `middleware/auth.ts`, `types/index.ts` |
| Rotas protegidas por role | Implementado | `ProtectedRoute.tsx`, `middleware/auth.ts` |

### 2.2 Catalogo de Servicos

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Listar servicos (publico) | Implementado | `listingController.ts`, `ServiceSearch.tsx` |
| Criar servico (profissional) | Implementado | `listingController.ts`, `CreateService.tsx` |
| Editar servico | Implementado | `listingController.ts`, `EditService.tsx` |
| Deletar servico | Implementado | `listingController.ts` |
| Detalhes do servico | Implementado | `serviceController.ts`, `ServiceDetails.tsx` |
| Busca por texto, categoria, preco | Implementado | `ServiceSearch.tsx`, `SearchBar.tsx` |
| Categorias hierarquicas | Implementado | `categoryController.ts`, `CategoryGrid.tsx` |
| Favoritos | Implementado (local) | `hooks/useFavorites.ts` |
| Recomendacoes personalizadas | Implementado | `recommendationService.ts` |

### 2.3 Pedidos (Orders)

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Criar pedido simples | Implementado | `orderController.ts`, `NewOrder.tsx` |
| Criar pedido com briefing | Implementado | `briefController.ts` |
| Listar pedidos (cliente/profissional) | Implementado | `orderController.ts`, `ServiceOrders.tsx` (2 versoes) |
| Detalhes do pedido | Implementado | `orderController.ts`, `OrderDetails.tsx` |
| Aceitar pedido (profissional) | Implementado | `orderController.ts` |
| Iniciar servico | Implementado | `orderController.ts` |
| Submeter conclusao (profissional) | Implementado | `orderController.ts` |
| Confirmar conclusao (cliente) | Implementado | `orderController.ts` |
| Confirmacao dupla (profissional) | Implementado | `orderController.ts`, `DualConfirmation.tsx` |
| Cancelar pedido | Implementado | `orderController.ts` |
| Reagendar pedido | Implementado | `scheduleController.ts`, `RescheduleModal.tsx` |
| Stepper visual do fluxo | Implementado | `ServiceFlowStepper.tsx`, `FlowStatusBanner.tsx` |
| Timeline do pedido | Implementado | `OrderTimeline.tsx` |

### 2.4 Pagamentos (MercadoPago)

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Checkout transparente (cartao) | Implementado | `paymentController.ts`, `CardForm.tsx` |
| Pagamento PIX | Implementado | `mercadopagoService.ts`, `PixPayment.tsx` |
| Pagamento Boleto | Implementado | `mercadopagoService.ts`, `BoletoPayment.tsx` |
| Escrow (retencao de pagamento) | Implementado | `escrowService.ts`, `EscrowIndicator.tsx` |
| Liberacao de escrow | Implementado | `escrowService.ts` |
| Webhook do MercadoPago | Implementado | `paymentController.ts` |
| Pagina de checkout | Implementado | `Checkout.tsx`, `PaymentConfirmation.tsx` |
| Banner de status do pagamento | Implementado | `PaymentStatusBanner.tsx` |
| Hook useMercadoPago | Implementado | `hooks/useMercadoPago.ts` |

### 2.5 Chat e Mensagens

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Enviar mensagem de texto | Implementado | `messageController.ts`, `ServiceChat.tsx` |
| Upload de arquivo | Implementado | `fileUploadController.ts` |
| Mensagem de localizacao | Implementado | `messageController.ts` |
| Mensagem do sistema | Implementado | `messageController.ts` |
| Listar conversas | Implementado | `chatController.ts`, `Messages.tsx` |
| Filtro anti-contato (telefone, email, CPF, redes sociais) | Implementado | `middleware/chatFilter.ts` |
| Gate de pagamento (exige pagamento aprovado para chatear) | Implementado | `messageController.ts` |

### 2.6 Propostas e Licitacao

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Enviar proposta (profissional) | Implementado | `proposalController.ts` |
| Listar propostas | Implementado | `proposalController.ts` |
| Aceitar proposta | Implementado | `proposalController.ts` |
| Rejeitar proposta | Implementado | `proposalController.ts` |
| Retirar proposta | Implementado | `proposalController.ts` |
| Comparador de propostas | Implementado | `ProposalComparator.tsx` |

### 2.7 Avaliacoes

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Criar avaliacao (3 criterios) | Implementado | `reviewController.ts`, `ReviewCTA.tsx` |
| CTA proativo apos conclusao | Implementado | `ReviewCTA.tsx` |

### 2.8 Disputas

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Abrir disputa | Implementado | `disputeController.ts`, `DisputeModal.tsx` |
| Listar disputas | Implementado | `disputeController.ts` |
| Resolver disputa (admin) | NAO IMPLEMENTADO | - |

### 2.9 Agenda e Calendario

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Disponibilidade semanal | Implementado | `scheduleController.ts`, `Calendar.tsx` |
| Bloqueio de horarios | Implementado | `scheduleController.ts` |
| Slots disponiveis | Implementado | `scheduleController.ts` |
| Picker de disponibilidade | Implementado | `AvailabilityPicker.tsx`, `AvailabilityCalendar.tsx` |

### 2.10 Dashboard e Metricas

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Dashboard do cliente | Implementado | `dashboardController.ts`, `client/Dashboard.tsx` |
| Dashboard do profissional | Implementado | `dashboardController.ts`, `professional/Dashboard.tsx` |
| CRM profissional | Implementado | `dashboardController.ts`, `CRM.tsx` |
| Metricas de reputacao | Implementado | `reputationController.ts`, `Reputation.tsx` |
| Stats cards animados | Implementado | `StatsCard.tsx`, `CountUp.tsx`, `SparklineChart.tsx`, `ProgressRing.tsx` |

### 2.11 Carteira Digital

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Saldo e resumo | Implementado | `walletController.ts`, `Wallet.tsx`, `BalanceCard.tsx` |
| Historico de transacoes | Implementado | `walletController.ts`, `TransactionList.tsx` |
| Solicitar saque | Implementado | `walletController.ts`, `WithdrawalModal.tsx` |

### 2.12 Admin

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Dashboard admin (stats) | Implementado | `adminController.ts`, `AdminDashboard.tsx` |
| Gerenciar usuarios | Implementado | `adminController.ts`, `AdminUsers.tsx` |
| Aprovar verificacoes | Implementado | `adminController.ts`, `AdminVerifications.tsx` |
| Mediacao de disputas | NAO IMPLEMENTADO | - |

### 2.13 Notificacoes

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Notificacoes in-app | Implementado | `notificationController.ts`, `Notifications.tsx` |
| Badge de contagem | Implementado | `Layout.tsx` |
| Marcar como lida | Implementado | `notificationController.ts` |
| Notificacoes por email | NAO IMPLEMENTADO | - |
| WebSocket / real-time | NAO IMPLEMENTADO | - |

### 2.14 UI/UX Global

| Funcionalidade | Status | Arquivos Envolvidos |
|---------------|--------|---------------------|
| Dark mode | Implementado | `ThemeContext.tsx` |
| Responsive (mobile/desktop) | Implementado | `Layout.tsx`, TailwindCSS |
| Skip to content (acessibilidade) | Implementado | `Layout.tsx` |
| Focus trap (mobile menu) | Implementado | `Layout.tsx` |
| Toast notifications | Implementado | `ToastContext.tsx`, `Toast.tsx` |
| Skeleton loading | Implementado | `Skeleton.tsx`, `ServiceCardSkeleton.tsx` |
| Empty states | Implementado | `EmptyState.tsx` |
| Dialogs de confirmacao | Implementado | `ConfirmDialog.tsx` |
| Modal portal | Implementado | `ModalPortal.tsx` |

---

## 3. PROBLEMAS IDENTIFICADOS

### 3.1 Problemas Criticos (Devem ser resolvidos ANTES do trabalho em equipe)

#### P1: serviceRoutes.ts Monolitico
**Problema**: Um unico arquivo com ~390 linhas concentra 30+ rotas de 8 dominios diferentes (orders, payments, chat, reviews, proposals, disputes, schedule, notifications). Qualquer feature nova tocara este arquivo.
**Impacto**: ALTO risco de conflito de merge quando 2 desenvolvedores trabalham simultaneamente.
**Solucao**: Dividir em route files separados:
- `orderRoutes.ts` - pedidos
- `paymentRoutes.ts` - pagamentos
- `chatRoutes.ts` - mensagens e conversas
- `reviewRoutes.ts` - avaliacoes
- `proposalRoutes.ts` - propostas
- `disputeRoutes.ts` - disputas
- `scheduleRoutes.ts` - agenda/calendario
- `notificationRoutes.ts` - notificacoes

#### P2: types/index.ts Centralizado
**Problema**: Um unico arquivo com ~745 linhas contem TODOS os tipos do frontend.
**Impacto**: ALTO risco de conflito quando 2 agentes adicionam tipos.
**Solucao**: Dividir por dominio:
- `types/auth.ts`
- `types/services.ts`
- `types/orders.ts`
- `types/payments.ts`
- `types/chat.ts`
- `types/wallet.ts`
- `types/common.ts`
- `types/index.ts` (re-exporta tudo)

#### P3: Falta de .env.example
**Problema**: Novo desenvolvedor nao sabe quais variaveis configurar.
**Solucao**: Criar `backend/.env.example` e `frontend/.env.example`.

#### P4: Sem Branch Strategy
**Problema**: Todo desenvolvimento esta na `main`. Sem branches de feature.
**Solucao**: Adotar Git Flow simplificado (feature branches + PR).

### 3.2 Problemas de Qualidade de Codigo

#### P5: Rota Duplicada
`/orders/:id/complete` e `/orders/:id/submit-completion` apontam para o mesmo handler `completeServiceOrder`.

#### P6: Handler Inline
Rota `/recommendations` tem logica inline no arquivo de rotas.

#### P7: Dependencias Mal Classificadas
`@types/*`, `@playwright/test`, `playwright` estao em `dependencies` ao inves de `devDependencies`.

#### P8: Enums Duplicados
`ServiceOrderStatus`, `PaymentStatus`, etc. existem em `types/index.ts` E no Prisma Client. Manutencao manual sincronizada.

#### P9: Sem Testes Frontend
Zero testes no frontend. Nenhum teste unitario para componentes criticos.

#### P10: Console.log como Logging
Backend usa `console.log/error` ao inves de logger estruturado.

### 3.3 Problemas de Arquitetura

#### P11: SQLite em Producao
SQLite nao suporta concorrencia adequada. Precisa migrar para PostgreSQL antes de ir para producao.

#### P12: Sem WebSocket
Chat funciona com polling (60s no Layout para notificacoes). Nao e real-time.

#### P13: Sem CI/CD
Nenhum pipeline automatizado. Nao ha verificacao automatica antes de merge.

#### P14: Sem Docker
Setup manual obrigatorio. Cada desenvolvedor precisa instalar Node, configurar .env, rodar seed manualmente.

---

## 4. FUNCIONALIDADES NAO IMPLEMENTADAS (ROADMAP)

Com base na analise e no README do projeto:

| Feature | Complexidade | Dependencia |
|---------|-------------|-------------|
| Resolucao de disputas (admin) | Media | Backend + Frontend Admin |
| Notificacoes por email (Resend) | Media | Backend |
| WebSocket para chat real-time | Alta | Backend + Frontend |
| Liberacao automatica de escrow | Media | Backend (cron job) |
| Dashboard analytics avancado | Media | Backend + Frontend |
| Integracao Google Maps | Media | Frontend + API key |
| Verificacao por SMS | Media | Backend + servico SMS |
| Portfolio de profissionais | Media | Backend + Frontend |
| Upload de imagens para servicos | Media | Backend (Multer) + Frontend |
| Pagina de termos de uso | Baixa | Frontend |
| Pagina de politica de privacidade | Baixa | Frontend |
| Sistema de cupons/descontos | Alta | Backend + Frontend |
| Multi-idioma (i18n) | Alta | Frontend |
| App mobile (React Native) | Muito Alta | Projeto separado |

---

## 5. PLANO DE ACAO PARA TRABALHO EM EQUIPE

### Fase 0: Preparacao (Antes de comecar a desenvolver juntos)

**OBRIGATORIO antes de comecar qualquer feature nova:**

1. [ ] Dividir `serviceRoutes.ts` em arquivos separados por dominio
2. [ ] Dividir `types/index.ts` em modulos por dominio
3. [ ] Criar `backend/.env.example` e `frontend/.env.example`
4. [ ] Mover `@types/*` e `playwright` para `devDependencies`
5. [ ] Remover rota duplicada (`/orders/:id/complete`)
6. [ ] Mover handler inline de `/recommendations` para controller
7. [ ] Configurar branch strategy no repositorio
8. [ ] Criar/atualizar CLAUDE.md com esta analise

### Fase 1: Estabilizacao

1. [ ] Configurar GitHub Actions basico (lint + type check + tests)
2. [ ] Adicionar testes minimos no frontend (AuthContext, formatters)
3. [ ] Configurar Docker + docker-compose para dev

### Fase 2: Features Prioritarias

**Desenvolvedor A (Backend + Infra)**:
- [ ] Migrar SQLite para PostgreSQL
- [ ] Implementar resolucao de disputas
- [ ] Implementar liberacao automatica de escrow (cron)
- [ ] Adicionar logger estruturado (Pino/Winston)
- [ ] Implementar notificacoes por email

**Desenvolvedor B (Frontend + UX)**:
- [ ] Upload de imagens para servicos
- [ ] Portfolio de profissionais
- [ ] Paginas legais (termos, privacidade)
- [ ] Melhorias de acessibilidade
- [ ] Testes E2E com Playwright

### Fase 3: Features Avancadas (Paralelizavel)
- WebSocket para chat
- Integracao Google Maps
- Dashboard analytics avancado
- Sistema de cupons

---

## 6. REGRAS DE CONVIVENCIA PARA AGENTES IA

### Regra 1: Arquivos com Lock
Antes de editar qualquer arquivo marcado como **PERIGO** no CLAUDE.md, comunicar a intencao e verificar se o outro agente nao esta editando.

### Regra 2: Commits Atomicos
Cada commit deve ser pequeno, focado e com mensagem clara. Evitar "mega commits" que tocam 10+ arquivos.

### Regra 3: Testes Obrigatorios
Qualquer feature nova deve vir com pelo menos:
- Backend: teste de integracao para a rota
- Frontend: verificacao de build (`npx tsc --noEmit`)

### Regra 4: Nao Editar types/index.ts Diretamente
Apos a divisao, cada agente adiciona tipos no arquivo do dominio correspondente.

### Regra 5: Pull Antes de Push
SEMPRE executar `git pull --rebase` antes de push para evitar conflitos.

### Regra 6: Nao Editar Schema Prisma Simultaneamente
Apenas UM agente pode alterar `schema.prisma` por vez. Migracao deve ser commitada imediatamente.

---

## 7. CONTATOS E CREDENCIAIS

- **Repo**: git@github.com:levygamer200-ux/faztudo.git
- **Branch principal**: main
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:5173
- **Prisma Studio**: `cd backend && npm run db:studio`
- **MercadoPago Sandbox**: Credenciais em `VARIAVEIS/.env.mp`
