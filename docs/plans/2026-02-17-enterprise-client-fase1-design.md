# Design: Cliente Empresarial — Fase 1: Fundação

> **Data**: 2026-02-17
> **Projeto**: FazTudo Marketplace
> **Escopo**: Fase 1 de 3 — Fundação do módulo empresarial
> **Status**: Aprovado ✅

---

## Contexto e Decisões de Design

### O que é o cliente empresarial?

Empresas entram na plataforma como **prestadoras de serviços** (não contratantes). O modelo é análogo ao iFood: assim como restaurantes têm cardápios, empresas terão uma **Vitrine** com catálogo de serviços organizado sob uma marca corporativa.

### Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Papel da empresa | Prestadora de serviços (não contratante) |
| Estrutura interna | Multi-membros gerenciáveis com cargos e permissões |
| Vitrine | Opção C — empresas têm vitrine completa, profissionais avulsos ganham vitrine básica |
| Permissões | Granulares por cargo + override individual, regra binária (vê ou não vê) |
| Wallet | Corporativa para a empresa + wallets individuais por membro (gestão salarial) |
| Chat de pedido | Grupo automático (cliente + equipe designada) com arquivamento pós-conclusão |
| Líder de equipe | Obrigatório, designado manualmente por quem atribui o pedido |

---

## Modelo de Dados

### Alterações no schema existente

```prisma
enum UserRole {
  CLIENT
  PROFESSIONAL
  COMPANY        // NOVO
  ADMIN
}
```

### Novos modelos

```prisma
model CompanyProfile {
  id           Int       @id @default(autoincrement())
  userId       Int       @unique
  user         User      @relation(fields: [userId], references: [id])
  companyName  String
  cnpj         String    @unique
  description  String?
  logo         String?
  coverImage   String?
  website      String?
  phone        String?
  address      Json?
  isVerified   Boolean   @default(false)
  industry     String?
  foundedAt    DateTime?
  createdAt    DateTime  @default(now())

  members      CompanyMember[]
  roles        CompanyRole[]
}

model CompanyRole {
  id          Int       @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id])
  name        String
  level       Int       // 1=admin, 2=supervisor, 3=operacional (quanto menor, mais poder)
  permissions Json      // ver Seção de Permissões
  color       String?
  createdAt   DateTime  @default(now())

  members          CompanyMember[]
  salaryRules      CompanySalaryRule[]
}

model CompanyMember {
  id                Int       @id @default(autoincrement())
  companyId         Int
  company           CompanyProfile @relation(fields: [companyId], references: [id])
  userId            Int
  user              User      @relation(fields: [userId], references: [id])
  roleId            Int
  role              CompanyRole @relation(fields: [roleId], references: [id])
  customPermissions Json?     // sobrescreve permissões do cargo individualmente
  joinedAt          DateTime  @default(now())
  isActive          Boolean   @default(true)

  salaryHistory     CompanySalaryPayment[]
  teamMemberships   ServiceTeamMember[]
  ledTeams          ServiceTeam[]         @relation("TeamLeader")
}

model CompanySalaryRule {
  id           Int       @id @default(autoincrement())
  companyId    Int
  roleId       Int?      // null = regra individual
  role         CompanyRole? @relation(fields: [roleId], references: [id])
  memberId     Int?      // null = regra por cargo
  amount       Float
  dayOfMonth   Int       // 1-28
  description  String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())

  payments     CompanySalaryPayment[]
}

model CompanySalaryPayment {
  id        Int       @id @default(autoincrement())
  ruleId    Int
  rule      CompanySalaryRule @relation(fields: [ruleId], references: [id])
  memberId  Int
  member    CompanyMember @relation(fields: [memberId], references: [id])
  amount    Float
  paidAt    DateTime
  status    SalaryStatus
  note      String?
}

enum SalaryStatus {
  PENDING
  PAID
  FAILED
}

model ServiceTeam {
  id        Int       @id @default(autoincrement())
  orderId   Int       @unique
  order     ServiceOrder @relation(fields: [orderId], references: [id])
  leaderId  Int
  leader    CompanyMember @relation("TeamLeader", fields: [leaderId], references: [id])
  createdAt DateTime  @default(now())

  members   ServiceTeamMember[]
}

model ServiceTeamMember {
  id       Int       @id @default(autoincrement())
  teamId   Int
  team     ServiceTeam @relation(fields: [teamId], references: [id])
  memberId Int
  member   CompanyMember @relation(fields: [memberId], references: [id])
}
```

### Alterações em modelos existentes

```prisma
// Adicionar ao modelo de Message/Chat existente:
isGroup    Boolean  @default(false)
isArchived Boolean  @default(false)
teamId     Int?     // FK → ServiceTeam (se for chat de equipe de serviço)
```

---

## Sistema de Permissões

### Estrutura do JSON de permissões

```json
{
  "metrics": {
    "view": false,
    "viewTeam": false
  },
  "chat": {
    "view": false,
    "respond": false,
    "manage": false
  },
  "orders": {
    "view": false,
    "assign": false,
    "manage": false
  },
  "finance": {
    "view": false,
    "transfer": false,
    "salary": false
  },
  "team": {
    "view": false,
    "invite": false,
    "manage": false
  },
  "catalog": {
    "edit": false
  },
  "company": {
    "settings": false,
    "roles": false
  }
}
```

### Tabela de permissões

| Área | Permissão | O que controla | Sem permissão |
|---|---|---|---|
| 📊 Métricas | `metrics.view` | Dashboard de faturamento e desempenho geral | ❌ Escondido |
| 📊 Métricas | `metrics.viewTeam` | Métricas individuais de outros membros | ❌ Escondido |
| 💬 Canais | `chat.view` | Ver canais de atendimento | ❌ Escondido |
| 💬 Canais | `chat.respond` | Responder clientes nos canais | ❌ Escondido |
| 💬 Canais | `chat.manage` | Criar/editar/arquivar canais | ❌ Escondido |
| 📦 Pedidos | `orders.view` | Ver lista de pedidos da empresa | ❌ Escondido |
| 📦 Pedidos | `orders.assign` | Designar pedido para membro/equipe | ❌ Escondido |
| 📦 Pedidos | `orders.manage` | Aceitar, cancelar pedidos | ❌ Escondido |
| 💰 Financeiro | `finance.view` | Ver saldo da wallet corporativa | ❌ Escondido |
| 💰 Financeiro | `finance.transfer` | Aprovar transferências para membros | ❌ Escondido |
| 💰 Financeiro | `finance.salary` | Gerenciar regras salariais | ❌ Escondido |
| 👥 Equipe | `team.view` | Ver lista de membros | ❌ Escondido |
| 👥 Equipe | `team.invite` | Convidar novos membros | ❌ Escondido |
| 👥 Equipe | `team.manage` | Editar cargos, remover membros | ❌ Escondido |
| 🛍️ Catálogo | `catalog.edit` | Criar/editar/remover serviços da vitrine | ❌ Escondido |
| ⚙️ Empresa | `company.settings` | Editar perfil, logo, dados da empresa | ❌ Escondido |
| ⚙️ Empresa | `company.roles` | Criar/editar cargos e suas permissões | ❌ Escondido |

**Sempre visível (sem permissão necessária):**
- Catálogo/vitrine pública da empresa
- Perfil público da empresa
- Pedidos/chats aos quais o membro foi designado

### Regra de resolução de permissões

`customPermissions` do membro **sempre sobrescreve** `permissions` do cargo.

```
permissão final = customPermissions[key] ?? rolePermissions[key] ?? false
```

### Exceção: Acesso por designação

Um membro **sem** `orders.view` ou `chat.view` ainda pode ver:
- O pedido específico ao qual foi designado como membro de equipe
- O chat em grupo do serviço ao qual pertence sua equipe

---

## Fluxo de Pedido com Equipe

```
1. Pedido chega na empresa (cliente fez o pedido)
2. Membro com orders.assign visualiza o pedido
3. Designa o pedido → cria ServiceTeam:
   - Seleciona membros da equipe
   - Obrigatório designar um líder
   - Bloqueio: não pode confirmar sem líder definido
4. Sistema cria Chat em Grupo automaticamente:
   - Participantes: cliente + todos os membros da equipe
   - Nome automático: "[Nome do Serviço] — [Nome da Empresa]"
5. Serviço é executado, comunicação via chat em grupo
6. Líder da equipe marca o serviço como concluído
7. Cliente confirma a conclusão
8. Chat arquivado automaticamente:
   - Removido da lista de chats ativos
   - Histórico preservado em "Chats Arquivados"
   - Acessível via busca ou seção de histórico
```

---

## Fluxo de Registro de Empresa

```
1. Usuário seleciona "Empresa" no formulário de registro
2. Campos adicionais: nome da empresa, CNPJ (validado), email, senha
3. Conta criada: role=COMPANY + CompanyProfile criado automaticamente
4. Redirect para /company/dashboard
5. Badge "Verificação Pendente" — pode usar a plataforma mas aparece como não-verificada
6. Admin aprova via painel → isVerified=true
7. Badge "🏢 Empresa Verificada" + destaque no catálogo
```

---

## Arquitetura Backend

### Novos arquivos

```
backend/src/
  controllers/
    companyController.ts          // perfil, vitrine, configurações da empresa
    companyMemberController.ts    // CRUD membros, cargos
    companySalaryController.ts    // regras salariais, pagamentos, histórico
    companyTeamController.ts      // criação de equipes por pedido
  routes/
    companyRoutes.ts              // /api/company/*
    companyMemberRoutes.ts        // /api/company/members/*
    companySalaryRoutes.ts        // /api/company/salary/*
    companyTeamRoutes.ts          // /api/company/teams/*
  middleware/
    companyPermission.ts          // valida permissões granulares por área
```

### Registro em `index.ts`

```
/api/company          → companyRoutes
/api/company/members  → companyMemberRoutes
/api/company/salary   → companySalaryRoutes
/api/company/teams    → companyTeamRoutes
```

---

## Arquitetura Frontend

### Novas páginas

```
frontend/src/pages/company/
  Dashboard.tsx           // visão geral: pedidos, faturamento, equipe
  Profile.tsx             // editar perfil/vitrine da empresa
  Members.tsx             // lista de membros + cargos
  MemberDetail.tsx        // métricas individuais do membro
  Roles.tsx               // criar/editar cargos + permissões (toggles)
  Salary.tsx              // regras salariais + histórico de pagamentos
  Orders.tsx              // pedidos da empresa + designação de equipes

frontend/src/pages/
  CompanyStorefront.tsx   // vitrine pública (acessível por qualquer visitante)
```

### Novos componentes

```
frontend/src/components/company/
  PermissionToggle.tsx    // toggle com label + breve descrição da permissão
  PermissionGroup.tsx     // grupo de permissões de uma área (métricas, chat, etc.)
  MemberCard.tsx          // card de membro com cargo, badge e métricas resumidas
  SalaryRuleCard.tsx      // card de regra salarial com membros afetados
  CompanyBadge.tsx        // badge "Empresa Verificada" / "Verificação Pendente"
  TeamBuilder.tsx         // seletor de membros + líder para designação de pedido
```

### Alterações em arquivos existentes

| Arquivo | Alteração |
|---|---|
| `types/enums.ts` | Adicionar `COMPANY = "COMPANY"` ao enum `UserRole` |
| `context/AuthContext.tsx` | Adicionar `isCompany` helper + redirect `/company/dashboard` no login/registro |
| `App.tsx` | Adicionar bloco de rotas `/company/*` com `<ProtectedRoute allowedRoles={[UserRole.COMPANY]}>` |
| `pages/Register.tsx` | Adicionar opção "Empresa" no seletor de papel + campos adicionais (CNPJ, nome empresa) |

---

## Vitrine — Diferencial por Tipo

| Recurso | Profissional avulso | Empresa |
|---|---|---|
| Página de perfil/vitrine | ✅ Básica (Fase 3) | ✅ Completa |
| Catálogo de serviços | ✅ Listagem atual | ✅ Com categorias internas |
| Canais de atendimento | ❌ | ✅ (Fase 2) |
| Membros e cargos | ❌ | ✅ |
| Gestão salarial | ❌ | ✅ |
| Métricas de equipe | ❌ | ✅ |
| Badge verificado | ⭐ Profissional verificado | 🏢 Empresa verificada |
| CNPJ | ❌ | ✅ |
| Chat em grupo por serviço | ❌ | ✅ |

---

## Fases Seguintes (fora do escopo desta fase)

- **Fase 2 — Canais de Atendimento**: canais por tipo de serviço, designação de membros a canais, roteamento de leads
- **Fase 3 — Vitrine Profissional Avulso + Métricas Avançadas**: vitrine básica para profissionais, BI avançado para empresas

---

## Arquivos Críticos Tocados

| Arquivo | Risco |
|---|---|
| `prisma/schema.prisma` | 🔴 Alto — migration necessária |
| `frontend/src/App.tsx` | 🔴 Alto — novas rotas |
| `frontend/src/context/AuthContext.tsx` | 🟡 Médio — novo role + redirect |
| `frontend/src/types/enums.ts` | 🟡 Médio — novo valor no enum |
| `backend/src/index.ts` | 🟡 Médio — novos routers |
| `frontend/src/pages/Register.tsx` | 🟡 Médio — novo campo de role |
