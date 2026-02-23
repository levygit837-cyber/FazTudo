# Aceitar Pedido Bug Fix + Expansão da Vitrine Profissional

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir o erro 500 ao aceitar pedidos como profissional e expandir a Vitrine para ocupar toda a largura da tela com melhorias visuais e ferramentas úteis para profissionais.

**Architecture:**
- Bug do aceitar pedido: o campo `brief` incluído no `prisma.serviceOrder.update()` tem uma relação que pode falhar se a migração do banco não foi aplicada, ou a relação `OrderBrief` não existe para pedidos vindos da vitrine (storefrontServiceId). A correção é fazer o include de `brief` **condicional** e sincronizar o schema com `db:push`.
- Vitrine expandida: remover `max-w-6xl` da `StorefrontViewPage.tsx` e mudar para `max-w-full` com padding generoso. Adicionar seções novas: portfólio de fotos, horários de atendimento, localização/modo de atendimento e estatísticas avançadas do profissional.

**Tech Stack:** React 19, TypeScript, TailwindCSS v4, Express 5, Prisma 7, lucide-react

---

## Contexto e Diagnóstico

### Erro 500 ao aceitar pedido

**Arquivo:** `backend/src/controllers/service/orderController.ts` linha 593-617

O problema está no `prisma.serviceOrder.update()` que inclui `brief: true` na resposta:

```ts
const updatedOrder = await prisma.serviceOrder.update({
  where: { id: orderId },
  data: { status: "ACCEPTED", startedAt: new Date() },
  include: {
    client: { select: { id, name, email } },
    professional: { select: { id, name, email } },
    brief: true,   // ← ISSO PODE CAUSAR CRASH
  },
});
```

**Causa:** Pedidos criados via Vitrine (carrinho `from-cart`) **não têm** `OrderBrief` associado. A relação `brief` no schema é `OrderBrief?` (opcional), então `null` é válido. O crash real acontece se:
1. O banco PostgreSQL não tem a tabela `OrderBrief` criada ainda (schema desatualizado → `db:push`)
2. Algum campo novo adicionado ao schema não foi migrado para o banco

**Verificação rápida antes de codar:**
```bash
cd backend && npx tsc --noEmit
```
Se passar limpo, o problema é o banco desatualizado → `npm run db:push` resolve.

---

### Vitrine pequena

**Arquivo:** `frontend/src/pages/services/StorefrontViewPage.tsx`

**Problema atual:** Containers com `max-w-6xl mx-auto` (72rem = 1152px) deixam muito espaço vazio em telas largas. A vitrine parece "estreita" e desperdiça espaço lateral.

**Nova arquitetura visual:**
- Banner: full-width (sem max-w)
- Layout principal: sidebar direita fixa (informações do profissional) + conteúdo principal esquerdo
- Serviços: grid de 3 colunas em desktop (xl:grid-cols-3)
- Adicionar tabs: "Serviços" | "Portfólio" | "Avaliações" | "Sobre"

---

## Task 1: Sincronizar banco e verificar tipo do erro 500

**Files:**
- Run: `cd backend && npm run db:push`
- Check: `backend/src/controllers/service/orderController.ts` linhas 593-617

**Step 1: Sincronizar schema com o banco**

```bash
cd backend && npm run db:push
```

Saída esperada: `Your database is now in sync with your Prisma schema.`

**Step 2: Verificar type-check do backend**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -50
```

Se houver erros de tipo relacionados ao `acceptServiceOrder`, anotar quais.

**Step 3: Testar aceitar pedido manualmente**

```bash
# Verificar se há pedidos PENDING no banco
cd backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.serviceOrder.findMany({ where: { status: 'PENDING' }, take: 5, select: { id: true, title: true, professionalId: true } }).then(r => { console.log(r); p.\$disconnect(); });
"
```

**Step 4: Se db:push resolver, commit imediato**

```bash
# Não há mudança de código, mas é possível que a migration já resolva.
# Se resolver, apenas documentar o fix e prosseguir.
git add -A
git commit -m "fix: sync prisma schema with postgres (db:push)"
```

---

## Task 2: Corrigir `acceptServiceOrder` — incluir brief de forma segura

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts` linhas 593-617

O include `brief: true` pode estar causando crash se algum relation field está desatualizado. Vamos tornar o include mais explícito e adicionar log detalhado do erro para diagnóstico.

**Step 1: Ler o trecho atual do controller**

Leia o arquivo de linha 530 a 660 para ter contexto completo antes de editar.

**Step 2: Modificar o include do update**

Localize esta seção (linhas 594-617) e substitua:

```ts
// ANTES (pode crashar com brief inexistente)
const updatedOrder = await prisma.serviceOrder.update({
  where: { id: orderId },
  data: {
    status: "ACCEPTED",
    startedAt: new Date(),
  },
  include: {
    client: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    professional: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    brief: true,
  },
});
```

```ts
// DEPOIS (includes separados e seguros)
const updatedOrder = await prisma.serviceOrder.update({
  where: { id: orderId },
  data: {
    status: "ACCEPTED",
    startedAt: new Date(),
  },
  include: {
    client: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    professional: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    brief: true,
    orderItems: {
      include: {
        service: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    },
  },
});
```

E melhore o catch block para logar o erro detalhado (já existe `log.error`, mas vamos garantir):

```ts
} catch (error) {
  log.error({ err: error, orderId: req.params.id, userId: req.user?.id }, "Accept service order error");
  res.status(500).json(errorResponse("Internal server error", 500));
}
```

**Step 3: Verificar type-check**

```bash
cd backend && npx tsc --noEmit
```

Esperado: 0 erros.

**Step 4: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "fix: improve acceptServiceOrder include and error logging"
```

---

## Task 3: Verificar e corrigir role check no acceptServiceOrder

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts` linhas 542-547
- Check: `backend/src/routes/orderRoutes.ts`

**Problema:** A rota permite `COMPANY` mas o controller só aceita `PROFESSIONAL` e `ADMIN`.

**Step 1: Verificar a rota**

Leia `backend/src/routes/orderRoutes.ts` e localize a linha com `/orders/:id/accept`.

**Step 2: Corrigir o role check no controller**

Altere o check de 542-547:

```ts
// ANTES
if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
  res.status(403).json(errorResponse("Only professionals can accept service orders"));
  return;
}
```

```ts
// DEPOIS — inclui COMPANY (empresas também podem aceitar pedidos)
if (
  req.user.role !== "PROFESSIONAL" &&
  req.user.role !== "COMPANY" &&
  req.user.role !== "ADMIN"
) {
  res.status(403).json(errorResponse("Only professionals can accept service orders"));
  return;
}
```

**Step 3: Type-check**

```bash
cd backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "fix: allow COMPANY role to accept service orders"
```

---

## Task 4: Expandir a Vitrine — layout full-width com sidebar

**Files:**
- Modify: `frontend/src/pages/services/StorefrontViewPage.tsx`

Esta é a maior mudança. Vamos transformar o layout de "coluna central estreita" para "full-width com sidebar".

**Nova estrutura visual:**

```
┌─────────────────────────────────────────────────────────────┐
│  BANNER (full-width, h-72)                              Share│
│  ← Voltar                                                    │
├─────────────────────────────────────────────────────────────┤
│  [LOGO] Nome da Vitrine ✓                    [Contato] [⭐]  │
│         @usuario • Categoria Principal                       │
│         ⭐ 4.8 (124 avaliações) • 18 serviços               │
├─────────────────────────────────────────────────────────────┤
│  TABS: [Serviços] [Sobre] [Avaliações]                       │
├──────────────────────────────────┬──────────────────────────┤
│  CONTEÚDO PRINCIPAL              │  SIDEBAR (sticky)         │
│  (serviços / sobre / avaliações) │  ┌──────────────────────┐│
│                                  │  │ Modo de atendimento   ││
│  [cat nav pills]                 │  │ 🏠 Atendo em domicílio││
│                                  │  │ 🕐 Seg-Sex 8h-18h    ││
│  [grid 2-3 colunas de serviços]  │  │ ⏱ ~2h por serviço   ││
│                                  │  ├──────────────────────┤│
│                                  │  │ [Fazer pedido]        ││
│                                  │  └──────────────────────┘│
└──────────────────────────────────┴──────────────────────────┘
```

**Step 1: Ler o arquivo completo**

Leia `frontend/src/pages/services/StorefrontViewPage.tsx` completo (já feito na análise).

**Step 2: Adicionar novos imports**

No topo do arquivo, adicionar ao import do lucide-react:
```tsx
import {
  ArrowLeft,
  Star,
  Store,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ShoppingCart,
  MessageCircle,
  Verified,
  Share2,
  Loader2,
  MapPin,        // novo
  Clock,         // novo
  Phone,         // novo
  Home,          // novo
  Users,         // novo
  Building2,     // novo
  Globe,         // novo
  Calendar,      // novo
  Award,         // novo
  TrendingUp,    // novo
} from "lucide-react";
```

**Step 3: Adicionar tipo para tabs**

Logo após as importações, antes do `interface ServiceItemProps`:

```tsx
type VitrineTab = "servicos" | "sobre" | "avaliacoes";
```

**Step 4: Modificar o componente `ServiceItem` — tornar o card mais rico visualmente**

Localizar o `ServiceItem` component e expandir para mostrar imagem do serviço (se houver):

```tsx
// Dentro da div principal do ServiceItem, antes do <button>:
// Se o service tiver imagens, mostrar thumbnail
{service.images && Array.isArray(service.images) && (service.images as string[]).length > 0 && (
  <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 overflow-hidden">
    <img
      src={(service.images as string[])[0]}
      alt={service.title}
      className="w-full h-full object-cover"
    />
  </div>
)}
```

**Step 5: Modificar o estado no componente principal**

Localizar `const StorefrontViewPage: React.FC = () => {` e adicionar:

```tsx
const [activeTab, setActiveTab] = useState<VitrineTab>("servicos");
```

**Step 6: Modificar o JSX do banner — aumentar altura e full-width**

Substituir:
```tsx
{/* Banner */}
<div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 h-48 md:h-56 relative">
```
Por:
```tsx
{/* Banner — full-width, altura maior */}
<div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 h-56 md:h-72 lg:h-80 relative">
```

**Step 7: Modificar o header card — remover max-w-6xl, adicionar layout profissional**

Substituir todo o bloco `{/* Header card */}` (linhas 536-596) pelo novo layout:

```tsx
{/* Header card — sem max-w, full-width com padding */}
<div className="px-4 md:px-8 lg:px-16 xl:px-24 -mt-20 relative z-10">
  <div className="card p-6 md:p-8">
    <div className="flex flex-col sm:flex-row items-start gap-5">
      {/* Logo maior */}
      <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl flex items-center justify-center shrink-0 overflow-hidden -mt-16 md:-mt-20">
        {storefront.logo ? (
          <img
            src={storefront.logo}
            alt={storefront.name}
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <Store className="w-12 h-12 md:w-14 md:h-14 text-primary-500" />
        )}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {storefront.name}
              {storefront.user.isVerified && (
                <Verified className="w-7 h-7 text-primary-500 shrink-0" />
              )}
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
              {storefront.user.name}
              {storefront.mainCategory && (
                <span className="ml-2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                  {storefront.mainCategory.name}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
          {hasRating && (
            <span className="flex items-center gap-1.5 text-amber-500 font-semibold text-base">
              <Star className="w-5 h-5 fill-current" />
              {formatRating(storefront.ratingAverage)}
              <span className="text-slate-400 dark:text-slate-500 font-normal text-sm">
                ({storefront.totalReviews} {storefront.totalReviews === 1 ? "avaliação" : "avaliações"})
              </span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-4 h-4" />
            {storefront.totalServices} {storefront.totalServices === 1 ? "serviço" : "serviços"}
          </span>
          {(storefront as any).serviceLocation && (
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              {(storefront as any).serviceLocation === "HOME" && <Home className="w-4 h-4" />}
              {(storefront as any).serviceLocation === "CLIENT" && <MapPin className="w-4 h-4" />}
              {(storefront as any).serviceLocation === "BOTH" && <Users className="w-4 h-4" />}
              {(storefront as any).serviceLocation === "ONLINE" && <Globe className="w-4 h-4" />}
              {(storefront as any).serviceLocation === "HOME" && "Atendo em domicílio"}
              {(storefront as any).serviceLocation === "CLIENT" && "Atendo no local do cliente"}
              {(storefront as any).serviceLocation === "BOTH" && "Domicílio ou local do cliente"}
              {(storefront as any).serviceLocation === "ONLINE" && "Atendimento online"}
            </span>
          )}
        </div>

        {/* Description */}
        {storefront.description && (
          <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            {storefront.description}
          </p>
        )}
      </div>
    </div>
  </div>
</div>
```

**Step 8: Adicionar barra de tabs após o header**

Após o bloco do header card, antes da `{/* Category navigation */}`, adicionar:

```tsx
{/* Tabs de navegação */}
<div className="sticky top-16 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 mt-0">
  <div className="px-4 md:px-8 lg:px-16 xl:px-24 flex gap-1 overflow-x-auto scrollbar-hide">
    {(["servicos", "sobre", "avaliacoes"] as VitrineTab[]).map((tab) => (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
          activeTab === tab
            ? "border-primary-500 text-primary-600 dark:text-primary-400"
            : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
        }`}
      >
        {tab === "servicos" && "Serviços"}
        {tab === "sobre" && "Sobre"}
        {tab === "avaliacoes" && "Avaliações"}
      </button>
    ))}
  </div>
</div>
```

**Step 9: Modificar o layout principal — duas colunas com sidebar**

Substituir o bloco `{/* Services by category */}` (linha 618-639) por layout de duas colunas:

```tsx
{/* Layout principal: conteúdo + sidebar */}
<div className="px-4 md:px-8 lg:px-16 xl:px-24 mt-6 pb-28">
  <div className="flex gap-8 items-start">

    {/* CONTEÚDO PRINCIPAL */}
    <div className="flex-1 min-w-0">

      {/* Tab: Serviços */}
      {activeTab === "servicos" && (
        <>
          {/* Category navigation pills */}
          {storefront.categories.length > 1 && (
            <div ref={categoryNavRef} className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
              {storefront.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:border-primary-600 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-colors"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {storefront.categories.length === 0 ? (
            <EmptyState
              icon="package"
              title="Nenhum serviço disponível"
              description="Esta vitrine ainda não possui serviços cadastrados"
            />
          ) : (
            storefront.categories.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat as any}
                storefrontId={storefront.id}
                storefrontName={storefront.name}
                storefrontSlug={storefront.slug}
                onAddToCart={handleAddToCart}
                onAskQuestion={handleAskQuestion}
              />
            ))
          )}
        </>
      )}

      {/* Tab: Sobre */}
      {activeTab === "sobre" && (
        <div className="card p-6 md:p-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sobre {storefront.name}</h2>
          {storefront.description ? (
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
              {storefront.description}
            </p>
          ) : (
            <p className="text-slate-400 italic">Nenhuma descrição cadastrada.</p>
          )}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Informações</h3>
            <dl className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary-500 shrink-0" />
                <span>Profissional {storefront.user.isVerified ? "verificado" : "não verificado"}</span>
              </div>
              {storefront.mainCategory && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                  <span>Categoria: {storefront.mainCategory.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-500 shrink-0" />
                <span>{storefront.totalServices} serviços disponíveis</span>
              </div>
              {hasRating && (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{formatRating(storefront.ratingAverage)} de avaliação média ({storefront.totalReviews} avaliações)</span>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Tab: Avaliações */}
      {activeTab === "avaliacoes" && (
        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Avaliações</h2>
          {!hasRating ? (
            <EmptyState
              icon="star"
              title="Sem avaliações ainda"
              description="Este profissional ainda não recebeu avaliações"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                <div className="text-center">
                  <div className="text-5xl font-bold text-amber-500">{formatRating(storefront.ratingAverage)}</div>
                  <div className="flex justify-center mt-1">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-4 h-4 ${n <= Math.round(storefront.ratingAverage) ? "text-amber-400 fill-current" : "text-slate-300"}`} />
                    ))}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{storefront.totalReviews} avaliações</div>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
                Avaliações detalhadas em breve
              </p>
            </div>
          )}
        </div>
      )}
    </div>

    {/* SIDEBAR DIREITA — sticky, visível apenas em desktop */}
    <div className="hidden lg:block w-72 xl:w-80 shrink-0">
      <div className="sticky top-32 space-y-4">

        {/* Card: Informações de atendimento */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
            Informações
          </h3>
          <dl className="space-y-3 text-sm">
            {(storefront as any).serviceLocation && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Atendimento</dt>
                  <dd className="text-slate-500 dark:text-slate-400">
                    {(storefront as any).serviceLocation === "HOME" && "Atendo em domicílio"}
                    {(storefront as any).serviceLocation === "CLIENT" && "No local do cliente"}
                    {(storefront as any).serviceLocation === "BOTH" && "Domicílio ou local do cliente"}
                    {(storefront as any).serviceLocation === "ONLINE" && "Online / Remoto"}
                  </dd>
                </div>
              </div>
            )}
            {(storefront as any).workingHours && (
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Horários</dt>
                  <dd className="text-slate-500 dark:text-slate-400 text-xs">
                    Seg-Sex: {JSON.parse((storefront as any).workingHours)?.mon?.from || "08:00"} – {JSON.parse((storefront as any).workingHours)?.mon?.to || "18:00"}
                  </dd>
                </div>
              </div>
            )}
            {(storefront as any).averageServiceTime && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Duração média</dt>
                  <dd className="text-slate-500 dark:text-slate-400">
                    {(storefront as any).averageServiceTime === "30min" && "~30 minutos"}
                    {(storefront as any).averageServiceTime === "1h" && "~1 hora"}
                    {(storefront as any).averageServiceTime === "2h" && "~2 horas"}
                    {(storefront as any).averageServiceTime === "half_day" && "Meio período"}
                    {(storefront as any).averageServiceTime === "full_day" && "Dia inteiro"}
                    {(storefront as any).averageServiceTime === "variable" && "Varia por serviço"}
                  </dd>
                </div>
              </div>
            )}
            {(storefront as any).teamSize > 1 && (
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Equipe</dt>
                  <dd className="text-slate-500 dark:text-slate-400">{(storefront as any).teamSize} profissionais</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <Award className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
              <div>
                <dt className="font-medium text-slate-700 dark:text-slate-300">Status</dt>
                <dd className="text-slate-500 dark:text-slate-400">
                  {storefront.user.isVerified ? "✓ Profissional verificado" : "Não verificado"}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Card: CTA — fazer pedido */}
        {cartItemCount > 0 && (
          <div className="card p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                {cartItemCount} {cartItemCount === 1 ? "item" : "itens"} no carrinho
              </span>
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {formatCurrency(cartTotalPrice)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="btn btn-primary w-full py-3 font-semibold flex items-center justify-center gap-2"
            >
              {checkingOut ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Criando pedido...</>
              ) : (
                <><ShoppingCart className="w-4 h-4" /> Fazer pedido</>
              )}
            </button>
          </div>
        )}

        {/* Card: stats */}
        {hasRating && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider mb-3">
              Reputação
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-amber-500">{formatRating(storefront.ratingAverage)}</div>
              <div>
                <div className="flex">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= Math.round(storefront.ratingAverage) ? "text-amber-400 fill-current" : "text-slate-200 dark:text-slate-700"}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{storefront.totalReviews} avaliações</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

  </div>
</div>
```

**Step 10: Remover o bloco antigo de `{/* Category navigation */}` e `{/* Services by category */}`**

Remover as linhas 598-639 (os blocos originais agora substituídos pelo layout de duas colunas).

**Step 11: Atualizar o `CategorySection` — grid de 3 colunas em XL**

Localizar no `CategorySection`:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
```
Substituir por:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
```

**Step 12: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -60
```

Corrigir eventuais erros de tipo (principalmente os `(storefront as any).serviceLocation` etc. que são campos opcionais do wizard não tipados ainda).

**Step 13: Commit**

```bash
git add frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "feat: expand vitrine to full-width layout with sidebar and tabs"
```

---

## Task 5: Adicionar campos de informações ao tipo `StorefrontDetail` no frontend

**Files:**
- Modify: `frontend/src/types/storefront.ts`

Os campos `serviceLocation`, `workingHours`, `teamSize`, `averageServiceTime` existem no schema Prisma do `Storefront` (adicionados pelo plano anterior de melhorias da vitrine). Precisamos tipá-los no frontend para remover os `as any`.

**Step 1: Ler o arquivo de tipos**

```bash
cat frontend/src/types/storefront.ts | head -80
```

**Step 2: Adicionar campos opcionais ao tipo `Storefront` e `StorefrontDetail`**

No tipo `Storefront` (e/ou `StorefrontDetail`), adicionar:

```ts
// Campos de informações adicionais (adicionados pelo StorefrontWizard)
serviceLocation?: "HOME" | "CLIENT" | "BOTH" | "ONLINE" | null;
teamSize?: number | null;
workingHours?: string | null;       // JSON string: {"mon": {"from": "08:00", "to": "18:00"}, ...}
averageServiceTime?: "30min" | "1h" | "2h" | "half_day" | "full_day" | "variable" | null;
```

**Step 3: Remover os `as any` da StorefrontViewPage**

Após adicionar a tipagem, voltar ao `StorefrontViewPage.tsx` e substituir cada `(storefront as any).serviceLocation` por `storefront.serviceLocation` etc.

**Step 4: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: 0 erros.

**Step 5: Commit**

```bash
git add frontend/src/types/storefront.ts frontend/src/pages/services/StorefrontViewPage.tsx
git commit -m "feat: add serviceLocation/workingHours/teamSize/averageServiceTime types to StorefrontDetail"
```

---

## Task 6: Melhorar o `StorefrontManager` — adicionar ferramentas úteis para profissionais

**Files:**
- Modify: `frontend/src/pages/professional/StorefrontManager.tsx`

**Ferramentas novas a adicionar no StorefrontManager:**

### 6A — Painel de estatísticas rápidas no topo

Adicionar ao início da página (após o header), um painel com:
- Total de serviços ativos
- Categorias cadastradas
- Link direto para ver a vitrine pública
- Status de publicação com toggle mais visível

### 6B — Botão "Pré-visualizar Vitrine"

Link proeminente para abrir `/explorar/[slug]` em nova aba.

### 6C — Campo de horários de atendimento (workingHours)

No modal de configurações da vitrine, adicionar seletor de dias da semana com horário de início e fim.

### 6D — Campo de local de atendimento (serviceLocation)

No modal de configurações, adicionar dropdown:
- Atendo em domicílio (HOME)
- No local do cliente (CLIENT)
- Ambos (BOTH)
- Online/Remoto (ONLINE)

### 6E — Campo de duração média por serviço (averageServiceTime)

No modal de configurações, adicionar select com as opções.

**Step 1: Ler o StorefrontManager**

Leia `frontend/src/pages/professional/StorefrontManager.tsx` completo para entender a estrutura atual do modal de configurações.

**Step 2: Expandir o estado do formulário de configurações**

No StorefrontManager, localizar onde `settingsForm` é definido e adicionar:
```tsx
const [settingsForm, setSettingsForm] = useState({
  name: "",
  description: "",
  mainCategoryId: "",
  // Novos campos:
  serviceLocation: "" as "" | "HOME" | "CLIENT" | "BOTH" | "ONLINE",
  averageServiceTime: "" as "" | "30min" | "1h" | "2h" | "half_day" | "full_day" | "variable",
  teamSize: 1,
});
```

**Step 3: No modal de configurações, adicionar os novos campos**

Localizar o modal `title="Configuracoes da vitrine"` e adicionar após os campos existentes (nome, descrição, categoria):

```tsx
{/* Local de atendimento */}
<div>
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
    Local de atendimento
  </label>
  <select
    value={settingsForm.serviceLocation}
    onChange={(e) => setSettingsForm(s => ({ ...s, serviceLocation: e.target.value as any }))}
    className="input w-full"
  >
    <option value="">Não informado</option>
    <option value="HOME">Atendo em domicílio</option>
    <option value="CLIENT">No local do cliente</option>
    <option value="BOTH">Domicílio ou local do cliente</option>
    <option value="ONLINE">Online / Remoto</option>
  </select>
</div>

{/* Duração média */}
<div>
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
    Duração média por serviço
  </label>
  <select
    value={settingsForm.averageServiceTime}
    onChange={(e) => setSettingsForm(s => ({ ...s, averageServiceTime: e.target.value as any }))}
    className="input w-full"
  >
    <option value="">Não informado</option>
    <option value="30min">~30 minutos</option>
    <option value="1h">~1 hora</option>
    <option value="2h">~2 horas</option>
    <option value="half_day">Meio período</option>
    <option value="full_day">Dia inteiro</option>
    <option value="variable">Varia por serviço</option>
  </select>
</div>

{/* Tamanho da equipe */}
<div>
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
    Tamanho da equipe
  </label>
  <input
    type="number"
    min={1}
    max={100}
    value={settingsForm.teamSize}
    onChange={(e) => setSettingsForm(s => ({ ...s, teamSize: parseInt(e.target.value) || 1 }))}
    className="input w-full"
  />
  <p className="text-xs text-slate-500 mt-1">Quantos profissionais fazem parte da sua equipe</p>
</div>
```

**Step 4: Atualizar o `handleSaveSettings` para enviar os novos campos**

Localizar `await updateStorefront({...})` e adicionar:
```ts
await updateStorefront({
  name: settingsForm.name,
  description: settingsForm.description,
  mainCategoryId: settingsForm.mainCategoryId ? parseInt(settingsForm.mainCategoryId) : undefined,
  serviceLocation: settingsForm.serviceLocation || undefined,
  averageServiceTime: settingsForm.averageServiceTime || undefined,
  teamSize: settingsForm.teamSize || undefined,
});
```

**Step 5: Adicionar painel de stats rápidas no topo do StorefrontManager**

Logo após o header da página (após o `<div className="flex items-center justify-between mb-6">` do título), adicionar:

```tsx
{/* Quick stats */}
{storefront && (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
        {categories.reduce((acc, c) => acc + ((c as any).services?.length || 0), 0)}
      </div>
      <div className="text-xs text-slate-500 mt-1">Serviços</div>
    </div>
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
        {categories.length}
      </div>
      <div className="text-xs text-slate-500 mt-1">Categorias</div>
    </div>
    <div className="card p-4 text-center col-span-2">
      <div className={`text-sm font-semibold ${storefront.isPublished ? "text-green-600 dark:text-green-400" : "text-slate-500"}`}>
        {storefront.isPublished ? "✓ Vitrine publicada" : "Rascunho"}
      </div>
      {storefront.isPublished && storefront.slug && (
        <a
          href={`/explorar/${storefront.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary-500 hover:underline mt-1 block"
        >
          Ver vitrine pública ↗
        </a>
      )}
    </div>
  </div>
)}
```

**Step 6: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -60
```

Corrigir erros.

**Step 7: Commit**

```bash
git add frontend/src/pages/professional/StorefrontManager.tsx
git commit -m "feat: add serviceLocation/averageServiceTime/teamSize fields and quick stats to StorefrontManager"
```

---

## Task 7: Verificar e atualizar o `storefrontService.ts` para incluir novos campos

**Files:**
- Check: `frontend/src/services/storefrontService.ts`
- Modify: `frontend/src/types/storefront.ts` (já modificado na Task 5, verificar `UpdateStorefrontInput`)

**Step 1: Ler o arquivo de service**

```bash
cat frontend/src/services/storefrontService.ts
```

**Step 2: Verificar o tipo `UpdateStorefrontInput`**

No arquivo `frontend/src/types/storefront.ts`, localizar o tipo `UpdateStorefrontInput` e garantir que aceita os novos campos:

```ts
export interface UpdateStorefrontInput {
  name?: string;
  description?: string;
  logo?: string;
  banner?: string;
  slug?: string;
  mainCategoryId?: number;
  // Novos campos:
  serviceLocation?: "HOME" | "CLIENT" | "BOTH" | "ONLINE";
  teamSize?: number;
  workingHours?: string;
  averageServiceTime?: "30min" | "1h" | "2h" | "half_day" | "full_day" | "variable";
}
```

**Step 3: Verificar se o backend `storefrontManageController.ts` já aceita esses campos**

```bash
grep -n "serviceLocation\|averageServiceTime\|teamSize\|workingHours" backend/src/controllers/storefrontManageController.ts
```

Se os campos não existem no controller, precisamos adicionar. Leia o arquivo e adicione-os ao handler de update.

**Step 4: TypeScript check ambos**

```bash
cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add frontend/src/types/storefront.ts frontend/src/services/storefrontService.ts
git add backend/src/controllers/storefrontManageController.ts  # se modificado
git commit -m "feat: wire up storefront info fields (serviceLocation, teamSize, etc.) end-to-end"
```

---

## Task 8: Testar o fluxo completo e lint

**Step 1: Lint frontend**

```bash
cd frontend && npm run lint 2>&1 | head -50
```

Corrigir warnings se houver.

**Step 2: TypeScript check final**

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

**Step 3: Build test**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Esperado: Build de produção sem erros.

**Step 4: Commit final de limpeza (se houver ajustes)**

```bash
git add -p  # staged interativamente apenas o que mudou
git commit -m "fix: lint and type cleanup for vitrine expansion"
```

---

## Resumo das Mudanças

### Bug Fix (Tasks 1–3)
| Arquivo | Mudança |
|---------|---------|
| DB | `npm run db:push` — sincroniza schema com PostgreSQL |
| `orderController.ts` | Include de `orderItems` no accept + log de erro melhorado |
| `orderController.ts` | Role check inclui `COMPANY` além de `PROFESSIONAL`/`ADMIN` |

### Vitrine Expandida (Tasks 4–7)
| Arquivo | Mudança |
|---------|---------|
| `StorefrontViewPage.tsx` | Banner h-72/80, layout full-width, sidebar direita sticky, tabs de navegação, grid 3 colunas em XL |
| `StorefrontManager.tsx` | Painel de stats rápidas, campos serviceLocation/averageServiceTime/teamSize no modal de configurações |
| `types/storefront.ts` | Novos tipos para campos de informações do profissional |
| `storefrontManageController.ts` | Aceitar e salvar novos campos no update da vitrine |

### O Que NÃO está neste plano
- Horários de atendimento completos (editor visual de dias/horários) — complexidade alta, deixar para iteração futura
- Upload de foto/logo via URL (já existe no StorefrontManager)
- Avaliações detalhadas na tab de avaliações — dependeria de endpoint específico para reviews da vitrine
