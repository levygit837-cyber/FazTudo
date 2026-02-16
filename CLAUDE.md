# CLAUDE.md - FazTudo Marketplace

> **Projeto**: FazTudo - Marketplace de Servicos
> **Stack**: Express 5 + React 18 + TypeScript + Prisma + SQLite
> **Repo**: git@github.com:levygamer200-ux/faztudo.git
> **Branch principal**: main
> **Ultima atualizacao**: 2026-02-16

---

## Comandos Essenciais

```bash
# Backend
cd backend && npm run dev          # Inicia servidor em http://localhost:3001
cd backend && npm test             # Roda testes com Vitest
cd backend && npm run test:watch   # Testes em modo watch
cd backend && npm run test:security # Apenas testes de seguranca
cd backend && npx tsc --noEmit     # Checa tipos sem compilar
cd backend && npm run db:seed      # Popula banco com dados de teste
cd backend && npm run db:push      # Aplica schema no banco
cd backend && npm run db:studio    # Abre Prisma Studio

# Frontend
cd frontend && npm run dev         # Inicia Vite em http://localhost:5173
cd frontend && npm run build       # Build de producao (tsc + vite build)
cd frontend && npm run lint        # ESLint
cd frontend && npx tsc --noEmit    # Checa tipos sem compilar

# Docker (dev)
docker compose up                  # Sobe backend + frontend
docker compose up backend          # Apenas backend
docker compose up frontend         # Apenas frontend
```

---

## Arquitetura

```
faztudo-main/
├── backend/                    # API REST Express 5 + TypeScript
│   ├── src/
│   │   ├── index.ts            # Entry point, middlewares, rotas
│   │   ├── config/             # env.ts, mercadopago.ts
│   │   ├── controllers/        # 23 controllers (auth, admin, service/*)
│   │   ├── routes/             # 15 route files (divididos por dominio)
│   │   ├── services/           # 4 services (escrow, mercadopago, notification, recommendation)
│   │   ├── middleware/         # 7 middlewares (auth, validate, sanitize, chatFilter, rateLimiter, error, auditLog)
│   │   └── lib/prisma.ts       # Prisma client singleton
│   ├── prisma/
│   │   ├── schema.prisma       # 21 modelos
│   │   └── seed.ts             # Dados de teste
│   ├── tests/                  # 11 arquivos de teste
│   └── uploads/chat/           # Uploads do chat
│
├── frontend/                   # SPA React 18 + Vite + TailwindCSS
│   ├── src/
│   │   ├── App.tsx             # Router principal (~160 linhas)
│   │   ├── index.tsx           # Entry point
│   │   ├── pages/              # 24 paginas organizadas por dominio
│   │   ├── components/         # 47 componentes organizados por feature
│   │   ├── services/           # 9 API service files (Axios)
│   │   ├── context/            # 3 contexts (Auth, Theme, Toast)
│   │   ├── hooks/              # 2 hooks (useFavorites, useMercadoPago)
│   │   ├── types/              # Tipos TypeScript divididos por dominio (10 modulos)
│   │   └── utils/formatters.ts # Utilitarios de formatacao
│   └── public/                 # Assets estaticos (logo.png)
│
├── .github/workflows/          # CI pipeline (lint, type check, tests)
├── docs/plans/                 # Planos de implementacao (.md)
├── VARIAVEIS/                  # Credenciais MercadoPago (gitignored)
├── docker-compose.yml          # Dev environment
└── playwright-test.js          # Teste E2E manual
```

**Linhas de codigo**: ~14.250 backend + ~25.040 frontend = ~39.290 total

---

## Rotas da API (Backend)

| Prefixo | Arquivo | Descricao |
|---------|---------|-----------|
| `/api/auth` | authRoutes.ts | Login, registro, JWT, perfil |
| `/api/services` | serviceRoutes.ts | Listings (catalogo) + briefs |
| `/api/services` | orderRoutes.ts | Orders (pedidos) - CRUD + fluxo |
| `/api/services` | paymentRoutes.ts | Pagamentos + webhook MercadoPago |
| `/api/services` | chatRoutes.ts | Chat/mensagens + upload |
| `/api/services` | reviewRoutes.ts | Avaliacoes |
| `/api/services` | proposalRoutes.ts | Propostas/licitacao |
| `/api/services` | disputeRoutes.ts | Disputas |
| `/api/services` | scheduleRoutes.ts | Agenda/calendario |
| `/api/services` | notificationRoutes.ts | Notificacoes |
| `/api/services` | recommendationRoutes.ts | Recomendacoes personalizadas |
| `/api/categories` | categoryRoutes.ts | CRUD categorias |
| `/api/dashboard` | dashboardRoutes.ts | Stats, CRM, reputacao |
| `/api/admin` | adminRoutes.ts | Usuarios, verificacoes |
| `/api/wallet` | walletRoutes.ts | Saldo, transacoes, saques |

**Nota**: Todos os routers de `/api/services` sao montados no mesmo prefixo. Cada router define seus sub-paths (ex: `orderRoutes` define `/orders`, `/orders/:id`, etc.).

---

## Convencoes de Codigo

### Backend
- Controllers em `src/controllers/service/` seguem padrao: export async function (req, res)
- Respostas SEMPRE: `{ success: boolean, message: string, data?: T }`
- Validacao com Zod em `middleware/validation.ts`
- Auth via JWT: `verifyToken` → `requireRole()` → `requireVerified`
- Prisma client via `import prisma from "../lib/prisma"`
- **Logger**: Pino estruturado via `import { createLogger } from "../lib/logger"` → `const log = createLogger("moduleName")`
  - Dev: pino-pretty (colorido). Prod: JSON por linha
  - Request logging: pino-http middleware em `src/middleware/requestLog.ts`
  - **NUNCA usar console.log/error** — sempre usar `log.info/error/warn/debug`
- **Novas rotas**: criar arquivo separado em `routes/` (NAO adicionar a um arquivo existente)

### Frontend
- Paginas em `src/pages/` organizadas por dominio (client/, professional/, admin/, checkout/, services/, orders/)
- Componentes em `src/components/` organizados por feature (common/, checkout/, dashboard/, orders/, services/, wallet/, landing/)
- API calls via Axios em `src/services/` - TODOS usam `api` de `services/api.ts`
- **Tipos divididos por dominio** em `src/types/` - importar de `../types` (barrel re-export via index.ts)
  - `enums.ts` - Enums (UserRole, ServiceOrderStatus, PaymentStatus, etc.)
  - `entities.ts` - Interfaces de entidades (User, ServiceOrder, Payment, etc.)
  - `auth.ts` - Tipos de autenticacao
  - `api.ts` - Tipos de request/response da API
  - `forms.ts` - Tipos de formularios
  - `filters.ts` - Tipos de filtros/queries
  - `wallet.ts` - Tipos de carteira
  - `dashboard.ts` - Tipos de dashboard/estatisticas
  - `components.ts` - Tipos de props de componentes
  - `utils.ts` - Tipos utilitarios, theme, events
- **Tipos novos**: adicionar ao modulo do dominio correspondente (NAO ao index.ts)
- Estilizacao: TailwindCSS + classes customizadas (btn, badge, card)
- Contextos: AuthContext (user/token), ThemeContext (dark/light), ToastContext (notificacoes)

### Commits
- Padrao semantico: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Mensagens em ingles

---

## Fluxo Principal (Servico)

```
1. Profissional cria ServiceListing (catalogo)
2. Cliente busca e seleciona servico
3. Cliente cria ServiceOrder (PENDING)
4. Profissional aceita (ACCEPTED)
5. Cliente paga via MercadoPago (cartao/PIX/boleto) → Escrow (HELD)
6. Profissional inicia servico (IN_PROGRESS)
7. Profissional submete conclusao (AWAITING_CLIENT_CONFIRMATION)
8. Cliente confirma (AWAITING_PROFESSIONAL_CONFIRMATION)
9. Profissional confirma (COMPLETED) → Pagamento RELEASED
   └── 90% profissional, 10% plataforma
```

---

## Banco de Dados

- **ORM**: Prisma 7.3 com SQLite (arquivo: `backend/dev.db`)
- **21 modelos**: User, ServiceCategory, ServiceListing, ServiceOrder, Payment, Transaction, Message, Notification, Review, Address, OrderBrief, Proposal, ProfessionalSchedule, ScheduleBlock, Dispute, File, Certification, VerificationSubmission, EscrowConfig, SystemConfig, ProfessionalCategory
- **Seed**: `prisma/seed.ts` cria categorias, configs, 3 usuarios teste, 8 listings

---

## Variaveis de Ambiente

### Backend (`backend/.env`) - ver `backend/.env.example`
```
NODE_ENV, PORT (3001), DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN,
BCRYPT_SALT_ROUNDS, CORS_ORIGIN, DEFAULT_ESCROW_HOLD_DAYS, PLATFORM_FEE_PERCENTAGE,
MP_PUBLIC_KEY, MP_ACCESS_TOKEN, MP_CLIENT_ID, MP_CLIENT_SECRET, MP_SANDBOX
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL,
FRONTEND_URL
```

### Frontend (`frontend/.env`) - ver `frontend/.env.example`
```
VITE_API_URL=http://localhost:3001
```

---

## Testes

11 arquivos de teste no backend:
- **Integration**: orderFlow, chatMensagens, professionalCalendar, professionalCrm, professionalFinance, professionalReputation, systemMessage, emailVerification, passwordReset
- **Unit**: emailService, envSmtp, scheduler
- **Middleware**: chatFilter, sanitize
- **Security**: xss, validation
- **Bug conhecido**: `validation.test.ts` > `createPaymentSchema` > `accepts valid payment method` falha (teste usa 'PIX' maiusculo, schema espera 'pix' minusculo)
- **Frontend**: SEM TESTES (apenas playwright-test.js na raiz)

---

## Gotchas e Padroes Nao-Obvios

1. **Frontend types duplicados**: Enums como `ServiceOrderStatus` existem tanto em `frontend/src/types/enums.ts` quanto no Prisma client. Precisam ser mantidos em sincronia manualmente.

2. **ToastContainer fora do AuthProvider**: No App.tsx, `<ToastContainer />` esta fora do `<AuthProvider>`, o que funciona mas e fragil.

3. **SQLite em producao**: O banco e SQLite (arquivo local). NAO e adequado para producao com multiplos usuarios simultaneos.

4. **Sem WebSocket**: Chat usa polling (requests periodicos), nao real-time.

5. **Credenciais MP separadas**: Ficam em `VARIAVEIS/.env.mp` (gitignored), NAO no `.env` do backend diretamente.

6. **Rotas `:id` no serviceRoutes**: No `serviceRoutes.ts`, as rotas com parametro `/:id` ficam NO FINAL para nao conflitar com rotas nomeadas como `/orders`, `/briefs`, etc.

7. **Multiplos routers no mesmo prefixo**: Todos os routers de servico sao montados em `/api/services`. Express processa na ordem de registro (serviceRoutes primeiro, depois orderRoutes, etc.).

---

## Mapa de Arquivos por Funcionalidade (Para Trabalho em Equipe)

### BACKEND - Zonas Independentes

| Zona | Arquivos | Pode ser trabalhada isoladamente? |
|------|----------|-----------------------------------|
| **Auth** | `controllers/authController.ts`, `routes/authRoutes.ts`, `middleware/auth.ts` | SIM |
| **Listings (Catalogo)** | `controllers/service/listingController.ts`, `routes/serviceRoutes.ts` | SIM |
| **Orders (Pedidos)** | `controllers/service/orderController.ts`, `routes/orderRoutes.ts` | CUIDADO - conecta com payments, chat, reviews |
| **Payments** | `controllers/service/paymentController.ts`, `routes/paymentRoutes.ts`, `services/mercadopagoService.ts`, `services/escrowService.ts` | SIM (mas depende de orders) |
| **Chat/Messages** | `controllers/service/chatController.ts`, `controllers/service/messageController.ts`, `controllers/service/fileUploadController.ts`, `routes/chatRoutes.ts`, `middleware/chatFilter.ts` | SIM |
| **Reviews** | `controllers/service/reviewController.ts`, `routes/reviewRoutes.ts` | SIM |
| **Proposals** | `controllers/service/proposalController.ts`, `routes/proposalRoutes.ts` | SIM |
| **Disputes** | `controllers/service/disputeController.ts`, `routes/disputeRoutes.ts` | SIM |
| **Schedule** | `controllers/service/scheduleController.ts`, `routes/scheduleRoutes.ts` | SIM |
| **Notifications** | `controllers/service/notificationController.ts`, `routes/notificationRoutes.ts`, `services/notificationService.ts` | CUIDADO - chamada por muitos controllers |
| **Recommendations** | `routes/recommendationRoutes.ts`, `services/recommendationService.ts` | SIM |
| **Dashboard** | `controllers/dashboardController.ts`, `controllers/reputationController.ts`, `routes/dashboardRoutes.ts` | SIM |
| **Admin** | `controllers/adminController.ts`, `routes/adminRoutes.ts` | SIM |
| **Wallet** | `controllers/walletController.ts`, `routes/walletRoutes.ts` | SIM |

### FRONTEND - Zonas Independentes

| Zona | Arquivos | Pode ser trabalhada isoladamente? |
|------|----------|-----------------------------------|
| **Auth** | `pages/Login.tsx`, `pages/Register.tsx`, `context/AuthContext.tsx` | SIM |
| **Landing Pages** | `pages/LandingPageUser.tsx`, `pages/LandingPageProfessional.tsx`, `components/landing/*` | SIM |
| **Service Search** | `pages/services/ServiceSearch.tsx`, `pages/services/ServiceDetails.tsx`, `components/services/*` | SIM |
| **Checkout** | `pages/checkout/Checkout.tsx`, `pages/checkout/PaymentConfirmation.tsx`, `components/checkout/*`, `hooks/useMercadoPago.ts` | SIM |
| **Orders (Client)** | `pages/client/ServiceOrders.tsx`, `pages/client/NewOrder.tsx`, `pages/orders/OrderDetails.tsx` | CUIDADO - OrderDetails e compartilhado |
| **Orders (Professional)** | `pages/professional/ServiceOrders.tsx` | CUIDADO - usa OrderDetails compartilhado |
| **Order Components** | `components/orders/*` (12 componentes) | CUIDADO - usados por OrderDetails |
| **Chat** | `pages/services/ServiceChat.tsx`, `pages/Messages.tsx` | SIM |
| **Dashboard Client** | `pages/client/Dashboard.tsx` | SIM |
| **Dashboard Pro** | `pages/professional/Dashboard.tsx`, `pages/professional/CRM.tsx`, `pages/professional/Calendar.tsx`, `pages/professional/Reputation.tsx` | SIM |
| **Catalog Pro** | `pages/professional/CreateService.tsx`, `pages/professional/EditService.tsx` | SIM |
| **Wallet** | `pages/Wallet.tsx`, `components/wallet/*` | SIM |
| **Admin** | `pages/admin/*` | SIM |
| **Profile** | `pages/Profile.tsx`, `pages/Settings.tsx`, `pages/VerifyAccount.tsx` | SIM |
| **Layout** | `components/Layout.tsx` | PERIGO - alteracoes afetam TUDO |
| **Common** | `components/common/*` | PERIGO - componentes reutilizaveis |
| **Types** | `types/*.ts` | MEDIO - divididos por dominio, mas index.ts re-exporta tudo |
| **API Services** | `services/*.ts` | CUIDADO - usados por muitas paginas |
| **Router** | `App.tsx` | PERIGO - alteracoes afetam TUDO |

### ARQUIVOS CRITICOS (Alto Risco de Conflito)

1. **`frontend/src/App.tsx`** - Router central. Qualquer nova pagina modifica este arquivo.
2. **`frontend/src/components/Layout.tsx`** - Layout global. Mudancas na nav ou footer afetam tudo.
3. **`backend/prisma/schema.prisma`** - Schema do banco. Mudancas exigem migration.
4. **`frontend/src/services/serviceService.ts`** - API client principal. Novas chamadas vao aqui.
5. **`backend/src/controllers/service/index.ts`** - Re-exporta todos os controllers de servico.
6. **`backend/src/middleware/validation.ts`** - Schemas Zod centralizados.
7. **`backend/src/index.ts`** - Entry point. Novos routers sao registrados aqui.

---

## Estrategia de Trabalho em Equipe com IA

### Regras Para Evitar Conflitos

1. **NUNCA dois agentes devem editar o mesmo arquivo simultaneamente**
2. **Antes de editar um arquivo critico**, puxar (`git pull`) e verificar mudancas recentes
3. **Branches por feature**: Cada pessoa/agente deve trabalhar em branch separada
4. **Commits granulares**: Commitar frequentemente para facilitar merges
5. **Tipos novos**: Adicionar ao modulo do dominio correspondente em `types/` (NAO ao index.ts)
6. **Rotas novas no backend**: Criar novos route files em `routes/` e registrar em `index.ts`
7. **Comunicar antes de tocar em arquivos criticos**

### Divisao Sugerida de Trabalho

**Desenvolvedor A (Backend-focused)**:
- Endpoints API novos
- Logica de negocio (services/)
- Testes
- Schema Prisma + migrations

**Desenvolvedor B (Frontend-focused)**:
- Paginas e componentes novos
- Estilizacao e UX
- Integracao com API existente
- Testes E2E

### Workflow Git Recomendado

```bash
# Antes de comecar qualquer trabalho
git pull origin main

# Criar branch de feature
git checkout -b feat/nome-da-feature

# Trabalhar, commitar frequentemente
git add <arquivos-especificos>
git commit -m "feat: descricao"

# Antes de merge, rebase na main
git fetch origin
git rebase origin/main

# Resolver conflitos se houver, depois push
git push origin feat/nome-da-feature

# Criar PR para review
```

---

## O Que Precisa Ser Melhorado/Corrigido

### Prioridade ALTA

1. **SQLite nao escala**: Para producao com multiplos usuarios, migrar para PostgreSQL. O Prisma facilita essa migracao.

### Prioridade MEDIA (Qualidade de Codigo)

2. **Frontend sem testes**: Zero testes unitarios ou de integracao no frontend. Adicionar pelo menos testes para:
   - AuthContext
   - Componentes de checkout
   - Formatters

3. **Tipos duplicados entre backend e frontend**: Os enums `ServiceOrderStatus`, `PaymentStatus`, etc. sao mantidos em 2 lugares. Considerar:
   - Gerar tipos do Prisma para o frontend
   - Ou manter um pacote `@faztudo/types` compartilhado

4. **Sem tratamento de erros padronizado no frontend**: Cada pagina trata erros de forma diferente. Criar um hook `useApiCall` ou similar.

5. **Sem logging estruturado**: ~~Backend usa `console.log/error`~~ → **RESOLVIDO**: Migrado para Pino em todos os 27 arquivos.

6. **Bug no teste de validacao**: `validation.test.ts` > `createPaymentSchema` usa 'PIX' (maiusculo) mas schema espera 'pix' (minusculo).

### Prioridade BAIXA (Melhorias Futuras)

7. **Sem WebSocket**: Chat funciona com polling. Implementar Socket.io ou similar.

8. **Sem cache no backend**: Requests frequentes (categorias, config) nao tem cache HTTP.

9. **Sem rate limiting por usuario**: Rate limiting atual e por IP, nao por usuario autenticado.

10. **Acessibilidade parcial**: Layout tem boa base (skip links, aria labels, focus trap) mas paginas internas podem nao seguir o mesmo padrao.

11. **Sem i18n**: Todo texto esta hardcoded em portugues.

12. **Email implementado**: Verificação de email, reset de senha e notificações opcionais via Brevo SMTP (Nodemailer). Ver `backend/src/services/emailService.ts`.

---

## Usuarios de Teste (Seed)

```
Cliente:        cliente@teste.com     / Teste@123
Profissional 1: profissional@teste.com / Teste@123
Profissional 2: profissional2@teste.com / Teste@123
```

---

## MercadoPago (Sandbox)

- Credenciais em `VARIAVEIS/.env.mp`
- Cartao teste: `5031 4332 1540 6351` (Mastercard)
- CVV: `123`, Validade: qualquer futura
- CPF teste: `12345678909`
- Flag `MP_SANDBOX=true` para ambiente de teste
