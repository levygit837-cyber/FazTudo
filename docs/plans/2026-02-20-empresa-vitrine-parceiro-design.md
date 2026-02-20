# Design — Módulo Empresarial: Vitrine + Programa de Parceiro
**Data:** 2026-02-20
**Status:** Aprovado
**Fase:** 1 (Vitrine + Credibilidade + Ferramentas Exclusivas)
**Fase futura:** 2 (Gestão Operacional Completa — chat de equipe, gestão de pedidos por membro)

---

## Contexto

O módulo empresarial do FazTudo já possui uma base sólida (CompanyProfile, CompanyMember, CompanyRole, permissões granulares, salários, canais, analytics, storefront básico). O problema identificado é **falta de credibilidade** — empresas não se sentem representadas como negócios sérios na plataforma.

**Objetivo da Fase 1:** Transformar a conta empresarial em algo que uma empresa real queira usar, com vitrine personalizável e ferramentas de gestão exclusivas que não existem para profissionais individuais.

**Modelo de receita:** Comissão diferenciada (sem assinatura). Taxas serão definidas internamente com base em métricas reais das empresas — o sistema de tiers existe como badge de progressão/credibilidade, sem taxa atrelada por enquanto.

---

## Abordagem Escolhida

**A + C** (Vitrine + Credibilidade + Programa de Parceiro com onboarding guiado)

---

## SEÇÃO 1 — Vitrine Empresarial Personalizável

### Conceito

A vitrine é uma página editorial personalizável — a empresa monta como quer ser apresentada. Seções nomeadas livremente, blocos opcionais reordenáveis, toggle público/privado.

### Estrutura Visual (para o visitante)

```
┌──────────────────────────────────────────────┐
│  [HERO] Banner com foto + headline + CTA      │
├──────────────────────────────────────────────┤
│  [ABOUT] Sobre nós — história + diferenciais  │
├──────────────────────────────────────────────┤
│  [SEÇÃO] Limpeza Residencial                  │
│  ┌─────┐ ┌─────┐ ┌─────┐                     │
│  │serv │ │serv │ │serv │  ...                 │
│  └─────┘ └─────┘ └─────┘                     │
├──────────────────────────────────────────────┤
│  [SEÇÃO] Reformas e Acabamento                │
│  ┌─────┐ ┌─────┐                             │
│  │serv │ │serv │                             │
│  └─────┘ └─────┘                             │
├──────────────────────────────────────────────┤
│  [TESTIMONIALS] O que dizem sobre nós         │
│  "Excelente trabalho!" — João S. ⭐⭐⭐⭐⭐      │
│  "Super profissionais!" — Maria L. ⭐⭐⭐⭐⭐    │
├──────────────────────────────────────────────┤
│  Métricas: ✅ 847 pedidos | ⭐ 4.9 | 👥 12    │
└──────────────────────────────────────────────┘
```

### Novos Modelos de Banco

```prisma
model CompanyStorefrontSection {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  title       String           // nome livre (ex: "Limpeza Residencial")
  description String?          // subtítulo opcional
  order       Int              // posição na vitrine
  isActive    Boolean  @default(true)
  items       CompanyStorefrontItem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CompanyStorefrontItem {
  id          Int      @id @default(autoincrement())
  sectionId   Int
  section     CompanyStorefrontSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  listingId   Int
  listing     ServiceListing @relation(fields: [listingId], references: [id], onDelete: Cascade)
  order       Int              // posição dentro da seção
  isFeatured  Boolean  @default(false)  // destaque visual
  createdAt   DateTime @default(now())
}

model CompanyStorefrontBlock {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  type        StorefrontBlockType
  order       Int              // posição global (intercalado com seções)
  isActive    Boolean  @default(true)
  content     Json             // varia por tipo (ver abaixo)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model CompanyPinnedTestimonial {
  id          Int      @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id], onDelete: Cascade)
  reviewId    Int
  review      Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  order       Int
  createdAt   DateTime @default(now())
}

enum StorefrontBlockType {
  HERO
  ABOUT
  TESTIMONIALS
}
```

**Content JSON por tipo de bloco:**
- `HERO`: `{ headline, subtext, ctaLabel, backgroundImage }`
- `ABOUT`: `{ title, body, image }`
- `TESTIMONIALS`: gerenciado via `CompanyPinnedTestimonial` (referências a Reviews reais já recebidas)

**Alterações em `CompanyProfile`:**
```prisma
storefrontPublic  Boolean  @default(true)   // toggle público/privado
```

### Painel de Edição (`/company/storefront`) — nova página

**Aba "Seções de Serviços":**
- Criar / renomear / reordenar seções (botões ↑↓ ou drag-and-drop)
- Dentro de cada seção: adicionar serviços do catálogo da empresa, reordenar, marcar destaque
- Toggle ativo/inativo por seção

**Aba "Blocos":**
- Lista de blocos disponíveis: Hero, Sobre Nós, Depoimentos
- Ativar/desativar e reordenar
- Editor inline para Hero (headline, texto, imagem de fundo) e Sobre Nós (título, corpo, imagem)
- Para Depoimentos: grid com **todas as avaliações recebidas** (privadas por padrão), empresa clica para fixar/desfixar na vitrine — máximo 6 fixados

**Toggle global no topo:** `Vitrine pública ↔ Apenas usuários logados`

### Rota Pública

`/empresa/:companyId` — renderiza blocos e seções em ordem, respeitando `storefrontPublic`.
- Se privado + visitante sem login: preview com blur + "Entre para ver os serviços"
- Serviços linkam para `/servicos/:id`
- Métricas automáticas no rodapé: pedidos completados, avaliação média, tamanho da equipe

### Novos Endpoints Backend

```
GET    /api/company/storefront              → dados completos para o editor
PUT    /api/company/storefront/visibility   → toggle público/privado

GET    /api/company/storefront/sections         → listar seções
POST   /api/company/storefront/sections         → criar seção
PUT    /api/company/storefront/sections/:id     → editar seção
DELETE /api/company/storefront/sections/:id     → deletar seção
PUT    /api/company/storefront/sections/reorder → reordenar (array de ids)

POST   /api/company/storefront/sections/:id/items         → adicionar serviço à seção
DELETE /api/company/storefront/sections/:id/items/:itemId → remover
PUT    /api/company/storefront/sections/:id/items/reorder → reordenar

GET    /api/company/storefront/blocks        → listar blocos
PUT    /api/company/storefront/blocks/:type  → salvar conteúdo do bloco
PUT    /api/company/storefront/blocks/reorder→ reordenar

GET    /api/company/storefront/testimonials        → avaliações disponíveis para fixar
POST   /api/company/storefront/testimonials        → fixar avaliação
DELETE /api/company/storefront/testimonials/:id    → desafixar

GET    /api/public/company/:companyId/storefront   → vitrine pública (sem auth)
```

---

## SEÇÃO 2 — Programa de Parceiro Empresarial

### Tiers (badge de progressão, sem taxa atrelada por enquanto)

| Tier | Requisito | Badge | Benefício de visibilidade |
|---|---|---|---|
| **Empresa** | CNPJ verificado | 🏢 Verificada | Aparece nos resultados |
| **Parceiro** | 50 pedidos completados | 🤝 Parceiro | Destaque médio na busca |
| **Parceiro Elite** | 200 pedidos + avaliação ≥ 4.5 | ⭐ Elite | Seção "Parceiros em Destaque" na home |

> Taxas diferenciadas serão definidas internamente com base em métricas reais. O campo `tier` existe no banco para quando essa decisão for tomada.

Progressão calculada automaticamente — sem ação manual do admin. Ao subir de tier: notificação + badge atualizado na vitrine.

**Alterações em `CompanyProfile`:**
```prisma
tier              CompanyTier  @default(EMPRESA)
tierUpdatedAt     DateTime?
completedOrders   Int          @default(0)   // contador cacheado
onboardingStep    Int          @default(0)   // 0-6, tracking do wizard

enum CompanyTier {
  EMPRESA
  PARCEIRO
  ELITE
}
```

### Onboarding Guiado (wizard)

Exibido no dashboard da empresa até `onboardingStep === 6`. Cada etapa concluída desbloqueia visualmente uma ferramenta:

```
Configuração da sua empresa    ████████░░ 80%

✅ CNPJ verificado              → Conta empresarial ativa
✅ Logo e cover image           → Vitrine habilitada
✅ Primeiro serviço publicado   → Aparece nos resultados de busca
✅ Primeiro membro convidado    → Módulo de equipe ativado
⬜ Primeira seção da vitrine    → Badge "Vitrine Completa"
⬜ Regra de salário criada      → Módulo financeiro ativado
```

Antes de completar, ferramentas bloqueadas aparecem como cards com cadeado + descrição do benefício. Ao completar todos os 6 passos: badge especial "Perfil Completo" na vitrine.

### Visibilidade nos Resultados de Busca

- Badge de tier visível nos cards de serviço na busca
- Filtro "Apenas empresas verificadas" na tela de busca
- Ordenação favorece: `(avaliação × peso_tier) + completude_vitrine`
- Empresas Elite aparecem em seção "Parceiros em Destaque" na landing page

---

## SEÇÃO 3 — Ferramentas Exclusivas de Conta Empresarial

Estas funcionalidades são **invisíveis para profissionais individuais** — só existem para `role === COMPANY`.

### 👥 Gestão de Membros (melhorias sobre o existente)

**Já existe:** listar, convidar por e-mail, atribuir role, desativar.

**Novo:**
- **Convite por link** — gera token único com expiração 48h (`CompanyInviteToken`), compartilhável via WhatsApp/e-mail sem o membro precisar estar cadastrado previamente
- **Status em tempo real:** ocupado (tem pedido ativo) / disponível / inativo
- **Métricas por membro** já existem no backend (`GET /api/company/members/:id/metrics`) — expor melhor na UI com cards visuais

```prisma
model CompanyInviteToken {
  id            Int      @id @default(autoincrement())
  companyId     Int
  company       CompanyProfile @relation(fields: [companyId], references: [id])
  roleId        Int
  role          CompanyRole @relation(fields: [roleId], references: [id])
  token         String   @unique @default(uuid())
  expiresAt     DateTime
  usedAt        DateTime?
  usedByUserId  Int?
  usedBy        User?    @relation(fields: [usedByUserId], references: [id])
  createdAt     DateTime @default(now())
}
```

Novos endpoints:
```
POST   /api/company/members/invite-link          → gera token
GET    /api/company/members/join/:token          → valida token (público)
POST   /api/company/members/join/:token/accept   → aceita convite (requer auth)
```

### 💰 Gestão de Salários (melhorias sobre o existente)

**Já existe:** regras de salário, histórico, transferência manual. O schema está completo.

**Novo:**
- **Cron job real** — job que executa diariamente verificando `CompanySalaryRule.dayOfMonth === hoje`, processa pagamentos automáticos (débita `company.user.balance`, credita `member.user.balance`, gera `CompanySalaryPayment`)
- **Relatório mensal exportável** (CSV) com: membro, regra, valor pago, data
- **Notificação ao membro** quando salário é depositado

### 📊 Analytics de Negócio (melhorias sobre o existente)

**Já existe:** receita 6 meses, performance de membros, top serviços.

**Novo KPIs a adicionar:**
- Ticket médio por serviço e por categoria
- Taxa de conversão: pedidos recebidos → aceitos → completados (funil)
- Ocupação da equipe: % membros com pedido ativo hoje
- NPS calculado das últimas 30 avaliações (% positivas - % negativas)
- Tempo médio de conclusão por categoria de serviço

Novos endpoints:
```
GET /api/company/analytics/conversion   → funil de conversão
GET /api/company/analytics/team-occupancy → ocupação atual
GET /api/company/analytics/nps          → NPS calculado
```

### 💬 Canais de Comunicação Interna

**Já existe:** CRUD de canais, gerenciamento de membros por canal.

**Fase 2 (operacional):** chat real dentro dos canais. Por ora, canais servem como grupos de organização para atribuição de pedidos futura.

### 🏪 Vitrine Personalizável

Ver Seção 1 deste documento.

---

## O que NÃO está no escopo desta fase

- Gestão de pedidos por membro (atribuição, visão unificada) → Fase 2
- Chat real nos canais → Fase 2
- Taxas diferenciadas por tier → decisão interna futura baseada em métricas
- API pública para ERP → Fase 3

---

## Arquivos a Criar/Alterar

### Backend
| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar: `CompanyStorefrontSection`, `CompanyStorefrontItem`, `CompanyStorefrontBlock`, `CompanyPinnedTestimonial`, `CompanyInviteToken`, `StorefrontBlockType`, `CompanyTier`. Alterar: `CompanyProfile` (+ `storefrontPublic`, `tier`, `tierUpdatedAt`, `completedOrders`, `onboardingStep`) |
| `src/routes/companyStorefrontRoutes.ts` | Novo arquivo — rotas da vitrine |
| `src/controllers/service/companyStorefrontController.ts` | Novo controller |
| `src/routes/companyInviteRoutes.ts` | Novo arquivo — rotas de convite por link |
| `src/controllers/service/companyInviteController.ts` | Novo controller |
| `src/routes/companyAnalyticsRoutes.ts` | Alterar — adicionar conversion, occupancy, nps |
| `src/controllers/service/companyAnalyticsController.ts` | Alterar — novos endpoints |
| `src/services/companyCronService.ts` | Novo — cron de salário automático |
| `src/index.ts` | Registrar novos routers |

### Frontend
| Arquivo | Ação |
|---|---|
| `src/pages/company/Storefront.tsx` | Nova página — editor da vitrine |
| `src/pages/CompanyPublicStorefront.tsx` | Substituir `/empresa/:id` existente |
| `src/components/company/StorefrontSectionEditor.tsx` | Novo componente |
| `src/components/company/StorefrontBlockEditor.tsx` | Novo componente |
| `src/components/company/TestimonialPicker.tsx` | Novo componente |
| `src/components/company/OnboardingWizard.tsx` | Novo componente |
| `src/components/company/TierBadge.tsx` | Novo componente |
| `src/pages/company/Dashboard.tsx` | Alterar — integrar OnboardingWizard |
| `src/pages/company/Members.tsx` | Alterar — adicionar invite por link |
| `src/pages/company/Analytics.tsx` | Alterar — novos KPIs |
| `src/pages/company/Salary.tsx` | Alterar — exportação CSV |
| `src/services/companyStorefrontService.ts` | Novo service Axios |
| `src/types/company.ts` | Adicionar novos tipos |
| `src/App.tsx` | Adicionar rota `/company/storefront` |
