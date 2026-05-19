<div align="center">

# 🛠️ FazTudo

**Marketplace de serviços B2C2B — conectando clientes, profissionais autônomos e empresas em uma única plataforma.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🎯 O Problema

Pequenos negócios e profissionais autônomos no Brasil perdem clientes por não terem presença digital. Ao mesmo tempo, consumidores struggle para encontrar prestadores de confiança com avaliações transparentes e pagamento seguro.

**FazTudo** resolve isso com um marketplace completo: clientes encontram serviços, profissionais gerenciam seu negócio, empresas escalam equipes — tudo com pagamento protegido via escrow e avaliações verificadas.

---

## ✨ Funcionalidades Principais

### 👤 Para Clientes
- **Busca inteligente** — Filtros por localização, categoria, preço, avaliação e disponibilidade de calendário
- **Mapa interativo** — Visualização de profissionais próximos com navegação estilo Waze
- **Pedidos com escrow** — Pagamento seguro: o dinheiro só é liberado após confirmação de entrega
- **Chat em tempo real** — Negociação integrada com histórico de mensagens
- **Múltiplos profissionais** — Receba propostas comparáveis e escolha a melhor

### 🔧 Para Profissionais
- **Vitrine personalizada** — Storefront com portfólio, serviços, reviews e integração de pagamento
- **Agenda inteligente** — Calendário com disponibilidade, reagendamento e lembretes automáticos
- **CRM integrado** — Gestão de leads, histórico de atendimento e pipeline de vendas
- **Carteira digital** — Saque automático, histórico de transações e relatório financeiro
- **Reputação verificada** — Sistema de reviews com verificação de pedido concluído

### 🏢 Para Empresas
- **Gestão de equipes** — Convites, permissões granulares, hierarquia e controle de acesso
- **Múltiplos canais** — Diferentes frentes de atendimento (ex: residencial, comercial, industrial)
- **Comissões automáticas** — Regras de salary split entre empresa e colaboradores
- **Analytics** — Dashboard com métricas de conversão, faturamento e performance da equipe
- **White-label storefront** — Vitrine customizada com identidade visual da empresa

### 🛡️ Segurança & Confiabilidade
- **MFA (2FA)** — Autenticação multifator via TOTP
- **Rate limiting** — Proteção contra brute-force e abuse
- **Audit logging** — Rastreamento completo de ações administrativas
- **Anti-fraude** — Worker dedicado a detecção de padrões suspeitos
- **IDOR protection** — Middleware que valida acesso a recursos por ownership
- **Input sanitization** — Proteção XSS e injeção em todas as camadas
- **Circuit breaker** — Resiliência em chamadas externas (Mercado Pago, geocoding)

---

## 🏗️ Arquitetura

```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   🎨 Frontend   │  │   ⚙️ Admin      │  │   📱 Mobile     │
│  React + Vite   │  │  React + Vite   │  │   (futuro)      │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │
         └────────────────────┼──────────────────────────────┘
                              │ REST API + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    🔧 Backend (Express)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Auth/MFA   │ │   Routes    │ │      Middleware         ││
│  │  JWT+TOTP   │ │  29 módulos │ │ RateLimit|Audit|Validate││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Controllers│ │   Services  │ │       Workers           ││
│  │     37      │ │   Escrow    │ │ AntiFraud|Email|Payment ││
│  │             │ │ MercadoPago │ │ Notification|Scheduler  ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└────────┬──────────────────────┬─────────────────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐  ┌─────────────────┐
│  💾 PostgreSQL  │  │  ⚡ Redis       │
│   Prisma ORM    │  │  BullMQ Queues  │
│  40+ entidades  │  │  Background jobs│
└─────────────────┘  └─────────────────┘
```

---

## 📊 Estatísticas do Projeto

| Métrica | Valor |
|---|---|
| **Linhas de código** | ~79.000 |
| **Arquivos** | 407 |
| **Controllers** | 37 |
| **Rotas API** | 29 módulos |
| **Middlewares** | 14 (auth, rate limit, audit, sanitize, etc.) |
| **Workers** | 7 (background jobs) |
| **Testes** | 47 (unitários, integração, segurança) |
| **Páginas frontend** | 52 |
| **Componentes UI** | 76 |
| **Páginas admin** | 9 |
| **Entidades DB** | 40+ (schema Prisma) |

---

## 🚀 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Admin** | React 19, TypeScript, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Banco de dados** | PostgreSQL 16, Prisma ORM |
| **Cache/Filas** | Redis 7, BullMQ |
| **Pagamentos** | Mercado Pago (Pix, cartão, boleto) |
| **Email** | Templates HTML + worker assíncrono |
| **Geocoding** | Overpass API + serviço próprio |
| **Real-time** | WebSocket para chat e notificações |
| **Infra** | Docker Compose, health checks, volumes |
| **Testes** | Vitest (unit + integration + security) |

---

## ⚡ Quick Start

```bash
# 1. Clone e entre no repo
git clone https://github.com/levygit837-cyber/FazTudo.git
cd FazTudo

# 2. Suba a infraestrutura (PostgreSQL + Redis + backend + frontend + admin)
docker compose up --build

# 3. Ou rode localmente com hot-reload:
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:5173
npm run dev:admin     # http://localhost:5174
```

**Pré-requisitos:** Node.js 20+, npm 10+, Docker (opcional)

---

## 🧪 Testes

```bash
# Todos os testes (unit + integration + security)
npm run test

# Testes específicos de segurança
npx vitest run apps/backend/tests/security/

# Testes de integração
npx vitest run apps/backend/tests/integration/
```

Cobertura inclui: auth bypass, data leak, IDOR, input validation, rate limiting, XSS, webhooks.

---

## 📁 Estrutura do Monorepo

```text
FazTudo/
├── apps/
│   ├── backend/          # API Express + Prisma + Workers
│   ├── frontend/         # App React para clientes/profissionais
│   └── admin/            # Painel administrativo
├── docker-compose.yml    # Orquestração completa da stack
└── package.json          # Scripts de orquestração do monorepo
```

---

## 🎓 Aprendizados Técnicos

- **Monorepo real** — Separação clara de responsabilidades com orquestração via npm workspaces
- **Escrow financeiro** — Implementação de máquina de estados para pagamentos protegidos
- **Background jobs** — BullMQ com workers dedicados para email, pagamento, notificação e anti-fraude
- **Segurança em camadas** — Defense in depth: sanitize → validate → auth → rate limit → audit
- **Resiliência** — Circuit breaker em integrações externas para evitar cascata de falhas
- **Testes de segurança** — Suite dedicada a detectar vulnerabilidades comuns (OWASP Top 10)
- **Multi-tenancy empresarial** — Isolamento de dados por empresa com permissionamento granular

---

## 📝 Status

| Módulo | Status |
|---|---|
| Autenticação & MFA | ✅ Completo |
| Gestão de usuários | ✅ Completo |
| Marketplace & busca | ✅ Completo |
| Pedidos & escrow | ✅ Completo |
| Pagamentos (Mercado Pago) | ✅ Completo |
| Chat em tempo real | ✅ Completo |
| Calendário & agendamento | ✅ Completo |
| Vitrines (storefronts) | ✅ Completo |
| Gestão empresarial | ✅ Completo |
| Admin panel | ✅ Completo |
| Testes automatizados | 🟡 Em expansão |
| CI/CD | 🔴 Pendente |
| Deploy em produção | 🔴 Pendente |

---

> 💡 **FazTudo** foi construído como um produto real, não um tutorial. Cada decisão de arquitetura — do schema Prisma ao circuit breaker — foi pensada para escalar e operar em produção.

