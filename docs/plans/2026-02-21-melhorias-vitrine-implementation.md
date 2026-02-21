# Melhorias Vitrine FazTudo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Melhorar a experiencia de vitrines com 6 mudancas: CurrencyInput, permissoes, tirar duvida por servico, eliminar "Meus Servicos", wizard de onboarding, e layout do explorer.

**Architecture:** Componente CurrencyInput reutilizavel + mudancas pontuais de permissao no backend + novo wizard de onboarding multi-step + redesign do grid do explorer. Storefront passa a ser o unico sistema de gerenciamento de servicos.

**Tech Stack:** React 19 + TypeScript + Tailwind 4 + Express 5 + Prisma 7 + SQLite

**Design doc:** `docs/plans/2026-02-21-melhorias-vitrine-design.md`

---

## Task 1: Componente CurrencyInput

**Files:**
- Create: `frontend/src/components/common/CurrencyInput.tsx`
- Modify: `frontend/src/utils/formatters.ts` (adicionar helper)

### Step 1: Criar CurrencyInput.tsx

Create `frontend/src/components/common/CurrencyInput.tsx`:

```tsx
import React, { useState, useCallback } from "react";

interface CurrencyInputProps {
  value: number; // valor em reais (ex: 150.00)
  onChange: (valueInReais: number) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  helperText?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  label,
  error,
  disabled = false,
  className = "",
  id,
  name,
  required,
  helperText,
}) => {
  // Converter reais para centavos (integer) para manipulacao interna
  const centavos = Math.round(value * 100);

  const formatDisplay = (cents: number): string => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Permitir: Backspace, Delete, Tab, Escape, Enter, setas
      if (
        ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
      ) {
        if (e.key === "Backspace") {
          e.preventDefault();
          const newCents = Math.floor(centavos / 10);
          onChange(newCents / 100);
        }
        return;
      }

      // Apenas digitos 0-9
      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const newCents = centavos * 10 + digit;

      // Limitar a R$ 999.999,99
      if (newCents > 99999999) return;

      onChange(newCents / 100);
    },
    [centavos, onChange],
  );

  // Bloquear paste e drag
  const handlePaste = (e: React.ClipboardEvent) => e.preventDefault();

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          {label}
          {required && " *"}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm font-medium pointer-events-none">
          R$
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          value={formatDisplay(centavos)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          readOnly={false}
          className={`w-full pl-10 pr-3 py-2.5 rounded-lg border ${
            error
              ? "border-red-500 focus:ring-red-500 focus:border-red-500"
              : "border-slate-300 dark:border-slate-600 focus:ring-primary-500 focus:border-primary-500"
          } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 text-right font-mono`}
        />
      </div>
      {helperText && !error && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default CurrencyInput;
```

### Step 2: Verificar que funciona com build

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros de tipo

### Step 3: Commit

```bash
git add frontend/src/components/common/CurrencyInput.tsx
git commit -m "feat: add CurrencyInput component with automatic cents mask"
```

---

## Task 2: Substituir inputs de preco pelo CurrencyInput

**Files:**
- Modify: `frontend/src/pages/professional/StorefrontManager.tsx` (2 modais)
- Modify: `frontend/src/components/wallet/WithdrawalModal.tsx`
- Modify: `frontend/src/pages/client/NewOrder.tsx`

### Step 1: StorefrontManager — modal de servico (linhas ~970-985)

Em `StorefrontManager.tsx`, substituir o input de preco do servico:

**Adicionar import** no topo:
```tsx
import CurrencyInput from "../../components/common/CurrencyInput";
```

**Substituir** o bloco de input de preco do servico (dentro do modal de servico, label "Preco (R$) *"):

Trocar o `<input type="number">` por:
```tsx
<CurrencyInput
  id="service-price"
  label="Preco (R$)"
  required
  value={parseFloat(serviceForm.price) || 0}
  onChange={(val) => setServiceForm((prev) => ({ ...prev, price: val.toString() }))}
/>
```

**Nota**: O `serviceForm.price` eh string no state. O CurrencyInput recebe number e retorna number, entao converter.

### Step 2: StorefrontManager — modal de opcao (linhas ~1052-1069)

Substituir o input de preco da opcao:
```tsx
<CurrencyInput
  id="option-price"
  label="Preco adicional (R$)"
  value={parseFloat(optionForm.price) || 0}
  onChange={(val) => setOptionForm((prev) => ({ ...prev, price: val > 0 ? val.toString() : "" }))}
  helperText="Valor adicional ao preco do servico. Deixe em R$ 0,00 se sem custo extra."
/>
```

### Step 3: WithdrawalModal — campo de saque

Em `frontend/src/components/wallet/WithdrawalModal.tsx`, adicionar import e substituir o input de valor de saque pelo CurrencyInput.

**Adicionar import:**
```tsx
import CurrencyInput from "../common/CurrencyInput";
```

**Substituir** o bloco do input de saque (que usa type="text" inputMode="decimal" com regex) por:
```tsx
<CurrencyInput
  id="withdrawal-amount"
  label="Valor do saque"
  required
  value={parseFloat(amount) || 0}
  onChange={(val) => setAmount(val > 0 ? val.toString() : "")}
  error={/* manter logica de erro existente */}
/>
```

### Step 4: NewOrder — campos min/max preco

Em `frontend/src/pages/client/NewOrder.tsx`, adicionar import e substituir os campos de range de preco.

**Adicionar import:**
```tsx
import CurrencyInput from "../../components/common/CurrencyInput";
```

**Substituir** campos "Minimo R$" e "Maximo R$" (linhas ~384-401) por dois CurrencyInput lado a lado.

### Step 5: Verificar build

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

### Step 6: Commit

```bash
git add frontend/src/pages/professional/StorefrontManager.tsx frontend/src/components/wallet/WithdrawalModal.tsx frontend/src/pages/client/NewOrder.tsx
git commit -m "feat: replace all price inputs with CurrencyInput mask component"
```

---

## Task 3: Permissoes — Profissional pode fazer pedidos

**Files:**
- Modify: `backend/src/routes/orderRoutes.ts` (linhas 36, 46)
- Modify: `backend/src/controllers/service/orderController.ts` (linha 120)
- Modify: `backend/src/controllers/cartCheckoutController.ts` (verificar)

### Step 1: orderRoutes.ts — rota POST /orders/from-cart

Linha 36: mudar `requireRole("CLIENT")` para `requireRole("CLIENT", "PROFESSIONAL")`

### Step 2: orderRoutes.ts — rota POST /orders

Linha 46: mudar `requireRole("CLIENT")` para `requireRole("CLIENT", "PROFESSIONAL")`

### Step 3: orderController.ts — createServiceOrder role check

Linha 120: mudar `req.user.role !== "CLIENT"` para `req.user.role !== "CLIENT" && req.user.role !== "PROFESSIONAL"`

Tambem adicionar verificacao anti-self-order (profissional nao pode pedir de si mesmo):
```typescript
// After fetching serviceListing (around line 165):
if (serviceListing.professionalId === req.user.id) {
  res.status(403).json(errorResponse("Voce nao pode fazer pedidos dos seus proprios servicos"));
  return;
}
```

### Step 4: cartCheckoutController.ts — verificar se tem check de role

Buscar se existe check `req.user.role !== "CLIENT"` dentro da funcao. Se existir, ajustar da mesma forma. Tambem verificar anti-self-order (storefront.userId !== req.user.id — ja existe conforme pesquisa).

### Step 5: Verificar build backend

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: Sem erros

### Step 6: Rodar testes existentes

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: Todos passam (os testes de order flow podem precisar de ajuste se testam role restriction)

### Step 7: Commit

```bash
git add backend/src/routes/orderRoutes.ts backend/src/controllers/service/orderController.ts backend/src/controllers/cartCheckoutController.ts
git commit -m "feat: allow professionals to place orders on other professionals' services"
```

---

## Task 4: Tirar Duvida por servico na vitrine

**Files:**
- Modify: `backend/prisma/schema.prisma` (campo storefrontServiceId no ServiceOrder)
- Modify: `backend/src/controllers/service/orderController.ts` (createDraftOrder)
- Modify: `frontend/src/pages/services/StorefrontViewPage.tsx` (ServiceItem + header)
- Modify: `frontend/src/services/storefrontService.ts` (ou orderService, onde createDraftOrder e chamado)

### Step 1: Schema — adicionar storefrontServiceId ao ServiceOrder

Em `backend/prisma/schema.prisma`, no modelo `ServiceOrder`, adicionar:

```prisma
  storefrontServiceId Int?
  storefrontService   StorefrontService? @relation("OrderStorefrontService", fields: [storefrontServiceId], references: [id])
```

E no modelo `StorefrontService`, adicionar:
```prisma
  draftOrders  ServiceOrder[] @relation("OrderStorefrontService")
```

### Step 2: Aplicar schema

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: Schema aplicado com sucesso

### Step 3: Backend — createDraftOrder aceitar storefrontServiceId

Em `orderController.ts`, funcao `createDraftOrder` (linha ~1372):

Adicionar `storefrontServiceId` ao destructuring:
```typescript
const { serviceListingId, storefrontServiceId, message } = req.body;
```

Adicionar logica: se `storefrontServiceId` for informado (e `serviceListingId` nao), buscar o StorefrontService e seu Storefront para determinar o profissional:

```typescript
let targetProfessionalId: number;
let targetTitle: string;
let targetPrice: number;

if (storefrontServiceId) {
  const sfService = await prisma.storefrontService.findUnique({
    where: { id: storefrontServiceId },
    include: {
      category: {
        include: {
          storefront: {
            include: { user: { select: SAFE_USER_SELECT } },
          },
        },
      },
    },
  });
  if (!sfService) {
    res.status(404).json(errorResponse("Servico nao encontrado"));
    return;
  }
  if (!sfService.isAvailable) {
    res.status(400).json(errorResponse("Servico indisponivel"));
    return;
  }
  targetProfessionalId = sfService.category.storefront.userId;
  targetTitle = sfService.title;
  targetPrice = sfService.price;

  if (targetProfessionalId === req.user.id) {
    res.status(403).json(errorResponse("Voce nao pode tirar duvidas sobre seus proprios servicos"));
    return;
  }
} else if (serviceListingId) {
  // ... logica existente para serviceListingId ...
} else {
  res.status(400).json(errorResponse("Informe serviceListingId ou storefrontServiceId"));
  return;
}
```

Criar o draft com titulo:
```typescript
title: `Duvida sobre: ${targetTitle}`
```

E incluir `storefrontServiceId` no create:
```typescript
storefrontServiceId: storefrontServiceId || undefined,
```

### Step 4: Frontend — remover botao generico "Tirar duvidas" do header

Em `StorefrontViewPage.tsx`, remover ou comentar o bloco das linhas 540-557 (o `<Link>` com "Tirar duvidas" que mostra toast).

### Step 5: Frontend — adicionar botao "Tirar Duvida" no ServiceItem

No componente `ServiceItem` (linhas 34-182 do StorefrontViewPage.tsx), adicionar um botao "Tirar Duvida" na area de acoes de cada servico.

No expanded view, ao lado do botao "Adicionar" (linhas 170-177), adicionar:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    onAskQuestion(service);
  }}
  className="btn btn-outline btn-sm flex items-center gap-1.5"
>
  <MessageCircle className="w-4 h-4" />
  Tirar duvida
</button>
```

Adicionar prop `onAskQuestion: (service: StorefrontService) => void` no `ServiceItemProps`.

### Step 6: Frontend — handler no StorefrontViewPage

No componente principal `StorefrontViewPage`, adicionar handler:

```tsx
const handleAskQuestion = async (service: StorefrontService) => {
  if (!isAuthenticated) {
    navigate("/login", { state: { from: location.pathname } });
    return;
  }
  try {
    const response = await api.post("/api/services/orders/draft", {
      storefrontServiceId: service.id,
      message: "",
    });
    const draft = response.data.data;
    const basePath = user?.role === "PROFESSIONAL" ? "/professional/services" : "/client/services";
    navigate(`${basePath}/${draft.id}/chat`);
  } catch (err: any) {
    toast.error("Erro", err?.response?.data?.message || "Erro ao iniciar conversa");
  }
};
```

Passar `onAskQuestion={handleAskQuestion}` para cada `<ServiceItem>`.

### Step 7: Verificar build (frontend + backend)

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

### Step 8: Commit

```bash
git add backend/prisma/schema.prisma backend/src/controllers/service/orderController.ts frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "feat: add 'Tirar Duvida' button per service in storefront view"
```

---

## Task 5: Eliminar "Meus Servicos" (Catalogo)

**Files:**
- Modify: `frontend/src/components/Layout.tsx` (remover link sidebar)
- Modify: `frontend/src/App.tsx` (remover/redirecionar rotas)
- Modify: `frontend/src/pages/professional/Dashboard.tsx` (redirecionar quick actions)

### Step 1: Layout.tsx — remover "Meus Servicos" do sidebar

Em `Layout.tsx`, linhas 188-193, remover o objeto:
```tsx
{ path: "/professional/catalog", label: "Meus Servicos", icon: <LayoutGrid /> },
```

Se o import de `LayoutGrid` nao for mais usado em outro lugar, remover do import.

### Step 2: App.tsx — redirecionar rotas de catalogo

Em `App.tsx`, substituir as rotas de catalogo por redirects:

```tsx
// Substituir:
// <Route path="catalog" element={<ServiceSearch showProfessionalCatalog />} />
// <Route path="catalog/new" element={<CreateService />} />
// <Route path="catalog/:id/edit" element={<EditService />} />

// Por:
<Route path="catalog" element={<Navigate to="/professional/vitrine" replace />} />
<Route path="catalog/new" element={<Navigate to="/professional/vitrine" replace />} />
<Route path="catalog/:id/edit" element={<Navigate to="/professional/vitrine" replace />} />
```

Remover imports de CreateService e EditService (linhas 31-32) se nao usados em mais nenhum lugar.

### Step 3: Dashboard.tsx — redirecionar quick actions

Buscar no `Dashboard.tsx` links para `/professional/catalog` ou `/professional/create-service` e trocar por `/professional/vitrine`.

### Step 4: TourContext — atualizar tour steps

Buscar steps `tour-create-service-btn` e `tour-create-service-form` e redirecionar para vitrine.

### Step 5: Verificar build

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

### Step 6: Commit

```bash
git add frontend/src/components/Layout.tsx frontend/src/App.tsx frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat: remove 'Meus Servicos' catalog, redirect all paths to Minha Vitrine"
```

---

## Task 6: Schema Prisma — novos campos Storefront

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/storefrontController.ts` (ou equivalente)
- Modify: `backend/src/routes/storefrontRoutes.ts` (se necessario)

### Step 1: Adicionar campos ao modelo Storefront

Em `schema.prisma`, no modelo `Storefront`, adicionar:

```prisma
  serviceLocation    String?   // HOME, CLIENT, BOTH, ONLINE
  teamSize           Int?      @default(1)
  workingHours       String?   // JSON: {"mon":{"from":"08:00","to":"18:00"}, ...}
  averageServiceTime String?   // "30min", "1h", "2h", "half_day", "full_day", "variable"
```

### Step 2: Adicionar campo ao modelo StorefrontService

```prisma
  serviceLocation    String?   // Nullable — herda do Storefront se null
```

### Step 3: Aplicar schema

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: Schema aplicado com sucesso

### Step 4: Atualizar API de criacao/update de storefront

No controller de storefront, aceitar os novos campos no create e update.

### Step 5: Atualizar API de criacao/update de StorefrontService

Aceitar `serviceLocation` no create e update de servicos da vitrine.

### Step 6: Verificar build

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: Sem erros

### Step 7: Commit

```bash
git add backend/prisma/schema.prisma backend/src/controllers/
git commit -m "feat: add serviceLocation, teamSize, workingHours, averageServiceTime to Storefront schema"
```

---

## Task 7: Wizard de Onboarding da Vitrine

**Files:**
- Create: `frontend/src/pages/professional/StorefrontWizard.tsx`
- Modify: `frontend/src/App.tsx` (rota vitrine/setup)
- Modify: `frontend/src/services/storefrontService.ts` (criar storefront com novos campos)
- Modify: `frontend/src/types/entities.ts` ou `types/` (novos campos no tipo)

### Step 1: Atualizar tipos no frontend

Em `frontend/src/types/`, adicionar os novos campos ao tipo `CreateStorefrontInput`:

```typescript
interface CreateStorefrontInput {
  name: string;
  description?: string;
  mainCategoryId?: number;
  // Novos campos:
  serviceLocation?: "HOME" | "CLIENT" | "BOTH" | "ONLINE";
  teamSize?: number;
  workingHours?: Record<string, { from: string; to: string }>;
  averageServiceTime?: "30min" | "1h" | "2h" | "half_day" | "full_day" | "variable";
  // Primeiro servico (wizard):
  firstServiceName?: string;
  firstServicePrice?: number;
  firstServiceDescription?: string;
  firstServiceLocation?: "HOME" | "CLIENT" | "BOTH" | "ONLINE";
}
```

### Step 2: Criar StorefrontWizard.tsx

Create `frontend/src/pages/professional/StorefrontWizard.tsx`:

Componente multi-step com 5 etapas:

**Estrutura geral:**
```tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Store, ArrowLeft, ArrowRight, Check, Camera, Loader2, Sparkles, MapPin, Clock, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getMainCategories, CategoryWithCounts } from "../../services/categoryService";
import { getMyStorefront, createStorefront } from "../../services/storefrontService";
import CurrencyInput from "../../components/common/CurrencyInput";

const STEPS = [
  { id: "welcome", title: "Boas-vindas" },
  { id: "basic", title: "Info Basica" },
  { id: "category", title: "Categoria" },
  { id: "first-service", title: "Primeiro Servico" },
  { id: "done", title: "Pronto!" },
];

const StorefrontWizard: React.FC = () => {
  const [step, setStep] = useState(0);
  // ... form state, category loading, etc.
  // ... step navigation (next/prev)
  // ... animated floating cards via CSS keyframes
  // ... submit handler que cria storefront + primeiro servico
};
```

**Step 1 - Boas-vindas:**
- Card animado central com icone Store e texto motivacional
- Animacao CSS: `@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }`
- Botao "Comecar →"

**Step 2 - Info Basica:**
- Upload de foto/logo com preview (drag & drop ou click)
- Nome da vitrine (text input, max 100)
- Descricao curta (textarea, max 200)
- Horario de funcionamento (checkboxes dos dias + time inputs from/to)

**Step 3 - Categoria & Prestacao:**
- Dropdown de categorias existentes + opcao "Outro" que abre input text
- Local de prestacao: 4 cards selecionaveis (HOME/CLIENT/BOTH/ONLINE) com icones
- Tamanho da equipe: seletor numerico (1-20)
- Tempo medio: dropdown (30min, 1h, 2h, meio dia, dia inteiro, variavel)

**Step 4 - Primeiro Servico:**
- Nome do servico (text)
- Preco (CurrencyInput)
- Descricao (textarea)
- Local de prestacao (herda default da Step 3, com toggle para override)

**Step 5 - Pronto!:**
- Mini preview da vitrine (nome, descricao, servico)
- Botoes: [Publicar agora] [Personalizar mais →]
- "Publicar" cria storefront como publicada
- "Personalizar" cria como rascunho e redireciona ao StorefrontManager

**Progress bar** no topo mostrando steps com bolinhas preenchidas.

**Animacoes dos cards flutuantes:**
- Cada step tem um ou mais cards decorativos com `animate-[float]` que se movem suavemente
- Transicao entre steps: fade + slide horizontal

### Step 3: App.tsx — trocar StorefrontSetup por StorefrontWizard

Em `App.tsx`, substituir:
```tsx
// De:
<Route path="vitrine/setup" element={<StorefrontSetup />} />
// Para:
<Route path="vitrine/setup" element={<StorefrontWizard />} />
```

Atualizar import correspondente.

### Step 4: StorefrontManager — redirect se nao tem storefront

Verificar que `StorefrontManager.tsx` continua redirecionando para `/professional/vitrine/setup` quando nao encontra storefront (isso ja deve existir).

### Step 5: Verificar build

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

### Step 6: Commit

```bash
git add frontend/src/pages/professional/StorefrontWizard.tsx frontend/src/App.tsx frontend/src/types/ frontend/src/services/storefrontService.ts
git commit -m "feat: add animated StorefrontWizard for first-time storefront onboarding"
```

---

## Task 8: Melhorar Layout do Explorer

**Files:**
- Modify: `frontend/src/pages/services/ExplorePage.tsx`

### Step 1: Redesign do StorefrontCard

Dentro de `ExplorePage.tsx`, o componente inline `StorefrontCard` (linhas 42-122) sera reescrito:

**Novo card design:**
- **Banner maior**: `h-40` com gradient (manter cores baseadas em mainCategory)
- **Avatar maior**: `w-16 h-16` com borda branca, posicionado sobrepondo banner/info
- **Info expandida**:
  - Nome + badge verificado (bold, text-lg)
  - Nome do profissional (text-sm, slate-500)
  - Descricao com 3 linhas (line-clamp-3 em vez de 2)
  - Tags: ate 3 categorias/servicos como badges `bg-primary-50 text-primary-600 text-xs px-2 py-0.5 rounded-full`
  - Rating proeminente: estrela + numero + "(X avaliacoes)"
  - Rodape: "X servicos disponiveis" com icone Package

### Step 2: Redesign do grid e remocao da sidebar

**Substituir layout**: remover sidebar `w-56` e colocar filtros no topo.

**Novo layout:**
```tsx
<div className="container mx-auto px-4 max-w-7xl">
  {/* Search + Filters (horizontal bar) */}
  <div className="mb-6 space-y-4">
    <SearchBar ... />
    {/* Horizontal category pills */}
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button className={`pill ${!selectedCategory ? "active" : ""}`}>Todas</button>
      {categories.map(cat => (
        <button className={`pill ${selectedCategory === cat.id ? "active" : ""}`}>
          {cat.name}
        </button>
      ))}
    </div>
    {/* Sort dropdown inline */}
  </div>

  {/* Grid — agora usa toda a largura */}
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {storefronts.map(sf => <StorefrontCard key={sf.id} storefront={sf} />)}
  </div>
</div>
```

**Category pills** (horizontal scroll): botoes pequenos arredondados com scroll horizontal em mobile, quebra em desktop.

### Step 3: Mobile — manter modal de filtro mas simplificar

O modal de filtro mobile continua existindo (via botao "Filtros" que aparece em md:hidden), mas agora mostra apenas:
- Categorias (lista vertical com checkmark na selecionada)
- Ordenacao
- Botao "Aplicar"

### Step 4: Verificar build

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

### Step 5: Commit

```bash
git add frontend/src/pages/services/ExplorePage.tsx
git commit -m "feat: redesign explorer page with larger cards, horizontal filters, and wider grid"
```

---

## Resumo de Commits

| # | Commit | Escopo |
|---|--------|--------|
| 1 | `feat: add CurrencyInput component with automatic cents mask` | Frontend (1 arquivo novo) |
| 2 | `feat: replace all price inputs with CurrencyInput mask component` | Frontend (3 arquivos) |
| 3 | `feat: allow professionals to place orders on other professionals' services` | Backend (3 arquivos) |
| 4 | `feat: add 'Tirar Duvida' button per service in storefront view` | Full-stack (3+ arquivos) |
| 5 | `feat: remove 'Meus Servicos' catalog, redirect all paths to Minha Vitrine` | Frontend (3 arquivos) |
| 6 | `feat: add serviceLocation, teamSize, workingHours to Storefront schema` | Backend (2+ arquivos) |
| 7 | `feat: add animated StorefrontWizard for first-time storefront onboarding` | Frontend (4+ arquivos) |
| 8 | `feat: redesign explorer page with larger cards, horizontal filters, wider grid` | Frontend (1 arquivo) |

## Dependencias entre Tasks

```
Task 1 (CurrencyInput) ← Task 2 (substituir inputs) ← Task 7 (wizard usa CurrencyInput)
Task 3 (permissoes) — independente
Task 4 (tirar duvida) — independente (mas Task 6 schema deve vir antes se possivel)
Task 5 (eliminar catalogo) — independente
Task 6 (schema novos campos) ← Task 7 (wizard usa novos campos)
Task 8 (explorer layout) — totalmente independente
```

**Ordem de execucao recomendada**: 1 → 2 → 3 → 6 → 4 → 5 → 7 → 8
(Ou paralelizar: [1→2, 3, 5, 8] em paralelo, depois [6→4→7])
