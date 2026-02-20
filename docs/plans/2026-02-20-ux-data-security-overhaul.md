# FazTudo — UX/Data/Security Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevar o FazTudo a um nível de produção real: onboarding intuitivo para clientes e profissionais, estrutura de dados escalável para múltiplas cidades/dispositivos, e hardening completo de segurança.

**Architecture:** Três trilhas paralelas (UX, Dados, Segurança) organizadas em fases sequenciais dentro de cada trilha. Cada tarefa é independente e pode ser desenvolvida em branch separada.

**Tech Stack:** Express 5 + React 19 + TypeScript 5.9 + Prisma 7.4 + SQLite→PostgreSQL-ready + TailwindCSS v4 + Zod v4 + Pino

---

# TRILHA A — UX/Acessibilidade

## Análise de UX: Estado Atual vs. Ideal

### Como um Cliente Novo Enxerga a Plataforma Hoje
- Landing page existe com seções de como funciona, mas o fluxo pós-registro não tem onboarding guiado
- Após registrar, o cliente cai direto no dashboard sem orientação
- "Novo Pedido" está escondido no menu lateral — não é o primeiro CTA óbvio
- Não há "primeiro serviço" highlights ou sugestões personalizadas

### Como um Profissional Novo Enxerga a Plataforma Hoje
- Landing profissional existe com boas métricas, mas o fluxo pós-registro não guia a criar o primeiro listing
- O dashboard profissional aparece vazio sem orientação clara
- "Criar Serviço" não é destacado como próximo passo óbvio
- Sem checklist de perfil (foto, verificação, categorias)

---

## Task A1: Onboarding Flow para Clientes (Frontend)

**Objetivo:** Guiar o cliente recém-cadastrado em 3 passos: explorar → selecionar → pedir

**Files:**
- Create: `frontend/src/components/onboarding/ClientOnboarding.tsx`
- Create: `frontend/src/components/onboarding/OnboardingStep.tsx`
- Create: `frontend/src/components/onboarding/index.ts`
- Modify: `frontend/src/pages/client/Dashboard.tsx`
- Modify: `frontend/src/types/components.ts` (adicionar `OnboardingProps`)

**Step 1: Criar o componente OnboardingStep**

```tsx
// frontend/src/components/onboarding/OnboardingStep.tsx
import { ReactNode } from "react";
import { CheckCircle } from "lucide-react";

interface OnboardingStepProps {
  step: number;
  total: number;
  title: string;
  description: string;
  icon: ReactNode;
  action: ReactNode;
  isCompleted?: boolean;
}

export function OnboardingStep({
  step, total, title, description, icon, action, isCompleted
}: OnboardingStepProps) {
  return (
    <div className={`relative rounded-2xl border p-6 transition-all ${
      isCompleted
        ? "border-green-500/30 bg-green-500/5"
        : "border-primary-500/30 bg-primary-500/5"
    }`}>
      {isCompleted && (
        <CheckCircle className="absolute top-4 right-4 h-5 w-5 text-green-500" />
      )}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600/20 text-primary-400">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-500 mb-1">
            Passo {step} de {total}
          </p>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{description}</p>
          {!isCompleted && action}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Criar o ClientOnboarding principal**

```tsx
// frontend/src/components/onboarding/ClientOnboarding.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Search, ShoppingBag, Star, X } from "lucide-react";
import { OnboardingStep } from "./OnboardingStep";
import { useAuth } from "../../context/AuthContext";

const ONBOARDING_KEY = "faztudo_client_onboarding_dismissed";

interface ClientOnboardingProps {
  hasOrders: boolean;
  hasFavorites: boolean;
  hasCompletedOrder: boolean;
}

export function ClientOnboarding({ hasOrders, hasFavorites, hasCompletedOrder }: ClientOnboardingProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ONBOARDING_KEY);
    if (stored) setDismissed(true);
  }, []);

  const allDone = hasOrders && hasCompletedOrder;
  if (dismissed || allDone) return null;

  const completedCount = [hasOrders, hasCompletedOrder].filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/5 to-transparent p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-lg">
            Bem-vindo ao FazTudo, {user?.name?.split(" ")[0]}! 👋
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Complete esses passos para aproveitar ao máximo a plataforma ({completedCount}/2)
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(ONBOARDING_KEY, "true");
            setDismissed(true);
          }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Fechar onboarding"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OnboardingStep
          step={1} total={2}
          title="Encontre um serviço"
          description="Pesquise por categoria ou descreva o que você precisa"
          icon={<Search className="h-5 w-5" />}
          isCompleted={hasOrders}
          action={
            <Link to="/services" className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors no-underline">
              <Search className="h-4 w-4" /> Explorar serviços
            </Link>
          }
        />
        <OnboardingStep
          step={2} total={2}
          title="Contrate e avalie"
          description="Faça seu primeiro pedido e avalie o profissional ao final"
          icon={<Star className="h-5 w-5" />}
          isCompleted={hasCompletedOrder}
          action={
            <Link to="/client/orders/new" className="inline-flex items-center gap-2 rounded-lg border border-primary-500/40 px-4 py-2 text-sm font-medium text-primary-400 hover:bg-primary-500/10 transition-colors no-underline">
              <ShoppingBag className="h-4 w-4" /> Novo pedido
            </Link>
          }
        />
      </div>
    </div>
  );
}
```

**Step 3: Integrar no Dashboard do cliente**

Modificar `frontend/src/pages/client/Dashboard.tsx` para importar e renderizar `<ClientOnboarding>` no topo da página, passando props derivadas dos dados já carregados (contagem de pedidos e pedidos completados).

**Step 4: Commit**

```bash
git add frontend/src/components/onboarding/
git add frontend/src/pages/client/Dashboard.tsx
git commit -m "feat: add client onboarding flow with step-by-step guidance"
```

---

## Task A2: Onboarding Flow para Profissionais (Frontend)

**Objetivo:** Guiar o profissional novo em 4 passos: completar perfil → criar listing → configurar agenda → receber primeiro pedido

**Files:**
- Create: `frontend/src/components/onboarding/ProfessionalOnboarding.tsx`
- Modify: `frontend/src/pages/professional/Dashboard.tsx`

**Step 1: Criar ProfessionalOnboarding**

```tsx
// frontend/src/components/onboarding/ProfessionalOnboarding.tsx
import { Link } from "react-router";
import { User, Briefcase, Calendar, ShieldCheck, X } from "lucide-react";
import { OnboardingStep } from "./OnboardingStep";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect } from "react";

const KEY = "faztudo_pro_onboarding_dismissed";

interface ProfessionalOnboardingProps {
  hasProfilePhoto: boolean;
  hasListings: boolean;
  hasSchedule: boolean;
  isVerified: boolean;
}

export function ProfessionalOnboarding({
  hasProfilePhoto, hasListings, hasSchedule, isVerified
}: ProfessionalOnboardingProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) setDismissed(true);
  }, []);

  const steps = [hasProfilePhoto, hasListings, hasSchedule, isVerified];
  const completedCount = steps.filter(Boolean).length;
  const allDone = completedCount === 4;

  if (dismissed || allDone) return null;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-lg">
            Configure seu perfil profissional, {user?.name?.split(" ")[0]}! 🚀
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Perfis completos recebem até 3x mais pedidos ({completedCount}/4 passos)
          </p>
        </div>
        <button onClick={() => { localStorage.setItem(KEY, "true"); setDismissed(true); }}
          className="text-slate-400 hover:text-slate-600" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OnboardingStep step={1} total={4} title="Foto de perfil"
          description="Perfis com foto recebem 70% mais cliques"
          icon={<User className="h-5 w-5" />} isCompleted={hasProfilePhoto}
          action={<Link to="/profile" className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 no-underline">Completar perfil</Link>}
        />
        <OnboardingStep step={2} total={4} title="Criar primeiro serviço"
          description="Descreva o que você oferece com preços e fotos"
          icon={<Briefcase className="h-5 w-5" />} isCompleted={hasListings}
          action={<Link to="/professional/catalog/new" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 no-underline">Criar serviço</Link>}
        />
        <OnboardingStep step={3} total={4} title="Configurar agenda"
          description="Defina seus horários disponíveis para clientes"
          icon={<Calendar className="h-5 w-5" />} isCompleted={hasSchedule}
          action={<Link to="/professional/agenda" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 no-underline">Configurar agenda</Link>}
        />
        <OnboardingStep step={4} total={4} title="Verificar identidade"
          description="Conta verificada gera mais confiança nos clientes"
          icon={<ShieldCheck className="h-5 w-5" />} isCompleted={isVerified}
          action={<Link to="/verify-account" className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 no-underline">Verificar conta</Link>}
        />
      </div>
    </div>
  );
}
```

**Step 2: Integrar no Dashboard do profissional**

Modificar `frontend/src/pages/professional/Dashboard.tsx` para importar `<ProfessionalOnboarding>` e passar props dos dados do dashboard.

**Step 3: Commit**

```bash
git add frontend/src/components/onboarding/
git add frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat: add professional onboarding flow with 4-step profile completion guide"
```

---

## Task A3: Melhorar Landing Page do Cliente — "Como Funciona" Interativo

**Objetivo:** Substituir o "Como Funciona" estático por um demo interativo com 3 tabs que mostram o fluxo real

**Files:**
- Create: `frontend/src/components/landing/HowItWorksInteractive.tsx`
- Modify: `frontend/src/pages/LandingPageUser.tsx`

**Step 1: Criar HowItWorksInteractive**

```tsx
// frontend/src/components/landing/HowItWorksInteractive.tsx
import { useState } from "react";
import { Search, CreditCard, Star, ArrowRight } from "lucide-react";

const STEPS = [
  {
    id: 1,
    icon: Search,
    title: "1. Encontre o serviço",
    short: "Busque",
    description: "Pesquise por categoria, cidade ou describe o que você precisa. Veja perfis, avaliações e portfólios de profissionais verificados.",
    visual: (
      <div className="rounded-xl bg-slate-900 p-4 text-sm font-mono">
        <div className="mb-3 flex gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <div className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary-400" />
          <span className="text-slate-400">Buscar "encanador São Paulo"...</span>
        </div>
        <div className="mt-3 space-y-2">
          {["João Silva ⭐ 4.9", "Maria Costa ⭐ 4.8", "Pedro Lima ⭐ 4.7"].map((p) => (
            <div key={p} className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-primary-600/30" />
              <span className="text-slate-300 text-xs">{p}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-primary-400" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 2,
    icon: CreditCard,
    title: "2. Pague com segurança",
    short: "Pague",
    description: "Pague por PIX, cartão ou boleto. O valor fica em escrow — só é liberado ao profissional após você confirmar o serviço concluído.",
    visual: (
      <div className="rounded-xl bg-slate-900 p-4">
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 mb-3">
          <p className="text-xs text-green-400 font-medium">🔒 Pagamento protegido</p>
          <p className="text-xs text-slate-400 mt-1">Seu dinheiro fica seguro até você confirmar a conclusão</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["PIX", "Cartão", "Boleto"].map((m) => (
            <div key={m} className="rounded-lg bg-slate-800 p-2 text-center">
              <p className="text-xs text-slate-300">{m}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 3,
    icon: Star,
    title: "3. Avalie e repita",
    short: "Avalie",
    description: "Confirme o serviço concluído, avalie o profissional e ajude outros clientes a escolherem bem. Cada avaliação melhora a comunidade.",
    visual: (
      <div className="rounded-xl bg-slate-900 p-4">
        <p className="text-xs text-slate-400 mb-3">Como foi o serviço?</p>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className="h-6 w-6 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 mb-3">
          "Ótimo profissional, chegou no horário..."
        </div>
        <button className="w-full rounded-lg bg-primary-600 py-2 text-xs font-medium text-white">
          Enviar avaliação
        </button>
      </div>
    ),
  },
];

export function HowItWorksInteractive() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tab selector */}
      <div className="flex gap-2 mb-8 justify-center">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
              active === i
                ? "bg-primary-600 text-white shadow-glow-blue"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <s.icon className="h-4 w-4" />
            {s.short}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid gap-8 md:grid-cols-2 items-center">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{step.title}</h3>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
          <div className="mt-6 flex gap-2">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all ${active === i ? "w-8 bg-primary-500" : "w-2 bg-slate-300 dark:bg-slate-700"}`}
              />
            ))}
          </div>
        </div>
        <div>{step.visual}</div>
      </div>
    </div>
  );
}
```

**Step 2: Substituir na LandingPageUser**

Localizar a seção "Como Funciona" em `LandingPageUser.tsx` e substituir pelo componente `<HowItWorksInteractive />`.

**Step 3: Commit**

```bash
git add frontend/src/components/landing/HowItWorksInteractive.tsx
git add frontend/src/pages/LandingPageUser.tsx
git commit -m "feat: replace static how-it-works with interactive 3-step demo"
```

---

## Task A4: Empty States Atrativos + CTAs Contextuais

**Objetivo:** Quando cliente/profissional não têm dados ainda, mostrar empty states que guiam à próxima ação

**Files:**
- Create: `frontend/src/components/common/EmptyStateGuided.tsx`
- Modify: `frontend/src/pages/client/ServiceOrders.tsx`
- Modify: `frontend/src/pages/professional/ServiceOrders.tsx`
- Modify: `frontend/src/pages/professional/CreateService.tsx` (hint no formulário)

**Step 1: Criar EmptyStateGuided**

```tsx
// frontend/src/components/common/EmptyStateGuided.tsx
import { ReactNode } from "react";
import { Link } from "react-router";

interface EmptyStateGuidedProps {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: { label: string; to: string };
  secondaryAction?: { label: string; to: string };
  tips?: string[];
}

export function EmptyStateGuided({
  icon, title, description, primaryAction, secondaryAction, tips
}: EmptyStateGuidedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mb-8 max-w-md text-slate-500 dark:text-slate-400">{description}</p>

      <div className="flex gap-3 flex-wrap justify-center mb-8">
        {primaryAction && (
          <Link to={primaryAction.to}
            className="inline-flex items-center rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-500 transition-colors no-underline shadow-glow-blue">
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction && (
          <Link to={secondaryAction.to}
            className="inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 px-6 py-3 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors no-underline">
            {secondaryAction.label}
          </Link>
        )}
      </div>

      {tips && tips.length > 0 && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 p-4 max-w-sm w-full text-left">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Dicas</p>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center font-bold">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Aplicar nos pedidos vazios**

Em `ServiceOrders.tsx` (client), quando a lista está vazia, usar `<EmptyStateGuided>` com icon `<ShoppingBag>`, "Nenhum pedido ainda", CTA "Explorar serviços" → `/services`, tips como "Use filtros por categoria para encontrar profissionais mais rapidamente".

**Step 3: Commit**

```bash
git add frontend/src/components/common/EmptyStateGuided.tsx
git add frontend/src/pages/client/ServiceOrders.tsx
git add frontend/src/pages/professional/ServiceOrders.tsx
git commit -m "feat: add guided empty states with CTAs and tips for new users"
```

---

## Task A5: Acessibilidade WCAG 2.1 AA — Auditoria e Correções

**Objetivo:** Corrigir falhas de acessibilidade nas páginas críticas (Landing, Login, ServiceSearch, OrderDetails)

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/services/ServiceSearch.tsx`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Modify: `frontend/src/components/common/ConfirmDialog.tsx`

**Step 1: Run type check first**

```bash
cd frontend && npx tsc --noEmit
```

**Step 2: Correções prioritárias de acessibilidade**

Nos formulários de login/registro:
- Cada `<input>` deve ter `<label>` com `htmlFor` explícito (não apenas placeholder)
- Mensagens de erro devem ter `role="alert"` e `aria-live="polite"`
- Botões de submit devem ter `aria-busy="true"` durante loading

No ConfirmDialog:
- Garantir `role="dialog"`, `aria-modal="true"`, `aria-labelledby` e `aria-describedby`
- Focus trap: ao abrir, mover foco para o primeiro elemento interativo; ao fechar, retornar ao trigger
- Fechar com Escape já funciona (verificar se está implementado)

No ServiceSearch:
- Os filtros de categoria devem ter `role="group"` com `aria-label="Filtros de categoria"`
- Cards de serviço devem ter `aria-label` descritivo (nome do serviço + profissional + preço)

**Step 3: Verificar contraste de cores**

As classes `text-slate-400` sobre `bg-slate-50` podem falhar WCAG AA (4.5:1 ratio).
Substituir textos secundários em cards por `text-slate-600 dark:text-slate-400`.

**Step 4: Commit**

```bash
git add frontend/src/pages/Login.tsx
git add frontend/src/components/common/ConfirmDialog.tsx
git commit -m "fix: improve WCAG 2.1 AA compliance - labels, aria roles, focus management"
```

---

---

# TRILHA B — Escalabilidade de Dados

## Análise: O Que Precisamos Para Escalar

### Dados que já temos (bom):
- UserSession + PageView (analytics de sessão)
- Transaction ledger completo
- Review com avaliações bidirecionais
- Timestamps em todos os eventos de pedido
- Notification history

### Dados que precisamos adicionar para escalar para múltiplas cidades e milhares de usuários:

| Modelo Novo | Por quê precisamos |
|-------------|-------------------|
| `SearchEvent` | Saber o que usuários buscam, quais termos convertem, onde abandonam |
| `ServiceImpression` | Funil: impressão → clique → pedido → conversão |
| `ProfessionalAvailabilitySnapshot` | Histórico de disponibilidade para análise de capacidade por cidade |
| `CityMetrics` | Métricas agregadas por cidade (supply vs demand) |
| `ABTestVariant` | Suporte a A/B testing futuro |
| `ServiceOrderEvent` | Log granular de cada mudança de estado de pedido (quem, quando, de→para) |
| `UserDevice` | Dados de dispositivo para UX multi-plataforma |
| `ServiceListingView` | Views por listing para analytics de popularidade |

---

## Task B1: Adicionar Modelos de Analytics ao Schema Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Verificar schema atual**

```bash
cd backend && npx prisma validate
```

**Step 2: Adicionar modelos ao schema.prisma**

No final de `backend/prisma/schema.prisma`, adicionar:

```prisma
// ─── ANALYTICS / ESCALABILIDADE ────────────────────────────────────────────

/// Evento de busca — rastreia termos de pesquisa e resultados
model SearchEvent {
  id          Int      @id @default(autoincrement())
  userId      Int?     // null = usuário anônimo
  query       String   // termo buscado
  category    String?  // categoria filtrada
  city        String?  // cidade filtrada
  resultsCount Int     @default(0)
  clickedId   Int?     // listing clicado após a busca
  convertedId Int?     // pedido criado após a busca
  sessionId   String?  // link com UserSession
  device      String?  // "mobile" | "tablet" | "desktop"
  createdAt   DateTime @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([createdAt])
  @@index([city, createdAt])
  @@index([query])
}

/// Impressão de listing — cada vez que um card é exibido em resultados
model ServiceListingView {
  id          Int      @id @default(autoincrement())
  listingId   Int
  userId      Int?
  sessionId   String?
  source      String?  // "search" | "recommendation" | "landing" | "direct"
  city        String?
  device      String?
  createdAt   DateTime @default(now())

  listing ServiceListing @relation(fields: [listingId], references: [id])
  user    User?          @relation(fields: [userId], references: [id])

  @@index([listingId, createdAt])
  @@index([city, createdAt])
}

/// Log granular de mudanças de estado de pedido (para auditoria e analytics de funil)
model ServiceOrderEvent {
  id           Int      @id @default(autoincrement())
  serviceOrderId Int
  fromStatus   String?  // null = criação
  toStatus     String
  triggeredBy  Int?     // userId que disparou a mudança
  reason       String?  // motivo de cancelamento, disputa, etc.
  metadata     Json?
  createdAt    DateTime @default(now())

  serviceOrder ServiceOrder @relation(fields: [serviceOrderId], references: [id])
  user         User?        @relation(fields: [triggeredBy], references: [id])

  @@index([serviceOrderId, createdAt])
  @@index([toStatus, createdAt])
}

/// Métricas agrupadas por cidade — para dashboard de expansão geográfica
model CityMetrics {
  id                  Int      @id @default(autoincrement())
  city                String
  state               String
  date                DateTime // granularidade dia
  totalSearches       Int      @default(0)
  totalOrders         Int      @default(0)
  totalCompletedOrders Int     @default(0)
  totalRevenue        Float    @default(0)
  activeProfessionals Int      @default(0)
  activeClients       Int      @default(0)
  avgOrderValue       Float    @default(0)
  topCategoryId       Int?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([city, state, date])
  @@index([date])
  @@index([city])
}

/// Dados de dispositivo do usuário (multi-plataforma analytics)
model UserDevice {
  id           Int      @id @default(autoincrement())
  userId       Int
  deviceType   String   // "mobile" | "tablet" | "desktop" | "unknown"
  platform     String?  // "android" | "ios" | "windows" | "macos"
  browser      String?
  appVersion   String?  // futura versão mobile nativa
  lastSeenAt   DateTime @default(now())
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, deviceType, platform])
  @@index([userId])
}
```

**Step 3: Adicionar relations no modelo User e ServiceListing/ServiceOrder**

No modelo `User`, adicionar:
```prisma
searchEvents        SearchEvent[]
listingViews        ServiceListingView[]
orderEvents         ServiceOrderEvent[]    @relation("OrderEventUser")
devices             UserDevice[]
```

No modelo `ServiceListing`:
```prisma
listingViews ServiceListingView[]
```

No modelo `ServiceOrder`:
```prisma
orderEvents ServiceOrderEvent[]
```

**Step 4: Aplicar migration**

```bash
cd backend && npm run db:push
```

Expected: Schema updated without errors.

**Step 5: Verificar tipos gerados**

```bash
cd backend && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add analytics models - SearchEvent, ServiceListingView, ServiceOrderEvent, CityMetrics, UserDevice"
```

---

## Task B2: Endpoint de Registro de Busca (Backend)

**Objetivo:** Criar endpoint para o frontend registrar eventos de busca e impressões

**Files:**
- Create: `backend/src/controllers/analyticsController.ts`
- Create: `backend/src/routes/analyticsRoutes.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Criar schemas de validação**

Em `backend/src/middleware/validation.ts`, adicionar:

```typescript
export const trackSearchSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  category: z.string().optional(),
  city: z.string().max(100).optional(),
  resultsCount: z.number().int().min(0).default(0),
  sessionId: z.string().optional(),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
});

export const trackListingViewSchema = z.object({
  listingId: z.number().int().positive(),
  source: z.enum(["search", "recommendation", "landing", "direct", "unknown"]).optional(),
  city: z.string().max(100).optional(),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
  sessionId: z.string().optional(),
});
```

**Step 2: Criar analyticsController.ts**

```typescript
// backend/src/controllers/analyticsController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("analyticsController");

// POST /api/analytics/search — registra evento de busca
export const trackSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query, category, city, resultsCount, sessionId, device } = req.body;

    await prisma.searchEvent.create({
      data: {
        userId: req.user?.id ?? null,
        query: query ?? "",
        category: category ?? null,
        city: city ?? null,
        resultsCount: resultsCount ?? 0,
        sessionId: sessionId ?? null,
        device: device ?? null,
      },
    });

    res.status(201).json({ success: true, message: "Search tracked" });
  } catch (error) {
    log.error({ err: error }, "Track search error");
    // Fire-and-forget: don't fail the user experience
    res.status(200).json({ success: true });
  }
};

// POST /api/analytics/listing-view — registra visualização de listing
export const trackListingView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listingId, source, city, device, sessionId } = req.body;

    await prisma.serviceListingView.create({
      data: {
        listingId,
        userId: req.user?.id ?? null,
        source: source ?? null,
        city: city ?? null,
        device: device ?? null,
        sessionId: sessionId ?? null,
      },
    });

    res.status(201).json({ success: true, message: "View tracked" });
  } catch (error) {
    log.error({ err: error }, "Track listing view error");
    res.status(200).json({ success: true }); // never fail
  }
};
```

**Step 3: Criar analyticsRoutes.ts**

```typescript
// backend/src/routes/analyticsRoutes.ts
import { Router } from "express";
import { trackSearch, trackListingView } from "../controllers/analyticsController";
import { validateBody } from "../middleware/validate";
import { trackSearchSchema, trackListingViewSchema } from "../middleware/validation";
import { createUserRateLimiter } from "../middleware/rateLimiter";

const router = Router();
const analyticsLimiter = createUserRateLimiter(100, 60 * 1000); // 100/min per user

router.post("/search", analyticsLimiter, validateBody(trackSearchSchema), trackSearch);
router.post("/listing-view", analyticsLimiter, validateBody(trackListingViewSchema), trackListingView);

export default router;
```

**Step 4: Registrar em index.ts**

Em `backend/src/index.ts`, adicionar na seção de rotas:
```typescript
import analyticsRoutes from "./routes/analyticsRoutes";
// ...
app.use("/api/analytics", analyticsRoutes);
```

**Step 5: Rodar testes**

```bash
cd backend && npm test
cd backend && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add backend/src/controllers/analyticsController.ts
git add backend/src/routes/analyticsRoutes.ts
git add backend/src/index.ts
git add backend/src/middleware/validation.ts
git commit -m "feat: add analytics tracking endpoints for search events and listing views"
```

---

## Task B3: Registrar ServiceOrderEvent em Todas as Mudanças de Status

**Objetivo:** Todo controller que muda `serviceOrder.status` deve criar um `ServiceOrderEvent` para auditoria e analytics de funil

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Criar helper de registro de evento**

No início do `orderController.ts`, adicionar:

```typescript
// Helper: registra evento de mudança de status
async function recordOrderEvent(
  serviceOrderId: number,
  fromStatus: string | null,
  toStatus: string,
  triggeredBy: number | null,
  reason?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.serviceOrderEvent.create({
      data: {
        serviceOrderId,
        fromStatus,
        toStatus,
        triggeredBy,
        reason: reason ?? null,
        metadata: metadata ?? null,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to record order event — non-blocking");
  }
}
```

**Step 2: Chamar em cada atualização de status**

Nos lugares onde `prisma.serviceOrder.update({ data: { status: ... } })` ocorre:
- Após `PENDING → ACCEPTED`: `recordOrderEvent(id, "PENDING", "ACCEPTED", professionalId)`
- Após `ACCEPTED → IN_PROGRESS`: `recordOrderEvent(id, "ACCEPTED", "IN_PROGRESS", professionalId)`
- Após qualquer cancelamento: `recordOrderEvent(id, currentStatus, "CANCELLED", userId, reason)`
- Após `COMPLETED`: `recordOrderEvent(id, prevStatus, "COMPLETED", userId)`

**Step 3: Rodar type check**

```bash
cd backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "feat: record ServiceOrderEvent on every status transition for audit trail"
```

---

---

# TRILHA C — Segurança (Prioridade CRÍTICA)

> ⚠️ Esta trilha deve ser executada PRIMEIRO antes das demais. As vulnerabilidades críticas abaixo representam risco real de exploração.

---

## Task C1: CRÍTICO — Fixar Webhook HMAC Bypass (VULN-01)

**Files:**
- Modify: `backend/src/config/env.ts`
- Modify: `backend/src/services/mercadopagoService.ts` (ou onde `validateMercadoPagoSignature` está)

**Step 1: Adicionar validação de startup no env.ts**

Localizar onde `MP_WEBHOOK_SECRET` é definido e adicionar:

```typescript
// backend/src/config/env.ts — adicionar na validação de produção
if (process.env.NODE_ENV === "production" && !process.env.MP_WEBHOOK_SECRET) {
  throw new Error("FATAL: MP_WEBHOOK_SECRET must be set in production. Refusing to start.");
}
MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
```

**Step 2: Reforçar validateMercadoPagoSignature para rejeitar secrets vazios**

Localizar a função `validateMercadoPagoSignature` e adicionar no início:

```typescript
if (!secret || secret.trim() === "") {
  return { valid: false, reason: "Webhook secret not configured" };
}
```

**Step 3: Rodar testes de segurança**

```bash
cd backend && npm run test:security
```

**Step 4: Commit**

```bash
git add backend/src/config/env.ts
git commit -m "fix(security): require MP_WEBHOOK_SECRET in production - prevent HMAC bypass [VULN-01]"
```

---

## Task C2: CRÍTICO — Redactar Passwords de Logs (VULN-14)

**Files:**
- Modify: `backend/src/middleware/validate.ts`

**Step 1: Adicionar função de redação**

```typescript
const SENSITIVE_KEYS = ["password", "currentPassword", "newPassword", "token", "secret", "cpf", "document"];

function redactSensitiveBody(body: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactSensitiveBody(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
```

**Step 2: Usar na mensagem de log de falha de validação**

Localizar `log.warn({ body: req.body, errors, path: req.path }, 'Body validation failed')` e substituir por:

```typescript
log.warn({ body: redactSensitiveBody(req.body), errors, path: req.path }, 'Body validation failed');
```

**Step 3: Rodar testes**

```bash
cd backend && npm test
```

**Step 4: Commit**

```bash
git add backend/src/middleware/validate.ts
git commit -m "fix(security): redact sensitive fields from validation error logs [VULN-14]"
```

---

## Task C3: CRÍTICO — Remover Email Hardcoded (VULN-04)

**Files:**
- Modify: `backend/src/config/env.ts`

**Step 1: Localizar e corrigir o default de SMTP_FROM_EMAIL**

Localizar `amplimusicstudo@gmail.com` no código e substituir por:

```typescript
SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || (
  process.env.NODE_ENV === "production"
    ? (() => { throw new Error("FATAL: SMTP_FROM_EMAIL must be set in production"); })()
    : "noreply@faztudo.local"
),
```

**Step 2: Verificar se há outros hardcodes**

```bash
cd backend && grep -rn "amplimusicstudo" src/
```

Expected: 0 results após a correção.

**Step 3: Commit**

```bash
git add backend/src/config/env.ts
git commit -m "fix(security): remove hardcoded personal email from SMTP config [VULN-04]"
```

---

## Task C4: ALTO — Fixar Socket.io Order Room Authorization (VULN-06)

**Files:**
- Modify: `backend/src/socket.ts`

**Step 1: Localizar o handler join:order**

```typescript
socket.on("join:order", (orderId: number) => {
  socket.join(`order:${orderId}`);
});
```

**Step 2: Substituir por versão com verificação de participação**

```typescript
socket.on("join:order", async (orderId: number) => {
  try {
    const orderIdNum = parseInt(String(orderId), 10);
    if (isNaN(orderIdNum)) return;

    // Verificar se o usuário é participante do pedido
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderIdNum },
      select: { clientId: true, professionalId: true },
    });

    if (!order) return;

    const isParticipant =
      order.clientId === userId ||
      order.professionalId === userId ||
      userRole === "ADMIN";

    if (!isParticipant) {
      log.warn({ userId, orderId: orderIdNum }, "Unauthorized attempt to join order room");
      return;
    }

    socket.join(`order:${orderIdNum}`);
    log.debug({ userId, orderId: orderIdNum }, "Joined order room");
  } catch (err) {
    log.error({ err }, "join:order error");
  }
});
```

**Step 3: Verificar que `userId` e `userRole` estão disponíveis no escopo do socket handler (vindos da autenticação Socket.io)**

**Step 4: Rodar type check**

```bash
cd backend && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add backend/src/socket.ts
git commit -m "fix(security): verify order participant before joining Socket.io room [VULN-06]"
```

---

## Task C5: ALTO — Fixar Dev Payment Bypass Condition (VULN-02)

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts`

**Step 1: Localizar o fallback de pagamento**

```typescript
if (env.NODE_ENV !== "production") {
```

**Step 2: Substituir por condição mais segura**

```typescript
if (env.NODE_ENV === "development" && env.ALLOW_LOCAL_PAYMENT_FALLBACK === "true") {
```

**Step 3: Adicionar a variável env.ts**

```typescript
ALLOW_LOCAL_PAYMENT_FALLBACK: process.env.ALLOW_LOCAL_PAYMENT_FALLBACK === "true",
```

**Step 4: Atualizar .env.example**

Adicionar ao `backend/.env.example`:
```
# Dev only: allow payment bypass without real MercadoPago (NEVER set true in production)
ALLOW_LOCAL_PAYMENT_FALLBACK=false
```

**Step 5: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts
git add backend/src/config/env.ts
git add backend/.env.example
git commit -m "fix(security): tighten dev payment fallback to explicit opt-in env var [VULN-02]"
```

---

## Task C6: ALTO — Adicionar Audit Log em Admin Login e Company Verify (VULN-03)

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`

**Step 1: Localizar as rotas sem auditLog**

Em `adminRoutes.ts`:
```typescript
router.post("/login", authLimiter, validateBody(adminLoginSchema), adminController.adminLogin);
// ...
router.post("/companies/:companyId/verify", validateBody(verifyCompanySchema), verifyCompany);
```

**Step 2: Adicionar auditLog**

```typescript
import { auditLog } from "../middleware/auditLog";
// ...
router.post("/login", authLimiter, auditLog("ADMIN_LOGIN"), validateBody(adminLoginSchema), adminController.adminLogin);
// ...
router.post("/companies/:companyId/verify", auditLog("ADMIN_VERIFY_COMPANY"), validateBody(verifyCompanySchema), verifyCompany);
```

**Nota**: Verificar se `auditLog` pode ser colocado antes de `verifyToken` no contexto de admin login (onde o token ainda não existe). Para admin login, criar uma variante `auditLogUnauthenticated("ADMIN_LOGIN_ATTEMPT")` que apenas loga IP + email da tentativa.

**Step 3: Commit**

```bash
git add backend/src/routes/adminRoutes.ts
git commit -m "fix(security): add audit logging to admin login and company verification [VULN-03]"
```

---

## Task C7: MÉDIO — Elevar chatFilter a Middleware Express (VULN-17)

**Objetivo:** Garantir que `filterChatContent` é executado automaticamente em TODAS as rotas de mensagem, sem depender de chamada manual nos controllers

**Files:**
- Modify: `backend/src/middleware/chatFilter.ts`
- Modify: `backend/src/routes/chatRoutes.ts`

**Step 1: Criar o Express middleware wrapper**

No final de `chatFilter.ts`, adicionar:

```typescript
import { Request, Response, NextFunction } from "express";

/**
 * Express middleware: aplica filterChatContent em req.body.content automaticamente.
 * Usar em todas as rotas que aceitam mensagens.
 */
export const chatFilterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body?.content && typeof req.body.content === "string") {
    const result = filterChatContent(req.body.content);
    if (result.blocked) {
      res.status(400).json({
        success: false,
        message: `Mensagem contém informações de contato não permitidas: ${result.blockedTypes.join(", ")}`,
        blockedTypes: result.blockedTypes,
      });
      return;
    }
    req.body.content = result.filtered;
  }
  next();
};
```

**Step 2: Aplicar em chatRoutes.ts**

```typescript
import { chatFilterMiddleware } from "../middleware/chatFilter";
// ...
// Aplicar em todas as rotas que recebem mensagens:
router.post("/send", verifyToken, chatFilterMiddleware, validateBody(sendMessageSchema), sendMessage);
```

**Step 3: Verificar que controllers que chamam `filterChatContent` manualmente podem remover a chamada manual (DRY)**

**Step 4: Commit**

```bash
git add backend/src/middleware/chatFilter.ts
git add backend/src/routes/chatRoutes.ts
git commit -m "refactor(security): promote chatFilter to Express middleware for automatic enforcement [VULN-17]"
```

---

## Task C8: MÉDIO — Validação CPF Algorítmica (VULN-09)

**Files:**
- Create: `backend/src/utils/cpfValidator.ts`
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Criar CPF validator**

```typescript
// backend/src/utils/cpfValidator.ts

/**
 * Valida CPF usando algoritmo de dígito verificador.
 * Aceita formatos: "12345678909" ou "123.456.789-09"
 */
export function isValidCPF(cpf: string): boolean {
  // Remove formatação
  const cleaned = cpf.replace(/\D/g, "");

  if (cleaned.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais (ex: "00000000000")
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]!) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9]!)) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]!) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10]!)) return false;

  return true;
}
```

**Step 2: Usar no schema de pagamento em validation.ts**

Substituir:
```typescript
payerCPF: z.string().min(11, 'CPF invalido').max(14),
```
Por:
```typescript
payerCPF: z.string().refine(
  (cpf) => isValidCPF(cpf),
  { message: "CPF inválido" }
),
```

**Step 3: Escrever teste unitário**

```typescript
// backend/tests/cpfValidator.test.ts
import { describe, it, expect } from "vitest";
import { isValidCPF } from "../src/utils/cpfValidator";

describe("isValidCPF", () => {
  it("accepts valid CPF (digits only)", () => {
    expect(isValidCPF("12345678909")).toBe(true);
  });
  it("accepts valid CPF (formatted)", () => {
    expect(isValidCPF("123.456.789-09")).toBe(true);
  });
  it("rejects all-same digits", () => {
    expect(isValidCPF("11111111111")).toBe(false);
  });
  it("rejects wrong check digit", () => {
    expect(isValidCPF("12345678901")).toBe(false);
  });
  it("rejects too short", () => {
    expect(isValidCPF("1234567")).toBe(false);
  });
});
```

**Step 4: Rodar testes**

```bash
cd backend && npm test -- --reporter=verbose tests/cpfValidator.test.ts
```

Expected: 5/5 passing.

**Step 5: Commit**

```bash
git add backend/src/utils/cpfValidator.ts
git add backend/tests/cpfValidator.test.ts
git add backend/src/middleware/validation.ts
git commit -m "feat: add CPF check-digit validation for payment schemas [VULN-09]"
```

---

## Task C9: MÉDIO — Restringir profileImage a Domínios Confiáveis (VULN-10)

**Files:**
- Modify: `backend/src/middleware/validation.ts`

**Step 1: Adicionar validação de domínio de imagem**

```typescript
const ALLOWED_IMAGE_HOSTS = [
  "res.cloudinary.com",
  "storage.googleapis.com",
  "s3.amazonaws.com",
  "images.unsplash.com",
  "faztudo.com.br",
  "localhost",
];

const profileImageSchema = z.string().url().refine(
  (url) => {
    try {
      const { hostname } = new URL(url);
      return ALLOWED_IMAGE_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
    } catch {
      return false;
    }
  },
  { message: "URL de imagem deve ser de um domínio autorizado" }
);
```

**Step 2: Usar no updateProfileSchema**

```typescript
profileImage: profileImageSchema.optional(),
```

**Step 3: Commit**

```bash
git add backend/src/middleware/validation.ts
git commit -m "fix(security): restrict profile image URLs to trusted domains [VULN-10]"
```

---

## Task C10: MÉDIO — Health Check Protegido + Remover Info de Versão (VULN-16)

**Files:**
- Modify: `backend/src/index.ts`

**Step 1: Modificar os endpoints `/` e `/health`**

```typescript
// Endpoint raiz — sem info interna
app.get("/", (_req, res) => {
  res.json({ status: "OK" }); // Remove versão e nome
});

// Health check — protegido com IP allowlist ou token interno
app.get("/health", (req, res) => {
  const allowedIPs = ["127.0.0.1", "::1", "10.0.0.0/8"]; // Ajustar para prod
  const clientIP = req.ip || "";
  
  // Em produção, só aceitar de IPs internos
  if (process.env.NODE_ENV === "production") {
    const isInternal = allowedIPs.some(allowed => clientIP.startsWith(allowed.split("/")[0]!));
    if (!isInternal) {
      res.status(404).json({ status: "Not Found" }); // Não revelar que existe
      return;
    }
  }

  res.json({ status: "healthy", timestamp: new Date().toISOString() });
  // Remove "database: connected" — não expor estado interno
});
```

**Step 2: Commit**

```bash
git add backend/src/index.ts
git commit -m "fix(security): limit health check endpoint info disclosure [VULN-16]"
```

---

## Task C11: BAIXO — Corrigir balanceBefore/balanceAfter nas Transações (VULN-20)

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts`
- Modify: `backend/src/controllers/walletController.ts`

**Objetivo:** Registrar saldo real antes/depois de cada transação financeira, não 0/0

**Step 1: Criar helper para calcular saldo atual**

```typescript
// Em paymentController.ts
async function getUserBalance(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  return user?.balance ?? 0;
}
```

**Step 2: Usar antes de criar Transaction**

```typescript
const balanceBefore = await getUserBalance(req.user.id);
// ... create payment ...
const balanceAfter = balanceBefore + amount; // ou - amount para débitos

await prisma.transaction.create({
  data: {
    // ...
    balanceBefore,
    balanceAfter,
  }
});
```

**Step 3: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts
git add backend/src/controllers/walletController.ts
git commit -m "fix: record accurate balance snapshots in transaction audit trail [VULN-20]"
```

---

# Resumo de Prioridades e Ordem de Execução

## Fase 1 — SEGURANÇA CRÍTICA (Executar IMEDIATAMENTE)
| Task | Severidade | Tempo Est. |
|------|-----------|-----------|
| C1 — Webhook HMAC bypass | 🔴 Crítico | 20 min |
| C2 — Passwords em logs | 🔴 Crítico | 15 min |
| C3 — Email hardcoded | 🔴 Crítico | 10 min |
| C4 — Socket.io room auth | 🟠 Alto | 30 min |
| C5 — Dev payment bypass | 🔴 Crítico | 15 min |
| C6 — Audit admin login | 🔴 Crítico | 20 min |

## Fase 2 — SEGURANÇA ALTA (Semana 1)
| Task | Severidade | Tempo Est. |
|------|-----------|-----------|
| C7 — chatFilter middleware | 🟡 Médio | 25 min |
| C8 — CPF validation | 🟠 Alto | 30 min |
| C9 — profileImage domains | 🟠 Alto | 20 min |
| C10 — Health check | 🟡 Médio | 15 min |
| C11 — Balance snapshots | 🟢 Baixo | 40 min |

## Fase 3 — UX (Semana 1–2)
| Task | Impacto | Tempo Est. |
|------|---------|-----------|
| A1 — Client Onboarding | Alto | 2h |
| A2 — Pro Onboarding | Alto | 2h |
| A3 — HowItWorks Interativo | Médio | 1.5h |
| A4 — Empty States | Médio | 1h |
| A5 — Acessibilidade | Médio | 2h |

## Fase 4 — DADOS (Semana 2–3)
| Task | Impacto | Tempo Est. |
|------|---------|-----------|
| B1 — Schema analytics | Alto (long-term) | 1h |
| B2 — Analytics endpoints | Alto (long-term) | 1.5h |
| B3 — OrderEvent log | Médio | 1h |

---

# Arquivos Críticos a Não Editar Simultaneamente

| Arquivo | Risco | Tasks que tocam |
|---------|-------|----------------|
| `backend/src/index.ts` | 🔴 Alto | C10 |
| `backend/prisma/schema.prisma` | 🔴 Alto | B1 |
| `backend/src/middleware/validation.ts` | 🟠 Médio | C8, C9, B2 |
| `frontend/src/App.tsx` | 🔴 Alto | Nenhuma neste plano |
| `frontend/src/components/Layout.tsx` | 🔴 Alto | Nenhuma neste plano |

---

_Plano gerado em: 2026-02-20 | Revisão recomendada: antes de cada fase_
