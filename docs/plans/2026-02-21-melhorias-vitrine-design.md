# Melhorias Vitrine FazTudo — Design Document

> **Data**: 2026-02-21
> **Status**: Aprovado
> **Escopo**: 5 melhorias coordenadas na experiencia de vitrines

---

## Resumo das Decisoes

| # | Melhoria | Decisao |
|---|----------|---------|
| 1 | Layout Explorer | Grid maior, filtros no topo, cards mais informativos |
| 2 | Input R$ | Mascara centavos automatica (componente CurrencyInput) |
| 3 | Tirar Duvida | Botao por servico (remover botao generico do header) |
| 4 | Permissoes | Profissional pode fazer pedidos (CLIENT + PROFESSIONAL) |
| 5 | Meus Servicos → Vitrine | Eliminar catalogo, wizard animado de onboarding |

---

## Secao 1: Melhoria do Layout do Explorer (`/explorar`)

### Problema
- Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` com sidebar `w-56` (fixa) comprime os cards
- StorefrontCard inline tem banner pequeno, descricao limitada a 2 linhas
- Espaco visual desperdicado pela sidebar permanente

### Solucao
- **Remover sidebar fixa** → filtros colapsaveis no topo (barra horizontal) ou sheet lateral toggleavel
- **Grid expandido**: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` com container `max-w-7xl mx-auto`
- **Cards maiores e mais informativos**:
  - Banner gradient maior (h-32 → h-40)
  - Area de info expandida
  - Mostrar ate 3 categorias/servicos populares como tags
  - Rating mais proeminente com numero de avaliacoes
  - Contagem de servicos com icone
- **Mobile**: 1 coluna, cards com altura adequada e filtros em modal

### Arquivos Afetados
- `frontend/src/pages/services/ExplorePage.tsx` — grid, sidebar → header filters, card component

---

## Secao 2: Mascara de Moeda R$ (Centavos Automaticos)

### Comportamento
- Campo comeca: `R$ 0,00`
- Digito '1': `R$ 0,01`
- Digito '5': `R$ 0,15`
- Digito '0': `R$ 1,50`
- Digito '0': `R$ 15,00`
- Digito '0': `R$ 150,00`
- Backspace: `R$ 150,00` → `R$ 15,00` → `R$ 1,50` → `R$ 0,15` → `R$ 0,01` → `R$ 0,00`

### Implementacao
- Componente reutilizavel: `frontend/src/components/common/CurrencyInput.tsx`
- Valor interno em **centavos** (integer) para evitar floating point
- Display formatado com `Intl.NumberFormat("pt-BR")` para separadores corretos (ponto milhar, virgula decimal)
- Prop `onChange(valueInReais: number)` retorna valor em reais para compatibilidade com API
- Props: `value`, `onChange`, `label?`, `error?`, `disabled?`, `className?`

### Substituir em
| Arquivo | Campo |
|---------|-------|
| `StorefrontManager.tsx` | Modal de servico (preco) + Modal de opcao (preco adicional) |
| `NewOrder.tsx` | Campos min/max do range de preco |
| `WithdrawalModal.tsx` | Campo de valor de saque |

**Nota**: CreateService.tsx e EditService.tsx serao removidos (Secao 5A).

---

## Secao 3: Botao "Tirar Duvida" por Servico

### Mudanca
- **Remover**: Botao generico "Tirar duvidas" do header da vitrine (`StorefrontViewPage.tsx` linhas 541-556)
- **Adicionar**: Botao "Tirar Duvida" em cada card de servico na vitrine, ao lado de "Adicionar ao carrinho"

### Fluxo
1. Usuario clica "Tirar Duvida" em servico especifico
2. Se nao autenticado → redirect `/login` com state de retorno
3. Se autenticado → cria DRAFT order referenciando `storefrontServiceId` + `storefrontId`
4. Redireciona para chat do draft order
5. Titulo auto: "Duvida sobre: [nome do servico] — [nome da vitrine]"

### Backend
- Adaptar `createDraftOrder` para aceitar `storefrontServiceId` (alem de `serviceListingId`)
- Validar que o servico pertence a vitrine informada
- Manter comportamento existente para `serviceListingId` (backwards-compatible)

### Arquivos Afetados
- `frontend/src/pages/services/StorefrontViewPage.tsx` — cards de servico, remover botao header
- `backend/src/controllers/service/orderController.ts` — createDraftOrder aceitar storefrontServiceId
- `backend/src/routes/orderRoutes.ts` — ajustar validacao se necessario
- `backend/prisma/schema.prisma` — campo opcional `storefrontServiceId` no ServiceOrder

---

## Secao 4: Permissoes — Profissional Pode Fazer Pedidos

### Regra Atual
- Apenas `role=CLIENT` pode criar pedidos (PENDING) e pedidos via carrinho
- Profissional so pode criar rascunho (DRAFT) para tirar duvidas

### Nova Regra
- **CLIENT e PROFESSIONAL** podem criar pedidos (PENDING) e pedidos via carrinho
- Restricao mantida: nao pode pedir de **si mesmo**
- ADMIN continua sem poder fazer pedidos
- COMPANY segue mesma regra (pode fazer pedidos de outras vitrines)

### Mudancas Backend
| Arquivo | Mudanca |
|---------|---------|
| `orderRoutes.ts` | `requireRole("CLIENT")` → `requireRole("CLIENT", "PROFESSIONAL")` em POST /orders e POST /orders/from-cart |
| `orderController.ts` | Remover check `req.user.role !== "CLIENT"` → check de self-order apenas |

### Mudancas Frontend
- Remover qualquer UI condicional que esconda botao "Fazer Pedido" para profissionais

---

## Secao 5: Eliminar "Meus Servicos" + Wizard de Onboarding

### 5A — Remocao de "Meus Servicos"

**Remover:**
- Item "Meus Servicos" do sidebar profissional (`Layout.tsx`)
- Rotas: `/professional/catalog`, `/professional/catalog/new`, `/professional/catalog/:id/edit` (`App.tsx`)
- Redirecionar quick action "Criar servico" do dashboard para `/professional/vitrine`
- Tour step `tour-create-service-btn` e `tour-create-service-form` apontar para vitrine

**NAO deletar (ainda):**
- Arquivos `CreateService.tsx`, `EditService.tsx`, `ServiceSearch.tsx` — podem ter dependencias
- Modelo `ServiceListing` no Prisma — dados historicos

### 5B — Wizard de Onboarding da Vitrine

**Novo componente**: `frontend/src/pages/professional/StorefrontWizard.tsx`

**Substitui**: `StorefrontSetup.tsx` (form simples de 3 campos: nome, descricao, categoria)

**5 Steps com cards flutuantes animados (CSS animations):**

#### Step 1: Boas-vindas
- Card animado flutuante: "Crie sua vitrine profissional!"
- Breve explicacao do que e uma vitrine
- Botao "Comecar"

#### Step 2: Info Basica
- Foto/logo (upload com preview)
- Nome da vitrine
- Descricao curta (textarea, max 200 chars)
- Horario de funcionamento (seletor de dias + horarios)

#### Step 3: Categoria & Prestacao
- Categoria principal (dropdown das ServiceCategory existentes + opcao "Outro" com input livre)
- Local de prestacao default: enum `HOME | CLIENT | BOTH | ONLINE`
  - "Atendo em meu local"
  - "Vou ate o cliente"
  - "Ambos"
  - "Online/Remoto"
- Tamanho da equipe (numero)
- Tempo medio por servico (seletor: 30min, 1h, 2h, meio dia, dia inteiro, variavel)

#### Step 4: Primeiro Servico
- Nome do servico
- Preco (com CurrencyInput — mascara R$)
- Descricao do servico
- Local de prestacao (herda default da categoria, com override opcional)

#### Step 5: Pronto!
- Preview visual da vitrine (mini-mockup)
- Opcoes: [Publicar agora] ou [Personalizar mais →]
- "Personalizar mais" leva ao StorefrontManager para adicionar categorias, mais servicos, opcoes

**Deteccao automatica:** Quando profissional acessa `/professional/vitrine` e nao tem storefront → redireciona para wizard

### Novos Campos no Schema Prisma

**Storefront:**
```
serviceLocation  String?   // HOME, CLIENT, BOTH, ONLINE
teamSize         Int?      // default 1
workingHours     String?   // JSON string: {"mon": {"from": "08:00", "to": "18:00"}, ...}
averageServiceTime String? // "30min", "1h", "2h", "half_day", "full_day", "variable"
```

**StorefrontService:**
```
serviceLocation  String?   // Nullable — herda do Storefront se null
```

---

## Ordem de Implementacao Sugerida

1. **CurrencyInput** (sem dependencia, reutilizado por tudo)
2. **Permissoes de pedido** (backend, mudanca pontual)
3. **Tirar Duvida por servico** (frontend + backend, depende do CurrencyInput? Nao. Independente)
4. **Eliminar Meus Servicos** (redirecionar rotas/sidebar)
5. **Wizard de Onboarding** (maior complexidade, depende de CurrencyInput + novos campos Prisma)
6. **Layout Explorer melhorado** (pode ser feito em paralelo, independente)

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| ServiceListings existentes ficam orfas | NAO deletar modelo/dados, apenas rotas de criacao |
| Wizard complexo demais | CSS animations simples (transform + opacity), sem lib pesada |
| Mascara de moeda com edge cases | Testar: 0, valores grandes (>999.999), paste, mobile keyboards |
| Profissional fazendo pedido de si mesmo | Check backend ja existe para draft, replicar para orders |
