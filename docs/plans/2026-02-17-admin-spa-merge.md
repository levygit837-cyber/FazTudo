# Admin SPA Merge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mesclar a funcionalidade exclusiva do `frontend/src/pages/admin/` (verificação de empresas, correções de HTTP) na SPA `admin/` (porta 5174), e remover as páginas admin do frontend principal para deixá-lo mais leve.

**Architecture:** A SPA `admin/` em `admin/` já é completa (Dashboard, Traffic, Users, Verifications, Disputes, Settings com sidebar, Recharts). A única funcionalidade que falta é CompanyVerifications. Além disso, dois endpoints na SPA admin usam o método HTTP errado (`POST`/`PATCH` onde o backend espera `PUT`). O frontend principal terá as páginas admin removidas e o redirect de ADMIN apontará para `http://localhost:5174`.

**Tech Stack:** React 18 + TypeScript + Vite (porta 5174), TailwindCSS 3, Recharts 2.10, Lucide React, Axios. Backend Express 5 em porta 3001.

---

## Phase 1: Correções de HTTP na SPA Admin

### Task 1: Corrigir métodos HTTP incorretos no adminService da SPA

**Arquivos:**
- Modificar: `admin/src/services/adminService.ts`

**Contexto:** O backend expõe `PUT /admin/disputes/:id/resolve` e `PUT /admin/config`, mas a SPA chama `POST` e `PATCH` respectivamente. Isso faz com que DisputesPage e SettingsPage falhem silenciosamente ao tentar salvar.

**Step 1: Verificar os dois mismatches**

Run: `grep -n "api\.post\|api\.patch\|api\.put" admin/src/services/adminService.ts`
Expected: ver `api.post` em `resolveDispute` (linha ~223) e `api.patch` em `updatePlatformConfig` (linha ~238)

**Step 2: Corrigir resolveDispute — POST → PUT**

No arquivo `admin/src/services/adminService.ts`, localizar:
```typescript
// ANTES (linha ~222):
export async function resolveDispute(
  id: number,
  resolution: string,
  action: string
) {
  const res = await api.post<ApiResponse<Dispute>>(
    `/admin/disputes/${id}/resolve`,
    { resolution, action }
  );
  return res.data.data;
}
```
Substituir por:
```typescript
// DEPOIS:
export async function resolveDispute(
  id: number,
  resolution: string,
  action: string
) {
  const res = await api.put<ApiResponse<Dispute>>(
    `/admin/disputes/${id}/resolve`,
    { resolution, action }
  );
  return res.data.data;
}
```

**Step 3: Corrigir updatePlatformConfig — PATCH → PUT**

No mesmo arquivo, localizar:
```typescript
// ANTES (linha ~236):
export async function updatePlatformConfig(data: Partial<PlatformConfig>) {
  const res = await api.patch<ApiResponse<PlatformConfig>>(
    "/admin/config",
    data
  );
  return res.data.data;
}
```
Substituir por:
```typescript
// DEPOIS:
export async function updatePlatformConfig(data: Partial<PlatformConfig>) {
  const res = await api.put<ApiResponse<PlatformConfig>>(
    "/admin/config",
    data
  );
  return res.data.data;
}
```

**Step 4: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 5: Commit**

```bash
git add admin/src/services/adminService.ts
git commit -m "fix: correct HTTP methods in admin SPA — POST→PUT for disputes, PATCH→PUT for config"
```

---

## Phase 2: Nova Página CompaniesPage na SPA Admin

### Task 2: Criar CompaniesPage.tsx na SPA admin

**Arquivos:**
- Criar: `admin/src/pages/CompaniesPage.tsx`

**Contexto:** O frontend tem `CompanyVerifications.tsx` que lista empresas pendentes (`GET /admin/companies/pending`) e aprova/rejeita (`POST /admin/companies/:id/verify`). Precisa ser portado para a SPA admin usando o `api.ts` e auth dela (sem ToastContext — usar estado local de feedback).

**Step 1: Criar o arquivo CompaniesPage.tsx**

Criar `admin/src/pages/CompaniesPage.tsx` com o seguinte conteúdo:

```tsx
import React, { useState, useEffect, useCallback } from "react";
import { Building2, Check, X, Clock, RefreshCw } from "lucide-react";
import api from "../services/api";

interface PendingCompany {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  industry?: string;
  createdAt: string;
  isVerified: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
    createdAt: string;
  };
  _count: { members: number };
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: PendingCompany[] }>(
        "/admin/companies/pending"
      );
      setCompanies(res.data.data ?? []);
    } catch {
      showFeedback("error", "Erro ao carregar empresas pendentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleVerify = async (companyId: number, approved: boolean) => {
    try {
      setProcessing(companyId);
      await api.post(`/admin/companies/${companyId}/verify`, { approved });
      showFeedback(
        "success",
        approved ? "Empresa verificada com sucesso!" : "Verificação recusada."
      );
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    } catch {
      showFeedback("error", "Erro ao processar verificação. Tente novamente.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Verificação de Empresas
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aprovar ou recusar cadastros de empresas pendentes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {companies.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-sm font-medium">
              {companies.length} pendente{companies.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={loadCompanies}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            title="Recarregar"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && companies.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">
            Nenhuma empresa pendente
          </h3>
          <p className="text-slate-500">
            Todas as solicitações de verificação foram processadas.
          </p>
        </div>
      )}

      {/* Companies list */}
      {!loading && companies.length > 0 && (
        <div className="space-y-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-slate-900 border border-slate-800/50 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-100 truncate">
                      {company.companyName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs shrink-0">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    CNPJ: {company.cnpj}
                    {company.industry ? ` · ${company.industry}` : ""}
                  </p>
                  <p className="text-sm text-slate-400">
                    Responsável: {company.user.name} ({company.user.email})
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {company._count.members} membro
                    {company._count.members !== 1 ? "s" : ""}
                  </p>
                  {company.description && (
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleVerify(company.id, false)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    title="Recusar verificação"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleVerify(company.id, true)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    title="Aprovar verificação"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompaniesPage;
```

**Step 2: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 3: Commit**

```bash
git add admin/src/pages/CompaniesPage.tsx
git commit -m "feat: add CompaniesPage to admin SPA with pending company verifications"
```

---

### Task 3: Registrar CompaniesPage no AdminLayout e App.tsx da SPA

**Arquivos:**
- Modificar: `admin/src/components/AdminLayout.tsx`
- Modificar: `admin/src/App.tsx`

**Contexto:** Precisa adicionar o item "Empresas" no menu da sidebar e registrar a rota `/companies` no router.

**Step 1: Adicionar Building2 aos imports do AdminLayout**

No arquivo `admin/src/components/AdminLayout.tsx`, localizar a linha de imports do lucide-react:
```typescript
// ANTES:
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
```
Substituir por:
```typescript
// DEPOIS:
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  BarChart3,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";
```

**Step 2: Adicionar item Empresas ao NAV_ITEMS**

No mesmo arquivo, localizar:
```typescript
// ANTES:
const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/users", icon: Users, label: "Usuarios" },
  { to: "/verifications", icon: ShieldCheck, label: "Verificacoes" },
  { to: "/traffic", icon: BarChart3, label: "Trafego" },
  { to: "/disputes", icon: AlertTriangle, label: "Disputas" },
  { to: "/settings", icon: Settings, label: "Configuracoes" },
] as const;
```
Substituir por:
```typescript
// DEPOIS:
const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/users", icon: Users, label: "Usuarios" },
  { to: "/verifications", icon: ShieldCheck, label: "Verificacoes" },
  { to: "/companies", icon: Building2, label: "Empresas" },
  { to: "/traffic", icon: BarChart3, label: "Trafego" },
  { to: "/disputes", icon: AlertTriangle, label: "Disputas" },
  { to: "/settings", icon: Settings, label: "Configuracoes" },
] as const;
```

**Step 3: Adicionar import e rota no App.tsx da SPA**

No arquivo `admin/src/App.tsx`, adicionar o import após os imports existentes de páginas:
```typescript
// Adicionar após a linha de import SettingsPage:
import CompaniesPage from "./pages/CompaniesPage";
```

Adicionar a rota dentro do bloco Protected, após `<Route path="verifications" .../>`:
```tsx
// Adicionar após:
// <Route path="verifications" element={<VerificationsPage />} />
<Route path="companies" element={<CompaniesPage />} />
```

**Step 4: Verificar TypeScript**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 5: Commit**

```bash
git add admin/src/components/AdminLayout.tsx admin/src/App.tsx
git commit -m "feat: add Empresas nav item and /companies route to admin SPA"
```

---

## Phase 3: Limpeza do Frontend Principal

### Task 4: Remover páginas admin do frontend e corrigir redirect de ADMIN

**Arquivos:**
- Modificar: `frontend/src/App.tsx`
- Modificar: `frontend/src/context/AuthContext.tsx`
- Modificar: `frontend/.env.example`
- Deletar: `frontend/src/pages/admin/AdminDashboard.tsx`
- Deletar: `frontend/src/pages/admin/AdminUsers.tsx`
- Deletar: `frontend/src/pages/admin/AdminVerifications.tsx`
- Deletar: `frontend/src/pages/admin/CompanyVerifications.tsx`
- Deletar: `frontend/src/services/adminService.ts`

**Contexto:** Com toda a funcionalidade admin na SPA separada, as páginas admin do frontend são código morto. O redirect de ADMIN após login deve apontar para a SPA admin em `localhost:5174`. Usar variável de ambiente `VITE_ADMIN_URL` para facilitar configuração em produção.

**Step 1: Remover os arquivos admin do frontend**

Run:
```bash
rm frontend/src/pages/admin/AdminDashboard.tsx
rm frontend/src/pages/admin/AdminUsers.tsx
rm frontend/src/pages/admin/AdminVerifications.tsx
rm frontend/src/pages/admin/CompanyVerifications.tsx
rm frontend/src/services/adminService.ts
```
Expected: Arquivos removidos sem erro

**Step 2: Remover imports e rotas admin do App.tsx do frontend**

No arquivo `frontend/src/App.tsx`, remover os 4 imports de páginas admin:
```typescript
// REMOVER estas 4 linhas:
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVerifications from "./pages/admin/AdminVerifications";
import CompanyVerifications from "./pages/admin/CompanyVerifications";
```

Remover o bloco de rotas admin (localizar e deletar):
```tsx
// REMOVER este bloco inteiro (6 linhas):
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.ADMIN]} />
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="companies" element={<CompanyVerifications />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
```

**Step 3: Corrigir o redirect de ADMIN no AuthContext do frontend**

No arquivo `frontend/src/context/AuthContext.tsx`, localizar (linha ~233):
```typescript
// ANTES:
      } else if (user.role === "ADMIN") {
        navigate("/admin/dashboard");
      }
```
Substituir por:
```typescript
// DEPOIS:
      } else if (user.role === "ADMIN") {
        const adminUrl = (import.meta.env.VITE_ADMIN_URL as string | undefined) || "http://localhost:5174";
        window.location.href = adminUrl;
      }
```

**Step 4: Adicionar VITE_ADMIN_URL ao .env.example do frontend**

No arquivo `frontend/.env.example`, adicionar após a linha `VITE_API_URL`:
```
# Admin SPA URL (porta separada)
VITE_ADMIN_URL=http://localhost:5174
```

**Step 5: Verificar TypeScript do frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: Sem erros — nenhuma importação quebrada

**Step 6: Verificar TypeScript da SPA admin**

Run: `cd admin && npx tsc --noEmit`
Expected: Sem erros

**Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/context/AuthContext.tsx frontend/.env.example
git rm frontend/src/pages/admin/AdminDashboard.tsx \
       frontend/src/pages/admin/AdminUsers.tsx \
       frontend/src/pages/admin/AdminVerifications.tsx \
       frontend/src/pages/admin/CompanyVerifications.tsx \
       frontend/src/services/adminService.ts
git commit -m "refactor: remove admin pages from frontend — admin now lives exclusively in admin SPA (port 5174)"
```

---

## Phase 4: Verificação Final

### Task 5: Verificação final de tipos e testes

**Contexto:** Confirmar que tudo compila e os testes do backend não foram afetados.

**Step 1: TypeScript check completo de ambos os projetos**

Run: `cd frontend && npx tsc --noEmit && echo "frontend OK" && cd ../admin && npx tsc --noEmit && echo "admin OK"`
Expected:
```
frontend OK
admin OK
```

**Step 2: Rodar testes do backend**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: Mesma quantidade de falhas que antes (7 falhas pré-existentes não relacionadas a esta mudança). Sem novas falhas.

**Step 3: Verificar que a pasta admin ainda tem node_modules e dependências**

Run: `ls admin/node_modules/recharts 2>/dev/null && echo "recharts OK" || echo "FALTA recharts — rodar: cd admin && npm install"`
Expected: `recharts OK`

**Step 4: Commit final**

```bash
git add -A
git commit -m "chore: verify admin SPA merge complete — frontend cleaned, admin SPA fully functional"
```

---

## Resumo das Mudanças

| # | Arquivo | Ação | Motivo |
|---|---------|------|--------|
| 1 | `admin/src/services/adminService.ts` | Corrigir `POST`→`PUT` e `PATCH`→`PUT` | Mismatches HTTP com o backend |
| 2 | `admin/src/pages/CompaniesPage.tsx` | **Criar** | Funcionalidade de verificação de empresas |
| 3 | `admin/src/components/AdminLayout.tsx` | Adicionar item "Empresas" no nav | Acesso à nova página |
| 4 | `admin/src/App.tsx` | Adicionar rota `/companies` | Registrar nova página |
| 5 | `frontend/src/App.tsx` | Remover imports + rotas `/admin/*` | Frontend mais leve |
| 6 | `frontend/src/context/AuthContext.tsx` | Redirect ADMIN → `window.location.href` | Apontar para SPA admin |
| 7 | `frontend/.env.example` | Adicionar `VITE_ADMIN_URL` | Configuração de ambiente |
| 8 | `frontend/src/pages/admin/*.tsx` (4 arquivos) | **Deletar** | Código morto |
| 9 | `frontend/src/services/adminService.ts` | **Deletar** | Código morto |

## Como Acessar o Admin Após a Mesclagem

```bash
# Terminal 1 — Backend
cd backend && npm run dev       # porta 3001

# Terminal 2 — Frontend principal (clientes, profissionais, empresas)
cd frontend && npm run dev      # porta 5173

# Terminal 3 — Admin SPA
cd admin && npm run dev         # porta 5174
```

- **Admin URL:** `http://localhost:5174/login`
- **Login:** usuário com `role: "ADMIN"` no banco (`admin_test_temp@faztudo.test`)
- **Sidebar:** Dashboard, Usuarios, Verificacoes, **Empresas** (novo), Trafego, Disputas, Configuracoes
