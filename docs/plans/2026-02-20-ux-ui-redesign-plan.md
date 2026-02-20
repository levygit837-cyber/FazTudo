# FazTudo — UX/UI Improvement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevar a experiência de usuário do FazTudo para que novos clientes e profissionais consigam navegar, entender e executar seu fluxo principal de forma intuitiva, acessível e visualmente coesa desde o primeiro acesso.

**Architecture:** Melhorias incrementais sobre os componentes existentes, sem quebrar rotas ou fluxos. Foco em onboarding guiado, hierarquia visual clara, microinterações de feedback e acessibilidade WCAG AA. Todas as mudanças mantêm compatibilidade com Tailwind v4 CSS-first e React 19.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 (CSS-first, `@theme`) + Lucide React 0.574 + React Router 7 + clsx

---

## Análise UX/UI Baseada no Código Atual

### O que está bem ✅
- Landing pages com hero section responsiva, grid cards de categorias, seção de depoimentos
- `HowItWorksInteractive` explica o fluxo de 4 passos com troca cliente/profissional
- `ClientOnboarding` e `ProfessionalOnboarding` existem e aparecem no dashboard
- Layout tem skip-link acessível, focus-trap no menu mobile, aria-labels nos botões
- ServiceCard com favoritos, badge de verificado, rating e trust signals
- Dark mode consistente via `.dark` class
- Design tokens bem definidos no `index.css` com `@theme`
- Animações: `animate-fadeIn`, `slide-in-right`, `shimmer` disponíveis

### Problemas identificados 🔴

#### 1. LANDING PAGE — Clientes
- **Hero sem barra de busca direta**: O usuário vê "Encontrar profissional" que leva a `/services`, mas não há uma barra de busca inline no hero. Primeira ação = clicar em botão → segunda página → buscar. São 2 cliques onde poderia ser 1.
- **Categorias hardcoded**: 6 categorias fixas no código, sem ícone visual diferenciado (todos usam ícones muito similares do Lucide, não há imagens/ilustrações).
- **Sem urgência ou prova social dinâmica**: Stats são strings hardcoded ("10 mil+"), não há um contador animado ou badge de "X profissionais online agora".
- **CTA duplicado no footer e no botão da nav**: Dois pontos de "Criar conta" muito próximos visuais, gerando confusão de qual clicar primeiro.
- **Mobile: sem "Profissional" na nav** — o switch para `/profissionais` aparece apenas como `<Briefcase /> Pro` em mobile, muito críptico.

#### 2. LANDING PAGE — Profissionais
- **Hero card de ganhos usa dados fictícios**: "Receita média mensal R$4.500" sem indicar claramente que é uma média estimada, pode parecer enganoso.
- **FixedSwitchCard flutua**: O card fixo "Sou Cliente" está posicionado com `fixed`, mas pode sobrepor conteúdo crítico no mobile.
- **Sem comparação clara com concorrentes**: Não há seção "Por que FazTudo vs. fazer por conta?" para profissionais que ainda estão indecisos.
- **Falta testimonial de profissional**: Apenas a página de clientes tem depoimentos.

#### 3. ONBOARDING — Cliente Dashboard
- **`ClientOnboarding` é dismissível de imediato**: O X aparece no canto, usuário fecha sem ler. Não há persistência do progresso.
- **Apenas 3 passos**: Falta mencionar pagamento escrow (passo crítico de confiança).
- **Sem link CTA no passo 2 (Faça seu pedido)**: `action: null` significa que o usuário aprende sobre o pedido mas não tem botão para ir criar um.
- **Visual pouco hierárquico**: Usa classes `card` genéricas com `border-blue-100` — não segue o mesmo design system dark/glass dos componentes de landing.

#### 4. ONBOARDING — Profissional Dashboard
- **4 passos exibidos em overflow horizontal em mobile**: Os botões de passo ficam em `overflow-x-auto` em mobile, cortando visualmente.
- **Passo "Crie seus serviços" usa classe `btn-primary`**: Enquanto o botão final usa `btn-success` — inconsistência de cores para ações primárias.
- **Sem indicação de "completado"**: Não há estado visual de "já fiz isso" para cada passo.

#### 5. SEARCH PAGE (ServiceSearch)
- **Filtros em sidebar aberta por padrão em desktop**: `sidebarOpen: true` por padrão — em mobile pode causar overflow.
- **Nenhuma animação de entrada nos cards**: Cards aparecem de uma vez sem `fadeIn` staggered.
- **Sem estado de "busca vazia" contextual**: EmptyState existe mas não diferencia "sem resultados para X" vs "nenhum serviço nessa categoria".

#### 6. SERVICE CARD
- **Alt text da imagem = title**: `alt={title}` — aceitável mas não ideal. Imagem decorativa de preview deveria ter `alt=""` e o contexto ser dado pelo heading.
- **"Online indicator dot" sempre verde**: O ponto verde no avatar do profissional é sempre renderizado sem checar status real online.
- **Touch target do favorito (32x32px)**: Abaixo do mínimo de 44x44px para mobile (WCAG 2.5.5).

#### 7. ORDER DETAILS
- **CheckoutStepper com linha horizontal**: Entre steps usa div, não uma linha conectora visual. Visualmente não comunica progressão.
- **Muitos modais**: DisputeModal, RescheduleModal, DelayAlertModal, ConfirmDialog — sem controle de foco centralizado entre eles.

#### 8. LAYOUT GERAL
- **Nav no desktop tem muitos itens para profissionais**: 5 links na nav + menu dropdown = muito cognitivo. Poderia usar grupos ou sidebar colapsível.
- **`container-responsive` não definido no index.css analisado**: Pode ser classe customizada — se não existir em Tailwind v4, pode causar layout quebrado.
- **Footer com links que levam a âncoras do tipo `/#how-it-works`**: Ao estar numa rota interna, esses links causam reload desnecessário, não scroll suave.

#### 9. VISUAL DESIGN
- **HowItWorksInteractive usa `bg-gray-100 dark:bg-gray-800`**: Enquanto o restante usa `bg-slate-100 dark:bg-slate-800` — inconsistência na paleta (gray vs slate).
- **ClientOnboarding usa `text-gray-400/600/800`**: Todas as outras páginas usam `text-slate-*` — mesma inconsistência.
- **Sem transições de página**: Rotas trocam abruptamente. A landing tem `animate-fadeIn` mas as páginas internas não têm.
- **Falta microinteração no botão "Pedir Serviço"**: Ele tem gradiente mas sem `hover:-translate-y-0.5` como os outros CTAs principais.

#### 10. ACESSIBILIDADE
- **`HowItWorksInteractive` usa emoji no texto dos botões** (`👤 Sou Cliente`): Emojis sem `aria-hidden` são lidos por leitores de tela como "pessoa de negócios cliente" em PT-BR, o que é confuso.
- **Focus rings ausentes na maioria dos botões**: Tailwind v4 requer `focus-visible:ring-*` explícito — botões de step do onboarding não têm.
- **Sem `lang="pt-BR"` verificado**: O HTML root deve ter lang correto.
- **Imagens de Unsplash em produção**: `src="https://images.unsplash.com/..."` — dependência externa sem fallback para `loading="lazy"`.
- **`role="progressbar"` no ProfessionalOnboarding**: Correto, mas falta `aria-valuetext` para leitores de tela.

---

## Visão do Fluxo Ideal

### Como um CLIENTE novo deveria experienciar o FazTudo

```
1. Landing (/) — Primeiro olhar (0–5s)
   ↓ Headline impactante + barra de busca INLINE no hero
   ↓ Logo abaixo: "Mais buscados: [Encanamento] [Elétrica] [Limpeza]" — pills clicáveis
   ↓ TrustBadges visíveis sem scroll

2. ServiceSearch (/services) — Exploração (5–60s)
   ↓ Cards com imagem, nome, rating, preço e selo "Verificado"
   ↓ Filtros rápidos horizontais no topo (não sidebar)
   ↓ CTA "Contratar" bem visível em cada card

3. ServiceDetails (/services/:id) — Decisão
   ↓ Portfólio do profissional, reviews expandidas, preço destacado
   ↓ Botão "Solicitar Serviço" sticky em mobile

4. NewOrder + Checkout — Conversão
   ↓ Stepper visual mostrando onde o usuário está
   ↓ Mensagem "Seu pagamento fica protegido até você aprovar" antes de pagar

5. ClientDashboard — Retenção
   ↓ Onboarding card APENAS para usuários novos (< 7 dias)
   ↓ Status dos pedidos em cards visuais claros
   ↓ Quick action: "Pedir novo serviço"
```

### Como um PROFISSIONAL novo deveria experienciar o FazTudo

```
1. Landing (/profissionais) — Primeiro olhar (0–5s)
   ↓ Headline focada em ganhos + autonomia
   ↓ Card de ganhos com disclaimer "estimativa média"
   ↓ 3 benefícios visuais (ícone colorido + texto curto)

2. Registro → Dashboard Profissional — Ativação
   ↓ Onboarding checklist com % de completude do perfil
   ↓ 4 tarefas: Foto, Bio, Criar 1º Serviço, Verificar Conta
   ↓ Bloqueio suave: "Você receberá pedidos após criar 1 serviço"

3. ProfessionalDashboard — Operação diária
   ↓ "X novos pedidos aguardando" como header alert
   ↓ Ganhos do mês em destaque (MoneyCard)
   ↓ Quick actions: Aceitar pedido, Abrir chat, Ver agenda
```

---

## Plano de Implementação

---

### Task 1: Corrigir inconsistências de paleta de cores (gray → slate)

**Arquivos:**
- Modify: `frontend/src/components/common/ClientOnboarding.tsx`
- Modify: `frontend/src/components/landing/HowItWorksInteractive.tsx`
- Modify: `frontend/src/components/common/ProfessionalOnboarding.tsx`

**Problema:** `gray-*` misturado com `slate-*` nos mesmos componentes quebra a coesão visual do design system.

**Step 1: Editar ClientOnboarding.tsx — trocar gray por slate**

```tsx
// ANTES (linha ~66):
"bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
// DEPOIS:
"bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"

// ANTES (linha ~44):
className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
// DEPOIS:
className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"

// ANTES (linha ~83):
<h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
// DEPOIS:
<h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
```

**Step 2: Editar HowItWorksInteractive.tsx — trocar gray por slate**

```tsx
// ANTES (linha ~117):
<div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
// DEPOIS:
<div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">

// ANTES (botões role toggle, linha ~123):
"bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
"text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
// DEPOIS:
"bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
"text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"

// ANTES (step card bg, linha ~182):
<div className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 ...">
// DEPOIS:
<div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 ...">

// ANTES (seção pai, linha ~104):
<section className="py-16 px-4 bg-white dark:bg-gray-900" ...>
// DEPOIS:
<section className="py-16 px-4 bg-white dark:bg-slate-900" ...>
```

**Step 3: Editar ProfessionalOnboarding.tsx — trocar gray por slate**

```tsx
// ANTES (linha ~51):
<div className="card mb-6 border-2 border-indigo-100 dark:border-indigo-800 relative">
// MANTER — borda indigo é intencional

// ANTES (linha ~72):
<div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
// DEPOIS:
<div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">

// ANTES (step buttons não ativos, linha ~92):
"bg-gray-100 dark:bg-gray-700 text-gray-500"
// DEPOIS:
"bg-slate-100 dark:bg-slate-700 text-slate-500"

// ANTES (content area, linha ~113):
<h3 className="font-semibold text-gray-800 dark:text-gray-100 ...">
<p className="text-sm text-gray-600 dark:text-gray-300 ...">
// DEPOIS:
<h3 className="font-semibold text-slate-800 dark:text-slate-100 ...">
<p className="text-sm text-slate-600 dark:text-slate-300 ...">
```

**Step 4: Commit**
```bash
git add frontend/src/components/common/ClientOnboarding.tsx \
        frontend/src/components/landing/HowItWorksInteractive.tsx \
        frontend/src/components/common/ProfessionalOnboarding.tsx
git commit -m "fix(ui): normalize palette gray→slate in onboarding and how-it-works components"
```

---

### Task 2: Corrigir acessibilidade — emojis, focus rings e touch targets

**Arquivos:**
- Modify: `frontend/src/components/landing/HowItWorksInteractive.tsx`
- Modify: `frontend/src/components/services/ServiceCard.tsx`
- Modify: `frontend/src/components/common/ProfessionalOnboarding.tsx`

**Step 1: Adicionar `aria-hidden` nos emojis do HowItWorksInteractive**

```tsx
// ANTES (linha ~119):
👤 Sou Cliente
// DEPOIS:
<span aria-hidden="true">👤</span> Sou Cliente

// ANTES (linha ~132):
🔧 Sou Profissional
// DEPOIS:
<span aria-hidden="true">🔧</span> Sou Profissional
```

Os tips com emoji nas strings de dados (`tip: "💡 Dica: ..."`) devem ter o emoji movido para o JSX:

```tsx
// Em cada step object, separar emoji do texto:
tip: "Dica: Use filtros de preço e avaliação para encontrar mais rápido!",
tipEmoji: "💡",
// No render:
<div ...>
  <span aria-hidden="true">{current.tipEmoji}</span>
  {" "}{current.tip}
</div>
```

**Step 2: Aumentar touch target do botão de favorito no ServiceCard**

```tsx
// ANTES (linha ~88):
<button
  className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 ..."
  aria-label={...}
>
// DEPOIS — padding externo + target mínimo 44px via p-2:
<button
  className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 ..."
  aria-label={...}
>
  <Heart className="h-4 w-4 ..." />
</button>
```

**Step 3: Adicionar `aria-valuetext` no progressbar do ProfessionalOnboarding**

```tsx
// ANTES (linha ~77):
<div
  className="h-1.5 bg-indigo-500 rounded-full transition-all duration-300"
  style={{ width: `${progress}%` }}
  role="progressbar"
  aria-valuenow={activeStep + 1}
  aria-valuemin={1}
  aria-valuemax={STEPS.length}
/>
// DEPOIS — adicionar aria-valuetext:
<div
  ...
  aria-valuenow={activeStep + 1}
  aria-valuemin={1}
  aria-valuemax={STEPS.length}
  aria-valuetext={`Passo ${activeStep + 1} de ${STEPS.length}: ${STEPS[activeStep].title}`}
/>
```

**Step 4: Adicionar focus-visible rings nos botões de step sem ring**

Em ambos ClientOnboarding e ProfessionalOnboarding, adicionar `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500` nos botões de navegação de step:

```tsx
// Botões "Anterior" / "Próximo" / "Começar agora!"
className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
```

**Step 5: Commit**
```bash
git add frontend/src/components/landing/HowItWorksInteractive.tsx \
        frontend/src/components/services/ServiceCard.tsx \
        frontend/src/components/common/ProfessionalOnboarding.tsx \
        frontend/src/components/common/ClientOnboarding.tsx
git commit -m "fix(a11y): aria-hidden emojis, increase favorite touch target 44px, add focus rings, aria-valuetext progressbar"
```

---

### Task 3: Adicionar barra de busca inline no Hero da Landing do Cliente

**Arquivos:**
- Modify: `frontend/src/pages/LandingPageUser.tsx`
- Modify: `frontend/src/components/common/SearchBar.tsx` (referência — usar componente existente ou inline)

**Objetivo UX:** Reduzir de 2 cliques para 1 ação a jornada de busca. O usuário digita na landing e já vai para `/services?q=termo`.

**Step 1: Adicionar estado local de busca inline no hero**

```tsx
// Adicionar no início do componente, após estados existentes:
const [heroSearch, setHeroSearch] = useState("");

const handleHeroSearch = (e: React.FormEvent) => {
  e.preventDefault();
  if (heroSearch.trim()) {
    navigate(`/services?q=${encodeURIComponent(heroSearch.trim())}`);
  } else {
    navigate("/services");
  }
};
```

**Step 2: Substituir o CTA primário do hero por um form de busca**

```tsx
// REMOVER o bloco de botões atual (linhas ~237–260):
// <div className="flex flex-col gap-3 sm:flex-row">
//   <Link to="/services" ...>Encontrar profissional</Link>
//   ...
// </div>

// SUBSTITUIR POR:
<form onSubmit={handleHeroSearch} className="flex flex-col gap-3 sm:flex-row w-full max-w-lg">
  <div className="relative flex-1">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
    <input
      type="search"
      value={heroSearch}
      onChange={(e) => setHeroSearch(e.target.value)}
      placeholder="Ex: Encanamento, Pintura, Elétrica..."
      className="w-full rounded-xl pl-12 pr-4 py-3.5 text-[0.9375rem] font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg"
      aria-label="Buscar serviços"
    />
  </div>
  <button
    type="submit"
    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue-lg transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 text-[0.9375rem] whitespace-nowrap"
  >
    Buscar
    <ArrowRight className="h-4 w-4" />
  </button>
</form>

{/* Quick category pills abaixo do search */}
<div className="flex flex-wrap gap-2 mt-2">
  <span className="text-xs text-slate-500 dark:text-slate-400 self-center">Populares:</span>
  {categories.slice(0, 4).map((cat) => (
    <button
      key={cat.name}
      onClick={() => navigate(`/services?q=${encodeURIComponent(cat.name)}`)}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all bg-white/10 dark:bg-slate-800/50 text-slate-300 dark:text-slate-400 border border-slate-600 dark:border-slate-700 hover:bg-white/20 hover:text-white"
    >
      {cat.icon}
      {cat.name}
    </button>
  ))}
</div>
```

**Step 3: Adicionar import do Search (já existia no arquivo)**
Verificar que `Search` está importado — já está na importação do Lucide.

**Step 4: Commit**
```bash
git add frontend/src/pages/LandingPageUser.tsx
git commit -m "feat(ux): add inline hero search with quick category pills on client landing"
```

---

### Task 4: Adicionar animação `prefers-reduced-motion` e microinteração no botão "Pedir Serviço"

**Arquivos:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Layout.tsx`

**Objetivo:** Respeitar preferência do usuário por redução de movimento (WCAG 2.3.3) e animar o CTA "Pedir Serviço" consistentemente com os outros CTAs.

**Step 1: Adicionar `prefers-reduced-motion` global no index.css**

```css
/* Adicionar após todos os @keyframes (linha ~200+) */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Step 2: Corrigir o botão "Pedir Serviço" no Layout**

```tsx
// ANTES (linha ~358):
className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-all no-underline"
// DEPOIS — adicionar hover scale e -translate-y:
className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
```

**Step 3: Commit**
```bash
git add frontend/src/index.css frontend/src/components/Layout.tsx
git commit -m "feat(ux): add prefers-reduced-motion global rule and consistent CTA hover microinteraction"
```

---

### Task 5: Melhorar onboarding do cliente — adicionar step de pagamento e CTA no passo 2

**Arquivos:**
- Modify: `frontend/src/components/common/ClientOnboarding.tsx`

**Problema:** O passo 2 não tem CTA, e falta o passo de pagamento seguro (escrow) que é o diferencial crítico de confiança da plataforma.

**Step 1: Atualizar array STEPS para 4 passos com CTAs**

```tsx
// SUBSTITUIR o array STEPS inteiro:
const STEPS = [
  {
    icon: Search,
    title: "Encontre um serviço",
    description: "Busque por categoria ou nome. Veja avaliações reais, portfólio e certificações dos profissionais.",
    action: { label: "Explorar serviços", to: "/services" },
    color: "text-primary-500",
    bg: "bg-primary-50 dark:bg-primary-900/20",
  },
  {
    icon: ShoppingBag,
    title: "Faça seu pedido",
    description: "Escolha o serviço, defina os detalhes e envie sua solicitação. O profissional responde em até 2 horas.",
    action: { label: "Criar pedido agora", to: "/client/orders/new" },
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: Shield,  // importar Shield de lucide-react
    title: "Pague com segurança",
    description: "Seu dinheiro fica em escrow — protegido na plataforma — e só é liberado quando você confirmar que o serviço foi entregue.",
    action: null,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: MessageCircle,
    title: "Acompanhe e avalie",
    description: "Chat direto com o profissional. Quando terminar, confirme e deixe sua avaliação para ajudar outros clientes.",
    action: { label: "Ver meus pedidos", to: "/client/orders" },
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
];
```

**Step 2: Adicionar import do Shield**
```tsx
// ANTES:
import { Search, ShoppingBag, MessageCircle, CheckCircle, X } from "lucide-react";
// DEPOIS:
import { Search, ShoppingBag, MessageCircle, Shield, X } from "lucide-react";
```

**Step 3: Commit**
```bash
git add frontend/src/components/common/ClientOnboarding.tsx
git commit -m "feat(ux): expand client onboarding to 4 steps including escrow payment trust step"
```

---

### Task 6: Adicionar checklist de completude de perfil no dashboard do profissional

**Arquivos:**
- Modify: `frontend/src/components/common/ProfessionalOnboarding.tsx`

**Objetivo:** Em vez de um guia linear de passos, tornar o onboarding um checklist persistente que mostra % de completude. Profissionais veem claramente o que falta e o impacto (ex: "+3x pedidos" ao completar perfil).

**Step 1: Refatorar o componente para checklist visual**

```tsx
// Novo design — manter compatibilidade de prop onDismiss

import React, { useState } from "react";
import { Link } from "react-router";
import { UserCheck, Briefcase, TrendingUp, Star, X, CheckCircle2, Circle } from "lucide-react";

interface ChecklistItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  impact: string;
  action: { label: string; to: string };
  color: string;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: "profile",
    icon: UserCheck,
    title: "Complete seu perfil",
    description: "Foto, bio e experiências",
    impact: "3x mais pedidos",
    action: { label: "Completar", to: "/profile" },
    color: "text-indigo-500",
  },
  {
    id: "service",
    icon: Briefcase,
    title: "Crie seu primeiro serviço",
    description: "Defina preço e descrição",
    impact: "Comece a receber pedidos",
    action: { label: "Criar", to: "/professional/create-service" },
    color: "text-primary-500",
  },
  {
    id: "verify",
    icon: Star,
    title: "Verifique sua conta",
    description: "Documentos e certificações",
    impact: "Selo de verificado",
    action: { label: "Verificar", to: "/verify-account" },
    color: "text-amber-500",
  },
  {
    id: "schedule",
    icon: TrendingUp,
    title: "Configure sua agenda",
    description: "Horários disponíveis",
    impact: "Mais controle",
    action: { label: "Configurar", to: "/professional/agenda" },
    color: "text-emerald-500",
  },
];

export const ProfessionalOnboarding: React.FC<ProfessionalOnboardingProps> = ({ onDismiss }) => {
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("faztudo_pro_checklist") || "[]"))
  );

  const toggleItem = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("faztudo_pro_checklist", JSON.stringify([...next]));
      return next;
    });
  };

  const progress = Math.round((completed.size / CHECKLIST.length) * 100);

  return (
    <div className="rounded-2xl mb-6 border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl relative overflow-hidden">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded"
        aria-label="Fechar guia de configuração"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4 pr-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-500" />
              Configure sua conta
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {completed.size}/{CHECKLIST.length} tarefas concluídas
            </p>
          </div>
          <span className="text-2xl font-black text-indigo-500">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-5">
          <div
            className="h-2 bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progress}% concluído — ${completed.size} de ${CHECKLIST.length} tarefas`}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {CHECKLIST.map((item) => {
            const done = completed.has(item.id);
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                  done
                    ? "bg-slate-50 dark:bg-slate-800/40 opacity-60"
                    : "bg-slate-50 dark:bg-slate-800/60"
                }`}
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded-full ${
                    done ? "text-emerald-500" : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                  }`}
                  aria-label={done ? `Desmarcar: ${item.title}` : `Marcar como concluído: ${item.title}`}
                  aria-pressed={done}
                >
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                <div className={`flex items-center gap-2 flex-shrink-0 ${item.color}`}>
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200"}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:inline text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                    {item.impact}
                  </span>
                  {!done && (
                    <Link
                      to={item.action.to}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      {item.action.label} →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {progress === 100 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Perfil completo! Você está pronto para receber pedidos.
            </p>
            <button onClick={onDismiss} className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

**Step 2: Commit**
```bash
git add frontend/src/components/common/ProfessionalOnboarding.tsx
git commit -m "feat(ux): replace professional onboarding steps with persistent completion checklist"
```

---

### Task 7: Adicionar indicador "X novos pedidos aguardando" no dashboard profissional

**Arquivos:**
- Modify: `frontend/src/pages/professional/Dashboard.tsx`

**Objetivo:** O profissional, ao entrar no dashboard, vê imediatamente se há ações urgentes pendentes.

**Step 1: Adicionar alert banner condicional no topo**

Após o bloco do onboarding e antes das stats cards, adicionar:

```tsx
{/* Pending orders alert banner */}
{stats.pendingOrders > 0 && (
  <div className="mb-6 flex items-center justify-between gap-4 rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 animate-slide-in-right">
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {stats.pendingOrders === 1
            ? "1 pedido aguardando sua resposta"
            : `${stats.pendingOrders} pedidos aguardando sua resposta`}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Responder rápido aumenta sua taxa de conversão
        </p>
      </div>
    </div>
    <Link
      to="/professional/services"
      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 no-underline"
    >
      Ver pedidos
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  </div>
)}
```

**Nota:** `AlertTriangle` já está importado. `ArrowRight` precisa ser adicionado ao import.

**Step 2: Verificar import de ArrowRight**
```tsx
// ANTES:
import { Clock, Star, ArrowRight, FileText, ... } from "lucide-react";
// ArrowRight já existe — sem alteração necessária
```

**Step 3: Commit**
```bash
git add frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat(ux): add pending orders alert banner on professional dashboard"
```

---

### Task 8: Adicionar transição de página global com CSS

**Arquivos:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/Layout.tsx`

**Objetivo:** Páginas internas aparecem sem transição (abruptamente). Adicionar um fade simples que não cause layout shift.

**Step 1: Adicionar keyframe e classe no index.css**

```css
/* Adicionar no bloco de @keyframes (após slide-in-left): */
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Adicionar após os keyframes: */
.page-transition {
  animation: page-enter 0.25s ease-out;
}
```

**Step 2: Aplicar classe no `<main>` do Layout**

```tsx
// ANTES (linha ~571):
<main id="main-content" className="flex-1 container-responsive py-8">
// DEPOIS:
<main id="main-content" className="flex-1 container-responsive py-8 page-transition" key={location.pathname}>
```

**Nota:** `key={location.pathname}` força React a remontar o `<main>` a cada navegação, re-triggering a animação CSS.

**Step 3: Commit**
```bash
git add frontend/src/index.css frontend/src/components/Layout.tsx
git commit -m "feat(ux): add page enter fade transition via CSS keyframe and key-based remount"
```

---

### Task 9: Adicionar disclaimer no card de ganhos da landing profissional

**Arquivos:**
- Modify: `frontend/src/pages/LandingPageProfessional.tsx`

**Objetivo:** O card "Seus ganhos potenciais" usa dados fictícios sem indicar claramente que são estimativas.

**Step 1: Adicionar nota de disclaimer**

```tsx
// No card de ganhos (após o bloco earningsData.map, linha ~254):
// Adicionar após o bloco <div className="mt-6 flex items-center gap-2 ...">,
// antes do fechamento do card:

<p className="mt-4 text-[0.6875rem] text-slate-500 text-center">
  * Estimativas baseadas na média dos profissionais ativos no último trimestre.
  Resultados individuais variam conforme dedicação e especialidade.
</p>
```

**Step 2: Commit**
```bash
git add frontend/src/pages/LandingPageProfessional.tsx
git commit -m "fix(ux): add earnings disclaimer to professional landing hero card"
```

---

### Task 10: Melhorar `ServiceCard` — remover "online indicator" sempre verde e corrigir alt text

**Arquivos:**
- Modify: `frontend/src/components/services/ServiceCard.tsx`

**Objetivo:** O ponto verde sempre renderizado engana o usuário. O alt da imagem deve ser vazio (decorativo) já que o título está no h3.

**Step 1: Remover o "online indicator dot" ou condicioná-lo**

```tsx
// OPÇÃO A — Remover completamente (recomendado até ter status real online):
// DELETAR as linhas ~135-137:
{/* REMOVER:
<div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
*/}

// OPÇÃO B — Adicionar prop opcional isOnline (para futura implementação):
// Adicionar na interface:
isOnline?: boolean;
// No render, só mostrar se prop existir:
{isOnline && (
  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
    aria-label="Profissional online"
  />
)}
```

**Step 2: Corrigir alt text da imagem de preview**

```tsx
// ANTES (linha ~70):
<img
  src={imageUrl}
  alt={title}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  ...
/>
// DEPOIS — imagem decorativa, texto está no h3:
<img
  src={imageUrl}
  alt=""
  role="presentation"
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  loading="lazy"
  ...
/>
```

**Step 3: Adicionar loading="lazy" e dimensões para evitar layout shift**

```tsx
// Adicionar loading="lazy" na img acima (já feito no step 2)
// Adicionar width/height para CLS score:
<img
  src={imageUrl}
  alt=""
  role="presentation"
  width={400}
  height={192}
  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
  loading="lazy"
  onError={(e) => {
    (e.target as HTMLImageElement).src = "/placeholder-service.jpg";
  }}
/>
```

**Step 4: Commit**
```bash
git add frontend/src/components/services/ServiceCard.tsx
git commit -m "fix(a11y): remove always-green online indicator, fix decorative img alt, add loading=lazy"
```

---

### Task 11: Criar componente `QuickActionBar` para dashboards

**Arquivos:**
- Create: `frontend/src/components/dashboard/QuickActionBar.tsx`
- Modify: `frontend/src/pages/client/Dashboard.tsx`
- Modify: `frontend/src/pages/professional/Dashboard.tsx`

**Objetivo:** Buttons de ação rápida proeminentes abaixo do greeting no dashboard, para as ações mais comuns de cada perfil.

**Step 1: Criar `QuickActionBar.tsx`**

```tsx
// frontend/src/components/dashboard/QuickActionBar.tsx
import React from "react";
import { Link } from "react-router";
import { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
}

interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({ actions, className = "" }) => {
  return (
    <div className={`flex flex-wrap gap-2 mb-6 ${className}`} role="navigation" aria-label="Ações rápidas">
      {actions.map((action) => {
        const Icon = action.icon;
        const variantClass = {
          primary: "bg-primary-600 hover:bg-primary-700 text-white shadow-glow-blue focus-visible:ring-primary-500",
          secondary: "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 focus-visible:ring-slate-500",
          ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 focus-visible:ring-slate-400",
        }[action.variant ?? "secondary"];

        return (
          <Link
            key={action.to}
            to={action.to}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClass}`}
          >
            <Icon size={16} aria-hidden="true" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
};

export default QuickActionBar;
```

**Step 2: Usar no `client/Dashboard.tsx`**

```tsx
// Adicionar import:
import { QuickActionBar } from "../../components/dashboard/QuickActionBar";
import { Search, FileText, MessageSquare, PlusCircle } from "lucide-react";
// (Search e FileText já podem estar importados)

// Adicionar após o bloco de greeting, antes das StatsCards:
const clientQuickActions = [
  { label: "Novo pedido", to: "/client/orders/new", icon: PlusCircle, variant: "primary" as const },
  { label: "Buscar serviços", to: "/services", icon: Search, variant: "secondary" as const },
  { label: "Meus pedidos", to: "/client/orders", icon: FileText, variant: "secondary" as const },
  { label: "Mensagens", to: "/client/messages", icon: MessageSquare, variant: "ghost" as const },
];

// No JSX, após o greeting section:
<QuickActionBar actions={clientQuickActions} />
```

**Step 3: Usar no `professional/Dashboard.tsx`**

```tsx
// Adicionar import:
import { QuickActionBar } from "../../components/dashboard/QuickActionBar";
import { PlusCircle, FileText, Calendar, MessageSquare } from "lucide-react";

const proQuickActions = [
  { label: "Criar serviço", to: "/professional/create-service", icon: PlusCircle, variant: "primary" as const },
  { label: "Pedidos recebidos", to: "/professional/services", icon: FileText, variant: "secondary" as const },
  { label: "Agenda", to: "/professional/agenda", icon: Calendar, variant: "secondary" as const },
  { label: "Mensagens", to: "/professional/messages", icon: MessageSquare, variant: "ghost" as const },
];

<QuickActionBar actions={proQuickActions} />
```

**Step 4: Commit**
```bash
git add frontend/src/components/dashboard/QuickActionBar.tsx \
        frontend/src/pages/client/Dashboard.tsx \
        frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat(ux): add QuickActionBar component to client and professional dashboards"
```

---

### Task 12: Adicionar staggered entry animation nos service cards

**Arquivos:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/services/ServiceSearch.tsx`

**Objetivo:** Cards na página de busca entram com um leve delay escalonado (stagger), criando uma sensação de carregamento mais fluida e polida.

**Step 1: Adicionar CSS utility de stagger no index.css**

```css
/* Adicionar no final do arquivo, após @media prefers-reduced-motion: */
/* Staggered animation para grids de cards */
.stagger-children > *:nth-child(1)  { animation-delay: 0ms; }
.stagger-children > *:nth-child(2)  { animation-delay: 50ms; }
.stagger-children > *:nth-child(3)  { animation-delay: 100ms; }
.stagger-children > *:nth-child(4)  { animation-delay: 150ms; }
.stagger-children > *:nth-child(5)  { animation-delay: 200ms; }
.stagger-children > *:nth-child(6)  { animation-delay: 250ms; }
.stagger-children > *:nth-child(7)  { animation-delay: 300ms; }
.stagger-children > *:nth-child(8)  { animation-delay: 350ms; }
.stagger-children > *:nth-child(9)  { animation-delay: 400ms; }
.stagger-children > *:nth-child(10) { animation-delay: 450ms; }
.stagger-children > *:nth-child(11) { animation-delay: 500ms; }
.stagger-children > *:nth-child(12) { animation-delay: 550ms; }

.stagger-children > * {
  animation: page-enter 0.3s ease-out both;
}
```

**Step 2: Aplicar classe no grid de ServiceSearch**

```tsx
// BUSCAR o grid de cards no ServiceSearch.tsx (deve ter algo como):
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ...">
  {services.map(service => <ServiceCard ... />)}
</div>

// ADICIONAR "stagger-children" ao className do grid:
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger-children">
  {services.map(service => <ServiceCard ... />)}
</div>
```

**Step 3: Commit**
```bash
git add frontend/src/index.css frontend/src/pages/services/ServiceSearch.tsx
git commit -m "feat(ux): add staggered entry animation on service card grid"
```

---

### Task 13: Criar design doc de referência para o design system do FazTudo

**Arquivos:**
- Create: `docs/plans/2026-02-20-design-system-reference.md`

**Objetivo:** Documentar os tokens, padrões e convenções de design estabelecidos para evitar inconsistências futuras.

**Step 1: Criar o arquivo de referência**

```markdown
# FazTudo Design System Reference

## Paleta de cores
- Primária: `primary-*` (blue-500 = #3b82f6)
- Cinzas: SEMPRE `slate-*` (NUNCA `gray-*`)
- Sucesso: `emerald-*` / `secondary-*`
- Aviso: `amber-*`
- Erro: `red-*`

## Tipografia
- Sans: Satoshi → Inter (fallback)
- Display: Cabinet Grotesk
- Mono: DM Mono

## Spacing
- Grid: 8px base (0.5rem)
- Card padding: 20-24px (p-5/p-6)
- Section gap: 32-64px

## Componentes críticos
- **Botão primário**: `bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500`
- **Card**: `rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl`
- **Badge verificado**: `BadgeCheck text-emerald-500`

## Padrões de acessibilidade obrigatórios
- Todo emoji: `<span aria-hidden="true">emoji</span>`
- Todos os botões interativos: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-{color}-500`
- Touch targets mínimos: 44x44px
- Alt text decorativo: `alt="" role="presentation"`
- Progressbars: `role="progressbar" aria-valuenow aria-valuemin aria-valuemax aria-valuetext`

## Dark mode
- Sempre via `.dark` class (não `prefers-color-scheme` diretamente)
- Pattern: `bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl`
- Bordas: `border-slate-200 dark:border-slate-800/50`
```

**Step 2: Commit**
```bash
git add docs/plans/2026-02-20-design-system-reference.md
git commit -m "docs: add design system reference document with palette, tokens and a11y patterns"
```

---

## Resumo de Impacto por Área

| Área | Tasks | Impacto UX | Impacto A11y |
|------|-------|------------|--------------|
| Onboarding Cliente | 5 | +++ Alto | ++ Médio |
| Onboarding Profissional | 6 | +++ Alto | +++ Alto |
| Landing Cliente | 3, 9 | +++ Alto | + Baixo |
| Landing Profissional | 9 | ++ Médio | - |
| Consistency Visual | 1 | ++ Médio | + Baixo |
| Acessibilidade | 2, 10 | + Baixo | +++ Alto |
| Microinterações | 4, 8, 12 | ++ Médio | + Baixo |
| Dashboards | 7, 11 | +++ Alto | ++ Médio |
| Docs | 13 | - | + Baixo |

## Ordem de Execução Recomendada

**Sprint 1 — Quick Wins (1–3h cada):**
1. Task 1 (paleta gray→slate)
2. Task 2 (a11y emojis, touch targets)
3. Task 4 (prefers-reduced-motion + microinteração CTA)
4. Task 9 (disclaimer ganhos)
5. Task 10 (ServiceCard fixes)

**Sprint 2 — Fluxo principal (2–4h cada):**
6. Task 3 (hero search inline)
7. Task 5 (onboarding cliente 4 passos)
8. Task 6 (onboarding profissional checklist)
9. Task 7 (alert banner pending orders)
10. Task 8 (page transitions)

**Sprint 3 — Polimento (1–2h cada):**
11. Task 11 (QuickActionBar)
12. Task 12 (stagger animation)
13. Task 13 (design system docs)

---

> **Nota:** Nenhuma das tasks acima modifica rotas, schemas de banco, controllers ou serviços backend. São puramente melhorias de UI/UX no frontend, seguras para fazer em branches de feature separadas.
