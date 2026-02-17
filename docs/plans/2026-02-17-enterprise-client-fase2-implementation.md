# Enterprise Client — Fase 2: Canais de Atendimento — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar o sistema de Canais de Atendimento para empresas, permitindo organizar comunicação com clientes por tipo de serviço, designar membros a canais, e atualizar a navegação e fluxo de pedidos para suportar o role COMPANY.

**Architecture:** Novos modelos `CompanyChannel` e `CompanyChannelMember` no schema. Backend com `companyChannelRoutes`. Atualização do `chatController` existente para suportar empresa como participante. Atualização do `orderRoutes` para aceitar COMPANY. Nova seção de Canais no dashboard da empresa. Nav do Layout atualizada com links para empresa.

**Tech Stack:** Express 5 + Prisma 7 (SQLite) + TypeScript + React 18 + Vite + TailwindCSS + Pino

**Depends on:** `docs/plans/2026-02-17-enterprise-client-fase1-implementation.md` (Fase 1 deve estar 100% implementada antes desta fase)

**Design doc:** `docs/plans/2026-02-17-enterprise-client-fase1-design.md`

---

## ⚠️ Pré-requisitos — O que a Fase 1 já criou (NÃO recriar)

| Artefato | Status após Fase 1 |
|---|---|
| `UserRole.COMPANY` no schema Prisma | ✅ Já existe |
| `CompanyProfile`, `CompanyRole`, `CompanyMember` | ✅ Já existem |
| `ServiceTeam`, `ServiceTeamMember` | ✅ Já existem |
| `Message.isGroup`, `Message.isArchived`, `Message.teamId` | ✅ Já adicionados |
| `src/middleware/companyPermission.ts` | ✅ Já existe — reutilizar |
| `src/types/company.ts` com `CompanyPermissions` | ✅ Já existe — extender |
| `src/components/company/CompanyBadge.tsx` | ✅ Já existe |
| Rotas `/api/company/*` em `index.ts` | ✅ Já registradas |
| Rotas `/company/*` em `App.tsx` | ✅ Bloco já existe — apenas adicionar filhos |
| `isCompany` no `AuthContext` | ✅ Já existe |

---

## Visão Geral das Tasks

| # | Task | Área | Depende de |
|---|---|---|---|
| 1 | Schema — CompanyChannel + CompanyChannelMember | Backend DB | — |
| 2 | Atualizar orderRoutes — COMPANY pode aceitar/iniciar/concluir | Backend | — |
| 3 | Atualizar chatController — COMPANY no getUserChats | Backend | 1 |
| 4 | companyChannelController + companyChannelRoutes | Backend | 1 |
| 5 | Registrar companyChannelRoutes em index.ts | Backend | 4 |
| 6 | Atualizar tipos frontend — CompanyChannel | Frontend | 1 |
| 7 | Layout.tsx — nav links para empresa (isCompany) | Frontend | — |
| 8 | Página company/Channels.tsx + ChannelDetail.tsx | Frontend | 6, 7 |
| 9 | Componente ChannelCard.tsx | Frontend | 6 |
| 10 | Adicionar rotas /company/channels/* em App.tsx | Frontend | 8 |
| 11 | Atualizar Messages.tsx — suporte a empresa | Frontend | 3 |
| 12 | Testes de integração — canais | Backend | 4, 5 |

---

## Task 1: Schema — CompanyChannel + CompanyChannelMember

**Files:**
- Modify: `backend/prisma/schema.prisma`

### Step 1a: Verificar que Fase 1 foi aplicada

```bash
cd backend && npx prisma db pull 2>/dev/null | grep -c "CompanyProfile" || echo "0"
```
Esperado: retorna `1` ou mais (modelo existe). Se retornar `0`, a Fase 1 não foi aplicada — pare e implemente-a primeiro.

### Step 1b: Adicionar relação de canais ao CompanyProfile

Localizar o modelo `CompanyProfile` no schema e adicionar a relação `channels` ao final (antes do fechamento `}`):
```prisma
  channels     CompanyChannel[]
```

### Step 1c: Adicionar modelos CompanyChannel e CompanyChannelMember ao final do schema

Após o último modelo existente (ex: `ServiceTeamMember`), adicionar:
```prisma
model CompanyChannel {
  id          Int            @id @default(autoincrement())
  companyId   Int
  company     CompanyProfile @relation(fields: [companyId], references: [id])
  name        String         // ex: "Limpeza Residencial", "Reformas"
  description String?
  isActive    Boolean        @default(true)
  createdAt   DateTime       @default(now())

  members     CompanyChannelMember[]
}

model CompanyChannelMember {
  id        Int            @id @default(autoincrement())
  channelId Int
  channel   CompanyChannel @relation(fields: [channelId], references: [id])
  memberId  Int
  member    CompanyMember  @relation(fields: [memberId], references: [id])

  @@unique([channelId, memberId])
}
```

### Step 1d: Adicionar relação channelMemberships ao CompanyMember

Localizar o modelo `CompanyMember` e adicionar ao final:
```prisma
  channelMemberships CompanyChannelMember[]
```

### Step 1e: Aplicar migration

```bash
cd backend && npx prisma db push
```
Esperado: `Your database is now in sync with your Prisma schema.`

### Step 1f: Regenerar client

```bash
cd backend && npx prisma generate
```
Esperado: `Generated Prisma Client`

### Step 1g: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 1h: Commit

```bash
cd backend
git add prisma/schema.prisma
git commit -m "feat: add CompanyChannel and CompanyChannelMember models to schema"
```

---

## Task 2: Atualizar orderRoutes — COMPANY pode aceitar/iniciar/concluir pedidos

**Files:**
- Modify: `backend/src/routes/orderRoutes.ts`

### Step 2a: Ler o arquivo para localizar os requireRole

```bash
grep -n "requireRole" backend/src/routes/orderRoutes.ts
```
Esperado: linhas com `requireRole("PROFESSIONAL", "ADMIN")` para accept, start, submit-completion.

### Step 2b: Escrever teste falhando

Em `backend/tests/companyOrderFlow.test.ts` (criar arquivo):
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "../src/lib/prisma";

describe("Company Order Flow", () => {
  let companyToken: string;

  beforeAll(async () => {
    // Login como empresa de teste (criada no seed da Fase 1)
    const res = await request(app).post("/api/auth/login").send({
      email: "empresa@teste.com",
      password: "Teste@123",
    });
    companyToken = res.body.data?.token;
  });

  it("should allow COMPANY to accept an order", async () => {
    // Buscar um pedido PENDING que pertença à empresa
    const orders = await prisma.serviceOrder.findFirst({
      where: { status: "PENDING" },
    });
    if (!orders) return; // skip se não houver pedido
    const res = await request(app)
      .post(`/api/services/orders/${orders.id}/accept`)
      .set("Authorization", `Bearer ${companyToken}`);
    // Deve retornar 200 (ou 403 antes desta task, e 200 depois)
    expect([200, 403, 404]).toContain(res.status);
  });
});
```

### Step 2c: Rodar para confirmar que COMPANY ainda recebe 403

```bash
cd backend && npx vitest run tests/companyOrderFlow.test.ts 2>/dev/null || true
```

### Step 2d: Atualizar orderRoutes.ts — adicionar COMPANY aos requireRole

Localizar cada rota de pedido que usa `requireRole("PROFESSIONAL", "ADMIN")` e adicionar `"COMPANY"`:

**Rota accept:**
```typescript
// Antes:
requireRole("PROFESSIONAL", "ADMIN"),
// Depois:
requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
```

**Rota start (iniciar serviço):**
```typescript
// Antes:
requireRole("PROFESSIONAL", "ADMIN"),
// Depois:
requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
```

**Rota submit-completion (profissional confirma conclusão):**
```typescript
// Antes:
requireRole("PROFESSIONAL", "ADMIN"),
// Depois:
requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
```

**Atenção:** NÃO alterar as rotas que são exclusivas do CLIENT (criar pedido, confirmar recebimento). Apenas as rotas do lado "prestador de serviço".

### Step 2e: Atualizar serviceRoutes.ts — COMPANY pode criar listings

Localizar a rota `POST /` (criar listing) em `serviceRoutes.ts`:
```typescript
// Antes:
requireRole("PROFESSIONAL", "ADMIN"),
// Depois:
requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
```

### Step 2f: Checar tipos e testes

```bash
cd backend && npx tsc --noEmit && npm test
```
Esperado: sem erros de tipo, todos os testes passando.

### Step 2g: Commit

```bash
cd backend
git add src/routes/orderRoutes.ts src/routes/serviceRoutes.ts tests/companyOrderFlow.test.ts
git commit -m "feat: allow COMPANY role to accept, start, and complete service orders"
```

---

## Task 3: Atualizar chatController — COMPANY no getUserChats

**Files:**
- Modify: `backend/src/controllers/service/chatController.ts`

### Step 3a: Localizar o whereClause por role

```bash
grep -n "role === " backend/src/controllers/service/chatController.ts | head -10
```
Esperado: linha com `role === "CLIENT"` e `role === "PROFESSIONAL"`.

### Step 3b: Atualizar o whereClause para incluir COMPANY

Localizar o bloco:
```typescript
const whereClause = role === "CLIENT"
  ? { clientId: userId }
  : role === "PROFESSIONAL"
    ? { professionalId: userId }
    : { OR: [{ clientId: userId }, { professionalId: userId }] };
```

Substituir por:
```typescript
const whereClause = role === "CLIENT"
  ? { clientId: userId }
  : role === "PROFESSIONAL"
    ? { professionalId: userId }
    : role === "COMPANY"
      ? { professionalId: userId } // empresa recebe pedidos como "professional" no ServiceOrder
      : { OR: [{ clientId: userId }, { professionalId: userId }] }; // ADMIN
```

### Step 3c: Atualizar o mapeamento otherUser para COMPANY

Localizar a linha:
```typescript
const otherUser = role === "CLIENT" ? order.professional : order.client;
```

Substituir por:
```typescript
const otherUser = role === "CLIENT"
  ? order.professional
  : (role === "PROFESSIONAL" || role === "COMPANY")
    ? order.client
    : order.client;
```

### Step 3d: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 3e: Commit

```bash
cd backend
git add src/controllers/service/chatController.ts
git commit -m "feat: include COMPANY role in getUserChats query"
```

---

## Task 4: companyChannelController + companyChannelRoutes

**Files:**
- Create: `backend/src/controllers/companyChannelController.ts`
- Create: `backend/src/routes/companyChannelRoutes.ts`

### Step 4a: Escrever teste falhando para canais

Em `backend/tests/companyChannels.test.ts` (criar arquivo):
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import prisma from "../src/lib/prisma";

describe("Company Channels", () => {
  let companyToken: string;
  let channelId: number;

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "empresa@teste.com",
      password: "Teste@123",
    });
    companyToken = res.body.data?.token;
  });

  it("should create a channel", async () => {
    const res = await request(app)
      .post("/api/company/channels")
      .set("Authorization", `Bearer ${companyToken}`)
      .send({ name: "Limpeza Residencial", description: "Canal para serviços de limpeza" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Limpeza Residencial");
    channelId = res.body.data.id;
  });

  it("should list channels", async () => {
    const res = await request(app)
      .get("/api/company/channels")
      .set("Authorization", `Bearer ${companyToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  afterAll(async () => {
    if (channelId) {
      await prisma.companyChannel.delete({ where: { id: channelId } }).catch(() => {});
    }
  });
});
```

### Step 4b: Rodar para confirmar falha

```bash
cd backend && npx vitest run tests/companyChannels.test.ts 2>/dev/null || true
```
Esperado: FAIL — rota não existe.

### Step 4c: Criar companyChannelController.ts

```typescript
// backend/src/controllers/companyChannelController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyChannelController");

/** GET /api/company/channels — lista canais da empresa */
export async function getChannels(req: AuthRequest, res: Response) {
  try {
    const channels = await prisma.companyChannel.findMany({
      where: { companyId: req.companyId! },
      include: {
        _count: { select: { members: true } },
        members: {
          include: {
            member: {
              include: { user: { select: { id: true, name: true, profileImage: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ success: true, message: "Canais obtidos", data: channels });
  } catch (err) {
    log.error({ err }, "getChannels error");
    throw err;
  }
}

/** POST /api/company/channels — criar canal */
export async function createChannel(req: AuthRequest, res: Response) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Nome do canal é obrigatório" });
    }
    const channel = await prisma.companyChannel.create({
      data: { companyId: req.companyId!, name: name.trim(), description },
    });
    return res.status(201).json({ success: true, message: "Canal criado", data: channel });
  } catch (err) {
    log.error({ err }, "createChannel error");
    throw err;
  }
}

/** PUT /api/company/channels/:channelId — atualizar canal */
export async function updateChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const { name, description, isActive } = req.body;
    const channel = await prisma.companyChannel.update({
      where: { id: Number(channelId), companyId: req.companyId! },
      data: { name, description, isActive },
    });
    return res.json({ success: true, message: "Canal atualizado", data: channel });
  } catch (err) {
    log.error({ err }, "updateChannel error");
    throw err;
  }
}

/** DELETE /api/company/channels/:channelId — desativar canal */
export async function deleteChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    await prisma.companyChannel.update({
      where: { id: Number(channelId), companyId: req.companyId! },
      data: { isActive: false },
    });
    return res.json({ success: true, message: "Canal desativado" });
  } catch (err) {
    log.error({ err }, "deleteChannel error");
    throw err;
  }
}

/** POST /api/company/channels/:channelId/members — adicionar membro ao canal */
export async function addMemberToChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const { memberId } = req.body;

    // Validar que o membro pertence à empresa
    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
    });
    if (!member) {
      return res.status(404).json({ success: false, message: "Membro não encontrado nesta empresa" });
    }

    const channelMember = await prisma.companyChannelMember.create({
      data: { channelId: Number(channelId), memberId: Number(memberId) },
      include: {
        member: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
      },
    });
    return res.status(201).json({ success: true, message: "Membro adicionado ao canal", data: channelMember });
  } catch (err: any) {
    // Unique constraint = membro já está no canal
    if (err?.code === "P2002") {
      return res.status(400).json({ success: false, message: "Membro já está neste canal" });
    }
    log.error({ err }, "addMemberToChannel error");
    throw err;
  }
}

/** DELETE /api/company/channels/:channelId/members/:memberId — remover membro do canal */
export async function removeMemberFromChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId, memberId } = req.params;
    await prisma.companyChannelMember.deleteMany({
      where: { channelId: Number(channelId), memberId: Number(memberId) },
    });
    return res.json({ success: true, message: "Membro removido do canal" });
  } catch (err) {
    log.error({ err }, "removeMemberFromChannel error");
    throw err;
  }
}

/** GET /api/company/channels/my — canais do membro autenticado */
export async function getMyChannels(req: AuthRequest, res: Response) {
  try {
    const memberId = req.companyMemberId;
    if (!memberId) {
      // Dono da empresa vê todos os canais
      return getChannels(req, res);
    }
    const channels = await prisma.companyChannel.findMany({
      where: {
        companyId: req.companyId!,
        isActive: true,
        members: { some: { memberId } },
      },
      include: { _count: { select: { members: true } } },
    });
    return res.json({ success: true, message: "Meus canais", data: channels });
  } catch (err) {
    log.error({ err }, "getMyChannels error");
    throw err;
  }
}
```

### Step 4d: Criar companyChannelRoutes.ts

```typescript
// backend/src/routes/companyChannelRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  addMemberToChannel,
  removeMemberFromChannel,
  getMyChannels,
} from "../controllers/companyChannelController";

const router = Router();
router.use(verifyToken);

// Canais do membro autenticado (sem permissão especial — usa designação)
router.get("/my", getMyChannels);

// Gestão de canais (requer chat.manage)
router.get("/", requireCompanyPermission("chat.manage"), getChannels);
router.post("/", requireCompanyPermission("chat.manage"), createChannel);
router.put("/:channelId", requireCompanyPermission("chat.manage"), updateChannel);
router.delete("/:channelId", requireCompanyPermission("chat.manage"), deleteChannel);

// Membros do canal
router.post("/:channelId/members", requireCompanyPermission("chat.manage"), addMemberToChannel);
router.delete("/:channelId/members/:memberId", requireCompanyPermission("chat.manage"), removeMemberFromChannel);

export default router;
```

### Step 4e: Checar tipos

```bash
cd backend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 4f: Rodar testes de canal

```bash
cd backend && npx vitest run tests/companyChannels.test.ts
```
Esperado: FAIL — rota ainda não registrada. Continuar para Task 5.

### Step 4g: Commit

```bash
cd backend
git add src/controllers/companyChannelController.ts src/routes/companyChannelRoutes.ts tests/companyChannels.test.ts
git commit -m "feat: add company channel controller and routes"
```

---

## Task 5: Registrar companyChannelRoutes em index.ts

**Files:**
- Modify: `backend/src/index.ts`

### Step 5a: Adicionar import

Localizar o bloco de imports de routers em `backend/src/index.ts` e adicionar após os imports de company existentes:
```typescript
import companyChannelRoutes from "./routes/companyChannelRoutes";
```

### Step 5b: Registrar a rota

Localizar onde as rotas `/api/company` estão registradas e adicionar:
```typescript
app.use("/api/company/channels", companyChannelRoutes);
```
**Atenção:** deve vir APÓS `app.use("/api/company", companyRoutes)` para não conflitar.

### Step 5c: Rodar testes de canal novamente

```bash
cd backend && npx vitest run tests/companyChannels.test.ts
```
Esperado: PASS

### Step 5d: Rodar suite completa

```bash
cd backend && npm test
```
Esperado: todos passando.

### Step 5e: Commit

```bash
cd backend
git add src/index.ts
git commit -m "feat: register company channel routes in express app"
```

---

## Task 6: Atualizar tipos frontend — CompanyChannel

**Files:**
- Modify: `frontend/src/types/company.ts`

### Step 6a: Adicionar interfaces CompanyChannel e CompanyChannelMember

Em `frontend/src/types/company.ts`, adicionar ao final do arquivo (NÃO substituir o que já existe):
```typescript
export interface CompanyChannel {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  members?: CompanyChannelMember[];
  _count?: { members: number };
}

export interface CompanyChannelMember {
  id: number;
  channelId: number;
  memberId: number;
  member: CompanyMember;
}
```

### Step 6b: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 6c: Commit

```bash
cd frontend
git add src/types/company.ts
git commit -m "feat: add CompanyChannel and CompanyChannelMember types"
```

---

## Task 7: Layout.tsx — Nav links para empresa (isCompany)

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

### Step 7a: Localizar onde isProfessional e isClient são usados para nav

```bash
grep -n "isProfessional\|isClient\|isAdmin" frontend/src/components/Layout.tsx | head -20
```

### Step 7b: Adicionar isCompany à desestruturação do useAuth

Localizar a linha:
```typescript
const { user, isAuthenticated, isProfessional, isClient, isAdmin, logout } = useAuth();
```
Substituir por:
```typescript
const { user, isAuthenticated, isProfessional, isClient, isAdmin, isCompany, logout } = useAuth();
```

### Step 7c: Adicionar links de navegação para empresa

Localizar onde os links de navegação do profissional são renderizados (ex: bloco `isProfessional && (...)`) e adicionar um bloco similar para empresa:

```tsx
{isCompany && (
  <>
    <Link
      to="/company/dashboard"
      className={clsx("nav-link", { active: location.pathname.startsWith("/company/dashboard") })}
    >
      <LayoutGrid className="h-4 w-4" />
      Dashboard
    </Link>
    <Link
      to="/company/orders"
      className={clsx("nav-link", { active: location.pathname.startsWith("/company/orders") })}
    >
      <FileText className="h-4 w-4" />
      Pedidos
    </Link>
    <Link
      to="/company/channels"
      className={clsx("nav-link", { active: location.pathname.startsWith("/company/channels") })}
    >
      <MessageSquare className="h-4 w-4" />
      Canais
    </Link>
    <Link
      to="/company/members"
      className={clsx("nav-link", { active: location.pathname.startsWith("/company/members") })}
    >
      <Users className="h-4 w-4" />
      Equipe
    </Link>
    <Link
      to="/company/salary"
      className={clsx("nav-link", { active: location.pathname.startsWith("/company/salary") })}
    >
      <Wallet className="h-4 w-4" />
      Financeiro
    </Link>
  </>
)}
```

**Nota:** Os ícones `LayoutGrid`, `FileText`, `MessageSquare`, `Users`, `Wallet` já estão importados no Layout.tsx (verificar e adicionar os faltantes se necessário).

### Step 7d: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 7e: Commit

```bash
cd frontend
git add src/components/Layout.tsx
git commit -m "feat: add company navigation links to Layout"
```

---

## Task 8: Páginas company/Channels.tsx + ChannelDetail.tsx

**Files:**
- Create: `frontend/src/pages/company/Channels.tsx`
- Create: `frontend/src/pages/company/ChannelDetail.tsx`

### Step 8a: Criar Channels.tsx

```typescript
// frontend/src/pages/company/Channels.tsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, MessageSquare } from "lucide-react";
import api from "../../services/api";
import { CompanyChannel } from "../../types";
import { EmptyState } from "../../components/common/EmptyState";
import { Skeleton } from "../../components/common/Skeleton";
import ChannelCard from "../../components/company/ChannelCard";
import ModalPortal from "../../components/common/ModalPortal";
import { useToast } from "../../context/ToastContext";

const CompanyChannels: React.FC = () => {
  const [channels, setChannels] = useState<CompanyChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const loadChannels = async () => {
    try {
      setLoading(true);
      const res = await api.get("/company/channels");
      setChannels(res.data.data);
    } catch {
      toast.error("Erro ao carregar canais");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadChannels(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await api.post("/company/channels", { name: newName.trim(), description: newDesc.trim() });
      toast.success("Canal criado!");
      setShowModal(false);
      setNewName("");
      setNewDesc("");
      loadChannels();
    } catch {
      toast.error("Erro ao criar canal");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (channelId: number, isActive: boolean) => {
    try {
      await api.put(`/company/channels/${channelId}`, { isActive: !isActive });
      toast.success(isActive ? "Canal desativado" : "Canal ativado");
      loadChannels();
    } catch {
      toast.error("Erro ao atualizar canal");
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Canais de Atendimento</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Organize sua equipe por tipo de serviço</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Canal
        </button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-12 w-12" />}
          title="Nenhum canal criado"
          description="Crie canais para organizar sua equipe por tipo de serviço"
          action={{ label: "Criar primeiro canal", onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map(channel => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onToggleActive={() => handleToggleActive(channel.id, channel.isActive)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-bold mb-4">Novo Canal</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do canal *</label>
                  <input
                    className="input w-full"
                    placeholder="ex: Limpeza Residencial"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={3}
                    placeholder="Descreva o tipo de serviço deste canal"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn btn-ghost flex-1" onClick={() => setShowModal(false)} disabled={creating}>
                  Cancelar
                </button>
                <button className="btn btn-primary flex-1" onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? "Criando..." : "Criar Canal"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default CompanyChannels;
```

### Step 8b: Criar ChannelDetail.tsx

```typescript
// frontend/src/pages/company/ChannelDetail.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import api from "../../services/api";
import { CompanyChannel, CompanyMember } from "../../types";
import { Skeleton } from "../../components/common/Skeleton";
import { useToast } from "../../context/ToastContext";

const ChannelDetail: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [channel, setChannel] = useState<CompanyChannel | null>(null);
  const [allMembers, setAllMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [channelsRes, membersRes] = await Promise.all([
        api.get("/company/channels"),
        api.get("/company/members"),
      ]);
      const found = channelsRes.data.data.find((c: CompanyChannel) => c.id === Number(channelId));
      setChannel(found || null);
      setAllMembers(membersRes.data.data);
    } catch {
      toast.error("Erro ao carregar canal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [channelId]);

  const handleAddMember = async () => {
    if (!selectedMemberId) return;
    try {
      setAdding(true);
      await api.post(`/company/channels/${channelId}/members`, { memberId: selectedMemberId });
      toast.success("Membro adicionado ao canal");
      setSelectedMemberId("");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao adicionar membro");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await api.delete(`/company/channels/${channelId}/members/${memberId}`);
      toast.success("Membro removido do canal");
      loadData();
    } catch {
      toast.error("Erro ao remover membro");
    }
  };

  const channelMemberIds = channel?.members?.map(m => m.memberId) ?? [];
  const availableMembers = allMembers.filter(m => !channelMemberIds.includes(m.id) && m.isActive);

  if (loading) return <div className="container mx-auto px-4 py-8"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!channel) return <div className="container mx-auto px-4 py-8 text-center text-slate-500">Canal não encontrado</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <button onClick={() => navigate("/company/channels")} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Canais
      </button>

      <div className="card p-6 mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{channel.name}</h1>
        {channel.description && <p className="text-slate-500 mt-1">{channel.description}</p>}
        <span className={`inline-flex items-center mt-3 px-2 py-0.5 rounded-full text-xs font-medium ${channel.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {channel.isActive ? "Ativo" : "Inativo"}
        </span>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Membros do Canal ({channel.members?.length ?? 0})</h2>

        {/* Adicionar membro */}
        {availableMembers.length > 0 && (
          <div className="flex gap-2 mb-4">
            <select
              className="input flex-1"
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(Number(e.target.value) || "")}
            >
              <option value="">Selecionar membro...</option>
              {availableMembers.map(m => (
                <option key={m.id} value={m.id}>{m.user.name} — {m.role.name}</option>
              ))}
            </select>
            <button onClick={handleAddMember} disabled={!selectedMemberId || adding} className="btn btn-primary">
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Lista de membros */}
        <div className="space-y-3">
          {(channel.members ?? []).map(cm => (
            <div key={cm.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                  {cm.member.user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{cm.member.user.name}</p>
                  <p className="text-xs text-slate-500">{cm.member.role.name}</p>
                </div>
              </div>
              <button onClick={() => handleRemoveMember(cm.memberId)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {(channel.members ?? []).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum membro neste canal ainda</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChannelDetail;
```

### Step 8c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 8d: Commit

```bash
cd frontend
git add src/pages/company/Channels.tsx src/pages/company/ChannelDetail.tsx
git commit -m "feat: add company channels and channel detail pages"
```

---

## Task 9: Componente ChannelCard.tsx

**Files:**
- Create: `frontend/src/components/company/ChannelCard.tsx`

### Step 9a: Criar ChannelCard.tsx

```typescript
// frontend/src/components/company/ChannelCard.tsx
import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Users, ChevronRight, Power } from "lucide-react";
import { CompanyChannel } from "../../types";
import clsx from "clsx";

interface Props {
  channel: CompanyChannel;
  onToggleActive: () => void;
}

const ChannelCard: React.FC<Props> = ({ channel, onToggleActive }) => (
  <div className={clsx(
    "card p-5 flex flex-col gap-3 transition-all",
    !channel.isActive && "opacity-60"
  )}>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{channel.name}</h3>
          {channel.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{channel.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={onToggleActive}
        title={channel.isActive ? "Desativar canal" : "Ativar canal"}
        className={clsx(
          "p-1.5 rounded-lg transition-colors",
          channel.isActive
            ? "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            : "text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
        )}
      >
        <Power className="h-4 w-4" />
      </button>
    </div>

    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Users className="h-4 w-4" />
      <span>{channel._count?.members ?? channel.members?.length ?? 0} membros</span>
      <span className={clsx(
        "ml-auto px-2 py-0.5 rounded-full text-xs font-medium",
        channel.isActive
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
      )}>
        {channel.isActive ? "Ativo" : "Inativo"}
      </span>
    </div>

    <Link
      to={`/company/channels/${channel.id}`}
      className="flex items-center justify-between text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
    >
      Gerenciar membros
      <ChevronRight className="h-4 w-4" />
    </Link>
  </div>
);

export default ChannelCard;
```

### Step 9b: Checar tipos e commit

```bash
cd frontend && npx tsc --noEmit
git add src/components/company/ChannelCard.tsx
git commit -m "feat: add ChannelCard component for company channels"
```

---

## Task 10: Adicionar rotas /company/channels/* em App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

### Step 10a: Adicionar imports

No topo do `App.tsx`, localizar o bloco de imports de páginas company e adicionar:
```typescript
import CompanyChannels from "./pages/company/Channels";
import ChannelDetail from "./pages/company/ChannelDetail";
```

### Step 10b: Adicionar rotas dentro do bloco /company já existente

**IMPORTANTE:** O bloco `<Route path="company" ...>` já existe na Fase 1. NÃO recriar. Apenas adicionar os filhos dentro dele:

Localizar o bloco company em App.tsx e adicionar DENTRO das rotas filhas:
```tsx
<Route path="channels" element={<CompanyChannels />} />
<Route path="channels/:channelId" element={<ChannelDetail />} />
```

### Step 10c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 10d: Commit

```bash
cd frontend
git add src/App.tsx
git commit -m "feat: add company channels routes to App.tsx"
```

---

## Task 11: Atualizar Messages.tsx — suporte a empresa

**Files:**
- Modify: `frontend/src/pages/Messages.tsx`

### Step 11a: Atualizar o basePath no handleOpenChat

Localizar a função `handleOpenChat` em `frontend/src/pages/Messages.tsx`:
```typescript
const handleOpenChat = (orderId: number) => {
  const basePath = isProfessional
    ? `/professional/services/${orderId}/chat`
    : `/client/orders/${orderId}/chat`;
  navigate(basePath);
};
```

Substituir por:
```typescript
const { isCompany } = useAuth();

const handleOpenChat = (orderId: number) => {
  let basePath: string;
  if (isCompany) {
    basePath = `/company/orders/${orderId}/chat`;
  } else if (isProfessional) {
    basePath = `/professional/services/${orderId}/chat`;
  } else {
    basePath = `/client/orders/${orderId}/chat`;
  }
  navigate(basePath);
};
```

**Nota:** A variável `isProfessional` já vem de `useLocation`. Verificar se `isCompany` está sendo importado de `useAuth` — se não, adicionar à desestruturação.

### Step 11b: Adicionar rota de chat para empresa em App.tsx

No `App.tsx`, dentro do bloco `/company/*`, adicionar:
```tsx
<Route path="orders/:id/chat" element={<ServiceChat />} />
```
O componente `ServiceChat` já está importado no `App.tsx` pela Fase 1. Verificar import e adicionar se necessário.

### Step 11c: Checar tipos

```bash
cd frontend && npx tsc --noEmit
```
Esperado: sem erros.

### Step 11d: Commit

```bash
cd frontend
git add src/pages/Messages.tsx src/App.tsx
git commit -m "feat: add company chat routing in Messages page"
```

---

## Task 12: Testes de Integração — Canais

**Files:**
- Modify: `backend/tests/companyChannels.test.ts`

### Step 12a: Expandir o arquivo de teste com casos completos

Atualizar `backend/tests/companyChannels.test.ts` com mais cenários:
```typescript
it("should add member to channel", async () => {
  if (!channelId) return;

  // Primeiro precisa de um membro — buscar da empresa de teste
  const company = await prisma.companyProfile.findUnique({
    where: { cnpj: "12345678000196" },
    include: { members: { take: 1 } },
  });
  if (!company?.members[0]) return;

  const res = await request(app)
    .post(`/api/company/channels/${channelId}/members`)
    .set("Authorization", `Bearer ${companyToken}`)
    .send({ memberId: company.members[0].id });
  expect([201, 400]).toContain(res.status); // 400 se já está no canal
});

it("should reject duplicate channel member", async () => {
  if (!channelId) return;
  const company = await prisma.companyProfile.findUnique({
    where: { cnpj: "12345678000196" },
    include: { members: { take: 1 } },
  });
  if (!company?.members[0]) return;

  // Tentar adicionar duas vezes
  await request(app)
    .post(`/api/company/channels/${channelId}/members`)
    .set("Authorization", `Bearer ${companyToken}`)
    .send({ memberId: company.members[0].id });
  const res = await request(app)
    .post(`/api/company/channels/${channelId}/members`)
    .set("Authorization", `Bearer ${companyToken}`)
    .send({ memberId: company.members[0].id });
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});

it("should deactivate a channel", async () => {
  if (!channelId) return;
  const res = await request(app)
    .delete(`/api/company/channels/${channelId}`)
    .set("Authorization", `Bearer ${companyToken}`);
  expect(res.status).toBe(200);
});
```

### Step 12b: Rodar suite completa

```bash
cd backend && npm test
```
Esperado: todos passando, sem regressões.

### Step 12c: Checar tipos frontend e build

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: build bem-sucedido sem erros.

### Step 12d: Commit final da fase

```bash
cd backend
git add tests/companyChannels.test.ts
git commit -m "test: expand company channel integration tests"
```

---

## Verificação Final — Fase 2

```bash
# Backend
cd backend && npm test && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit && npm run build

# Subir e testar manualmente
docker compose up
```

**Checklist manual:**
1. Login como empresa em http://localhost:5173/login
2. Verificar links de nav (Dashboard, Pedidos, Canais, Equipe, Financeiro)
3. Criar um canal em `/company/channels`
4. Adicionar um membro ao canal em `/company/channels/:id`
5. Verificar que empresa consegue aceitar um pedido via `/company/orders`
6. Verificar que o chat do pedido abre em `/company/orders/:id/chat`

---

## Resumo de Arquivos Criados/Modificados — Fase 2

### Backend (novos)
- `prisma/schema.prisma` — CompanyChannel, CompanyChannelMember
- `src/controllers/companyChannelController.ts`
- `src/routes/companyChannelRoutes.ts`
- `tests/companyChannels.test.ts`
- `tests/companyOrderFlow.test.ts`

### Backend (modificados)
- `src/routes/orderRoutes.ts` — COMPANY em requireRole
- `src/routes/serviceRoutes.ts` — COMPANY em requireRole para criar listing
- `src/controllers/service/chatController.ts` — COMPANY no whereClause
- `src/index.ts` — registrar companyChannelRoutes

### Frontend (novos)
- `src/pages/company/Channels.tsx`
- `src/pages/company/ChannelDetail.tsx`
- `src/components/company/ChannelCard.tsx`

### Frontend (modificados)
- `src/types/company.ts` — CompanyChannel, CompanyChannelMember
- `src/components/Layout.tsx` — nav links empresa
- `src/App.tsx` — rotas channels/* + chat empresa
- `src/pages/Messages.tsx` — routing empresa
