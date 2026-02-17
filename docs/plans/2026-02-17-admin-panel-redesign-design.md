# Admin Panel Redesign — Design Document

> **Data**: 2026-02-17
> **Escopo**: Redesign completo do painel administrativo do FazTudo
> **Abordagem**: SPA separada (`admin/`) com frontend dedicado

---

## 1. Visao Geral

O painel admin atual tem 3 paginas basicas (Dashboard, Users, Verifications) sem navegacao propria, com graficos fake e verificacao de documentos cega. Este redesign cria um admin profissional completo como SPA separada.

### Paginas do Novo Admin

| Pagina | Rota | Descricao |
|--------|------|-----------|
| Login | `/login` | Login dedicado (so admins) |
| Dashboard | `/dashboard` | KPIs, graficos, funil, rankings |
| Usuarios | `/users` | Lista por categoria com metricas |
| Usuarios Detalhe | `/users/:id` | Perfil completo com 5 tabs |
| Verificacoes | `/verifications` | Review de documentos com visualizacao |
| Trafego | `/traffic` | Analytics de sessoes, chat, retencao |
| Disputas | `/disputes` | Gestao e resolucao de disputas |
| Inbox | `/inbox` | Email placeholder (futuro) |
| Configuracoes | `/settings` | Config da plataforma |

---

## 2. Arquitetura

### Estrutura do Projeto

```
faztudo-main/
├── backend/        # Existente — recebe novos endpoints
├── frontend/       # Existente — app cliente/profissional
├── admin/          # NOVO — SPA separada
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── UserDetail.tsx
│   │   │   ├── Verifications.tsx
│   │   │   ├── Traffic.tsx
│   │   │   ├── Disputes.tsx
│   │   │   ├── Inbox.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── charts/
│   │   │   ├── metrics/
│   │   │   ├── users/
│   │   │   ├── verifications/
│   │   │   └── common/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── authService.ts
│   │   │   ├── statsService.ts
│   │   │   ├── usersService.ts
│   │   │   ├── verificationsService.ts
│   │   │   ├── trafficService.ts
│   │   │   └── disputesService.ts
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── index.html
│   ├── vite.config.ts    # Porta 5174
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
└── docker-compose.yml    # Atualizado
```

### Stack

- React 18 + TypeScript + Vite (porta 5174)
- TailwindCSS
- Recharts (graficos)
- Lucide React (icones)
- Axios (API calls para backend:3001)

---

## 3. Login Admin

**Rota**: `/login` (no admin SPA)
**Visual**: Fullscreen, fundo escuro/gradiente, card centralizado
**Campos**: Email + Senha
**Fluxo**: `POST /api/admin/login` → verifica `role === ADMIN` → JWT → localStorage → redirect `/dashboard`
**Seguranca**: Usuarios nao-admin recebem erro "Acesso nao autorizado"
**Sem link de cadastro** — admins criados manualmente no banco

---

## 4. Layout (Sidebar + Header)

### Sidebar

- Fixa a esquerda, colapsavel (icones only no mobile)
- Itens: Dashboard, Usuarios, Verificacoes, Trafego, Disputas, Inbox, Configuracoes
- Badge de notificacao em Verificacoes (pendentes) e Inbox (futuro)
- Item ativo com destaque visual
- Botao "Sair" no final

### Header

- Logo + "FazTudo Admin"
- Busca global (usuarios, pedidos, disputas)
- Icone notificacoes
- Avatar/nome do admin
- Toggle dark/light mode

---

## 5. Dashboard

### KPI Cards (4)

1. **Servicos concluidos** no periodo + variacao %
2. **Faturamento da plataforma** (taxa 10%) + variacao %
3. **Novos usuarios** cadastrados + variacao %
4. **Ticket medio** (valor medio/pedido) + variacao %

Cada card com mini sparkline embaixo.

### Graficos

- **Novos Usuarios**: Line chart com area, eixo X = dias, tooltip com data+valor
- **Faturamento**: Area chart, receita plataforma por dia, % variacao
- **Funil de Conversao**: Visitantes → Cadastros → 1o Pedido → Recorrentes (com %)
- **Top 5 Categorias**: Ranking com barra horizontal proporcional
- **Tempos Medios + Taxas**: Aceite, conclusao, resposta chat, cancelamento, disputas, retencao 7d

### Filtro de Periodo

Dropdown global: **1d / 7d / 30d** — todos os dados reagem.

---

## 6. Pagina de Usuarios

### Tabs

- **Todos** (padrao) — cards misturados com visual por tipo
- **Clientes**
- **Profissionais**
- **Empresas** (estado vazio por enquanto)

### Filtros

- Busca por nome/email
- Status: Todos / Ativo / Pendente / Suspenso / Inativo
- Verificado: Todos / Sim / Nao
- Ordenacao: Mais recente / Nome / Rating

### Metricas por Tipo

**Profissionais**: Concluidos, Cancelados, Pendentes, Ativos, Receita total, Rating
**Clientes**: Pedidos feitos, Cancelados, Finalizados, Total gasto
**Empresas**: Membros, Realizados, Em Vitrine, Ativos, Receita, Folha salarial

### Detalhe do Usuario (`/users/:id`)

Pagina completa (nao modal) com:
- Cabecalho: avatar, nome, email, badges
- Acoes: Ativar / Suspender / Desativar / Forcar logout
- Tab "Visao Geral": metricas + dados pessoais
- Tab "Pedidos": lista de pedidos
- Tab "Pagamentos": historico financeiro
- Tab "Verificacao": documentos submetidos
- Tab "Atividade": sessoes, page views

---

## 7. Verificacoes de Documentos

### Fluxo do Usuario (profissional/empresa)

1. Upload de documento (RG/CNH/CNPJ frente+verso)
2. Selfie segurando o documento
3. Salvo em `uploads/verifications/` + `VerificationSubmission`
4. Validacao automatica: CPF (ReceitaWS) / CNPJ (ReceitaWS)
5. Resultado salvo em `metadata` do VerificationSubmission

### Fluxo do Admin

- Tabs: Pendentes / Aprovadas / Rejeitadas
- Card com thumbnails dos documentos
- "Ver maior" abre modal com zoom
- Resultado da validacao automatica visivel
- Acoes: Aprovar Tudo / Aprovar Doc / Aprovar Facial / Rejeitar (com motivo)
- Ambos aprovados → `user.isVerified = true`

---

## 8. Analise de Trafego

### KPIs

- Sessoes ativas no periodo
- Tempo medio de sessao
- Usuarios ativos (distintos)
- Retencao 7d

### Graficos

- **Trafego Diario**: Line chart com 2 linhas (sessoes totais + usuarios unicos)
- **Tempo de Uso por Hora**: Bar chart (picos de uso no dia)
- **Distribuicao por Device**: Donut chart (Mobile/Desktop/Tablet)
- **Volume de Mensagens**: Area chart diario

### Metricas de Conversas

- Mensagens/dia medias
- Tempo medio de chat Pro↔Cliente
- Tempo medio de chat Empresa↔Cliente
- Mensagens por conversa (media)

### Retencao (Cohort)

- Tabela de cohort com heatmap: D1, D7, D14, D30
- Churn Rate 30d

### Filtro: 1d / 7d / 30d em cada secao

---

## 9. Disputas

### Tabs

- Abertas / Em Analise / Resolvidas / Fechadas

### Card de Disputa

- Pedido referenciado + nome do servico
- Cliente + Profissional
- Valor + Data abertura
- Motivo da disputa

### Acoes

- **Assumir analise** → status UNDER_REVIEW
- **Ver pedido** → detalhes do ServiceOrder
- **Ver chat** → historico de mensagens
- **Resolver** → modal com:
  - Decisao: Favor cliente / Favor profissional / Acordo mutuo
  - Acao financeira: Reembolso total / Parcial (valor) / Liberar pagamento
  - Justificativa (obrigatoria)

---

## 10. Inbox (Placeholder)

Estado vazio elegante com icone de email e mensagem "Inbox de Email sera configurado em breve". Layout completo pronto para integracao futura.

---

## 11. Configuracoes

Usando modelos existentes `EscrowConfig` + `SystemConfig`:

- **Taxa da Plataforma**: porcentagem (default 10%)
- **Escrow**: dias de retencao, periodo de disputa
- **Verificacao**: exigir para profissionais/empresas, tipos requeridos
- **Manutencao**: modo manutencao on/off, mensagem customizada

---

## 12. Novos Modelos Prisma

### UserSession (tracking de atividade)

```prisma
model UserSession {
  id          String     @id @default(uuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  startedAt   DateTime   @default(now())
  endedAt     DateTime?
  duration    Int?       // segundos
  pagesViewed Int        @default(0)
  device      String?    // mobile/desktop/tablet
  pageViews   PageView[]
  createdAt   DateTime   @default(now())

  @@index([userId])
  @@index([startedAt])
}
```

### PageView (tracking de navegacao)

```prisma
model PageView {
  id        String      @id @default(uuid())
  sessionId String
  session   UserSession @relation(fields: [sessionId], references: [id])
  path      String
  enteredAt DateTime    @default(now())
  duration  Int?        // segundos

  @@index([sessionId])
  @@index([path])
  @@index([enteredAt])
}
```

---

## 13. Novos Endpoints Backend

### Autenticacao Admin

```
POST  /api/admin/login   # Login dedicado (verifica role=ADMIN)
```

### Dashboard Stats

```
GET   /api/admin/stats/dashboard     # KPIs + series temporais
GET   /api/admin/stats/traffic       # Sessoes, tempo uso, devices
GET   /api/admin/stats/chat          # Metricas de conversas
GET   /api/admin/stats/funnel        # Funil de conversao
GET   /api/admin/stats/categories    # Ranking de categorias
GET   /api/admin/stats/retention     # Cohort + churn
```

### Usuarios (ajuste dos existentes)

```
GET   /api/admin/users               # Ajustar: metricas por role
GET   /api/admin/users/:id           # Expandir: tabs de detalhe
PUT   /api/admin/users/:id/status    # Existente
POST  /api/admin/users/:id/force-logout  # Novo: bump tokenVersion
```

### Verificacoes (ajuste)

```
GET   /api/admin/verifications       # Existente
PUT   /api/admin/verifications/:id   # Existente
```

### Disputas (novo)

```
GET   /api/admin/disputes            # Listar com filtros
GET   /api/admin/disputes/:id        # Detalhes
PUT   /api/admin/disputes/:id/assign # Assumir analise
PUT   /api/admin/disputes/:id/resolve # Resolver
```

### Configuracoes (novo)

```
GET   /api/admin/config              # Ler configs
PUT   /api/admin/config              # Atualizar configs
```

### Tracking (chamado pelo frontend principal)

```
POST   /api/sessions/start           # Iniciar sessao
PATCH  /api/sessions/:id/heartbeat   # Heartbeat (60s)
PATCH  /api/sessions/:id/end         # Encerrar sessao
POST   /api/sessions/:id/pageview    # Registrar page view
```

---

## 14. Bugs a Corrigir

1. **`_count` name mismatch**: Backend retorna `serviceOrders`/`servicesProvided`, frontend espera `clientOrders`/`professionalOrders`
2. **`VerificationSubmission` tipo duplicado**: Definido diferente em `types/entities.ts` e `adminService.ts`
3. **Graficos fake**: SparklineChart usa arrays hardcoded — substituir por series temporais reais

---

## 15. Decisoes Tomadas

- **SPA separada** (nao modulo integrado) para isolamento total
- **Dados 100% reais** (sem mocks, inclui sistema de tracking)
- **Login admin dedicado** em rota propria
- **Sidebar colapsavel** como navegacao principal
- **Verificacao hibrida**: Upload visual + validacao automatica CPF/CNPJ
- **Inbox como placeholder** — estrutura pronta para integracao futura
- **Empresas**: Tab presente mas com estado vazio ate modelo Company existir
