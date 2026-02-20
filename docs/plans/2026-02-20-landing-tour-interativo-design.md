# Landing Page Refactor + Tutorial Interativo Design

> **Versão**: 1.0 — 2026-02-20
> **Escopo**: Remoção do "Como funciona" da landing de clientes, substituição por fluxo visual 3 etapas, e implementação de tour interativo global para clientes e profissionais.

---

## 1. Resumo Executivo

### Problema
- `HowItWorksInteractive` na `LandingPageUser` usa `bg-gray-900` (fora do design system), emojis sem `aria-hidden`, e nomes de steps estranhos ("Encontre o", "Faça seu", "Acompanhe e").
- Os tutoriais de boas-vindas (`ClientOnboarding`, `ProfessionalOnboarding`) são cards inline no dashboard — passivos, não guiam o usuário na plataforma real.
- Nenhum tour interativo existe para profissionais no fluxo de KYC e simulação de pedido.

### Solução
1. **Remover** `HowItWorksInteractive` da landing de clientes.
2. **Substituir** por seção "Fluxo em 3 etapas" — visual coeso com o design system.
3. **Implementar** `TourContext` global + `TourSpotlight` component para tours interativos que navegam entre páginas reais, com cards flutuantes e setas.
4. **Remover** os componentes `ClientOnboarding` e `ProfessionalOnboarding` inline (substituídos pelo tour global).

---

## 2. Mudanças na Landing Page (`LandingPageUser.tsx`)

### 2.1 Remoção
- Remove `<HowItWorksInteractive />` e o import correspondente.
- Remove o link `href="#como-funciona"` do nav header.
- Arquivo `frontend/src/components/landing/HowItWorksInteractive.tsx` pode ser deletado (não usado em `LandingPageProfessional`).

### 2.2 Nova seção: "Fluxo em 3 etapas"

**Posição**: Entre a seção de categorias e o trust banner (onde `HowItWorksInteractive` estava).

**Visual**: Segue o design system — `bg-slate-50 dark:bg-slate-950`, cards `bg-white dark:bg-slate-900/60`, bordas `border-slate-200 dark:border-slate-800/50`, ícones Lucide sem emojis.

**Estrutura**:
```
Seção: py-16 bg-slate-50 dark:bg-slate-950

  Título: "Como contratar em 3 passos"
  Subtítulo: "Simples, rápido e com pagamento protegido."

  Grid 3 colunas (md:grid-cols-3):

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ [1] Search icon  │  │ [2] ShoppingBag  │  │ [3] CheckCircle  │
  │  Busque e         │  │  Solicite com    │  │  Confirme e      │
  │  compare          │  │  segurança       │  │  avalie          │
  │                  │  │                  │  │                  │
  │ Encontre profis- │  │ O pagamento fica │  │ Só libera o $    │
  │ sionais com ava- │  │ em escrow até    │  │ quando você      │
  │ liações reais    │  │ você aprovar     │  │ estiver feliz    │
  └──────────────────┘  └──────────────────┘  └──────────────────┘

  Conector visual: linha horizontal tracejada entre os cards (hidden em mobile)
  Número do passo: badge circular no topo-esquerdo de cada card
```

**Componente criado**: `frontend/src/components/landing/HowItWorksSimple.tsx`

---

## 3. Remoção dos Onboardings Inline

- `ClientOnboarding.tsx`: componente removido da `client/Dashboard.tsx`. O arquivo pode ser mantido ou deletado.
- `ProfessionalOnboarding.tsx`: componente removido da `professional/Dashboard.tsx`. O arquivo pode ser mantido ou deletado.
- As flags de localStorage `faztudo_client_onboarding_done` e `faztudo_pro_onboarding_done` são substituídas por `faztudo_client_tour_done` e `faztudo_pro_tour_done` (usadas pelo novo TourContext).

---

## 4. Sistema de Tour Interativo Global

### 4.1 Arquitetura

```
App.tsx
├── TourProvider (wraps tudo)
│   └── TourSpotlight (renderizado via portal, position:fixed, z-index:9999)
├── AuthProvider
└── ... rotas
```

### 4.2 `TourContext` (`frontend/src/context/TourContext.tsx`)

**Estado:**
```typescript
interface TourState {
  isActive: boolean;
  tourId: 'client' | 'professional' | null;
  currentStep: number;
  totalSteps: number;
}
```

**Actions:**
```typescript
startTour(tourId: 'client' | 'professional'): void
nextStep(): void
prevStep(): void
skipTour(): void   // marca como feito no localStorage, fecha
completeTour(): void  // marca como feito, fecha com celebração
```

**localStorage keys:**
- `faztudo_client_tour_done` → `"1"` quando concluído
- `faztudo_pro_tour_done` → `"1"` quando concluído

**Gatilhos (nos dashboards):**
- `client/Dashboard.tsx`: `useEffect` que chama `startTour('client')` se `!localStorage.getItem('faztudo_client_tour_done')`
- `professional/Dashboard.tsx`: `useEffect` que chama `startTour('professional')` se `!localStorage.getItem('faztudo_pro_tour_done')`

### 4.3 `TourSpotlight` Component (`frontend/src/components/common/TourSpotlight.tsx`)

**Responsabilidades:**
1. Ler o passo atual do `TourContext`
2. Buscar o elemento alvo via `document.querySelector('[data-tour="step-id"]')`
3. Calcular posição via `getBoundingClientRect()`
4. Renderizar via `ReactDOM.createPortal` em `document.body`
5. Aplicar highlight no elemento alvo (outline ring)
6. Navegar para a rota correta se o passo exigir

**Partes renderizadas:**
```
[1] Backdrop semitransparente: position:fixed inset-0 bg-black/50 z-[9998]
    pointer-events-none (não bloqueia cliques além do card)

[2] Card flutuante: position:fixed, calculado pelo getBoundingClientRect do alvo
    z-[9999], pointer-events-all

[3] Seta SVG: triângulo apontando para o alvo, cor combinando com o card
```

**Visual do card (design system compliant):**
```tsx
// Tailwind classes
"rounded-2xl border border-slate-200 dark:border-slate-800/50
 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl
 dark:shadow-glow-blue shadow-2xl p-5 w-80 max-w-[calc(100vw-2rem)]"
```

**Conteúdo do card:**
```
┌─────────────────────────────────────────┐
│  [ícone Lucide]  Passo X de Y    [X]    │
│  ─────────────────────────────          │
│  Título do passo (font-semibold)        │
│  Descrição instrutiva (text-sm          │
│  text-slate-600 dark:text-slate-400)    │
│                                         │
│  [Pular tour]          [Próximo →]      │
│  (ghost, text-slate-500)  (btn-primary) │
└─────────────────────────────────────────┘
```

**Indicador de progresso**: linha de pontinhos `●●○○○` — `currentStep` em `primary-500`, restantes em `slate-200`.

**Detecção de overflow**: se o card ficaria fora da tela, inverte o lado.

**Passos sem alvo** (simulação do profissional): o card é centralizado na tela (`top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`) sem backdrop overlay, sem seta. Mostra um mini-mockup visual de pedido fictício dentro do card.

### 4.4 Definição dos Passos

#### Tour do Cliente (`TOUR_CLIENT_STEPS`)

| # | targetId | rota | icon | título | descrição |
|---|----------|------|------|--------|-----------|
| 1 | `tour-client-welcome` | `/client/dashboard` | `Sparkles` | Bem-vindo ao FazTudo! | Este é seu painel. Aqui você acompanha tudo. |
| 2 | `tour-search-services` | `/client/dashboard` | `Search` | Busque profissionais | Clique aqui para encontrar profissionais por categoria ou serviço. |
| 3 | `tour-service-card-first` | `/services` | `Star` | Compare avaliações | Veja avaliações, preços e o perfil de cada profissional antes de contratar. |
| 4 | `tour-service-chat-btn` | `/services/:id` | `MessageCircle` | Tire dúvidas antes | Use o chat para conversar com o profissional antes de solicitar. |
| 5 | `tour-request-service-btn` | `/services/:id` | `ShoppingBag` | Solicite o serviço | Quando estiver pronto, clique aqui para criar seu pedido. |
| 6 | `tour-new-order-btn` | `/client/dashboard` | `Plus` | Ou solicite direto | Não achou o que precisa? Clique em "Novo Serviço" e descreva o que você quer. |

**Fluxo de navegação:**
- Passo 1-2: `/client/dashboard`
- Passo 3: navega para `/services`
- Passo 4-5: navega para `/services` e espera usuário clicar em um card (ou avança automaticamente após 3s)
- Passo 6: volta para `/client/dashboard`

**Nota sobre passo 4-5**: como o ID do serviço é dinâmico, o tour injetará o `data-tour` nos primeiros botões da listagem de serviços em vez de depender de uma rota específica.

#### Tour do Profissional (`TOUR_PROFESSIONAL_STEPS`)

| # | targetId / modo | rota | icon | título | descrição |
|---|-----------------|------|------|--------|-----------|
| 1 | `tour-pro-welcome` | `/professional/dashboard` | `Sparkles` | Bem-vindo, profissional! | Este é seu painel. Para ter acesso completo, você precisa verificar sua identidade. |
| 2 | `tour-kyc-cta` | `/professional/dashboard` | `BadgeCheck` | Complete a verificação | Clique aqui para enviar seus documentos. É rápido e garante mais confiança para seus clientes. |
| 3 | `tour-verify-form` | `/verify-account` | `FileText` | Envie seus documentos | Preencha seus dados e envie uma foto do documento. Você será notificado por email. |
| 4 | `tour-create-service-btn` | `/professional/dashboard` | `Briefcase` | Crie seu primeiro serviço | Enquanto aguarda a verificação, você já pode criar seus serviços. |
| 5 | `tour-create-service-form` | `/professional/create-service` | `Edit` | Descreva seu serviço | Adicione título, descrição, preço e fotos. Serviços detalhados recebem mais pedidos. |
| 6 | modal-simulação | `/professional/dashboard` | `Clock` | Simulação: pedido recebido | (mini-card fictício) Você acabou de receber um pedido! Após o dia agendado, você tem **15 minutos** para chegar ao local. |
| 7 | modal-simulação | `/professional/dashboard` | `MapPin` | Navegue até o cliente | Use o mapa integrado para ver a rota até o endereço do cliente. |
| 8 | modal-simulação | `/professional/dashboard` | `CheckCircle` | Confirme a conclusão | Ao terminar, confirme o serviço. O cliente também confirma. O pagamento fica em escrow até os dois confirmarem. |
| 9 | modal-simulação | `/professional/dashboard` | `Wallet` | Pagamento liberado! | Na simulação paramos aqui. Na realidade, o valor (90%) vai para sua carteira. Agora você está pronto! |

**Passos 6-9**: renderizados como cards centralizados sem alvo real, com um mini-mockup visual mostrando um pedido fictício do "João Silva — Instalação elétrica".

---

## 5. Adição de `data-tour` nos Componentes Existentes

Cada componente que é alvo do tour precisa receber o atributo `data-tour="id"` correspondente. São mudanças mínimas — apenas adicionar o atributo, sem alterar lógica.

**Componentes modificados:**
| Arquivo | Elemento | `data-tour` adicionado |
|---------|----------|------------------------|
| `client/Dashboard.tsx` | Heading ou wrapper do dashboard | `tour-client-welcome` |
| `client/Dashboard.tsx` | Botão/link "Explorar serviços" ou SearchBar | `tour-search-services` |
| `client/Dashboard.tsx` | Botão "Novo Serviço" | `tour-new-order-btn` |
| `services/ServiceSearch.tsx` | Primeiro ServiceCard do grid | `tour-service-card-first` |
| `services/ServiceDetails.tsx` | Botão de chat | `tour-service-chat-btn` |
| `services/ServiceDetails.tsx` | Botão de solicitar serviço | `tour-request-service-btn` |
| `professional/Dashboard.tsx` | Heading do dashboard | `tour-pro-welcome` |
| `professional/Dashboard.tsx` | Botão/banner de KYC | `tour-kyc-cta` |
| `professional/Dashboard.tsx` | Botão "Criar serviço" | `tour-create-service-btn` |
| `pages/VerifyAccount.tsx` | Form principal | `tour-verify-form` |
| `professional/CreateService.tsx` | Form ou heading | `tour-create-service-form` |

---

## 6. Opção "Rever Tutorial" no Perfil

**Arquivo**: `frontend/src/pages/Profile.tsx` (ou `Settings.tsx`)

Adicionar uma seção simples:
```
Seção: "Tutorial"
[Botão] "Rever tutorial do cliente"   → limpa faztudo_client_tour_done + startTour('client')
[Botão] "Rever tutorial profissional" → limpa faztudo_pro_tour_done + startTour('professional')
```

(Visível apenas para o papel correspondente)

---

## 7. Checklist de Design System

Todos os componentes novos devem seguir:
- [ ] `slate-*` para cinzas (nunca `gray-*`)
- [ ] `bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl`
- [ ] `border-slate-200 dark:border-slate-800/50`
- [ ] `rounded-2xl`
- [ ] `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`
- [ ] Touch targets ≥ 44px
- [ ] `prefers-reduced-motion` respeitado (sem animações automáticas)
- [ ] Emojis com `<span aria-hidden="true">`
- [ ] Testado em dark mode

---

## 8. Arquivos a Criar / Modificar / Deletar

### Criar
- `frontend/src/context/TourContext.tsx`
- `frontend/src/components/common/TourSpotlight.tsx`
- `frontend/src/components/landing/HowItWorksSimple.tsx`

### Modificar
- `frontend/src/pages/LandingPageUser.tsx` — remove `<HowItWorksInteractive>`, adiciona `<HowItWorksSimple>`, remove link do nav
- `frontend/src/pages/client/Dashboard.tsx` — remove `<ClientOnboarding>`, adiciona `data-tour` attrs, inicia tour
- `frontend/src/pages/professional/Dashboard.tsx` — remove `<ProfessionalOnboarding>`, adiciona `data-tour` attrs, inicia tour
- `frontend/src/pages/services/ServiceSearch.tsx` — adiciona `data-tour` no primeiro card
- `frontend/src/pages/services/ServiceDetails.tsx` — adiciona `data-tour` em botões
- `frontend/src/pages/VerifyAccount.tsx` — adiciona `data-tour` no form
- `frontend/src/pages/professional/CreateService.tsx` — adiciona `data-tour` no form
- `frontend/src/App.tsx` — wrappa com `TourProvider`, adiciona `<TourSpotlight />`
- `frontend/src/pages/Profile.tsx` ou `Settings.tsx` — seção "Rever Tutorial"

### Deletar (opcional)
- `frontend/src/components/landing/HowItWorksInteractive.tsx` (se não usada em nenhum outro lugar)
- `frontend/src/components/common/ClientOnboarding.tsx` (substituído)
- `frontend/src/components/common/ProfessionalOnboarding.tsx` (substituído)

---

## 9. Fora do Escopo

- Websocket ou backend para rastrear progresso do tour (tudo no localStorage)
- Animações de confetti ou celebração elaborada
- Tour em mobile (funciona mas não otimizado separadamente — responsividade básica garantida pelo `max-w-[calc(100vw-2rem)]`)
- Landing Page do Profissional (`LandingPageProfessional.tsx`) — não alterada
