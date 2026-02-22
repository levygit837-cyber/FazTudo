# Bugfixes, Micro-interações & Vitrine de Empresa — Design

**Data**: 2026-02-21
**Escopo**: Correção de bugs, normalização de micro-interações CSS, ajustes no dashboard empresa, convites de membros e nova vitrine de serviços para empresas.

---

## 1. Normalização CSS & Micro-interações

### Problema

A regra global em `index.css` (`@layer base`) aplica `ring-2 ring-primary-500 ring-offset-2` a TODOS os inputs em focus. Isso conflita com componentes que definem seus próprios estilos (CurrencyInput, inputs inline no Profile, etc.), causando bordas duplas/indesejadas.

Inputs `type="number"` exibem spin buttons nativos (setas para cima/baixo) que fogem da estética da plataforma.

### Solução

1. **Remover** `ring-2 ring-primary-500 ring-offset-2` do `@layer base` para inputs. Manter apenas `outline-none`.
2. **Estilo de focus** fica na classe `.input` (`@layer components`) com `focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500`.
3. **Esconder spin buttons** globalmente via CSS para `input[type="number"]`.
4. **Auditoria visual completa** de todos os componentes interativos: checkboxes, toggles, selects, modais, tabs, inputs inline.

### Arquivos afetados

- `frontend/src/index.css` — regra global
- Componentes com inputs inline (Profile.tsx, StorefrontEditor.tsx, Salary.tsx, etc.)

---

## 2. Correção de Bugs

### Bug 1: Erro ao aceitar pedido ("Cannot convert undefined or null to object")

- **Causa**: `extractData(response)` retorna `undefined` quando `response.data.data` não existe. O código `payload.serviceOrder` lança erro ao acessar propriedade de `undefined`.
- **Fix**: Null guard: `const payload = extractData(response) ?? {};`
- **Arquivos**: `frontend/src/services/serviceService.ts` (função `acceptOrder`)

### Bug 2: Botão "Editar Perfil" não funciona no /profile

- **Causa**: O overlay SVG pattern (`absolute inset-0`) está sobre o botão sem `pointer-events-none`.
- **Fix**: Adicionar `pointer-events-none` ao overlay SVG e `z-10` ao botão.
- **Arquivos**: `frontend/src/pages/Profile.tsx`

### Bug 3: Toggle de regra de salário dá 404

- **Causa**: Frontend envia `PATCH`, backend só registra `PUT`.
- **Fix**: Adicionar `router.patch("/rules/:ruleId", ...)` no backend.
- **Arquivos**: `backend/src/routes/companySalaryRoutes.ts`

---

## 3. Dashboard Empresa

- **Remover** "Perfil da Empresa" do array `quickLinks` em `company/Dashboard.tsx`.
- Rota `/company/profile` continua acessível por URL direto.

### Arquivos afetados

- `frontend/src/pages/company/Dashboard.tsx`

---

## 4. Membros — Convites sem cargo obrigatório + Seed

### Convite sem cargo

- Frontend: tornar `roleId` opcional no modal de convite
- Backend: aceitar `roleId` como opcional em `POST /company/members/invite`

### Seed

- Criar 2 novos usuários: `membro1@teste.com`, `membro2@teste.com` (role: PROFESSIONAL, senha: Teste@123)
- Vincular como membros de `empresa@teste.com`
- Um com cargo, outro sem

### Arquivos afetados

- `frontend/src/pages/company/Members.tsx`
- `backend/src/routes/companyMemberRoutes.ts` ou controller correspondente
- `backend/prisma/seed.ts`

---

## 5. Vitrine de Empresa com Serviços + Equipes

### Arquitetura

Substituir o `StorefrontEditor.tsx` (blocos visuais: Hero/About/Testimonials) por `CompanyStorefrontManager.tsx` que segue a mesma hierarquia do `StorefrontManager.tsx` profissional:

```
Categoria de Serviço → Serviços → Opções/Add-ons
         ↓
    Equipe (membros associados via TeamBuilder)
```

### Componentes

1. **`CompanyStorefrontManager.tsx`** — baseado em `StorefrontManager.tsx`:
   - CRUD de categorias de serviço
   - CRUD de serviços por categoria
   - CRUD de opções/add-ons por serviço
   - CurrencyInput para preços
   - TeamBuilder integrado por categoria

2. **TeamBuilder.tsx** — já existe, reutilizar para associar membros a categorias

### Backend

- Criar/adaptar endpoints em `companyStorefrontRoutes.ts` para serviços de empresa
- Modelo `CompanyServiceCategory` com relação a `CompanyMember[]`
- Cada `CompanyServiceListing` pertence a uma categoria

### Rota

- `/company/storefront-editor` → `CompanyStorefrontManager`

### Arquivos afetados

- `frontend/src/pages/company/StorefrontEditor.tsx` (substituir)
- `frontend/src/components/company/TeamBuilder.tsx` (reutilizar)
- `backend/src/routes/companyStorefrontRoutes.ts`
- `backend/prisma/schema.prisma` (se novos modelos necessários)
- `frontend/src/App.tsx` (atualizar import se necessário)

---

## 6. Salary Rules — UI

- Substituir `<input type="number">` do valor por `CurrencyInput`
- Dia do mês: remover spin buttons (já feito globalmente) ou usar `<select>` 1-28
- Formatação R$ 0,00 automática

### Arquivos afetados

- `frontend/src/pages/company/Salary.tsx`
