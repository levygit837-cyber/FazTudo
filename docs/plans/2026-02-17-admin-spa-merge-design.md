# Design: Mesclagem do Admin do Frontend na SPA Admin (porta 5174)

> **Data:** 2026-02-17
> **Status:** Aprovado
> **Objetivo:** Unificar toda a área administrativa na SPA `admin/` (porta 5174), migrando a funcionalidade exclusiva do `frontend/src/pages/admin/` (verificação de empresas) para lá, e removendo as páginas admin do frontend principal para deixá-lo mais leve.

---

## Contexto

O projeto tem duas áreas admin:

| Onde | Porta | Qualidade | Funcionalidades |
|------|-------|-----------|-----------------|
| `admin/` | 5174 | ✅ Completa, sidebar, Recharts | Dashboard, Traffic, Users, Verifications, Disputes, Settings |
| `frontend/src/pages/admin/` | 5173 | ⚠️ Básica, sem sidebar | AdminDashboard, AdminUsers, AdminVerifications, **CompanyVerifications** |

A SPA `admin/` é significativamente mais completa. A única funcionalidade exclusiva do frontend é **CompanyVerifications** (`/admin/companies/pending` e `/admin/companies/:id/verify`).

---

## Decisão Arquitetural

**Manter a SPA `admin/` como aplicação independente na porta 5174**, migrando para ela a funcionalidade de verificação de empresas do frontend. Remover as páginas admin do frontend principal.

**Razão:** Separação de responsabilidades — clientes, profissionais e empresas não carregam código, dependências (Recharts, ~4000 linhas de páginas admin) ou contexto de admin.

---

## Bugs de Integração Detectados Durante Análise

Dois mismatches HTTP entre a SPA admin e o backend, a corrigir durante a mesclagem:

| Endpoint | Backend espera | SPA admin usa | Correção |
|----------|---------------|---------------|----------|
| `resolveDispute` | `PUT /admin/disputes/:id/resolve` | `POST /admin/disputes/:id/resolve` | Mudar para `api.put()` em `adminService.ts` |
| `updatePlatformConfig` | `PUT /admin/config` | `PATCH /admin/config` | Mudar para `api.put()` em `adminService.ts` |

---

## O que a SPA Admin Terá Após a Mesclagem

| Rota | Página | Status |
|------|--------|--------|
| `/login` | LoginPage | Existente |
| `/` | DashboardPage | Existente |
| `/users` | UsersPage | Existente |
| `/users/:id` | UserDetailPage | Existente |
| `/verifications` | VerificationsPage | Existente |
| `/companies` | CompaniesPage | **NOVO — migrado do frontend** |
| `/traffic` | TrafficPage | Existente |
| `/disputes` | DisputesPage | Existente |
| `/settings` | SettingsPage | Existente |

---

## Componentes a Criar/Modificar na SPA Admin

### Novo: `admin/src/pages/CompaniesPage.tsx`

Porta o `CompanyVerifications.tsx` do frontend, adaptado para:
- Usar `api` e `admin_token` da SPA admin (sem ToastContext)
- Feedback inline com estado local `feedback: { type: 'success' | 'error', message: string } | null`
- Tipo `PendingCompany` inline (não importar do frontend)
- Calls: `GET /admin/companies/pending` e `POST /admin/companies/:id/verify`

### Modificar: `admin/src/components/AdminLayout.tsx`

Adicionar item no `NAV_ITEMS`:
```ts
{ to: "/companies", icon: Building2, label: "Empresas" }
```
Inserir entre `VerificacoeS` e `Trafego`.

### Modificar: `admin/src/App.tsx`

Adicionar rota:
```tsx
<Route path="companies" element={<CompaniesPage />} />
```

### Modificar: `admin/src/services/adminService.ts`

Corrigir dois mismatches HTTP:
1. `resolveDispute`: `api.post` → `api.put`
2. `updatePlatformConfig`: `api.patch` → `api.put`

---

## O que Remover do Frontend Principal

### Arquivos a deletar:
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`
- `frontend/src/pages/admin/AdminVerifications.tsx`
- `frontend/src/pages/admin/CompanyVerifications.tsx`
- `frontend/src/services/adminService.ts`

### Modificar: `frontend/src/App.tsx`

Remover:
- Imports das 4 páginas admin + `adminService`
- Bloco de rotas `<Route path="admin" ...>` com todas as sub-rotas

### Modificar: `frontend/src/context/AuthContext.tsx`

Mudar o redirect de ADMIN após login:
```ts
// ANTES:
} else if (user.role === "ADMIN") {
  navigate("/admin/dashboard");
}

// DEPOIS:
} else if (user.role === "ADMIN") {
  const adminUrl = import.meta.env.VITE_ADMIN_URL || "http://localhost:5174";
  window.location.href = adminUrl;
}
```

### Modificar: `frontend/.env.example`

Adicionar:
```
VITE_ADMIN_URL=http://localhost:5174
```

---

## O que NÃO Remover do Frontend

- `frontend/src/components/dashboard/` — ainda usado por profissionais/clientes
- Rota `ProtectedRoute` com `allowedRoles={[UserRole.ADMIN]}` — pode ser removida junto com as rotas admin
- Tipo `PendingCompany` em `frontend/src/types/company.ts` — deixar, pode ser usado por `CompanyVerifications` em outros contextos

---

## Verificações TypeScript

Após todas as mudanças:
```bash
cd admin && npx tsc --noEmit     # Sem erros
cd frontend && npx tsc --noEmit  # Sem erros (nenhuma importação quebrada)
```

---

## Fluxo de Acesso Após a Mesclagem

```
Usuário acessa localhost:5173/login
  └─ role === ADMIN → window.location.href = "http://localhost:5174"
       └─ SPA admin já tem token? → Dashboard
          Não tem? → /login da SPA admin
```

Os demais usuários (CLIENT, PROFESSIONAL, COMPANY) nunca carregam código da SPA admin.
