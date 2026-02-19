# Admin SPA — Correção de Bugs e Melhorias

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir 5 bugs na nova SPA admin (`admin/`, porta 5174) para que o login funcione, a sidebar apareça, os gráficos do dashboard exibam dados reais, e o ranking de categorias funcione.

**Architecture:** A nova SPA admin em `admin/` é uma aplicação Vite+React separada do frontend principal. Ela já está scaffoldada e com node_modules instalados. Os problemas são todos de integração: endpoint de login errado, mismatch de campos entre backend e frontend, e ausência de ThemeContext (que o AdminLayout não usa, mas a ausência pode causar crash se algo o importar). O backend em `backend/` já tem todos os endpoints necessários implementados.

**Tech Stack:** React 18 + TypeScript + Vite (porta 5174), TailwindCSS 3, Recharts 2.10, Lucide React, Axios — nenhuma nova dependência necessária.

---

## Diagnóstico Completo

### Bug 1 — Login usa `/auth/login` em vez de `/admin/login` (CRÍTICO)
**Arquivo:** `admin/src/context/AuthContext.tsx` linha 96
**Problema:** `api.post("/auth/login", ...)` chama o endpoint genérico de login do frontend. Embora funcione com verificação manual de `role !== "ADMIN"`, o endpoint correto e dedicado é `POST /api/admin/login` (já implementado no backend em `adminRoutes.ts` linha 18).
**Risco:** O endpoint `/auth/login` pode não retornar o mesmo shape de dados (o campo `token` pode ser diferente, e não há `refreshToken` no formato do admin).

### Bug 2 — Chart data: `count` vs `value` e `revenue` vs `value` (CRÍTICO)
**Arquivo:** `admin/src/pages/DashboardPage.tsx` linhas 341-352
**Problema:** O `DashboardPage.tsx` mapeia os dados dos gráficos esperando:
```ts
dailyUsers: Array<{ date: string; count: number }>   // "count"
dailyRevenue: Array<{ date: string; revenue: number }> // "revenue"
```
Mas o backend retorna (verificado em `backend/src/controllers/adminController.ts` linhas 899-904):
```ts
dailyUsers: Array<{ date: string; value: number }>   // "value"
dailyRevenue: Array<{ date: string; value: number }>  // "value"
```
**Resultado:** Os gráficos de Novos Usuários e Receita ficam em branco (todos os pontos = 0).

### Bug 3 — `topCategories` sem campo `count` (MÉDIO)
**Arquivo:** `admin/src/pages/DashboardPage.tsx` linhas 391-396
**Problema:** O `DashboardPage.tsx` usa `cat.count ?? 0` para calcular as barras do ranking, mas o backend retorna apenas `{ id, name }` sem o campo `count` nem `revenue` (verificado em `adminController.ts` linhas 908-911: `categoryStats.map(cat => ({ id: cat.id, name: cat.name }))`).
**Resultado:** O ranking de categorias aparece com todas as barras em 0%.

### Bug 4 — `topCategories` no backend não retorna métricas de negócio (MÉDIO)
**Arquivo:** `backend/src/controllers/adminController.ts` (função `getDashboardStats`)
**Problema:** A query de `topCategories` não conta pedidos por categoria (diferente do que o plano de design especificou). O backend mapeia `categoryStats` sem nenhum número de pedidos.
**Resultado combinado com Bug 3:** Ranking vazio/zerado.

### Bug 5 — ThemeContext ausente na admin SPA (BAIXO — risco futuro)
**Arquivo:** `admin/src/context/` — contém apenas `AuthContext.tsx`
**Problema:** O `AdminLayout.tsx` e `App.tsx` da admin SPA **não usam** ThemeContext (eles não têm toggle de tema implementado além do `dark` fixo no `body` do `index.html`). Portanto hoje não quebra. Porém o plano de design original previa toggle dark/light. Se alguma página futura importar `useTheme`, vai crashar.
**Ação:** Criar ThemeContext mínimo para garantir estabilidade futura.

---

## Phase 1: Correções Críticas (Login + Dados)

### Task 1: Corrigir endpoint de login para `/admin/login`

**Arquivos:**
- Modificar: `admin/src/context/AuthContext.tsx`

**Contexto:** O `AuthContext.tsx` da admin SPA está chamando `/auth/login` (linha 96), que é o endpoint do app principal. O endpoint correto é `/admin/login`, já implementado no backend. O shape de resposta do `/admin/login` retorna `{ user, token, refreshToken }`. O código atual só usa `user` e `token`, então basta mudar o endpoint.

**Step 1: Verificar o shape atual da resposta do endpoint correto**

Run: `grep -A 30 "adminLogin" backend/src/controllers/adminController.ts | head -35`
Expected: ver que o endpoint retorna `{ user: userData, token, refreshToken }`

**Step 2: Modificar a linha de chamada de API no AuthContext**

No arquivo `admin/src/context/AuthContext.tsx`, linha 96, altere:
```typescript
// ANTES:
const response = await api.post<ApiResponse<LoginResponseData>>(
  "/auth/login",
  { email, password }
);
```
Para:
```typescript
// DEPOIS:
const response = await api.post<ApiResponse<LoginResponseData>>(
  "/admin/login",
  { email, password }
);
```

**Step 3: Verificar tipo TypeScript compila sem erros**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros de TypeScript

**Step 4: Commit**

```bash
git add admin/src/context/AuthContext.tsx
git commit -m "fix: admin SPA login now uses /admin/login endpoint instead of /auth/login"
```

---

### Task 2: Corrigir mismatch de campos nos gráficos de usuários e receita

**Arquivos:**
- Modificar: `admin/src/pages/DashboardPage.tsx`

**Contexto:** O backend retorna `{ date, value }` para ambos `dailyUsers` e `dailyRevenue`. O `DashboardPage.tsx` mapeia esperando `.count` (para usuários) e `.revenue` (para receita). Precisa mudar o mapeamento para usar `.value`.

**Step 1: Localizar as linhas de mapeamento problemáticas**

Run: `grep -n "count\|revenue" admin/src/pages/DashboardPage.tsx | head -20`
Expected: ver linhas ~341-352 com `p.count` e `p.revenue`

**Step 2: Corrigir o mapeamento de `dailyUsers`**

No arquivo `admin/src/pages/DashboardPage.tsx`, localize (linhas ~340-345):
```typescript
// ANTES:
const dailyUsersData =
  d?.charts?.dailyUsers?.map((p: { date: string; count: number }) => ({
    name: formatDateShort(p.date),
    usuarios: p.count,
  })) ?? [];
```
Substitua por:
```typescript
// DEPOIS:
const dailyUsersData =
  d?.charts?.dailyUsers?.map((p: { date: string; value: number }) => ({
    name: formatDateShort(p.date),
    usuarios: p.value,
  })) ?? [];
```

**Step 3: Corrigir o mapeamento de `dailyRevenue`**

Ainda em `admin/src/pages/DashboardPage.tsx`, localize (linhas ~347-353):
```typescript
// ANTES:
const dailyRevenueData =
  d?.charts?.dailyRevenue?.map(
    (p: { date: string; revenue: number }) => ({
      name: formatDateShort(p.date),
      receita: p.revenue,
    })
  ) ?? [];
```
Substitua por:
```typescript
// DEPOIS:
const dailyRevenueData =
  d?.charts?.dailyRevenue?.map(
    (p: { date: string; value: number }) => ({
      name: formatDateShort(p.date),
      receita: p.value,
    })
  ) ?? [];
```

**Step 4: Também corrigir o tipo do `DashboardData` interface (linhas ~39-43)**

No topo do arquivo, localize:
```typescript
// ANTES:
charts: {
  dailyUsers: Array<{ date: string; count: number }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
};
```
Substitua por:
```typescript
// DEPOIS:
charts: {
  dailyUsers: Array<{ date: string; value: number }>;
  dailyRevenue: Array<{ date: string; value: number }>;
};
```

**Step 5: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 6: Commit**

```bash
git add admin/src/pages/DashboardPage.tsx
git commit -m "fix: correct chart data field names (count->value, revenue->value) to match backend response"
```

---

### Task 3: Corrigir backend para retornar contagem de pedidos por categoria

**Arquivos:**
- Modificar: `backend/src/controllers/adminController.ts`

**Contexto:** O backend está calculando `categoryStats` mas não retornando o número de pedidos concluídos por categoria. A query já busca os dados necessários mas o `.map()` não os inclui no retorno. Precisa adicionar `count` ao retorno do `topCategories`.

**Step 1: Verificar a query atual de categories no backend**

Run: `grep -n -A 20 "categoryStats\|topCategories" backend/src/controllers/adminController.ts | head -40`
Expected: ver a query `findMany` com `serviceListings.serviceOrders` e o `.map()` que só retorna `{ id, name }`

**Step 2: Verificar o schema Prisma para confirmar a relação**

Run: `grep -A 5 "serviceListings\|ServiceListing" backend/prisma/schema.prisma | head -20`
Expected: ver que `ServiceCategory` tem `serviceListings ServiceListing[]` e `ServiceListing` tem `serviceOrders ServiceOrder[]`

**Step 3: Modificar a query de categoryStats para incluir contagem**

No `backend/src/controllers/adminController.ts`, localize a query `categoryStats` dentro do `Promise.all`. O bloco atual é:
```typescript
prisma.serviceCategory.findMany({
  select: {
    id: true,
    name: true,
    serviceListings: {
      select: {
        serviceOrders: {
          where: { status: "COMPLETED", updatedAt: { gte: startDate } },
          select: { price: true },
        },
      },
    },
  },
}),
```

Não é necessário mudar a query, apenas o mapeamento. Localize o bloco `topCategories` (após os awaits do Promise.all):

```typescript
// ANTES:
const topCategories = categoryStats.map((cat) => ({
  id: cat.id,
  name: cat.name,
}));
```

Substitua por:
```typescript
// DEPOIS:
const topCategories = categoryStats
  .map((cat) => {
    const count = cat.serviceListings.reduce(
      (sum, listing) => sum + listing.serviceOrders.length,
      0
    );
    return { id: cat.id, name: cat.name, count };
  })
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);
```

**Step 4: Verificar TypeScript do backend**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 5: Commit**

```bash
git add backend/src/controllers/adminController.ts
git commit -m "fix: topCategories now includes order count and sorts by most active category"
```

---

### Task 4: Corrigir frontend para usar `count` do topCategories

**Arquivos:**
- Modificar: `admin/src/pages/DashboardPage.tsx`

**Contexto:** Com o backend agora retornando `{ id, name, count }`, o frontend já usa `cat.count ?? 0` corretamente (linha ~678). Mas a interface `DashboardData` na linha ~48 precisa ser atualizada para refletir o campo `count` como obrigatório.

**Step 1: Verificar a interface `DashboardData` atual**

Run: `grep -n "topCategories" admin/src/pages/DashboardPage.tsx`
Expected: ver `topCategories: Array<{ id: number; name: string; count?: number }>;`

**Step 2: Tornar `count` não-opcional**

No arquivo `admin/src/pages/DashboardPage.tsx`, localize (linha ~48):
```typescript
// ANTES:
topCategories: Array<{ id: number; name: string; count?: number }>;
```
Substitua por:
```typescript
// DEPOIS:
topCategories: Array<{ id: number; name: string; count: number }>;
```

**Step 3: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add admin/src/pages/DashboardPage.tsx
git commit -m "fix: topCategories.count is now required (non-optional) in DashboardData type"
```

---

## Phase 2: Estabilidade e Infraestrutura

### Task 5: Criar ThemeContext mínimo para a admin SPA

**Arquivos:**
- Criar: `admin/src/context/ThemeContext.tsx`
- Modificar: `admin/src/App.tsx`

**Contexto:** A admin SPA não tem ThemeContext. O `index.html` já tem `body class="dark"` fixo. Vamos criar um ThemeContext funcional que persiste a preferência no localStorage, permitindo que futuras páginas usem `useTheme()` sem crashar.

**Step 1: Criar o ThemeContext**

Criar `admin/src/context/ThemeContext.tsx`:
```tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "faztudo-admin-theme";

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return "dark"; // default dark for admin
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
```

**Step 2: Envolver o App com ThemeProvider**

No arquivo `admin/src/App.tsx`, adicionar import e envolver com ThemeProvider:
```tsx
// Adicionar import no topo:
import { ThemeProvider } from "./context/ThemeContext";

// Envolver o BrowserRouter com ThemeProvider:
const App: React.FC = () => {
  return (
    <ThemeProvider>          {/* ← ADICIONAR */}
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ... existente ... */}
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>          {/* ← ADICIONAR */}
  );
};
```

**Step 3: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add admin/src/context/ThemeContext.tsx admin/src/App.tsx
git commit -m "feat: add ThemeContext to admin SPA with dark/light toggle and localStorage persistence"
```

---

## Phase 3: Verificação Final

### Task 6: Testar o admin SPA completo

**Contexto:** Verificar que todos os bugs estão corrigidos executando a aplicação manualmente.

**Step 1: Iniciar o backend**

Run: `cd backend && npm run dev`
Expected: "Server running on port 3001" nos logs

**Step 2: Iniciar a admin SPA em outro terminal**

Run: `cd admin && npm run dev`
Expected: Vite server running on http://localhost:5174

**Step 3: Acessar o login**

Navegar para: `http://localhost:5174/login`
Expected: Tela de login do "FazTudo Admin" aparece

**Step 4: Fazer login com credenciais admin**

O banco tem um usuário admin criado no seed. Verificar:
Run: `cd backend && node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.user.findFirst({ where: { role: 'ADMIN' }, select: { email: true, name: true } }).then(u => { console.log(u); p.\$disconnect(); })"`
Expected: ver email do admin no banco

Se não existir admin, criar manualmente:
Run: `cd backend && npm run db:seed`

**Step 5: Verificar que a sidebar aparece após o login**

Expected:
- Sidebar esquerda com itens: Dashboard, Usuarios, Verificacoes, Trafego, Disputas, Configuracoes
- Header com nome do admin
- Botão de colapso da sidebar funcional

**Step 6: Verificar Dashboard com dados reais**

Na página Dashboard:
- Selecionar período "30 dias"
- Expected: KPI cards com números (mesmo que 0 se banco vazio)
- Expected: Gráficos de área renderizados (sem "Sem dados no período" se houver dados no banco)
- Expected: Top categorias com barras proporcionais

**Step 7: Verificar TypeScript final de ambos os projetos**

Run: `cd backend && npx tsc --noEmit && cd ../admin && npx tsc --noEmit`
Expected: Sem erros em nenhum dos dois

**Step 8: Commit final**

```bash
git add -A
git commit -m "chore: verify admin SPA fully functional with sidebar, login, and real charts"
```

---

## Resumo dos Bugs Corrigidos

| # | Bug | Arquivo | Impacto |
|---|-----|---------|---------|
| 1 | Login endpoint errado (`/auth/login` → `/admin/login`) | `admin/src/context/AuthContext.tsx` | Login pode falhar com admins criados manualmente |
| 2 | Chart fields mismatch (`count`/`revenue` → `value`) | `admin/src/pages/DashboardPage.tsx` | Gráficos diários sempre em branco |
| 3 | Backend não retorna `count` em topCategories | `backend/src/controllers/adminController.ts` | Ranking de categorias zerado |
| 4 | Frontend usa `count` como opcional quando é obrigatório | `admin/src/pages/DashboardPage.tsx` | Type safety fraca |
| 5 | ThemeContext ausente | `admin/src/context/ThemeContext.tsx` (novo) | Crash se useTheme() for chamado |

## Como Acessar o Admin Após as Correções

- **URL:** `http://localhost:5174` (não confundir com o frontend em 5173)
- **Login:** Use o email/senha do usuário com `role: "ADMIN"` no banco
- **Sidebar:** Aparece automaticamente após o login bem-sucedido
- **Sem relação com o frontend:** A admin SPA é completamente separada
