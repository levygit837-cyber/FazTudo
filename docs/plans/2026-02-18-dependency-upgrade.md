# Dependency Upgrade & Modern Best Practices Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Atualizar todas as dependências dos três pacotes (backend, frontend, admin) para suas versões mais recentes e adaptar o código aos breaking changes e melhores práticas modernas.

**Architecture:** Atualização incremental por workspace (backend → frontend → admin), começando pelos pacotes com mais breaking changes (Tailwind v4, React Router v7, React 19, Vite 7). Cada task é independente dentro de seu escopo e commitada separadamente.

**Tech Stack:**
- Backend: Node.js + Express 5 + Zod v4 (já atualizado) + Prisma + Pino + TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + TypeScript 5.9
- Admin: React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 + TypeScript 5.9

---

## Versões Atuais vs. Alvo (Resumo do Inventário)

### Backend
| Pacote | Atual | Alvo | Breaking? |
|--------|-------|------|-----------|
| typescript | ^5.9.3 | ^5.9.3 | ✅ Já na versão mais recente |
| zod | ^4.3.6 | ^4.3.6 | ✅ Já no v4 — mas revisar uso do `message` deprecated |
| prisma / @prisma/client | ^7.3.0 | ^7.4.0 | Patch — update simples |
| pino | ^10.3.1 | ^10.3.1 | ✅ Já atualizado |
| vitest | ^4.0.18 | ^4.0.18 | ✅ Já atualizado |
| @types/node | ^25.2.0 | ^25.2.3 | Patch |

### Frontend
| Pacote | Atual | Alvo | Breaking? |
|--------|-------|------|-----------|
| react / react-dom | ^18.2.0 | ^19.2.4 | ⚠️ MAJOR — ver guia abaixo |
| react-router-dom | ^6.20.0 | react-router ^7.13.0 | ⚠️ MAJOR — mudança de pacote |
| vite | ^5.0.0 | ^7.3.1 | ⚠️ MAJOR — v6 + v7 changes |
| tailwindcss | ^3.3.5 | ^4.1.18 | ⚠️ MAJOR — CSS-first config |
| @vitejs/plugin-react | ^4.2.0 | ^5.1.4 | Minor |
| lucide-react | ^0.292.0 | ^0.574.0 | Minor — ícones renomeados possíveis |
| axios | ^1.6.0 | ^1.13.5 | Minor |
| typescript | ^5.2.2 | ^5.9.3 | Minor |
| @types/react | ^18.2.37 | ^19.2.14 | Match com React 19 |
| autoprefixer | - | REMOVER | Tailwind v4 inclui internamente |

### Admin
| Pacote | Atual | Alvo | Breaking? |
|--------|-------|------|-----------|
| react / react-dom | ^18.2.0 | ^19.2.4 | ⚠️ MAJOR |
| react-router-dom | ^6.20.0 | react-router ^7.13.0 | ⚠️ MAJOR |
| vite | ^5.0.0 | ^7.3.1 | ⚠️ MAJOR |
| tailwindcss | ^3.3.5 | ^4.1.18 | ⚠️ MAJOR |
| recharts | ^2.10.0 | ^3.7.0 | Minor |
| lucide-react | ^0.292.0 | ^0.574.0 | Minor |
| typescript | ^5.2.2 | ^5.9.3 | Minor |

---

## Resumo dos Breaking Changes Críticos

### React 18 → React 19
- `ReactDOM.render()` REMOVIDO → usar `createRoot()` (já feito nos dois apps)
- `findDOMNode()` REMOVIDO → usar refs
- String refs REMOVIDAS → usar callback refs
- `hydrate()` REMOVIDO → usar `hydrateRoot()`
- Novos tipos `@types/react@19` com mudanças nas props de `children`
- `ErrorBoundary` ainda suportado, mas novo `use()` hook disponível
- `React.FC` com `children` agora precisa ser explícito: `React.FC<{ children: React.ReactNode }>`

### React Router v6 → v7
- O pacote `react-router-dom` foi ABOLIDO — agora é só `react-router`
- Todos os imports `from "react-router-dom"` → `from "react-router"`
- `RouterProvider` DOM-specific: `from "react-router/dom"`
- Requer Node >= 20, React >= 18 (ambos satisfeitos)
- `BrowserRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useParams` etc. continuam iguais

### Tailwind CSS v3 → v4
- `tailwind.config.js` **não é mais necessário** — configuração CSS-first via `@theme`
- `postcss.config.cjs` muda: `tailwindcss` + `autoprefixer` → `@tailwindcss/postcss` apenas
- `@tailwind base/components/utilities` → `@import "tailwindcss"`
- Com Vite: instalar `@tailwindcss/vite` como plugin (mais simples que PostCSS)
- `darkMode: "class"` → `@variant dark (&:where(.dark, .dark *));` no CSS
- Cores customizadas migram para `@theme { --color-primary-500: #3b82f6; }`
- Animações customizadas migram para `@theme` e `@keyframes` no CSS
- O arquivo `tailwind.config.js` pode ser mantido temporariamente com `@config "tailwind.config.js";` no CSS

### Vite 5 → Vite 7
- Vite 6: novo Environment API (backward compatible para apps normais)
- Vite 7: remove `splitVendorChunkPlugin` (não usado aqui) e Sass legacy API (não usado)
- Para apps SPA simples como este: upgrade é praticamente não-breaking

### Zod v4 (já no v4) — Limpeza de Código
- `{ message: "..." }` deprecated → `{ error: "..." }` (backend já usa `error:` ✅)
- `ctx.path` removido de `superRefine` — verificar uso
- `z.string()` agora usa `import * as z from "zod"` estilo recomendado

---

## Tasks

### Task 1: Backend — Atualizar Prisma e dependências patch

**Arquivos:**
- Modify: `backend/package.json`

**Contexto:** O backend já está muito bem atualizado (Zod v4, Pino, Vitest v4, TypeScript 5.9). Apenas Prisma precisa de bump de patch. Vamos aproveitar para também verificar que o padrão Zod v4 está sendo seguido corretamente.

**Step 1: Atualizar prisma para ^7.4.0**

```bash
cd /home/levybonito/faztudo-main/backend
npm install prisma@latest @prisma/client@latest @prisma/adapter-libsql@latest
```

**Step 2: Verificar que o TypeScript compila sem erros**

```bash
cd /home/levybonito/faztudo-main/backend
npx tsc --noEmit
```
Esperado: zero erros de tipo

**Step 3: Rodar todos os testes**

```bash
cd /home/levybonito/faztudo-main/backend
npm test
```
Esperado: todos os testes passando

**Step 4: Commit**

```bash
cd /home/levybonito/faztudo-main/backend
git add package.json package-lock.json
git commit -m "chore(backend): update prisma to latest patch version"
```

---

### Task 2: Backend — Auditar e modernizar uso do Zod v4

**Arquivos:**
- Modify: `backend/src/middleware/validation.ts`
- Modify: `backend/src/middleware/validate.ts`

**Contexto:** O backend já usa Zod v4 com `error:` em vez de `message:`. Porém, a documentação Zod v4 recomenda o import estilo `import * as z from "zod"` ao invés de `import { z } from "zod"`. Além disso, devemos verificar que `z.ZodType<any>` seja substituído pelo tipo correto `z.ZodTypeAny` do v4.

**Step 1: Verificar imports e tipagem atual**

```bash
grep -n "from 'zod'" /home/levybonito/faztudo-main/backend/src/middleware/validate.ts
grep -n "from 'zod'" /home/levybonito/faztudo-main/backend/src/middleware/validation.ts
grep -n "ZodType\|ZodTypeAny" /home/levybonito/faztudo-main/backend/src/middleware/validate.ts
```

**Step 2: Atualizar `validate.ts` — tipagem moderna Zod v4**

Em `backend/src/middleware/validate.ts`, substituir o tipo `z.ZodType<any>` pela versão tipada corretamente:

```typescript
// Antes (v3 style)
import { z } from 'zod';
export function validateBody(schema: z.ZodType<any>) {

// Depois (v4 modern style)
import { z } from 'zod';
export function validateBody<T>(schema: z.ZodType<T>) {
```

Também substituir o `(issue: any)` em `extractErrors` pelo tipo correto:

```typescript
// Antes
function extractErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue: any) => ({

// Depois — usar tipo inferido do ZodError
function extractErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
```

**Step 3: Verificar uso de `superRefine` sem `ctx.path` (removido no v4)**

```bash
grep -n "ctx\.path" /home/levybonito/faztudo-main/backend/src/middleware/validation.ts
```

Se existir: remover e ajustar a lógica para não depender de `ctx.path`.

**Step 4: Verificar que TypeScript compila e testes passam**

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit && npm test
```

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main/backend
git add src/middleware/validate.ts src/middleware/validation.ts
git commit -m "refactor(backend): modernize Zod v4 typings in validation middleware"
```

---

### Task 3: Frontend — Upgrade Vite 5 → 7

**Arquivos:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Verify: `frontend/tsconfig.node.json`

**Contexto:** Vite 7 é essencialmente backward compatible para SPAs simples. O maior cuidado é atualizar `@vitejs/plugin-react` junto.

**Step 1: Instalar Vite 7 e @vitejs/plugin-react v5**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install vite@latest @vitejs/plugin-react@latest
```

**Step 2: Verificar `tsconfig.node.json` — Vite 7 usa ES2023+**

Ler o arquivo `frontend/tsconfig.node.json` e garantir que `target` seja pelo menos `"ES2022"`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  }
}
```

**Step 3: Testar o build**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build
```
Esperado: build completa sem erros

**Step 4: Testar dev server**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run dev
```
Esperado: servidor iniciado em http://localhost:5173

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json
git commit -m "chore(frontend): upgrade Vite 5 to 7 with plugin-react v5"
```

---

### Task 4: Frontend — Upgrade TypeScript e @types

**Arquivos:**
- Modify: `frontend/package.json`

**Step 1: Atualizar TypeScript e @types/react para React 19 compatible**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install --save-dev typescript@latest @types/react@latest @types/react-dom@latest
```

**Importante:** `@types/react@19` muda o tipo de `children` — `React.FC` não inclui mais `children` automaticamente. Qualquer componente que receba `children` precisa declarar explicitamente:

```typescript
// Antes (React 18 types)
const MyComp: React.FC = ({ children }) => <div>{children}</div>

// Depois (React 19 types — CORRETO)
const MyComp: React.FC<{ children: React.ReactNode }> = ({ children }) => <div>{children}</div>
```

**Step 2: Rodar type check e encontrar todos os erros de tipo**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | head -50
```

Anotar todos os arquivos com erro de tipo relacionados a `children`.

**Step 3: Corrigir todos os erros de tipo encontrados**

Para cada componente com erro de `children`, adicionar `React.ReactNode` explicitamente na prop:

```typescript
// Padrão para componentes wrapper
interface Props {
  children: React.ReactNode;
  className?: string;
}
const MyComp: React.FC<Props> = ({ children, className }) => ...
```

**Step 4: Verificar que type check passa limpo**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit
```
Esperado: zero erros

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json src/
git commit -m "chore(frontend): upgrade TypeScript and React types to 19-compatible"
```

---

### Task 5: Frontend — Upgrade React 18 → React 19

**Arquivos:**
- Modify: `frontend/package.json`
- Verify: `frontend/src/index.tsx` (já usa `createRoot` ✅)

**Contexto:** O `frontend/src/index.tsx` já usa `createRoot` da `react-dom/client` — sem breaking change aqui. Os principais riscos são em componentes que usam APIs deprecated.

**Step 1: Instalar React 19**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install react@latest react-dom@latest
```

**Step 2: Verificar APIs removidas no React 19**

Checar se algum arquivo usa `findDOMNode`, `render` do react-dom antigo, ou string refs:

```bash
grep -rn "findDOMNode\|ReactDOM\.render\|ReactDOM\.hydrate\|unmountComponentAtNode" /home/levybonito/faztudo-main/frontend/src/
```

Se encontrar: substituir pelas alternativas modernas (refs, createRoot, hydrateRoot).

**Step 3: Verificar `defaultProps` em componentes de função (deprecated)**

```bash
grep -rn "\.defaultProps" /home/levybonito/faztudo-main/frontend/src/
```

Se encontrar em function components, substituir por default parameters:

```typescript
// Antes (deprecated)
MyComp.defaultProps = { size: 'medium' }

// Depois (moderno)
function MyComp({ size = 'medium' }: Props) { ... }
```

**Step 4: Build e type check**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build
```
Esperado: build limpa

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json
git commit -m "chore(frontend): upgrade React 18 to React 19"
```

---

### Task 6: Frontend — Migrar react-router-dom v6 → react-router v7

**Arquivos:**
- Modify: `frontend/package.json`
- Modify: todos os `frontend/src/**/*.tsx` que importam de `react-router-dom` (47 arquivos aprox.)

**Contexto:** Em React Router v7, o pacote `react-router-dom` foi unificado em `react-router`. Todos os imports precisam mudar. O script `sed` ou um codemod pode fazer isso automaticamente.

**Step 1: Desinstalar react-router-dom e instalar react-router**

```bash
cd /home/levybonito/faztudo-main/frontend
npm uninstall react-router-dom
npm install react-router@latest
```

**Step 2: Substituir todos os imports automaticamente com sed**

```bash
# No Linux/Mac:
find /home/levybonito/faztudo-main/frontend/src -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i 's|from "react-router-dom"|from "react-router"|g'

find /home/levybonito/faztudo-main/frontend/src -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i "s|from 'react-router-dom'|from 'react-router'|g"
```

**Step 3: Verificar `RouterProvider` — se usado, migrar para react-router/dom**

```bash
grep -rn "RouterProvider" /home/levybonito/faztudo-main/frontend/src/
```

Se encontrado: mudar import para `from "react-router/dom"`.

**Step 4: Verificar App.tsx — BrowserRouter continua disponível em react-router**

Conferir que `BrowserRouter` está sendo importado corretamente:

```typescript
// Deve estar assim após a substituição
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
```

**Step 5: Type check completo**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit
```
Esperado: sem erros relacionados a router

**Step 6: Build**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build
```

**Step 7: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json src/
git commit -m "chore(frontend): migrate react-router-dom v6 to react-router v7"
```

---

### Task 7: Frontend — Upgrade Tailwind CSS v3 → v4 (maior mudança)

**Arquivos:**
- Modify: `frontend/package.json`
- Modify: `frontend/postcss.config.cjs` → `frontend/postcss.config.mjs` (ou usar plugin Vite)
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css`
- Delete (ou adaptar): `frontend/tailwind.config.js`

**Contexto:** Tailwind v4 usa CSS-first config. O `tailwind.config.js` existente tem cores, fontes, animações e keyframes customizados — tudo precisa migrar para CSS via `@theme`. Usar o `@tailwindcss/vite` plugin é mais simples que PostCSS para projetos Vite.

**Step 1: Instalar Tailwind v4 e @tailwindcss/vite**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install tailwindcss@latest @tailwindcss/vite@latest
npm uninstall autoprefixer
```

**Step 2: Atualizar `vite.config.ts` para usar o plugin Tailwind v4**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
  },
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
})
```

**Step 3: Deletar ou simplificar `postcss.config.cjs`**

Com `@tailwindcss/vite`, o arquivo PostCSS não é necessário para Vite. Deletar:

```bash
rm /home/levybonito/faztudo-main/frontend/postcss.config.cjs
```

**Step 4: Migrar `frontend/src/index.css`**

Substituir os `@tailwind` directives e adicionar config CSS-first.

**O arquivo completo novo deve ser:**

```css
/* Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800,900&f[]=satoshi@400,500,700,900&display=swap');

/* Tailwind v4 — CSS-first import */
@import "tailwindcss";

/* Dark mode via class */
@variant dark (&:where(.dark, .dark *));

/* Theme customization */
@theme {
  /* Fonts */
  --font-family-sans: "Satoshi", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-display: "Cabinet Grotesk", "Satoshi", sans-serif;
  --font-family-mono: "DM Mono", "JetBrains Mono", "Fira Code", monospace;

  /* Primary colors (blue) */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  /* Secondary colors (green) */
  --color-secondary-50: #f0fdf4;
  --color-secondary-100: #dcfce7;
  --color-secondary-200: #bbf7d0;
  --color-secondary-300: #86efac;
  --color-secondary-400: #4ade80;
  --color-secondary-500: #22c55e;
  --color-secondary-600: #16a34a;
  --color-secondary-700: #15803d;
  --color-secondary-800: #166534;
  --color-secondary-900: #14532d;

  /* Slate extra */
  --color-slate-950: #020617;

  /* Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Border radius */
  --radius-4xl: 2rem;

  /* Box shadows */
  --shadow-glow-blue: 0 0 20px rgba(37, 99, 235, 0.15);
  --shadow-glow-blue-md: 0 0 30px rgba(37, 99, 235, 0.2);
  --shadow-glow-blue-lg: 0 0 40px rgba(37, 99, 235, 0.3);
  --shadow-glow-green: 0 0 20px rgba(16, 185, 129, 0.15);
  --shadow-glow-amber: 0 0 20px rgba(245, 158, 11, 0.15);

  /* Animations */
  --animate-glow-pulse: glow-pulse 2s ease-in-out infinite;
  --animate-fade-in: fade-in 0.5s ease-out;
  --animate-slide-up: slide-up 0.5s ease-out;
  --animate-shimmer: shimmer 2s linear infinite;
  --animate-count-up: count-up 0.8s ease-out;
  --animate-pulse-soft: pulse-soft 2s ease-in-out infinite;
  --animate-slide-in-right: slide-in-right 0.3s ease-out;
  --animate-slide-in-left: slide-in-left 0.35s ease-out;
  --animate-step-complete: step-complete 0.4s ease-out;
}

/* Keyframes */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.15); }
  50% { box-shadow: 0 0 30px rgba(37, 99, 235, 0.3); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes count-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(12px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes slide-in-left {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes step-complete {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* ========================================
   BASE STYLES (equivalente ao @layer base)
   ======================================== */
@layer base {
  * {
    @apply border-slate-200;
  }

  html.dark * {
    @apply border-slate-800/50;
  }

  html {
    @apply scroll-smooth;
  }

  body {
    @apply bg-slate-50 text-slate-900 antialiased font-sans;
    line-height: 1.5;
  }

  html.dark body {
    @apply bg-slate-950 text-slate-100;
  }
}
```

> **Nota:** O restante do arquivo `index.css` (componentes customizados, utilitários, etc.) deve ser copiado a partir do `index.css` existente — apenas substituir o cabeçalho `@tailwind` + as variáveis CSS que estavam no `:root` pelo bloco `@theme` acima.

**Step 5: Deletar `tailwind.config.js` (agora obsoleto)**

```bash
rm /home/levybonito/faztudo-main/frontend/tailwind.config.js
```

**Step 6: Testar build**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build
```

Se houver erros de classes Tailwind não reconhecidas, verificar se o nome da classe mudou no v4. Classes comuns que mudam:
- `backdrop-blur-2xl` → continua igual (apenas semântica interna muda)
- `shadow-glow-blue` → agora disponível via `--shadow-*` (mas usar `shadow-[var(--shadow-glow-blue)]` pode ser necessário)

**Step 7: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json vite.config.ts src/index.css
git rm tailwind.config.js postcss.config.cjs 2>/dev/null || true
git commit -m "chore(frontend): migrate Tailwind CSS v3 to v4 CSS-first config"
```

---

### Task 8: Frontend — Atualizar lucide-react e axios

**Arquivos:**
- Modify: `frontend/package.json`
- Verify: componentes que usam ícones do lucide-react

**Contexto:** lucide-react atualizou de v0.292 para v0.574 — alguns ícones podem ter sido renomeados.

**Step 1: Atualizar pacotes**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install lucide-react@latest axios@latest
```

**Step 2: Verificar ícones renomeados mais comuns**

```bash
# Listar todos os ícones usados no projeto
grep -rn "from 'lucide-react'\|from \"lucide-react\"" /home/levybonito/faztudo-main/frontend/src/ | \
  grep -o "{ [^}]* }" | tr ',' '\n' | tr -d '{}' | sort -u
```

Ícones conhecidos renomeados entre v0.292 e v0.5xx:
- `Sliders` → `SlidersHorizontal`
- `ExternalLink` → continua igual
- `ChevronDown` → continua igual

Verificar na [changelog do lucide-react](https://github.com/lucide-icons/lucide/blob/main/CHANGELOG.md) se algum ícone usado foi renomeado.

**Step 3: Build e verificar erros**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build 2>&1 | grep -i "error\|cannot find"
```

**Step 4: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add package.json package-lock.json
git commit -m "chore(frontend): update lucide-react and axios to latest versions"
```

---

### Task 9: Admin — Upgrade completo (espelha frontend)

**Arquivos:**
- Modify: `admin/package.json`
- Modify: `admin/vite.config.ts`
- Delete: `admin/postcss.config.cjs`
- Delete: `admin/tailwind.config.js`
- Modify: `admin/src/index.css`
- Modify: todos os `admin/src/**/*.tsx` com imports de react-router-dom

**Contexto:** O admin tem um conjunto mais simples de dependências. Seguir os mesmos passos de Task 3 a Task 8, mas para o workspace `admin/`.

**Step 1: Instalar todas as atualizações de uma vez**

```bash
cd /home/levybonito/faztudo-main/admin
npm install react@latest react-dom@latest
npm install --save-dev @types/react@latest @types/react-dom@latest typescript@latest
npm install --save-dev vite@latest @vitejs/plugin-react@latest @tailwindcss/vite@latest
npm install tailwindcss@latest react-router@latest recharts@latest lucide-react@latest axios@latest
npm uninstall react-router-dom autoprefixer
```

**Step 2: Migrar imports react-router-dom → react-router**

```bash
find /home/levybonito/faztudo-main/admin/src -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i 's|from "react-router-dom"|from "react-router"|g'
```

**Step 3: Atualizar `admin/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

**Step 4: Migrar `admin/src/index.css` para Tailwind v4**

Substituir o cabeçalho:

```css
/* Antes */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Depois */
@import "tailwindcss";
@variant dark (&:where(.dark, .dark *));

@theme {
  --font-family-sans: "Satoshi", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-display: "Cabinet Grotesk", "Satoshi", sans-serif;
  --font-family-mono: "DM Mono", "JetBrains Mono", "Fira Code", monospace;

  /* Cores Primary (copiar do frontend) */
  --color-primary-50: #eff6ff;
  /* ... (mesmo tema do frontend) ... */
  --color-primary-950: #172554;

  /* Secondary */
  --color-secondary-50: #f0fdf4;
  /* ... */
  --color-slate-950: #020617;

  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Animações do admin */
  --animate-fade-in: fade-in 0.5s ease-out;
  --animate-slide-up: slide-up 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Step 5: Deletar arquivos obsoletos**

```bash
rm /home/levybonito/faztudo-main/admin/tailwind.config.js
rm /home/levybonito/faztudo-main/admin/postcss.config.cjs
```

**Step 6: Type check e build**

```bash
cd /home/levybonito/faztudo-main/admin
npx tsc --noEmit
npm run build
```

**Step 7: Commit**

```bash
cd /home/levybonito/faztudo-main/admin
git add .
git rm tailwind.config.js postcss.config.cjs
git commit -m "chore(admin): full dependency upgrade — React 19, Vite 7, Tailwind v4, RR v7"
```

---

### Task 10: Frontend — Melhores práticas modernas React 19

**Arquivos:**
- Varios arquivos em `frontend/src/`

**Contexto:** Aproveitar o upgrade para React 19 e introduzir melhores práticas modernas.

**Step 1: Criar hook `useApiCall` para padronizar tratamento de erros (prioridade MEDIA do CLAUDE.md)**

Criar `frontend/src/hooks/useApiCall.ts`:

```typescript
import { useState, useCallback } from 'react';
import axios from 'axios';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApiCall<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<T>) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ?? err.message
        : 'Erro inesperado';
      setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, []);

  return { ...state, execute };
}
```

**Step 2: Verificar que o componente ErrorBoundary em index.tsx usa a sintaxe moderna**

Em `frontend/src/index.tsx`, o `ErrorBoundary` pode ser simplificado usando a API moderna. Verificar se está correto e se o `componentDidCatch` usa `console.error` — se sim, notar que no React 19 isso é chamado automaticamente pelo React; podemos remover para simplicidade.

**Step 3: Verificar uso de `React.memo` e `useCallback` onde faz sentido**

```bash
# Identificar componentes que recebem callbacks pesados
grep -rn "onChange\|onSubmit\|onClick" /home/levybonito/faztudo-main/frontend/src/components/ | wc -l
```

Nos componentes com alta frequência de re-render (listas, formulários grandes), garantir que callbacks sejam envolvidos em `useCallback`.

**Step 4: Padronizar Context com `use()` hook do React 19 (opcional/moderno)**

React 19 introduz o hook `use()` para consumir contexts:

```typescript
// Antes (React 18)
const { user, token } = useContext(AuthContext);

// Depois (React 19 — mais ergonômico)
import { use } from 'react';
const { user, token } = use(AuthContext);
```

Avaliar se vale migrar os 3 contexts (Auth, Theme, Toast) para esta sintaxe.

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main/frontend
git add src/hooks/useApiCall.ts src/
git commit -m "feat(frontend): add useApiCall hook and apply React 19 best practices"
```

---

### Task 11: Verificação Final e Atualização do CLAUDE.md

**Arquivos:**
- Verify: todos os três workspaces
- Modify: `CLAUDE.md`

**Step 1: Rodar todos os testes do backend**

```bash
cd /home/levybonito/faztudo-main/backend
npm test
```
Esperado: todos os testes passando

**Step 2: Type check nos três workspaces**

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
cd /home/levybonito/faztudo-main/admin && npx tsc --noEmit
```
Esperado: zero erros nos três

**Step 3: Build dos dois frontends**

```bash
cd /home/levybonito/faztudo-main/frontend && npm run build
cd /home/levybonito/faztudo-main/admin && npm run build
```
Esperado: builds completas sem warning críticos

**Step 4: Atualizar CLAUDE.md**

Atualizar a seção de versões/stack e a lista de melhorias implementadas:

```markdown
# Mudanças registradas após upgrade 2026-02-18:
- React 18 → 19.x (todos os apps)
- react-router-dom v6 → react-router v7 (todos os apps)
- Vite 5 → 7.x (todos os apps)
- Tailwind CSS v3 → v4 CSS-first (todos os apps)
- Prisma 7.3 → 7.4 (backend)
- ✅ Hook useApiCall criado em frontend/src/hooks/useApiCall.ts
- ✅ Tailwind config migrada para CSS-first (sem tailwind.config.js)
- ✅ autoprefixer removido (incluído no Tailwind v4)
```

**Step 5: Commit final**

```bash
cd /home/levybonito/faztudo-main
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with post-upgrade stack versions and improvements"
```

---

## Ordem de Execução Recomendada

```
Task 1  → Backend: Prisma patch update
Task 2  → Backend: Zod v4 modernization
Task 3  → Frontend: Vite 5 → 7
Task 4  → Frontend: TypeScript + @types React 19
Task 5  → Frontend: React 18 → 19
Task 6  → Frontend: react-router-dom v6 → react-router v7
Task 7  → Frontend: Tailwind v3 → v4 (maior risco)
Task 8  → Frontend: lucide-react + axios patch
Task 9  → Admin: tudo de uma vez (espelha frontend)
Task 10 → Frontend: React 19 best practices
Task 11 → Verificação final + docs
```

## Notas de Risco

- **Task 7 (Tailwind v4)** é a de maior risco — pode quebrar classes customizadas. Testar visualmente no browser, não apenas build.
- **Task 6 (React Router v7)** tem muitos arquivos (47 no frontend) — o `sed` automatiza, mas revisar manualmente 5-6 arquivos críticos (App.tsx, ProtectedRoute, etc.)
- **Task 5 (React 19)** — se algum componente de biblioteca de terceiros (recharts, leaflet) não tiver tipagens React 19 compatíveis, pode haver erros de tipo que requerem `skipLibCheck: true` temporariamente.
