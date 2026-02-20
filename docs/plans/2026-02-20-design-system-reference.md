# FazTudo Design System Reference

> **Versão**: 1.0 — 2026-02-20
> **Propósito**: Guia normativo para garantir consistência visual e acessibilidade em todo o frontend.

---

## Paleta de Cores

| Uso | Classe Tailwind | Hex |
|-----|----------------|-----|
| Primária (blue) | `primary-*` | `primary-500` = #3b82f6 |
| Cinzas de texto/fundo | **SEMPRE `slate-*`** (**NUNCA `gray-*`**) | — |
| Sucesso / Profissional | `emerald-*` / `secondary-*` | `emerald-500` = #10b981 |
| Aviso | `amber-*` | `amber-500` = #f59e0b |
| Erro | `red-*` | `red-500` = #ef4444 |
| Indigo (onboarding pro) | `indigo-*` | `indigo-500` = #6366f1 |

### Regra crítica
```
✅ text-slate-600, bg-slate-100, border-slate-200
❌ text-gray-600, bg-gray-100, border-gray-200
```

---

## Tipografia

| Uso | Família |
|-----|---------|
| Texto corrido | Satoshi → Inter (fallback) |
| Títulos de destaque | Cabinet Grotesk (`.font-display`) |
| Números / monospace | DM Mono (`.font-mono-num`) |

---

## Espaçamento

- **Base**: 8px (0.5rem)
- **Card padding**: `p-5` (20px) ou `p-6` (24px)
- **Gap entre seções**: `gap-6` a `gap-8`
- **Seção vertical**: `py-16` (64px) em landing pages

---

## Componentes Críticos

### Botão Primário
```tsx
className="bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5
           shadow-glow-blue focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-offset-2 focus-visible:ring-primary-500"
```

### Card padrão
```tsx
className="rounded-2xl border border-slate-200 dark:border-slate-800/50
           bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl"
```

### Card dark/glass (landing)
```tsx
className="rounded-2xl backdrop-blur-xl bg-white/5 dark:bg-slate-900/60
           border border-white/10 dark:border-slate-800/50"
```

### Badge verificado
```tsx
<BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
```

### Alert banner de ação
```tsx
className="rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20
           border border-amber-200 dark:border-amber-800/50"
```

---

## Padrões de Acessibilidade Obrigatórios

### Emojis
```tsx
// SEMPRE:
<span aria-hidden="true">💡</span> Texto legível separado
// NUNCA:
💡 Texto colado ao emoji
```

### Focus rings em todos os elementos interativos
```tsx
className="... focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-offset-2 focus-visible:ring-{color}-500"
```

### Touch targets mínimos (WCAG 2.5.5)
```tsx
// Mínimo 44×44px para botões em mobile
className="h-11 w-11 ..."  // ✅
className="h-8 w-8 ..."   // ❌ abaixo de 44px
```

### Imagens decorativas
```tsx
// Imagem cujo contexto é dado por heading/texto adjacente:
<img alt="" role="presentation" loading="lazy" ... />
// Imagem com significado próprio:
<img alt="Descrição descritiva" loading="lazy" ... />
```

### Progressbars
```tsx
role="progressbar"
aria-valuenow={progress}
aria-valuemin={0}
aria-valuemax={100}
aria-valuetext={`${progress}% concluído — ${done} de ${total} tarefas`}
```

### Navegação sem mouse
- Todos os elementos interativos alcançáveis via `Tab`
- `<nav>` com `aria-label` descritivo
- Links "pular para conteúdo": `<a href="#main-content">` no topo do Layout

---

## Animações e Microinterações

### Regras de motion
- Toda animação DEVE ser anulada por `prefers-reduced-motion`
- O arquivo `index.css` tem rule global: `@media (prefers-reduced-motion: reduce) { ... }`

### Transição de página
```tsx
// Layout.tsx — key força remount e re-trigger da animação:
<main key={location.pathname} className="... page-transition">
```

### Hover em CTAs principais
```tsx
className="... hover:-translate-y-0.5 hover:scale-[1.02] transition-all duration-200"
```

### Cards com stagger (grids)
```tsx
className="grid grid-cols-... stagger-grid"  // já definido no CSS
```

---

## Dark Mode

- Sempre via `.dark` class no `<html>` (gerenciado pelo ThemeContext)
- **Nunca** usar `prefers-color-scheme` diretamente em componentes
- Pattern padrão de background:
  ```
  bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl
  ```
- Bordas: `border-slate-200 dark:border-slate-800/50`
- Sombras no dark: preferir `dark:shadow-glow-blue` em elementos de destaque

---

## Estrutura de Arquivos (Frontend)

```
src/
├── components/
│   ├── common/         # Componentes globais reutilizáveis
│   ├── dashboard/      # QuickActionBar, StatsCard, MoneyCard, etc.
│   ├── landing/        # HowItWorksInteractive, FixedSwitchCard, etc.
│   ├── services/       # ServiceCard
│   └── orders/         # Componentes de pedido
├── pages/
│   ├── client/         # Dashboard, ServiceOrders, NewOrder
│   └── professional/   # Dashboard, CreateService, etc.
└── index.css           # Tailwind v4 CSS-first — tokens em @theme {}
```

---

## Checklist de Revisão de Componente Novo

- [ ] Usa `slate-*` para todos os cinzas (nunca `gray-*`)
- [ ] Botões têm `focus-visible:ring-*` explícito
- [ ] Touch targets ≥ 44px em elementos clicáveis
- [ ] Emojis com `<span aria-hidden="true">`
- [ ] Imagens decorativas com `alt="" role="presentation" loading="lazy"`
- [ ] Animações cobertas por `prefers-reduced-motion`
- [ ] Dark mode testado com ThemeContext
