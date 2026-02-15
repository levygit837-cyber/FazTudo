# FazTudo - Marketplace de Serviços

**FazTudo** é uma plataforma completa de marketplace que conecta **clientes** a **profissionais de serviços** no Brasil, com sistema de pagamentos em escrow via MercadoPago, chat integrado, CRM profissional e muito mais.

---

## Visão Geral

| Item | Detalhes |
|------|---------|
| **Backend** | Express 5 + TypeScript + Prisma ORM + SQLite |
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS |
| **Pagamentos** | MercadoPago (Cartão, PIX, Boleto) |
| **Autenticação** | JWT com refresh tokens |
| **Linhas de Código** | ~18.000+ linhas TypeScript |
| **Modelos no Banco** | 21 tabelas |
| **Endpoints da API** | 60+ rotas REST |

---

## Funcionalidades Principais

### Para Clientes
- Busca e navegação de serviços por categoria, localização e avaliação
- Criação de pedidos com briefing detalhado (fotos, vídeos, urgência)
- Pagamento seguro com escrow (Cartão, PIX, Boleto)
- Chat integrado com profissionais (texto, anexos, localização)
- Sistema de avaliações e reviews
- Carteira digital com histórico de transações

### Para Profissionais
- Catálogo de serviços com preços, imagens e tags
- Dashboard CRM com pipeline de clientes e métricas
- Calendário de disponibilidade com bloqueio de horários
- Painel de reputação com análise de tendências
- Sistema de propostas para concorrer em pedidos
- Gestão financeira com saques e histórico

### Para Administradores
- Gerenciamento de usuários e verificações
- Aprovação de documentos (CPF/CNPJ)
- Estatísticas da plataforma
- Gerenciamento de categorias

---

## Arquitetura do Projeto

```
faztudo/
├── backend/                    # API REST Express.js
│   ├── src/
│   │   ├── controllers/        # Handlers de requisição
│   │   │   └── service/        # Controllers de serviço (orders, payments, chat)
│   │   ├── routes/             # Definições de rotas
│   │   ├── services/           # Lógica de negócio (MercadoPago, escrow, notificações)
│   │   ├── middleware/         # Auth, validação, rate limiting, filtro de chat, XSS
│   │   ├── config/             # Configuração de ambiente e MercadoPago
│   │   └── lib/                # Cliente Prisma
│   ├── prisma/                 # Schema do banco e migrações
│   ├── tests/                  # Testes (integração, segurança, middleware)
│   └── uploads/                # Armazenamento de arquivos do chat
│
├── frontend/                   # SPA React + TypeScript
│   ├── src/
│   │   ├── pages/              # Páginas organizadas por domínio
│   │   │   ├── auth/           # Login, Registro
│   │   │   ├── services/       # Catálogo, Detalhes, Busca
│   │   │   ├── orders/         # Pedidos, Detalhes do pedido
│   │   │   ├── checkout/       # Pagamento (Cartão, PIX, Boleto)
│   │   │   ├── professional/   # Dashboard, CRM, Calendário, Reputação
│   │   │   ├── client/         # Dashboard do cliente
│   │   │   ├── chat/           # Sistema de mensagens
│   │   │   └── admin/          # Painel administrativo
│   │   ├── components/         # Componentes reutilizáveis
│   │   ├── context/            # Providers (Auth, Theme, Toast)
│   │   ├── services/           # Chamadas à API (Axios)
│   │   ├── hooks/              # Custom hooks
│   │   └── types/              # Interfaces TypeScript
│   └── public/                 # Assets estáticos
│
├── docs/plans/                 # Documentação e planos de implementação
└── VARIAVEIS/                  # Credenciais MercadoPago (gitignored)
```

---

## Stack Tecnológica

### Backend
| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Express | 5.2 | Framework web |
| TypeScript | 5.9 | Linguagem |
| Prisma | 7.3 | ORM + Migrações |
| SQLite | - | Banco de dados |
| JWT | 9.0 | Autenticação |
| bcrypt | 6.0 | Hash de senhas |
| MercadoPago SDK | 2.12 | Pagamentos |
| Zod | 4.3 | Validação de dados |
| Helmet | 8.1 | Segurança HTTP |
| Multer | 2.0 | Upload de arquivos |
| Vitest | 4.0 | Testes |

### Frontend
| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React | 18.2 | UI Framework |
| Vite | 5.0 | Build tool |
| TypeScript | 5.2 | Linguagem |
| TailwindCSS | 3.3 | Estilização |
| React Router | 6.20 | Roteamento |
| Axios | 1.6 | HTTP Client |
| Lucide React | 0.292 | Ícones |

---

## Fluxo de Pagamento (Escrow)

```
Cliente cria pedido
       │
       ▼
Profissional aceita
       │
       ▼
Cliente realiza pagamento ──► Fundos retidos em ESCROW (7 dias)
   (Cartão/PIX/Boleto)
       │
       ▼
Profissional executa serviço
       │
       ▼
Profissional marca como concluído
       │
       ▼
Cliente confirma conclusão ──► Confirmação dupla
       │
       ▼
Pagamento LIBERADO
   ├── Profissional recebe: 90%
   └── Taxa da plataforma: 10%
```

### Métodos de Pagamento
- **Cartão de Crédito/Débito** - Checkout transparente (tokenização pelo SDK do MercadoPago)
- **PIX** - QR Code gerado em tempo real
- **Boleto Bancário** - Código de barras para pagamento

---

## Endpoints da API

### Autenticação (`/api/auth`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/register` | Registro de usuário |
| POST | `/login` | Login com JWT |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Invalidar token |
| GET | `/me` | Dados do usuário atual |
| PUT | `/me` | Atualizar perfil |

### Serviços (`/api/services`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Listar serviços (público) |
| POST | `/` | Criar serviço (profissional) |
| GET | `/:id` | Detalhes do serviço |
| PUT | `/:id` | Atualizar serviço |
| DELETE | `/:id` | Remover serviço |

### Pedidos (`/api/services/orders`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/` | Criar pedido |
| POST | `/with-brief` | Criar com briefing detalhado |
| GET | `/` | Meus pedidos |
| GET | `/:id` | Detalhes do pedido |
| POST | `/:id/accept` | Profissional aceita |
| POST | `/:id/start` | Iniciar serviço |
| POST | `/:id/submit-completion` | Marcar como concluído |
| POST | `/:id/confirm-completion` | Cliente confirma |
| POST | `/:id/cancel` | Cancelar pedido |
| POST | `/:id/reschedule` | Reagendar |

### Propostas
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/orders/:id/proposals` | Enviar proposta |
| GET | `/orders/:id/proposals` | Ver propostas |
| POST | `/orders/:id/proposals/:pid/accept` | Aceitar proposta |

### Pagamentos (`/api/services`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/payments/config` | Chave pública do MercadoPago |
| POST | `/orders/:id/payments` | Criar pagamento |
| POST | `/payments/webhook` | Webhook do MercadoPago |
| POST | `/orders/:id/payments/release` | Liberar do escrow |

### Chat e Mensagens
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/chats` | Listar conversas |
| POST | `/orders/:id/messages` | Enviar mensagem |
| POST | `/orders/:id/messages/upload` | Upload de arquivo |
| GET | `/orders/:id/messages` | Obter mensagens |

### Dashboard e Carteira
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/stats` | Estatísticas do usuário |
| GET | `/api/dashboard/professional/crm` | Dados do CRM |
| GET | `/api/dashboard/professional/reputation` | Métricas de reputação |
| GET | `/api/wallet/balance` | Saldo da carteira |
| GET | `/api/wallet/transactions` | Histórico de transações |
| POST | `/api/wallet/withdraw` | Solicitar saque |

### Admin (`/api/admin`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users` | Listar usuários |
| PUT | `/users/:id/status` | Alterar status |
| GET | `/verifications` | Verificações pendentes |
| POST | `/verifications/:id/approve` | Aprovar verificação |

---

## Modelos do Banco de Dados

O schema Prisma contém **21 modelos**:

| Modelo | Descrição |
|--------|-----------|
| `User` | Usuários (CLIENT, PROFESSIONAL, ADMIN) |
| `ServiceCategory` | Categorias hierárquicas de serviços |
| `ServiceListing` | Catálogo de serviços dos profissionais |
| `ServiceOrder` | Ciclo de vida dos pedidos |
| `Payment` | Rastreamento de pagamentos em escrow |
| `Transaction` | Histórico financeiro (depósito, saque, taxa) |
| `Message` | Sistema de chat (TEXT, SYSTEM, ATTACHMENT, LOCATION) |
| `Notification` | Notificações do sistema |
| `Review` | Avaliações (qualidade, pontualidade, comunicação) |
| `Address` | Endereços e geolocalização |
| `OrderBrief` | Briefing detalhado do pedido |
| `Proposal` | Sistema de propostas/licitação |
| `ProfessionalSchedule` | Disponibilidade semanal |
| `ScheduleBlock` | Bloqueios de horário |
| `Dispute` | Resolução de conflitos |
| `File` | Armazenamento de anexos |
| `Certification` | Certificações profissionais |
| `VerificationSubmission` | Fluxo de verificação KYC |
| `EscrowConfig` | Configuração de escrow |
| `SystemConfig` | Configurações da plataforma |
| `ProfessionalCategory` | Mapeamento profissional-categoria |

---

## Segurança

- **Autenticação JWT** com refresh tokens e versionamento
- **Bcrypt** com 12 rounds para hash de senhas
- **Rate Limiting** - 100 req/15min (geral), 10 req/15min (auth)
- **Helmet.js** para headers HTTP seguros
- **Sanitização XSS** em todas as entradas
- **Validação Zod** em todos os inputs da API
- **Filtro de Chat** - bloqueia telefones, emails, CPF/CNPJ, redes sociais, chaves PIX
- **Escrow** com confirmação dupla obrigatória
- **CORS** configurado por ambiente
- **Proteção contra SQL Injection** via Prisma ORM

---

## Como Executar

### Pré-requisitos
- Node.js 18+
- npm

### Instalação

```bash
# Clone o repositório
git clone git@github.com:levygamer200-ux/faztudo.git
cd faztudo

# Instalar dependências do backend
cd backend
npm install
cp .env.example .env  # Configure suas variáveis

# Instalar dependências do frontend
cd ../frontend
npm install
```

### Configurar Banco de Dados

```bash
cd backend
npx prisma generate
npx prisma db push
```

### Variáveis de Ambiente

#### Backend (`backend/.env`)
```env
# Servidor
NODE_ENV=development
PORT=3001

# Banco de Dados
DATABASE_URL=file:./dev.db

# Autenticação
JWT_SECRET=sua-chave-secreta-com-minimo-32-caracteres
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# Segurança
CORS_ORIGIN=http://localhost:5173

# Escrow e Taxas
DEFAULT_ESCROW_HOLD_DAYS=7
PLATFORM_FEE_PERCENTAGE=10.0

# MercadoPago
MP_PUBLIC_KEY=sua-public-key
MP_ACCESS_TOKEN=seu-access-token
MP_CLIENT_ID=seu-client-id
MP_CLIENT_SECRET=seu-client-secret
MP_SANDBOX=true
```

#### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3001
```

### Executar em Desenvolvimento

```bash
# Terminal 1 - Backend
cd backend
npm run dev    # http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev    # http://localhost:5173
```

### Executar Testes

```bash
cd backend
npm test                # Todos os testes
npm run test:watch      # Modo watch
npm run test:security   # Testes de segurança
```

---

## Rotas do Frontend

### Públicas
| Rota | Página |
|------|--------|
| `/` | Landing page para clientes |
| `/profissionais` | Landing page para profissionais |
| `/login` | Login |
| `/register` | Registro |
| `/services` | Catálogo de serviços |
| `/services/:id` | Detalhes do serviço |

### Cliente (`/client/*`)
| Rota | Página |
|------|--------|
| `/client/dashboard` | Dashboard |
| `/client/orders` | Meus pedidos |
| `/client/orders/:id` | Detalhes do pedido |
| `/client/orders/:id/checkout` | Pagamento |
| `/client/orders/:id/chat` | Chat do pedido |
| `/client/messages` | Conversas |
| `/client/carteira` | Carteira |

### Profissional (`/professional/*`)
| Rota | Página |
|------|--------|
| `/professional/dashboard` | Dashboard |
| `/professional/crm` | CRM |
| `/professional/agenda` | Calendário |
| `/professional/reputacao` | Reputação |
| `/professional/services` | Meus pedidos |
| `/professional/catalog` | Catálogo |
| `/professional/catalog/new` | Novo serviço |
| `/professional/messages` | Conversas |
| `/professional/carteira` | Carteira |

### Admin (`/admin/*`)
| Rota | Página |
|------|--------|
| `/admin/dashboard` | Estatísticas |
| `/admin/users` | Gerenciar usuários |
| `/admin/verifications` | Verificações |

---

## Modelo de Negócio

| Item | Valor |
|------|-------|
| Taxa da plataforma | 10% por transação |
| Período de escrow | 7 dias |
| Confirmação | Dupla (cliente + profissional) |

**Exemplo de transação:**
```
Valor do serviço:    R$ 500,00
Taxa (10%):          R$  50,00
Profissional recebe: R$ 450,00
```

---

## Roadmap

- [ ] Notificações por email (Resend)
- [ ] WebSocket para chat em tempo real
- [ ] Liberação automática de escrow
- [ ] Painel de mediação de disputas
- [ ] Dashboard de analytics avançado
- [ ] Aplicativo mobile (React Native)
- [ ] Integração com Google Maps
- [ ] Verificação por SMS
- [ ] Portfólio de profissionais
- [ ] Suporte a videochamadas
- [ ] Multi-idioma

---

## Contribuição

Projeto desenvolvido com assistência do Claude Code. Workflow:
- TypeScript strict mode
- Testes com Vitest
- Commits semânticos
- Code review integrado

---

## Licença

Projeto privado - Todos os direitos reservados.

---

Desenvolvido com ❤️ no Brasil
