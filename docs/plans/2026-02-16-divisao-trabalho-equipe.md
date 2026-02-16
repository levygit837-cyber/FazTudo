# Divisao de Trabalho em Equipe — FazTudo

> **Data**: 2026-02-16
> **Objetivo**: Dividir tarefas entre 2 desenvolvedores (cada um com agente IA) de forma que **nunca editem os mesmos arquivos simultaneamente**
> **Branch principal**: `main`
> **Estrategia**: Feature branches independentes (`feat/dev-a-*` e `feat/dev-b-*`)

---

## Regras de Ouro

1. **NUNCA dois agentes editam o mesmo arquivo ao mesmo tempo** — cada tarefa lista EXATAMENTE quais arquivos serao tocados
2. Cada dev trabalha em **branch propria** (`feat/dev-a-xxx`, `feat/dev-b-xxx`)
3. **Merge para main** somente apos `tsc --noEmit` + `npm test` passarem
4. **Commits granulares** com prefixo semantico (`feat:`, `fix:`, `refactor:`)
5. **ANTES de iniciar qualquer tarefa**: `git pull origin main` para pegar merges do outro dev
6. **Editar SOMENTE os arquivos listados na tarefa** — se precisar de outro arquivo, consultar o outro dev

---

## Inventario de Problemas Identificados

### CRITICOS (impactam funcionalidade)

| # | Problema | Onde | Impacto |
|---|---------|------|---------|
| C1 | `serviceController.ts` monolitico com **2.689 linhas** — codigo morto, nenhum arquivo importa dele | Backend | Confusao, peso morto no projeto |
| C2 | Chat usa **polling a cada 5s** — sem WebSocket/SSE | Frontend + Backend | UX ruim, consumo de recursos |
| C3 | **Sem email real** — notificacoes apenas in-app, sem envio de email | Backend | Usuarios nao recebem alertas fora do app |
| C4 | **Sem cron/scheduler** — funcoes `checkExpiredOrders`, `checkAutoReleasablePayments`, `sendDeadlineWarnings` existem mas **nunca sao chamadas** | Backend | Pedidos nunca expiram, pagamentos nunca sao liberados automaticamente |
| C5 | **VerifyAccount e placeholder** — nao ha fluxo real de KYC/verificacao documental | Frontend + Backend | Verificacao nao funciona de verdade |
| C6 | **Home.tsx nao e usada** — existe mas nao esta no router (App.tsx usa LandingPageUser) | Frontend | Codigo morto |

### QUALIDADE (impactam UX/manutenibilidade)

| # | Problema | Onde | Impacto |
|---|---------|------|---------|
| Q1 | **Sem testes frontend** — zero testes unitarios/integracao | Frontend | Regressoes nao detectadas |
| Q2 | Bug no teste `validation.test.ts` — usa `'PIX'` maiusculo, schema espera `'pix'` | Backend | 1 teste falhando |
| Q3 | **console.error no CRM.tsx** — ao inves de toast | Frontend | Inconsistencia |
| Q4 | **Tratamento de erro inconsistente** — cada pagina trata erros de forma diferente | Frontend | UX inconsistente |
| Q5 | **ESLint nao funciona** — config ausente no frontend | Frontend | Sem lint |
| Q6 | **Tipos duplicados** — `ApiResponse`, `PaginatedResponse`, `ApiError` existem em `types/api.ts` E em `services/api.ts` | Frontend | Ambiguidade de imports |

### MELHORIAS (funcionalidades novas)

| # | Melhoria | Onde | Valor |
|---|---------|------|-------|
| M1 | **Password Reset/Forgot Password** — schemas e rotas existem no backend, mas controllers retornam 501 | Backend + Frontend | Funcionalidade essencial |
| M2 | **Admin: gerenciar disputas** — admin nao tem tela para mediar disputas | Frontend + Backend | Operacoes |
| M3 | **Perfil publico do profissional** — nao existe pagina publica de perfil | Frontend | SEO, confianca |

---

## LISTA DE TAREFAS — Desenvolvedor A (Backend)

> **Branch prefix**: `feat/dev-a-*`
> **Foco**: Backend, infraestrutura, logica de negocio
> **Regra**: Dev A NAO edita nenhum arquivo em `frontend/`

---

### A1 — Deletar `serviceController.ts` (codigo morto)

**Descricao**: O arquivo `serviceController.ts` (2.689 linhas) e codigo morto. Nenhum arquivo do projeto importa dele — todas as rotas usam os controllers modulares em `controllers/service/`. Verificacao ja foi feita: zero imports encontrados.

**NOTA IMPORTANTE**: `calendarController.ts` NAO e codigo morto — e usado por `dashboardRoutes.ts`. NAO deletar.

**Arquivos a DELETAR**:
- `backend/src/controllers/serviceController.ts`

**Verificacao pos-delete**:
```bash
cd backend && npx tsc --noEmit && npm test
```

**Estimativa**: 30 minutos

---

### A2 — Implementar Scheduler/Cron para jobs automaticos

**Descricao**: As funcoes `checkExpiredOrders()`, `checkAutoReleasablePayments()`, `sendDeadlineWarnings()` existem em `escrowService.ts` mas nunca sao chamadas. Implementar cron jobs.

**Arquivos a CRIAR**:
- `backend/src/jobs/scheduler.ts`
- `backend/src/jobs/escrowJobs.ts`
- `backend/src/jobs/orderJobs.ts`
- `backend/src/jobs/notificationJobs.ts`

**Arquivos a EDITAR**:
- `backend/src/index.ts` — adicionar import do scheduler e `startScheduler()` ANTES do bloco `// GRACEFUL SHUTDOWN`
- `backend/package.json` — adicionar dependencia `node-cron` + `@types/node-cron`

**Arquivos SOMENTE LEITURA (nao editar)**:
- `backend/src/services/escrowService.ts`
- `backend/src/services/notificationService.ts`

**Estimativa**: 3-4 horas

---

### A3 — Implementar Password Reset (backend)

**Descricao**: Os schemas `forgotPasswordSchema` e `resetPasswordSchema` JA existem em `validation.ts` (linhas 66-73). As rotas JA existem em `authRoutes.ts` (linhas 30-31). Os controllers `forgotPassword` e `resetPassword` JA existem em `authController.ts` mas retornam 501/stub. Implementar a logica real.

**Arquivos a CRIAR**:
- `backend/src/services/tokenService.ts` — geracao e validacao de tokens de reset

**Arquivos a EDITAR**:
- `backend/src/controllers/authController.ts` — implementar logica real nas funcoes `forgotPassword` (linha ~436) e `resetPassword` (linha ~477)
- `backend/prisma/schema.prisma` — adicionar model `PasswordResetToken`

**Arquivos que NAO precisa editar (ja estao prontos)**:
- ~~`backend/src/routes/authRoutes.ts`~~ — rotas ja registradas
- ~~`backend/src/middleware/validation.ts`~~ — schemas ja existem

**Apos editar schema.prisma, rodar**:
```bash
cd backend && npx prisma db push
```

**Estimativa**: 3-4 horas

---

### A4 — Integrar servico de Email (Resend)

**Descricao**: Notificacoes existem apenas in-app. Integrar com Resend para enviar emails em eventos criticos.

**Arquivos a CRIAR**:
- `backend/src/services/emailService.ts`
- `backend/src/templates/welcome.ts`
- `backend/src/templates/passwordReset.ts`
- `backend/src/templates/orderNotification.ts`

**Arquivos a EDITAR**:
- `backend/src/services/notificationService.ts` — chamar emailService nos handlers
- `backend/src/config/env.ts` — adicionar variaveis RESEND_API_KEY, EMAIL_FROM
- `backend/.env.example` — documentar novas variaveis

**Estimativa**: 4-5 horas

---

### A5 — Corrigir teste + adicionar testes de escrow

**Descricao**: Corrigir o teste que usa `'PIX'` maiusculo e adicionar testes unitarios para servicos criticos.

**Arquivos a EDITAR**:
- `backend/tests/security/validation.test.ts` — corrigir `'PIX'` para `'pix'`

**Arquivos a CRIAR**:
- `backend/tests/services/escrowService.test.ts`
- `backend/tests/services/notificationService.test.ts`

**Estimativa**: 3-4 horas

---

### A6 — Admin: endpoints para gerenciar disputas

**Descricao**: Admin nao tem endpoint para mediar/resolver disputas.

**Arquivos a EDITAR**:
- `backend/src/controllers/adminController.ts` — adicionar `getDisputes`, `reviewDispute`, `resolveDispute`
- `backend/src/routes/adminRoutes.ts` — adicionar rotas `GET /disputes`, `PUT /disputes/:id`
- `backend/src/middleware/validation.ts` — adicionar `resolveDisputeSchema`

**Estimativa**: 3-4 horas

---

### A7 — Cache HTTP para endpoints frequentes

**Descricao**: Endpoints como categorias sao chamados frequentemente. Adicionar cache em memoria com TTL.

**Arquivos a CRIAR**:
- `backend/src/middleware/cache.ts`

**Arquivos a EDITAR**:
- `backend/src/routes/categoryRoutes.ts` — aplicar middleware de cache nas rotas GET

**Estimativa**: 2-3 horas

---

## LISTA DE TAREFAS — Desenvolvedor B (Frontend)

> **Branch prefix**: `feat/dev-b-*`
> **Foco**: Frontend, UX, componentes, integracao visual
> **Regra**: Dev B NAO edita nenhum arquivo em `backend/` EXCETO nas tasks B1 (cria arquivos novos de SSE)

---

### B1 — Refatorar Chat para SSE (Server-Sent Events)

**Descricao**: Chat atualmente usa polling a cada 5s. Implementar SSE para receber mensagens em tempo real.

**Arquivos a CRIAR (backend — arquivos NOVOS, sem conflito)**:
- `backend/src/routes/sseRoutes.ts` — endpoint SSE
- `backend/src/services/sseService.ts` — gerenciamento de conexoes SSE

**Arquivos a EDITAR (frontend)**:
- `frontend/src/pages/services/ServiceChat.tsx` — substituir polling por EventSource
- `frontend/src/pages/Messages.tsx` — adicionar indicador de novas mensagens
- `frontend/src/services/serviceService.ts` — adicionar helper para SSE

**Arquivo a EDITAR (backend — UNICO)**:
- `backend/src/index.ts` — adicionar `app.use("/api/services", sseRoutes)` na secao de rotas
- `backend/src/controllers/service/messageController.ts` — chamar `sseService.broadcast()` ao enviar mensagem

**REGRA OBRIGATORIA**: Fazer `git pull origin main` ANTES de editar `index.ts`. Task A2 deve estar mergeada primeiro.

**Estimativa**: 6-8 horas

---

### B2 — Configurar ESLint + criar hook `useApiCall`

**Descricao**: ESLint nao funciona (config ausente). Criar hook generico para chamadas API.

**Arquivos a CRIAR**:
- `frontend/.eslintrc.cjs` ou `frontend/eslint.config.js`
- `frontend/src/hooks/useApiCall.ts`

**Arquivos a EDITAR**:
- `frontend/package.json` — ajustar deps de ESLint

**NAO editar paginas existentes** — refatorar para usar o hook em tasks futuras

**Estimativa**: 2-3 horas

---

### B3 — Pagina de Forgot Password (frontend)

**Descricao**: Criar paginas de "Esqueci minha senha" e "Redefinir senha".

**NOTA**: O link "Esqueci minha senha" JA existe em `Login.tsx` (linha 86: `navigate("/forgot-password")`). NAO precisa editar Login.tsx.

**NOTA**: As chamadas de auth NAO devem ir em `serviceService.ts`. Criar um arquivo `authService.ts` separado (auth != services).

**Arquivos a CRIAR**:
- `frontend/src/pages/ForgotPassword.tsx`
- `frontend/src/pages/ResetPassword.tsx`
- `frontend/src/services/authService.ts` — funcoes `forgotPassword()` e `resetPassword()`

**Arquivos a EDITAR**:
- `frontend/src/App.tsx` — adicionar rotas `/forgot-password` e `/reset-password` na secao de rotas publicas (linhas ~73-80)

**Arquivos que NAO precisa editar**:
- ~~`frontend/src/pages/Login.tsx`~~ — link ja existe
- ~~`frontend/src/services/serviceService.ts`~~ — usar authService.ts novo

**DEPENDENCIA**: Requer task A3 concluida e mergeada

**Estimativa**: 3-4 horas

---

### B4 — Perfil Publico do Profissional

**Descricao**: Criar pagina publica com bio, avaliacoes, servicos e certificacoes do profissional.

**Arquivos a CRIAR**:
- `frontend/src/pages/ProfessionalProfile.tsx`

**Arquivos a EDITAR**:
- `frontend/src/App.tsx` — adicionar rota `/profissional/:id` na secao de rotas publicas (linhas ~73-80)
- `frontend/src/components/services/ServiceCard.tsx` — linkar para perfil do profissional

**Estimativa**: 4-5 horas

---

### B5 — Remover codigo morto e limpar inconsistencias

**Descricao**: Limpar codigo morto e inconsistencias identificadas.

**Arquivos a DELETAR**:
- `frontend/src/pages/Home.tsx` — codigo morto (nao esta no router)

**Arquivos a EDITAR**:
- `frontend/src/types/api.ts` — remover tipos duplicados com `services/api.ts` (manter apenas em types/)
- `frontend/src/pages/professional/CRM.tsx` — substituir `console.error` por toast

**Estimativa**: 1-2 horas

---

### B6 — Implementar testes frontend

**Descricao**: Adicionar testes unitarios para componentes e hooks criticos.

**Arquivos a CRIAR**:
- `frontend/src/__tests__/context/AuthContext.test.tsx`
- `frontend/src/__tests__/hooks/useApiCall.test.ts`
- `frontend/src/__tests__/utils/formatters.test.ts`
- `frontend/src/__tests__/components/checkout/Checkout.test.tsx`
- `frontend/vitest.config.ts`

**Arquivos a EDITAR**:
- `frontend/package.json` — adicionar vitest, @testing-library/react, jsdom

**NOTA**: B2 e B6 ambos editam `package.json`. Executar B2 primeiro, mergear, depois B6.

**Estimativa**: 5-6 horas

---

### B7 — Admin: tela de gerenciamento de disputas

**Descricao**: Interface admin para visualizar e resolver disputas.

**Arquivos a CRIAR**:
- `frontend/src/pages/admin/AdminDisputes.tsx`
- `frontend/src/components/admin/DisputeDetail.tsx`

**Arquivos a EDITAR**:
- `frontend/src/App.tsx` — adicionar rota `/admin/disputes` na secao admin (linhas ~127-138)
- `frontend/src/services/adminService.ts` — adicionar chamadas de disputas
- `frontend/src/pages/admin/AdminDashboard.tsx` — adicionar card/link para disputas (melhor que editar Layout.tsx)

**Arquivos que NAO precisa editar**:
- ~~`frontend/src/components/Layout.tsx`~~ — adicionar nav de disputas dentro do AdminDashboard ao inves de modificar o layout global

**DEPENDENCIA**: Requer task A6 concluida e mergeada

**Estimativa**: 4-5 horas

---

### B8 — Melhorar Landing Pages (UX/Performance)

**Descricao**: Otimizar landing pages com lazy loading, melhorar SEO e refinar animacoes.

**Arquivos a EDITAR**:
- `frontend/src/pages/LandingPageUser.tsx`
- `frontend/src/pages/LandingPageProfessional.tsx`
- `frontend/src/components/landing/RegisterPromptClient.tsx`
- `frontend/src/components/landing/RegisterPromptProfessional.tsx`

**Estimativa**: 3-4 horas

---

## MATRIZ DE ARQUIVOS — Quem edita o que

### Arquivos que SOMENTE Dev A edita

| Arquivo | Tasks |
|---------|-------|
| `backend/src/controllers/serviceController.ts` | A1 (deletar) |
| `backend/src/controllers/authController.ts` | A3 |
| `backend/src/controllers/adminController.ts` | A6 |
| `backend/src/routes/adminRoutes.ts` | A6 |
| `backend/src/routes/categoryRoutes.ts` | A7 |
| `backend/src/middleware/validation.ts` | A6 |
| `backend/src/services/notificationService.ts` | A4 |
| `backend/src/config/env.ts` | A4 |
| `backend/prisma/schema.prisma` | A3 |
| `backend/tests/security/validation.test.ts` | A5 |

### Arquivos que SOMENTE Dev B edita

| Arquivo | Tasks |
|---------|-------|
| `frontend/src/App.tsx` | B3, B4, B7 (sequencial) |
| `frontend/src/pages/services/ServiceChat.tsx` | B1 |
| `frontend/src/pages/Messages.tsx` | B1 |
| `frontend/src/services/serviceService.ts` | B1 |
| `frontend/src/services/adminService.ts` | B7 |
| `frontend/src/components/services/ServiceCard.tsx` | B4 |
| `frontend/src/types/api.ts` | B5 |
| `frontend/src/pages/professional/CRM.tsx` | B5 |
| `frontend/src/pages/admin/AdminDashboard.tsx` | B7 |
| `frontend/src/pages/LandingPageUser.tsx` | B8 |
| `frontend/src/pages/LandingPageProfessional.tsx` | B8 |
| `frontend/src/components/landing/RegisterPromptClient.tsx` | B8 |
| `frontend/src/components/landing/RegisterPromptProfessional.tsx` | B8 |
| `frontend/package.json` | B2, B6 (sequencial) |
| `frontend/src/pages/Home.tsx` | B5 (deletar) |

### Arquivo COMPARTILHADO (requer coordenacao)

| Arquivo | Dev A | Dev B | Regra |
|---------|-------|-------|-------|
| `backend/src/index.ts` | A2 (Sprint 1) | B1 (Sprint 2) | A2 PRIMEIRO. B1 so edita APOS merge de A2. |
| `backend/package.json` | A2 (Sprint 1) | — | Apenas Dev A |
| `backend/src/controllers/service/messageController.ts` | — | B1 (Sprint 2) | Apenas Dev B |

### Arquivos que NINGUEM edita (ja estao corretos)

| Arquivo | Motivo |
|---------|--------|
| `backend/src/routes/authRoutes.ts` | Rotas de forgot/reset password ja existem |
| `backend/src/middleware/validation.ts` (para A3) | Schemas ja existem |
| `frontend/src/pages/Login.tsx` | Link "esqueci senha" ja existe |
| `frontend/src/components/Layout.tsx` | Nav de disputas vai no AdminDashboard |
| `backend/src/controllers/calendarController.ts` | E USADO por dashboardRoutes, NAO deletar |

---

## Cronograma de Execucao

### Sprint 1 — Fundacao (100% paralelo, zero conflitos)

```
Dev A                                    Dev B
-------                                  -------
A1: Deletar serviceController.ts         B2: ESLint + hook useApiCall
    (30 min)                                 (2-3h)
A5: Corrigir testes + novos testes       B5: Remover codigo morto
    (3-4h)                                   (1-2h)
A2: Implementar Scheduler/Cron          B8: Melhorar Landing Pages
    (3-4h, EDITA index.ts)                   (3-4h)

>>> AMBOS: merge para main <<<
```

**Conflitos neste sprint**: ZERO. Nenhum arquivo e compartilhado.

---

### Sprint 2 — Features Core (1 ponto de coordenacao)

```
Dev A                                    Dev B
-------                                  -------
A3: Password Reset backend              B4: Perfil Publico Profissional
    (3-4h, edita authController +            (4-5h, edita App.tsx)
     schema.prisma)
A7: Cache HTTP                           B1: Chat SSE
    (2-3h)                                   (6-8h, EDITA index.ts)
                                              >>> PUXAR main antes! <<<

>>> AMBOS: merge para main <<<
```

**Ponto de coordenacao**: B1 edita `backend/src/index.ts`. Dev B DEVE fazer `git pull origin main` antes de comecar B1 para pegar as mudancas de A2.

**App.tsx**: Somente Dev B edita (B4 neste sprint). Sem conflito.

---

### Sprint 3 — Features Avancadas (dependencias entre devs)

```
Dev A                                    Dev B
-------                                  -------
A4: Integrar Email                       B3: Forgot Password frontend
    (4-5h)                                   (3-4h, DEPENDE de A3)
A6: Admin Disputas backend               B6: Testes frontend
    (3-4h)                                   (5-6h)

>>> AMBOS: merge para main <<<
```

**Dependencia**: B3 precisa que A3 esteja mergeado (endpoints de password reset).

**App.tsx**: Somente Dev B edita (B3 neste sprint). Sem conflito.

---

### Sprint 4 — Finalizacao

```
Dev A                                    Dev B
-------                                  -------
(review + ajustes finais)                B7: Admin Disputas frontend
                                             (4-5h, DEPENDE de A6)

>>> MERGE FINAL <<<
```

**Dependencia**: B7 precisa que A6 esteja mergeado (endpoints admin de disputas).

**App.tsx**: Somente Dev B edita (B7 neste sprint). Sem conflito.

---

## Diagrama de Dependencias

```
Sprint 1 (paralelo total):
  A1 ─────┐
  A5 ─────┤──── MERGE ────┐
  A2 ─────┘               │
  B2 ─────┐               │
  B5 ─────┤──── MERGE ────┤
  B8 ─────┘               │
                           v
Sprint 2:                 main
  A3 ─────┐               │
  A7 ─────┤──── MERGE ────┤
  B4 ─────┤               │
  B1 ─────┘ (precisa A2)  │
                           v
Sprint 3:                 main
  A4 ─────┐               │
  A6 ─────┤──── MERGE ────┤
  B3 ─────┘ (precisa A3)  │
  B6 ─────────── MERGE ───┤
                           v
Sprint 4:                 main
  B7 ────────── (precisa A6) ──── MERGE FINAL
```

---

## Resumo de Volume

| Dev | Tasks | Cria | Edita | Deleta | Estimativa |
|-----|-------|------|-------|--------|------------|
| **A** | 7 | 10 arquivos | 9 arquivos | 1 arquivo | 19-24 horas |
| **B** | 8 | 12 arquivos | 13 arquivos | 1 arquivo | 28-37 horas |

---

## Checklist Pre-Merge (para cada branch)

```bash
# Backend
cd backend && npx tsc --noEmit       # zero erros
cd backend && npm test                # todos testes passando

# Frontend
cd frontend && npx tsc --noEmit      # zero erros
cd frontend && npm run build          # build com sucesso

# Geral
git diff --name-only origin/main     # verificar que so editou arquivos da task
```

**Regras**:
- Nenhum `console.log` no codigo novo (usar logger no backend, toast no frontend)
- Nenhum arquivo `.env` ou credencial commitado
- Commit messages em ingles com prefixo semantico
