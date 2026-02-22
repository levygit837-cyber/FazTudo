# FazTudo - Marketplace de Servicos

**FazTudo** e uma plataforma completa de marketplace que conecta **clientes** a **profissionais de servicos** e **empresas** no Brasil, com sistema de pagamentos em escrow via MercadoPago, vitrines personalizaveis, chat integrado, CRM profissional, painel administrativo dedicado e muito mais.

---

## Visao Geral

| Item | Detalhes |
|------|---------|
| **Backend** | Express 5 + TypeScript + Prisma 7.4 + PostgreSQL + Redis/BullMQ |
| **Frontend** | React 19 + TypeScript + Vite 7 + TailwindCSS 4 |
| **Admin** | React 19 + TypeScript + Vite 7 + Recharts 3 |
| **Pagamentos** | MercadoPago (Cartao, PIX, Boleto) com Escrow |
| **Autenticacao** | JWT + Refresh Tokens + MFA (TOTP) |
| **Filas Assincronas** | BullMQ + Redis (email, notificacoes, pagamentos, anti-fraude) |
| **Banco de Dados** | PostgreSQL 16 + 50 modelos Prisma |
| **Linhas de Codigo** | ~23.000 backend + ~41.600 frontend/admin = ~64.600 total |
| **Testes** | 337 testes (40 arquivos) - integracao, seguranca, unitarios |
| **Endpoints da API** | 28 grupos de rotas REST |
| **Commits** | 619+ |

---

## Funcionalidades Principais

### Para Clientes
- Busca e navegacao de servicos por categoria, localizacao e avaliacao
- **Explorar vitrines** de profissionais e empresas com carrinho de compras
- Criacao de pedidos com briefing detalhado (fotos, videos, urgencia)
- Pagamento seguro com escrow (Cartao, PIX, Boleto)
- Chat integrado com profissionais (texto, anexos, localizacao)
- **Rastreamento em mapa** da localizacao do profissional
- Sistema de avaliacoes e reviews
- Carteira digital com historico de transacoes
- Notificacoes em tempo real via WebSocket

### Para Profissionais
- **Vitrine personalizavel** com categorias, servicos e opcoes
- **Wizard de onboarding** para configuracao inicial da vitrine
- Dashboard CRM com pipeline de clientes e metricas
- Calendario de disponibilidade com bloqueio de horarios
- Painel de reputacao com analise de tendencias
- Sistema de propostas para concorrer em pedidos
- Gestao financeira com saques e historico
- Verificacao de conta (KYC) com tour guiado

### Para Empresas
- **Perfil empresarial** com gestao de membros e cargos
- **Vitrine da empresa** com editor visual (banner, secoes, blocos)
- Canais de comunicacao internos
- Regras salariais e gestao de pagamentos
- Analytics com metricas de trafego e conversao
- Convites para novos membros

### Para Administradores (Painel Dedicado)
- Dashboard com estatisticas da plataforma
- Gerenciamento de usuarios e verificacoes
- Aprovacao de documentos (CPF/CNPJ)
- Gerenciamento de empresas
- Moderacao de disputas
- Metricas de trafego e configuracoes

---

## Stack Tecnologica

### Backend

| Tecnologia | Versao | Uso |
|-----------|--------|-----|
| Express | 5.2 | Framework web |
| TypeScript | 5.9.3 | Linguagem |
| Prisma | 7.4.0 | ORM + PostgreSQL adapter |
| PostgreSQL | 16 | Banco de dados relacional |
| Redis | 7 | Cache, filas, idempotencia |
| BullMQ | 5.x | Filas assincronas (email, pagamentos, notificacoes) |
| Socket.IO | 4.8 | WebSocket (notificacoes em tempo real) |
| JWT | 9.0 | Autenticacao |
| bcrypt | 6.0 | Hash de senhas |
| MercadoPago SDK | 2.12 | Pagamentos |
| Zod | 4.3.6 | Validacao de dados |
| Pino | 10.3 | Logging estruturado |
| opossum | 9.x | Circuit breaker (MercadoPago) |
| otplib | 13.x | MFA TOTP |
| prom-client | 15.x | Metricas Prometheus |
| Helmet | 8.1 | Seguranca HTTP |
| Nodemailer | 8.0 | Envio de emails (Brevo SMTP) |
| Multer | 2.0 | Upload de arquivos |
| Vitest | 4.0 | Testes |
| Playwright | 1.58 | Testes E2E |

### Frontend

| Tecnologia | Versao | Uso |
|-----------|--------|-----|
| React | 19.2.4 | UI Framework |
| Vite | 7.3.1 | Build tool |
| TypeScript | 5.9.3 | Linguagem |
| TailwindCSS | 4.1.18 | Estilizacao (CSS-first, sem config JS) |
| React Router | 7.13.0 | Roteamento |
| Axios | 1.13.5 | HTTP Client |
| Lucide React | 0.574.0 | Icones |
| Socket.IO Client | 4.8 | WebSocket |
| Leaflet / MapLibre | 1.9 / 5.18 | Mapas interativos |

### Admin

| Tecnologia | Versao | Uso |
|-----------|--------|-----|
| React | 19.2.4 | UI Framework |
| Vite | 7.3.1 | Build tool |
| React Router | 7.13.0 | Roteamento |
| Recharts | 3.7.0 | Graficos e dashboards |
| Axios | 1.13.5 | HTTP Client |
| Lucide React | 0.574.0 | Icones |

---

## Arquitetura do Projeto

```
faztudo-main/
├── backend/                        # API REST Express 5 + TypeScript
│   ├── src/
│   │   ├── index.ts                # Entry point, middlewares, 28 grupos de rotas
│   │   ├── config/                 # env.ts, mercadopago.ts, secrets.ts
│   │   ├── controllers/            # 36 controllers
│   │   │   ├── service/            # 15 controllers de dominio (orders, payments, chat...)
│   │   │   ├── admin*.ts           # Administracao
│   │   │   ├── auth*.ts            # Autenticacao
│   │   │   ├── company*.ts         # 7 controllers empresa (profile, members, salary...)
│   │   │   ├── storefront*.ts      # Vitrines
│   │   │   ├── mfa*.ts             # Autenticacao multi-fator
│   │   │   └── ...                 # Dashboard, wallet, analytics, etc.
│   │   ├── routes/                 # 23 route files (divididos por dominio)
│   │   ├── services/               # 9 services (escrow, mercadopago, email, geocoding...)
│   │   ├── middleware/             # 14 middlewares (auth, mfa, validate, sanitize, auditLog...)
│   │   ├── queues/                 # BullMQ: connection, queues, producers
│   │   ├── workers/                # 7 workers: notification, email, payment, reconciliation,
│   │   │                           #   anti-fraud, scheduler
│   │   └── lib/                    # 10 libs: prisma, logger, circuitBreaker, metrics,
│   │                               #   paymentStateMachine, socket, idempotency...
│   ├── prisma/
│   │   ├── schema.prisma           # 50 modelos
│   │   └── seed.ts                 # Dados de teste
│   ├── tests/                      # 40 arquivos de teste (337 tests)
│   │   ├── integration/            # 10 testes de integracao
│   │   ├── security/               # 8 testes de seguranca
│   │   ├── unit/                   # 4 testes unitarios
│   │   ├── lib/                    # 2 testes de libs
│   │   ├── middleware/             # 3 testes de middleware
│   │   ├── config/                 # 1 teste de config
│   │   └── *.test.ts               # 12 testes E2E/feature
│   └── uploads/chat/               # Uploads do chat
│
├── frontend/                       # SPA React 19 + Vite + TailwindCSS 4
│   ├── src/
│   │   ├── App.tsx                 # Router principal (~210 linhas)
│   │   ├── pages/                  # 52 paginas organizadas por dominio
│   │   │   ├── client/             # Dashboard, pedidos, novo pedido
│   │   │   ├── professional/       # Dashboard, CRM, calendario, vitrine, wizard
│   │   │   ├── company/            # Dashboard, membros, cargos, canais, analytics
│   │   │   ├── services/           # Explorar, detalhes, chat, mapa, vitrines
│   │   │   ├── checkout/           # Pagamento, confirmacao
│   │   │   ├── orders/             # Detalhes do pedido
│   │   │   └── *.tsx               # Auth, perfil, wallet, notificacoes, seguranca, legal
│   │   ├── components/             # 75 componentes organizados por feature
│   │   │   ├── common/             # Componentes reutilizaveis
│   │   │   ├── checkout/           # Checkout
│   │   │   ├── company/            # Empresa
│   │   │   ├── dashboard/          # Dashboard
│   │   │   ├── landing/            # Landing pages
│   │   │   ├── map/                # Mapas
│   │   │   ├── orders/             # Pedidos
│   │   │   ├── services/           # Servicos
│   │   │   └── wallet/             # Carteira
│   │   ├── services/               # 13 API service files (Axios)
│   │   ├── context/                # 5 contexts (Auth, Socket, Theme, Toast, Tour)
│   │   ├── hooks/                  # 9 custom hooks
│   │   └── types/                  # Tipos TypeScript divididos por dominio (10+ modulos)
│   └── public/                     # Assets estaticos
│
├── admin/                          # Painel Administrativo (SPA separada)
│   ├── src/
│   │   ├── pages/                  # 9 paginas (dashboard, users, companies, disputes...)
│   │   └── ...                     # 15 arquivos TSX total
│   └── vite.config.ts
│
├── docker-compose.yml              # PostgreSQL 16 + Redis 7 + Backend + Frontend + Admin
├── docs/plans/                     # Planos de implementacao (.md)
└── VARIAVEIS/                      # Credenciais MercadoPago (gitignored)
```

---

## Fluxo de Pagamento (Escrow)

```
Cliente busca servico/vitrine
       │
       ▼
Cliente cria pedido (com ou sem briefing)
       │
       ▼
Profissional aceita
       │
       ▼
Cliente realiza pagamento ──► Fundos retidos em ESCROW (7 dias)
   (Cartao/PIX/Boleto)         │
       │                       ├─ Payment Event Store (idempotente)
       ▼                       └─ State Machine valida transicoes
Profissional executa servico
       │
       ▼
Profissional submete conclusao
       │
       ▼
Cliente confirma ──────────── Confirmacao dupla obrigatoria
       │
       ▼
Profissional confirma
       │
       ▼
Pagamento LIBERADO
   ├── Profissional recebe: 90%
   └── Taxa da plataforma: 10%
```

### Metodos de Pagamento
- **Cartao de Credito/Debito** - Checkout transparente (tokenizacao pelo SDK do MercadoPago)
- **PIX** - QR Code gerado em tempo real
- **Boleto Bancario** - Codigo de barras para pagamento

### Seguranca de Pagamentos
- **State Machine**: Transicoes de status validadas — transicoes invalidas sao rejeitadas
- **Idempotencia dupla**: Redis NX SET (5min TTL) + UNIQUE constraint no DB
- **Circuit Breaker**: Chamadas MercadoPago com circuit breaker (opossum) — abre apos 50% de falhas
- **Reconciliacao diaria**: Worker automatico compara eventos locais com MercadoPago
- **Anti-fraude**: Worker dedicado para analise de transacoes suspeitas

---

## Endpoints da API

### Autenticacao (`/api/auth`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/register` | Registro de usuario |
| POST | `/login` | Login com JWT |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Invalidar token |
| GET | `/me` | Dados do usuario atual |
| PUT | `/me` | Atualizar perfil |
| POST | `/forgot-password` | Solicitar reset de senha |
| POST | `/reset-password/:token` | Resetar senha |
| GET | `/verify-email/:token` | Verificar email |

### MFA (`/api/auth/mfa`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/setup` | Configurar TOTP |
| POST | `/verify` | Verificar codigo TOTP |
| POST | `/disable` | Desabilitar MFA |

### Servicos e Catalogo (`/api/services`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/` | Listar servicos (publico) |
| POST | `/` | Criar servico (profissional) |
| GET | `/:id` | Detalhes do servico |
| PUT | `/:id` | Atualizar servico |
| DELETE | `/:id` | Remover servico |

### Pedidos (`/api/services/orders`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/` | Criar pedido |
| POST | `/with-brief` | Criar com briefing detalhado |
| GET | `/` | Meus pedidos |
| GET | `/:id` | Detalhes do pedido |
| POST | `/:id/accept` | Profissional aceita |
| POST | `/:id/start` | Iniciar servico |
| POST | `/:id/submit-completion` | Marcar como concluido |
| POST | `/:id/confirm-completion` | Confirmar conclusao |
| POST | `/:id/cancel` | Cancelar pedido |
| POST | `/:id/reschedule` | Reagendar |

### Pagamentos (`/api/services`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/payments/config` | Chave publica do MercadoPago |
| POST | `/orders/:id/payments` | Criar pagamento |
| POST | `/payments/webhook` | Webhook do MercadoPago |
| POST | `/orders/:id/payments/release` | Liberar do escrow |

### Propostas
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/orders/:id/proposals` | Enviar proposta |
| GET | `/orders/:id/proposals` | Ver propostas |
| POST | `/orders/:id/proposals/:pid/accept` | Aceitar proposta |

### Chat e Mensagens
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/chats` | Listar conversas |
| POST | `/orders/:id/messages` | Enviar mensagem |
| POST | `/orders/:id/messages/upload` | Upload de arquivo |
| GET | `/orders/:id/messages` | Obter mensagens |

### Vitrines (`/api/storefronts`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/` | Listar vitrines (publico) |
| GET | `/:slug` | Ver vitrine por slug |
| POST | `/` | Criar vitrine |
| PUT | `/:id` | Atualizar vitrine |
| POST | `/cart/checkout` | Checkout do carrinho |

### Empresa (`/api/company`)
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET/PUT | `/profile` | Perfil da empresa |
| CRUD | `/members` | Gestao de membros |
| CRUD | `/invite` | Convites |
| CRUD | `/salary` | Regras salariais |
| CRUD | `/teams` | Equipes |
| CRUD | `/channels` | Canais de comunicacao |
| CRUD | `/storefront` | Vitrine da empresa |

### Dashboard e Carteira
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/dashboard/stats` | Estatisticas do usuario |
| GET | `/api/dashboard/professional/crm` | Dados do CRM |
| GET | `/api/dashboard/professional/reputation` | Metricas de reputacao |
| GET | `/api/wallet/balance` | Saldo da carteira |
| GET | `/api/wallet/transactions` | Historico de transacoes |
| POST | `/api/wallet/withdraw` | Solicitar saque |

### Outros
| Prefixo | Descricao |
|---------|-----------|
| `/api/categories` | CRUD de categorias |
| `/api/admin` | Gerenciamento admin (usuarios, verificacoes, empresas) |
| `/api/analytics` | Metricas de trafego |
| `/api/sessions` | Sessoes de usuario |
| `/api/geocoding` | Proxy de geocodificacao e rotas |
| `/api/services/schedule` | Agenda/calendario do profissional |
| `/api/services/notifications` | Notificacoes |
| `/api/services/recommendations` | Recomendacoes personalizadas |
| `/api/services/location` | Rastreamento de localizacao |
| `/api/services/disputes` | Disputas |
| `/api/services/reviews` | Avaliacoes |

### Health & Metricas
| Rota | Descricao |
|------|-----------|
| `/health` | Status de database, Redis, filas, circuit breaker |
| `/metrics` | Metricas Prometheus (localhost only) |

---

## Modelos do Banco de Dados

O schema Prisma contem **50 modelos** organizados por dominio:

### Core
| Modelo | Descricao |
|--------|-----------|
| `User` | Usuarios (CLIENT, PROFESSIONAL, COMPANY, ADMIN) |
| `UserSession` | Sessoes ativas |
| `UserDevice` | Dispositivos conhecidos |
| `UserMFA` | Configuracao MFA (TOTP com AES-256-GCM) |
| `AuditLog` | Log de auditoria persistente |
| `Address` | Enderecos e geolocalizacao |

### Servicos
| Modelo | Descricao |
|--------|-----------|
| `ServiceCategory` | Categorias hierarquicas (20 principais + 130 sub) |
| `ProfessionalCategory` | Mapeamento profissional-categoria |
| `ServiceListing` | Catalogo legado de servicos |
| `ServiceOrder` | Ciclo de vida dos pedidos |
| `ServiceOrderItem` | Itens do pedido (vitrine) |
| `ServiceOrderEvent` | Eventos do pedido |
| `OrderBrief` | Briefing detalhado |
| `Proposal` | Sistema de propostas/licitacao |

### Vitrines (Storefronts)
| Modelo | Descricao |
|--------|-----------|
| `Storefront` | Vitrine do profissional |
| `StorefrontCategory` | Categorias da vitrine |
| `StorefrontService` | Servicos da vitrine |
| `StorefrontServiceOption` | Opcoes/variacoes do servico |

### Financeiro
| Modelo | Descricao |
|--------|-----------|
| `Payment` | Rastreamento de pagamentos em escrow |
| `PaymentEvent` | Event store de pagamentos (idempotente) |
| `Transaction` | Historico financeiro (deposito, saque, taxa) |
| `EscrowConfig` | Configuracao de escrow |

### Comunicacao
| Modelo | Descricao |
|--------|-----------|
| `Message` | Chat (TEXT, SYSTEM, ATTACHMENT, LOCATION) |
| `Notification` | Notificacoes do sistema |
| `File` | Armazenamento de anexos |

### Profissional
| Modelo | Descricao |
|--------|-----------|
| `Review` | Avaliacoes (qualidade, pontualidade, comunicacao) |
| `ProfessionalSchedule` | Disponibilidade semanal |
| `ScheduleBlock` | Bloqueios de horario |
| `Certification` | Certificacoes profissionais |
| `VerificationSubmission` | Fluxo de verificacao KYC |
| `Dispute` | Resolucao de conflitos |

### Empresa
| Modelo | Descricao |
|--------|-----------|
| `CompanyProfile` | Perfil da empresa |
| `CompanyRole` | Cargos personalizados |
| `CompanyMember` | Membros da empresa |
| `CompanySalaryRule` | Regras salariais |
| `CompanySalaryPayment` | Pagamentos de salario |
| `ServiceTeam` / `ServiceTeamMember` | Equipes de servico |
| `CompanyChannel` / `CompanyChannelMember` | Canais de comunicacao |
| `CompanyStorefront*` | Vitrine da empresa (secoes, itens, blocos) |
| `CompanyPinnedTestimonial` | Depoimentos fixados |
| `CompanyInviteToken` | Tokens de convite |

### Analytics
| Modelo | Descricao |
|--------|-----------|
| `PageView` | Visualizacoes de pagina |
| `SearchEvent` | Eventos de busca |
| `ServiceListingView` | Visualizacoes de listings |
| `CityMetrics` | Metricas por cidade |
| `SystemConfig` | Configuracoes da plataforma |

---

## Seguranca

- **Autenticacao JWT** com refresh tokens e versionamento
- **MFA TOTP** com segredos criptografados (AES-256-GCM) — obrigatorio para admins
- **Bcrypt** com 12 rounds para hash de senhas
- **Rate Limiting** — geral por IP + especifico para auth e webhooks
- **Helmet.js** para headers HTTP seguros
- **Sanitizacao XSS** em todas as entradas
- **Validacao Zod** em todos os inputs da API
- **Filtro de Chat** — bloqueia telefones, emails, CPF/CNPJ, redes sociais, chaves PIX
- **Escrow** com confirmacao dupla obrigatoria
- **CORS** configurado por ambiente
- **Protecao contra SQL Injection** via Prisma ORM
- **Circuit Breaker** para chamadas externas (MercadoPago)
- **Audit Log** persistente com middleware automatico
- **Secrets Management** abstraido (`env` / `aws` / `gcp` / `azure`)
- **Idempotencia dupla** em pagamentos (Redis + DB constraint)
- **Webhook validation** com assinatura MercadoPago

---

## Filas Assincronas (BullMQ)

Workers rodam como processos separados da API, permitindo escalar independentemente:

| Worker | Funcao |
|--------|--------|
| `notificationWorker` | Processa notificacoes assincronas |
| `emailWorker` | Envia emails (verificacao, reset, notificacoes) |
| `paymentWorker` | Processa eventos de pagamento |
| `reconciliationWorker` | Reconciliacao diaria com MercadoPago |
| `antiFraudWorker` | Analise de transacoes suspeitas |
| `schedulerWorker` | Jobs recorrentes (BullMQ repeatable) |

---

## Observabilidade

- **Logging**: Pino estruturado (JSON em prod, pino-pretty em dev) — zero `console.log`
- **Metricas**: Prometheus via `/metrics` (HTTP, filas, pagamentos, circuit breaker, MFA)
- **Health Check**: `/health` com status de database, Redis, filas e circuit breaker
- **Request Logging**: pino-http middleware com correlacao de requests
- **Audit Trail**: Todas acoes criticas registradas em `AuditLog`

---

## Como Executar

### Pre-requisitos

- Node.js 20+
- Docker e Docker Compose (para PostgreSQL e Redis)
- npm

### Instalacao

```bash
# Clone o repositorio
git clone git@github.com:levygamer200-ux/faztudo.git
cd faztudo

# Subir PostgreSQL e Redis
docker compose up postgres redis -d

# Instalar e configurar o backend
cd backend
npm install
cp .env.example .env  # Configure suas variaveis (ver secao abaixo)
npx prisma generate
npx prisma db push
npm run db:seed  # Popula banco com dados de teste

# Instalar o frontend
cd ../frontend
npm install

# Instalar o admin (opcional)
cd ../admin
npm install
```

### Executar em Desenvolvimento

```bash
# Terminal 1 - Backend API
cd backend && npm run dev          # http://localhost:3001

# Terminal 2 - Workers BullMQ
cd backend && npm run worker       # Processa filas assincronas

# Terminal 3 - Scheduler
cd backend && npm run scheduler    # Jobs recorrentes

# Terminal 4 - Frontend
cd frontend && npm run dev         # http://localhost:5173

# Terminal 5 - Admin (opcional)
cd admin && npm run dev            # http://localhost:5174
```

### Ou com Docker Compose (tudo junto)

```bash
docker compose up                  # Backend + Frontend + Admin + PostgreSQL + Redis
```

### Variaveis de Ambiente

#### Backend (`backend/.env`)
```env
# Servidor
NODE_ENV=development
PORT=3001

# Banco de Dados (PostgreSQL)
DATABASE_URL=postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# Autenticacao
JWT_SECRET=sua-chave-secreta-com-minimo-32-caracteres
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# Seguranca
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
MFA_ENCRYPTION_KEY=chave-hex-32-bytes-para-aes-256-gcm
SECRETS_PROVIDER=env

# Escrow e Taxas
DEFAULT_ESCROW_HOLD_DAYS=7
PLATFORM_FEE_PERCENTAGE=10.0

# MercadoPago
MP_PUBLIC_KEY=sua-public-key
MP_ACCESS_TOKEN=seu-access-token
MP_CLIENT_ID=seu-client-id
MP_CLIENT_SECRET=seu-client-secret
MP_SANDBOX=true
MP_WEBHOOK_SECRET=seu-webhook-secret

# Email (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=seu-usuario
SMTP_PASS=sua-senha
SMTP_FROM_NAME=FazTudo
SMTP_FROM_EMAIL=noreply@faztudo.com

FRONTEND_URL=http://localhost:5173
```

#### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

### Executar Testes

```bash
cd backend
npm test                # Todos os 337 testes
npm run test:watch      # Modo watch
npm run test:security   # Apenas testes de seguranca (8 arquivos)
npx tsc --noEmit        # Checagem de tipos
```

### Comandos Uteis

```bash
# Banco de dados
cd backend
npm run db:push         # Aplica schema no banco
npm run db:seed         # Popula com dados de teste
npm run db:studio       # Abre Prisma Studio (GUI)
npm run db:reset        # Reset completo do banco

# Frontend
cd frontend
npm run build           # Build de producao
npm run lint            # ESLint
npx tsc --noEmit        # Checagem de tipos
```

---

## Rotas do Frontend

### Publicas
| Rota | Pagina |
|------|--------|
| `/` | Landing page para clientes |
| `/profissionais` | Landing page para profissionais |
| `/login` | Login |
| `/register` | Registro |
| `/forgot-password` | Recuperar senha |
| `/reset-password/:token` | Resetar senha |
| `/verify-email/:token` | Verificar email |
| `/explorar` | Explorar vitrines de profissionais |
| `/explorar/:slug` | Ver vitrine especifica |
| `/services/:id` | Detalhes do servico |
| `/mapa` | Visualizacao em mapa |
| `/empresa/:companyId` | Vitrine da empresa |
| `/profissional/:userId` | Vitrine do profissional |
| `/termos` | Termos de servico |
| `/privacidade` | Politica de privacidade |
| `/seguranca` | Dicas de seguranca |

### Cliente (`/client/*`)
| Rota | Pagina |
|------|--------|
| `/client/dashboard` | Dashboard |
| `/client/orders` | Meus pedidos |
| `/client/orders/new` | Novo pedido |
| `/client/orders/:id` | Detalhes do pedido |
| `/client/orders/:id/checkout` | Pagamento |
| `/client/orders/:id/payment-confirmed` | Confirmacao de pagamento |
| `/client/orders/:id/chat` | Chat do pedido |
| `/client/orders/:id/mapa` | Rastreamento em mapa |
| `/client/messages` | Conversas |
| `/client/notifications` | Notificacoes |
| `/client/carteira` | Carteira digital |

### Profissional (`/professional/*`)
| Rota | Pagina |
|------|--------|
| `/professional/dashboard` | Dashboard |
| `/professional/crm` | CRM (pipeline de clientes) |
| `/professional/agenda` | Calendario de disponibilidade |
| `/professional/reputacao` | Painel de reputacao |
| `/professional/services` | Meus pedidos |
| `/professional/services/:id` | Detalhes do pedido |
| `/professional/services/:id/chat` | Chat do pedido |
| `/professional/services/:id/mapa` | Mapa do servico |
| `/professional/vitrine` | Gerenciador da vitrine |
| `/professional/vitrine/setup` | Wizard de onboarding |
| `/professional/messages` | Conversas |
| `/professional/notifications` | Notificacoes |
| `/professional/carteira` | Carteira digital |

### Empresa (`/company/*`)
| Rota | Pagina |
|------|--------|
| `/company/dashboard` | Dashboard |
| `/company/profile` | Perfil da empresa |
| `/company/members` | Gestao de membros |
| `/company/roles` | Cargos e permissoes |
| `/company/salary` | Regras salariais |
| `/company/orders` | Pedidos da empresa |
| `/company/channels` | Canais de comunicacao |
| `/company/channels/:channelId` | Detalhe do canal |
| `/company/analytics` | Analytics e metricas |
| `/company/storefront-editor` | Editor de vitrine |
| `/company/orders/:id/chat` | Chat do pedido |
| `/company/notifications` | Notificacoes |
| `/company/carteira` | Carteira digital |

### Perfil (todos os roles)
| Rota | Pagina |
|------|--------|
| `/profile` | Meu perfil |
| `/profile/settings` | Configuracoes |

### Admin (Painel Dedicado - porta 5174)
| Pagina | Descricao |
|--------|-----------|
| Dashboard | Estatisticas gerais |
| Usuarios | Listagem e gerenciamento |
| Detalhe do usuario | Perfil completo |
| Empresas | Gerenciamento de empresas |
| Verificacoes | Aprovacao de documentos KYC |
| Disputas | Moderacao de conflitos |
| Trafego | Metricas de acesso |
| Configuracoes | Settings da plataforma |

---

## Modelo de Negocio

| Item | Valor |
|------|-------|
| Taxa da plataforma | 10% por transacao |
| Periodo de escrow | 7 dias |
| Confirmacao | Dupla (cliente + profissional) |

**Exemplo de transacao:**
```
Valor do servico:    R$ 500,00
Taxa (10%):          R$  50,00
Profissional recebe: R$ 450,00
```

---

## Testes

**337 testes** em 40 arquivos, todos passando:

| Categoria | Arquivos | Descricao |
|-----------|----------|-----------|
| **Integracao** | 10 | Fluxo de pedidos, confirmacao, chat, calendario, CRM, financas, reputacao, email, reset de senha |
| **Seguranca** | 8 | XSS, validacao, rate limiting, input validation, IDOR, data leak, auth bypass, webhook |
| **E2E/Feature** | 12 | Storefront, company flow, company invite, company channels, company orders, analytics, admin verification, professional storefront, geocoding, reschedule, bearing |
| **Unitarios** | 4 | Email service, SMTP config, scheduler, CPF validator |
| **Lib** | 2 | Payment state machine (11 tests), circuit breaker (6 tests) |
| **Middleware** | 3 | Chat filter, sanitize, MFA (7 tests) |
| **Config** | 1 | Secrets management (6 tests) |

---

## Usuarios de Teste (Seed)

```
Cliente:         cliente@teste.com        / Teste@123
Profissional 1:  profissional@teste.com   / Teste@123
Profissional 2:  profissional2@teste.com  / Teste@123
Membro 1:        membro1@teste.com        / Teste@123
Membro 2:        membro2@teste.com        / Teste@123
```

---

## MercadoPago (Sandbox)

- Credenciais em `VARIAVEIS/.env.mp` (gitignored)
- Cartao teste: `5031 4332 1540 6351` (Mastercard)
- CVV: `123`, Validade: qualquer futura
- CPF teste: `12345678909`
- Flag `MP_SANDBOX=true` para ambiente de teste

---

## Roadmap

- [x] ~~Migrar SQLite para PostgreSQL~~
- [x] ~~Filas assincronas com BullMQ~~
- [x] ~~Logging estruturado (Pino)~~
- [x] ~~Autenticacao multi-fator (MFA TOTP)~~
- [x] ~~Circuit breaker para APIs externas~~
- [x] ~~Metricas Prometheus~~
- [x] ~~Reconciliacao de pagamentos~~
- [x] ~~Email (verificacao, reset, notificacoes)~~
- [x] ~~Vitrines personalizaveis~~
- [x] ~~Modulo de empresas completo~~
- [x] ~~WebSocket (Socket.IO) para notificacoes~~
- [x] ~~Mapas interativos (Leaflet/MapLibre)~~
- [x] ~~Painel admin dedicado~~
- [ ] Testes no frontend (unitarios e integracao)
- [ ] Chat em tempo real via WebSocket (atualmente polling)
- [ ] Liberacao automatica de escrow
- [ ] Cache HTTP no backend
- [ ] Rate limiting por usuario autenticado
- [ ] Internacionalizacao (i18n)
- [ ] Aplicativo mobile (React Native)
- [ ] Suporte a videochamadas

---

## Contribuicao

Projeto desenvolvido com assistencia do Claude Code. Workflow:
- TypeScript strict mode
- Testes com Vitest (337 testes passando)
- Commits semanticos (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- Code review integrado
- Git worktrees para features paralelas

---

## Licenca

Projeto privado - Todos os direitos reservados.

---

Desenvolvido com ❤️ no Brasil
