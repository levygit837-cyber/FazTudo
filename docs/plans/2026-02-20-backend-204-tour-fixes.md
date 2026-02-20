# Backend 204 / Tour Interativo — Plano de Correção

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir dois conjuntos de bugs críticos: (1) requisições bloqueadas/retornando 204 que impedem clientes e profissionais de acessar qualquer funcionalidade; (2) tour interativo do profissional com etapas KYC mostradas para usuários já verificados, navegação para rota errada e card parado no centro da tela a partir do passo 5.

**Architecture:**
- **Bug 1 (204/CORS):** O 204 em si é comportamento correto do CORS preflight. O problema real é que `sameSite: "strict"` nos cookies httpOnly impede o browser de enviar cookies em requisições cross-origin (porta 5173 → 3001). O fallback via `Authorization: Bearer` no localStorage funciona, mas o `GET /auth/profile` feito no boot do AuthContext falha se o usuário tiver `status: "PENDING"` — limpando o localStorage e deslogando o usuário silenciosamente. Também, `cors()` está registrado DEPOIS do `generalLimiter`, então respostas 429 não têm headers CORS e aparecem como "CORS error" no browser.
- **Bug 2 (Tour):** Três problemas independentes: (a) passos KYC (steps 2–3) não verificam `user.isVerified` antes de navegar; (b) step 3 aponta para rota `/verify-email` mas o `data-tour` fica em `/verify-account`; (c) `useLayoutEffect` do TourSpotlight roda ANTES da nova página terminar de montar após `navigate()`, retornando `null` do `querySelector` e travando o card no centro sem retry.

**Tech Stack:** Express 5, TypeScript, React 19, react-router v7, Tailwind v4 CSS-first, Lucide React, localStorage.

---

## ════════════════════════════════════
## PARTE 1 — BACKEND: Corrigir CORS + Cookie SameSite
## ════════════════════════════════════

### Task 1: Mover `cors()` antes do `generalLimiter` em `index.ts`

**Files:**
- Modify: `backend/src/index.ts`

**Diagnóstico:**
O middleware `cors()` está registrado DEPOIS do `generalLimiter`. Quando um rate limit (429) é atingido, a resposta não tem headers `Access-Control-Allow-Origin`, então o browser reporta "CORS error" em vez de 429. Isso faz o app parecer "offline".

**Step 1: Verificar a ordem atual dos middlewares**

```bash
cd backend && grep -n "cors\|generalLimiter\|helmet\|requestLog" src/index.ts | head -30
```
Esperado: ver que `generalLimiter` vem antes de `cors(...)`.

**Step 2: Mover o bloco cors() para imediatamente após helmet()**

Localizar no `src/index.ts` o bloco:
```ts
app.use(generalLimiter);
// ...
app.use(
  cors({
```

E reordenar para que fique:
```ts
// 1. CORS — DEVE vir antes do rate limiter para que 429 também tenha CORS headers
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

// 2. Rate limiter (após CORS para que 429 tenha Access-Control-Allow-Origin)
app.use(generalLimiter);
```

**Step 3: Verificar que não há erros de compilação**

```bash
cd backend && npx tsc --noEmit
```
Esperado: zero erros.

**Step 4: Commit**

```bash
cd backend && git add src/index.ts
git commit -m "fix: move cors() before generalLimiter so 429 responses include CORS headers"
```

---

### Task 2: Corrigir `sameSite: "strict"` → `"lax"` nos cookies JWT

**Files:**
- Modify: `backend/src/controllers/authController.ts`

**Diagnóstico:**
`sameSite: "strict"` impede o browser de enviar o cookie `accessToken` em QUALQUER requisição cross-origin (frontend porta 5173 → backend porta 3001). Isso quebra:
1. O refresh automático de token (o refresh endpoint nunca recebe o `refreshToken` cookie)
2. Se o `Authorization: Bearer` do localStorage expirar, o usuário é deslogado silenciosamente

`sameSite: "lax"` é o valor correto para SPAs com backend separado no mesmo domínio (ou localhost com portas diferentes em dev). Ele ainda protege contra CSRF em navegação cross-site.

**Step 1: Localizar `getCookieOptions` em authController.ts**

```bash
cd backend && grep -n "sameSite\|getCookieOptions\|httpOnly" src/controllers/authController.ts | head -20
```

**Step 2: Alterar `sameSite: "strict"` para `"lax"`**

Localizar o bloco:
```ts
const getCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeMs,
});
```

Alterar para:
```ts
const getCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  // "lax" permite que o cookie seja enviado em requests cross-origin da mesma app
  // (e.g., frontend:5173 → backend:3001 em dev). "strict" bloquearia todos os cookies
  // em requests cross-origin, quebrando o refresh token flow em SPAs.
  sameSite: (env.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
  path: "/",
  maxAge: maxAgeMs,
});
```

> **Nota:** Em produção, quando frontend e backend estão no mesmo domínio, `"strict"` pode voltar a ser usado. Para dev com portas diferentes, `"lax"` é obrigatório.

**Step 3: Verificar compilação**

```bash
cd backend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/controllers/authController.ts
git commit -m "fix: use sameSite lax in dev so cookies are sent on cross-origin requests (port 5173→3001)"
```

---

### Task 3: Verificar e corrigir status de usuários no seed

**Files:**
- Read: `backend/prisma/seed.ts`

**Diagnóstico:**
O middleware `verifyToken` em `auth.ts` rejeita com 403 "Conta não está ativa" se `user.status !== "ACTIVE"`. Novos usuários registrados têm `status: "PENDING"` até verificar o email. Se o seed não criar usuários como `ACTIVE`, o login em si também falha (o loginController tem o mesmo check).

**Step 1: Verificar o status dos usuários no seed**

```bash
cd backend && grep -n "status\|ACTIVE\|PENDING" prisma/seed.ts
```
Esperado: usuários criados com `status: "ACTIVE"` e `isVerified: true`.

**Step 2: Se os usuários de teste não estiverem ACTIVE, corrigir**

No `prisma/seed.ts`, nos blocos `prisma.user.upsert` para os 3 usuários de teste, garantir:
```ts
status: "ACTIVE",
isVerified: true,
emailVerifiedAt: new Date(),
```

**Step 3: Verificar se há um endpoint ou flag para auto-ativar usuários em dev**

```bash
cd backend && grep -rn "status.*ACTIVE\|isVerified.*true" src/controllers/authController.ts | head -20
```
Se o registro auto-ativa em dev (`NODE_ENV !== "production"`), documentar. Se não, o usuário precisa verificar email para logar.

**Step 4: Re-rodar seed para confirmar**

```bash
cd backend && npm run db:seed
```
Esperado: seed executado sem erros.

**Step 5: Testar login com usuário de teste**

```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@teste.com","password":"Teste@123"}' | jq .
```
Esperado: `{ "success": true, "data": { "token": "...", "user": {...} } }`

**Step 6: Commit (se seed foi alterado)**

```bash
git add prisma/seed.ts
git commit -m "fix: ensure seed users are created with status ACTIVE and isVerified true"
```

---

### Task 4: Testar end-to-end que autenticação funciona

**Step 1: Iniciar backend**

```bash
cd backend && npm run dev
```

**Step 2: Testar login + endpoint protegido**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@teste.com","password":"Teste@123"}' | jq -r '.data.token')

echo "Token: $TOKEN"

# Endpoint protegido (carteira)
curl -s http://localhost:3001/api/wallet \
  -H "Authorization: Bearer $TOKEN" | jq .

# Endpoint protegido (notificações)
curl -s http://localhost:3001/api/services/notifications \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Esperado: ambos retornam `{ "success": true, "data": {...} }` (não 401/403/204).

**Step 3: Testar CORS preflight (o 204 esperado)**

```bash
curl -s -I -X OPTIONS http://localhost:3001/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST"
```
Esperado: `HTTP/1.1 204 No Content` com `Access-Control-Allow-Origin: http://localhost:5173` — isso é CORRETO e esperado.

**Step 4: Commit de documentação se necessário**

Nenhum arquivo para commitar nesta task — é apenas verificação.

---

## ════════════════════════════════════
## PARTE 2 — FRONTEND: Corrigir Tour Interativo do Profissional
## ════════════════════════════════════

### Task 5: Pular steps KYC para usuários já verificados (TourContext)

**Files:**
- Modify: `frontend/src/context/TourContext.tsx`

**Diagnóstico:**
Steps 2 (`tour-kyc-cta`) e 3 (`tour-verify-form`) do tour profissional são sobre verificação KYC. O `data-tour="tour-kyc-cta"` só existe no DOM quando `!user?.isVerified` (é renderizado condicionalmente no Dashboard). Quando o usuário JÁ é verificado:
- Step 2: `querySelector` retorna `null` → card centra, sem highlight, mostrando mensagem sobre KYC para quem já verificou
- Step 3: navega para `/verify-email` (rota errada!) e mostra "sua conta precisa de validação documental e facial"

A solução é tornar o `startTour` consciente do estado de verificação do usuário, filtrando dinamicamente os steps irrelevantes.

**Step 1: Adicionar import de `useAuth` no TourContext**

Localizar os imports no topo de `TourContext.tsx`:
```ts
import { useNavigate } from "react-router";
```

Adicionar após:
```ts
import { useAuth } from "./AuthContext";
```

> **Nota:** TourContext está dentro de `TourProvider` que é filho de `AuthProvider` no App.tsx, então `useAuth()` é acessível.

**Step 2: Usar `useAuth` dentro do `TourProvider` e filtrar steps dinamicamente**

Localizar no `TourProvider`:
```ts
export const TourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TourState>({
```

Adicionar `useAuth` logo após:
```ts
export const TourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<TourState>({
```

**Step 3: Marcar os steps KYC como opcionais e filtrar em `startTour`**

Adicionar campo `requiresUnverified?: boolean` na interface `TourStep`:
```ts
export interface TourStep {
  id: string;
  route: string | null;
  icon: string;
  title: string;
  description: string;
  simulationMode?: boolean;
  requiresUnverified?: boolean; // se true, step só aparece para usuários não verificados
}
```

Marcar os steps KYC no `PROFESSIONAL_STEPS`:
```ts
{
  id: "tour-kyc-cta",
  route: "/professional/dashboard",
  icon: "BadgeCheck",
  title: "Complete a verificação (KYC)",
  description: "Clique aqui para enviar seus documentos. É rápido e garante mais confiança para os seus clientes.",
  requiresUnverified: true,  // ← ADICIONAR
},
{
  id: "tour-verify-form",
  route: "/verify-account",  // ← CORRIGIR: era "/verify-email", o data-tour está em /verify-account
  icon: "FileText",
  title: "Envie seus documentos",
  description: "Preencha seus dados e envie uma foto do documento. Você será notificado por email quando aprovado.",
  requiresUnverified: true,  // ← ADICIONAR
},
```

**Step 4: Filtrar steps em `startTour` baseado em `user?.isVerified`**

Localizar a função `startTour`:
```ts
const startTour = useCallback(
  (id: TourId) => {
    const steps = STEPS_MAP[id];
    setState({
      isActive: true,
      tourId: id,
      currentStep: 0,
      steps,
    });
    navigateToStep(steps[0]);
  },
  [navigateToStep]
);
```

Substituir por:
```ts
const startTour = useCallback(
  (id: TourId) => {
    // Filtrar steps que requerem usuário não verificado quando já é verificado
    const allSteps = STEPS_MAP[id];
    const steps = allSteps.filter((step) => {
      if (step.requiresUnverified && user?.isVerified) return false;
      return true;
    });
    setState({
      isActive: true,
      tourId: id,
      currentStep: 0,
      steps,
    });
    navigateToStep(steps[0]);
  },
  [navigateToStep, user?.isVerified]
);
```

**Step 5: Verificar compilação**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: zero erros.

**Step 6: Commit**

```bash
cd frontend && git add src/context/TourContext.tsx
git commit -m "fix: skip KYC tour steps for already-verified professionals; fix verify-email route to verify-account"
```

---

### Task 6: Corrigir VerifyAccount.tsx — adicionar guard para usuários verificados

**Files:**
- Modify: `frontend/src/pages/VerifyAccount.tsx`

**Diagnóstico:**
`VerifyAccount.tsx` não verifica `user?.isVerified`. Para usuários verificados que chegam nesta página (via tour ou link direto), a página sempre mostra "sua conta ainda precisa de validação documental e facial" — que é errado. Deve mostrar uma mensagem de sucesso.

**Step 1: Ler o arquivo atual**

```bash
cd frontend && cat src/pages/VerifyAccount.tsx
```

**Step 2: Adicionar branch para usuário verificado**

O componente atual retorna sempre o mesmo JSX. Substituir por versão com guard:

```tsx
import React from "react";
import { Link } from "react-router";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const VerifyAccount: React.FC = () => {
  const { user } = useAuth();

  // Usuário já verificado: mostrar tela de confirmação
  if (user?.isVerified) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10">
        <div className="card w-full border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Conta verificada!
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            {user?.name ? `${user.name}, sua` : "Sua"} identidade já foi verificada com sucesso.
            Você tem acesso completo à plataforma.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/professional/dashboard" className="btn btn-primary">
              Ir para o painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Usuário não verificado: mostrar instrução de verificação
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10">
      <div
        className="card w-full border border-slate-200 dark:border-slate-700 p-8 text-center"
        data-tour="tour-verify-form"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificação de conta
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {user?.name
            ? `${user.name}, sua conta ainda precisa passar pela verificação de identidade para liberar todas as funções.`
            : "Sua conta ainda precisa passar pela verificação de identidade para liberar todas as funções."}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Você será notificado por e-mail quando a verificação for aprovada.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login" className="btn btn-outline">
            Voltar para login
          </Link>
          <Link to="/" className="btn btn-primary">
            Ir para página inicial
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;
```

**Step 3: Verificar compilação**

```bash
cd frontend && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/VerifyAccount.tsx
git commit -m "fix: show verified confirmation on VerifyAccount page instead of KYC prompt for verified users"
```

---

### Task 7: Corrigir race condition de posicionamento do card após `navigate()` no TourSpotlight

**Files:**
- Modify: `frontend/src/components/common/TourSpotlight.tsx`

**Diagnóstico:**
Este é o bug principal que faz o card ficar preso no centro a partir do step 5 (e potencialmente outros steps cross-route).

**Causa raiz:** No `nextStep()` (TourContext), `navigate(newRoute)` é chamado dentro do `setState` callback. React Router começa a desmontar a página atual e montar a nova. Mas `useLayoutEffect` no TourSpotlight re-roda IMEDIATAMENTE com o novo `currentStep`, ANTES da nova página terminar de montar — então `document.querySelector('[data-tour="..."]')` retorna `null`. `setCardPos(null)` é chamado, o card centra. Como as dependências do `useLayoutEffect` (`[isActive, currentStep, currentStepData, isSimulation]`) não mudam depois que a nova página monta, o efeito NUNCA re-roda para tentar de novo.

**Solução:** Introduzir um mecanismo de retry com `requestAnimationFrame` + `setTimeout` para aguardar o DOM da nova página estar disponível.

**Step 1: Adicionar estado de `retryKey` e `useRef` para cancelamento**

Localizar no TourSpotlight:
```ts
const [cardPos, setCardPos] = useState<{
  top: number; left: number; arrowDir: ArrowDir;
} | null>(null);
const highlightRef = useRef<HTMLElement | null>(null);
```

Adicionar após:
```ts
const [cardPos, setCardPos] = useState<{
  top: number; left: number; arrowDir: ArrowDir;
} | null>(null);
const highlightRef = useRef<HTMLElement | null>(null);
// Contador de retry para forçar re-execução do useLayoutEffect após navigate()
const [retryKey, setRetryKey] = useState(0);
const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Step 2: Extrair a lógica de posicionamento em função helper**

A função `positionCard` encapsula toda a lógica atual do `useLayoutEffect`, mas retorna `boolean` indicando se o elemento foi encontrado:

```ts
const positionCard = useCallback(
  (stepData: typeof currentStepData) => {
    if (!stepData || stepData.simulationMode) return false;

    const target = document.querySelector<HTMLElement>(`[data-tour="${stepData.id}"]`);
    if (!target) return false; // elemento ainda não montou

    // Remover highlight anterior
    if (highlightRef.current && highlightRef.current !== target) {
      highlightRef.current.style.outline = "";
      highlightRef.current.style.outlineOffset = "";
      highlightRef.current.style.position = "";
      highlightRef.current.style.zIndex = "";
    }

    // Aplicar highlight
    target.style.outline = "2px solid var(--color-primary-500, #3b82f6)";
    target.style.outlineOffset = "4px";
    target.style.position = "relative";
    target.style.zIndex = "9999";
    highlightRef.current = target;

    // Scroll suave
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // Calcular posição
    const rect = target.getBoundingClientRect();
    const cardW = 320;
    const cardH = 260;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0, left = 0;
    let arrowDir: ArrowDir = "top";

    if (rect.bottom + cardH + gap < vh) {
      top = rect.bottom + gap;
      left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, 16), vw - cardW - 16);
      arrowDir = "top";
    } else if (rect.top - cardH - gap > 0) {
      top = rect.top - cardH - gap;
      left = Math.min(Math.max(rect.left + rect.width / 2 - cardW / 2, 16), vw - cardW - 16);
      arrowDir = "bottom";
    } else if (rect.right + cardW + gap < vw) {
      top = Math.min(Math.max(rect.top + rect.height / 2 - cardH / 2, 16), vh - cardH - 16);
      left = rect.right + gap;
      arrowDir = "left";
    } else {
      top = Math.min(Math.max(rect.top + rect.height / 2 - cardH / 2, 16), vh - cardH - 16);
      left = Math.max(rect.left - cardW - gap, 16);
      arrowDir = "right";
    }

    setCardPos({ top, left, arrowDir });
    return true; // elemento encontrado e posicionado
  },
  [] // sem dependências — usa apenas refs e DOM queries
);
```

**Step 3: Substituir o `useLayoutEffect` para usar retry**

Substituir o `useLayoutEffect` existente por:

```ts
useLayoutEffect(() => {
  // Cancelar retry pendente
  if (retryTimerRef.current) {
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }

  // Limpar highlight anterior
  if (highlightRef.current) {
    highlightRef.current.style.outline = "";
    highlightRef.current.style.outlineOffset = "";
    highlightRef.current.style.position = "";
    highlightRef.current.style.zIndex = "";
    highlightRef.current = null;
  }

  if (!isActive || !currentStepData) return;

  if (isSimulation) {
    setCardPos(null); // centralizado via CSS
    return;
  }

  // Tentar posicionar. Se o elemento ainda não existir (navigate() acabou de rodar),
  // agendar retry com back-off: 100ms → 300ms → 600ms → desiste
  const found = positionCard(currentStepData);
  if (!found) {
    const delays = [100, 300, 600];
    let attempt = 0;

    const tryAgain = () => {
      if (attempt >= delays.length) {
        // Desistiu: centra o card (melhor que nada)
        setCardPos(null);
        return;
      }
      retryTimerRef.current = setTimeout(() => {
        const ok = positionCard(currentStepData);
        if (!ok) {
          attempt++;
          tryAgain();
        }
      }, delays[attempt++]);
    };
    tryAgain();
  }

  return () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };
}, [isActive, currentStep, currentStepData, isSimulation, positionCard, retryKey]);
```

**Step 4: Adicionar `useCallback` import se necessário**

Verificar se `useCallback` está nos imports:
```ts
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
```

**Step 5: Adicionar listener de resize para reposicionar ao redimensionar janela**

Após os efeitos existentes:
```ts
// Reposicionar ao redimensionar a janela
useEffect(() => {
  if (!isActive || !currentStepData || isSimulation) return;

  const handleResize = () => {
    positionCard(currentStepData);
  };

  window.addEventListener("resize", handleResize, { passive: true });
  return () => window.removeEventListener("resize", handleResize);
}, [isActive, currentStepData, isSimulation, positionCard]);
```

**Step 6: Verificar compilação**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: zero erros.

**Step 7: Commit**

```bash
git add src/components/common/TourSpotlight.tsx
git commit -m "fix: retry querySelector after navigate() so tour card positions correctly on cross-route steps"
```

---

### Task 8: Expor `triggerReposition` via TourContext para etapas que precisam de reposicionamento manual

**Files:**
- Modify: `frontend/src/context/TourContext.tsx`
- Modify: `frontend/src/components/common/TourSpotlight.tsx`

**Diagnóstico:**
O retry automático (Task 7) resolve a maioria dos casos. Mas para step 5 (`/professional/catalog/new`), a página pode levar mais de 600ms para montar em máquinas lentas. Uma solução mais robusta é expor um callback no contexto que o componente da página pode chamar quando terminar de montar.

**Step 1: Adicionar `onTourTargetReady` no TourContext**

Na interface `TourContextValue`:
```ts
interface TourContextValue extends TourState {
  startTour: (id: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: (id: TourId) => void;
  onTourTargetReady: () => void; // ← NOVO: chamado pelas páginas quando montam
}
```

No `TourProvider`, adicionar função e contador de ready:
```ts
const notifyTargetReady = useCallback(() => {
  // Incrementa um contador que TourSpotlight observa para re-tentar posicionamento
  setReadyNonce((n) => n + 1);
}, []);
```

E adicionar state:
```ts
const [readyNonce, setReadyNonce] = useState(0);
```

Incluir no provider value:
```ts
<TourContext.Provider
  value={{
    ...state,
    readyNonce,          // ← expor para TourSpotlight
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
    onTourTargetReady: notifyTargetReady,
  }}
>
```

**Step 2: Atualizar a interface para incluir `readyNonce`**

```ts
interface TourContextValue extends TourState {
  startTour: (id: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: (id: TourId) => void;
  onTourTargetReady: () => void;
  readyNonce: number; // incrementa quando uma página sinaliza que seu data-tour está montado
}
```

**Step 3: Adicionar `readyNonce` nas dependências do `useLayoutEffect` do TourSpotlight**

```ts
// No TourSpotlight.tsx, desestruturar readyNonce do useTour():
const { isActive, currentStep, steps, nextStep, prevStep, skipTour, completeTour, readyNonce } = useTour();

// Adicionar readyNonce nas deps do useLayoutEffect:
}, [isActive, currentStep, currentStepData, isSimulation, positionCard, readyNonce]);
```

**Step 4: Adicionar chamada `onTourTargetReady` na página CreateService**

Localizar `frontend/src/pages/professional/CreateService.tsx`.

Adicionar hook no componente:
```tsx
import { useTour } from "../../context/TourContext";

// Dentro do componente:
const { isActive, onTourTargetReady } = useTour();

// Notificar tour quando o formulário terminar de montar
useEffect(() => {
  if (isActive) {
    // Aguarda um frame para garantir que o data-tour está no DOM
    const raf = requestAnimationFrame(() => {
      onTourTargetReady();
    });
    return () => cancelAnimationFrame(raf);
  }
}, [isActive, onTourTargetReady]);
```

**Step 5: Verificar compilação**

```bash
cd frontend && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/context/TourContext.tsx src/components/common/TourSpotlight.tsx src/pages/professional/CreateService.tsx
git commit -m "feat: add onTourTargetReady signal so pages notify tour when their data-tour element is mounted"
```

---

### Task 9: Melhorar UX visual dos steps de simulação (steps 6-9)

**Files:**
- Modify: `frontend/src/components/common/TourSpotlight.tsx`
- Modify: `frontend/src/context/TourContext.tsx`

**Diagnóstico:**
Os steps 6-9 são intencionalmente centrados (simulação). O card está correto. Mas o conteúdo da simulação é sempre o mesmo mock `SimulationOrderCard` para todos os 4 steps, mesmo que cada step descreva algo diferente (pedido recebido → navegar → confirmar → pagamento). Melhorar para que cada step de simulação tenha um visual diferente que ilustre o que está descrevendo.

**Step 1: Adicionar `simulationVariant` ao tipo `TourStep`**

```ts
export interface TourStep {
  id: string;
  route: string | null;
  icon: string;
  title: string;
  description: string;
  simulationMode?: boolean;
  requiresUnverified?: boolean;
  simulationVariant?: "order" | "map" | "confirm" | "payment"; // ← NOVO
}
```

**Step 2: Marcar cada step de simulação com o variant correto**

```ts
{ id: "sim-order-received",  ..., simulationMode: true, simulationVariant: "order" },
{ id: "sim-navigate-map",    ..., simulationMode: true, simulationVariant: "map" },
{ id: "sim-confirm-completion",..., simulationMode: true, simulationVariant: "confirm" },
{ id: "sim-payment-released",..., simulationMode: true, simulationVariant: "payment" },
```

**Step 3: Criar mini-cards específicos por variant no TourSpotlight**

Substituir o único `<SimulationOrderCard />` por um switch baseado em `simulationVariant`:

```tsx
// Dentro do card body, onde estava {isSimulation && <SimulationOrderCard />}:
{isSimulation && currentStepData.simulationVariant && (
  <SimulationContent variant={currentStepData.simulationVariant} />
)}
```

Criar o componente `SimulationContent`:

```tsx
type SimVariant = "order" | "map" | "confirm" | "payment";

const SimulationContent: React.FC<{ variant: SimVariant }> = ({ variant }) => {
  const base = "mt-3 rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm";

  if (variant === "order") return (
    <div className={base}>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold">J</div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">João Silva</p>
          <p className="text-xs text-slate-500">Instalação Elétrica • R$ 350,00</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Novo pedido</span>
      </div>
      <p className="text-xs text-slate-500"><span aria-hidden="true">📅</span> Agendado para amanhã às 14h00</p>
    </div>
  );

  if (variant === "map") return (
    <div className={base}>
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 text-primary-500 flex-shrink-0" />
        <p className="font-medium text-slate-800 dark:text-slate-100 text-xs">Rua das Flores, 123 — São Paulo</p>
      </div>
      <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
        <p className="text-xs text-slate-400">🗺️ Mapa integrado</p>
      </div>
      <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">→ Ver rota no mapa</p>
    </div>
  );

  if (variant === "confirm") return (
    <div className={base}>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <p className="text-xs font-medium text-slate-800 dark:text-slate-100">Instalação Elétrica — concluída</p>
      </div>
      <div className="flex gap-3 text-xs">
        <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Você confirmou</p>
        </div>
        <div className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 p-2 text-center">
          <p className="text-slate-500">Aguard. cliente...</p>
        </div>
      </div>
    </div>
  );

  // payment
  return (
    <div className={base}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">Pagamento liberado</p>
        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">+ R$ 315,00</span>
      </div>
      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex justify-between"><span>Valor do serviço</span><span>R$ 350,00</span></div>
        <div className="flex justify-between text-slate-400"><span>Taxa plataforma (10%)</span><span>− R$ 35,00</span></div>
        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700"><span>Seu ganho</span><span>R$ 315,00</span></div>
      </div>
    </div>
  );
};
```

**Step 4: Adicionar `MapPin` e `CheckCircle` nos imports do TourSpotlight se não estiverem**

Verificar linha de imports do lucide e adicionar se necessário.

**Step 5: Verificar compilação**

```bash
cd frontend && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/components/common/TourSpotlight.tsx src/context/TourContext.tsx
git commit -m "feat: differentiated simulation cards per step in professional tour (order/map/confirm/payment)"
```

---

### Task 10: Teste manual end-to-end do tour

**Step 1: Iniciar frontend**

```bash
cd frontend && npm run dev
```

**Step 2: Testar tour com usuário VERIFICADO (profissional@teste.com)**

1. Abrir http://localhost:5173 e logar com `profissional@teste.com / Teste@123`
2. Ir para Settings → clicar "Rever tutorial" do profissional
3. Verificar:
   - Step 1 (`tour-pro-welcome`): card aparece ao lado do elemento de boas-vindas no dashboard ✓
   - Steps 2-3 (KYC): **DEVEM SER PULADOS** para usuário verificado ✓
   - Step 4 (`tour-create-service-btn`): card aparece ao lado do botão de criar serviço ✓
   - Step 5 (`tour-create-service-form`): navega para `/professional/catalog/new`, card aparece ao lado do formulário (não no centro) ✓
   - Steps 6-9 (simulação): card centrado com mini-cards diferentes para cada step ✓
   - Último step: botão "Começar!" fecha o tour ✓

**Step 3: Testar tour com usuário NÃO VERIFICADO**

> Criar usuário novo ou temporariamente setar `isVerified: false` no seed para teste

1. Logar com usuário não verificado
2. Ir para dashboard do profissional
3. Verificar:
   - Step 2 (`tour-kyc-cta`): card aparece ao lado do banner KYC ✓
   - Step 3 (`tour-verify-form`): navega para `/verify-account`, card aparece ao lado do formulário de verificação ✓
   - Página `/verify-account` mostra texto sobre verificação (não mensagem de "verificado!") ✓

**Step 4: Testar navegação com cliente**

1. Logar com `cliente@teste.com / Teste@123`
2. Verificar que carteira, conversas e serviços carregam normalmente (sem 403/401)
3. Verificar DevTools → Network: requests para `/api/wallet`, `/api/services`, `/api/services/notifications` retornam 200 (não 204, exceto OPTIONS que é esperado)

**Step 5: Commit final se houver ajustes**

```bash
git add -p
git commit -m "fix: tour and auth integration test adjustments"
```

---

## ════════════════════════════════════
## PARTE 3 — DOCUMENTAÇÃO
## ════════════════════════════════════

### Task 11: Atualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Atualizar a seção "Gotchas e Padrões Não-Óbvios"**

Adicionar os seguintes itens à lista:

```markdown
8. **Cookie sameSite em dev**: `getCookieOptions` em `authController.ts` usa `sameSite: "lax"` em
   dev e `"strict"` em prod. Manter assim — `"strict"` quebra cross-origin cookies em dev (porta 5173 → 3001).

9. **Ordem de middleware CORS**: `cors()` deve ficar ANTES de `generalLimiter` em `index.ts`. Se rate-limited (429),
   a resposta precisa ter `Access-Control-Allow-Origin` para o browser não reportar falso CORS error.

10. **Tour steps condicionais**: Steps com `requiresUnverified: true` no `PROFESSIONAL_STEPS` são automaticamente
    filtrados por `startTour()` quando `user.isVerified === true`. Para adicionar novos steps KYC, usar esse campo.

11. **Tour posicionamento cross-route**: `TourSpotlight` usa retry automático (100ms → 300ms → 600ms) para encontrar
    `data-tour` elementos após `navigate()`. Páginas que são alvo de tour podem chamar `onTourTargetReady()` (via
    `useTour()`) no seu `useEffect` de mount para sinalizar que o elemento está pronto mais rapidamente.
```

**Step 2: Atualizar a seção "O Que Precisa Ser Melhorado/Corrigido"**

Marcar como **RESOLVIDO**:
- "Sem tratamento de erros padronizado no frontend" (já resolvido anteriormente)
- Adicionar novo item resolvido:

```markdown
- **Cookie SameSite e CORS em dev**: ~~`sameSite: "strict"` impedia cookies cross-origin em dev, quebrando refresh token e causando aparência de "offline"~~ → **RESOLVIDO**: Alterado para `"lax"` em dev.
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with cookie sameSite, CORS ordering, and tour system gotchas"
```

---

## Ordem de Execução Recomendada

```
Task 1 → Task 2 → Task 3 → Task 4  (backend — testar que auth funciona)
    ↓
Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10  (frontend — tour)
    ↓
Task 11  (docs)
```

**Tasks 1-4 devem ser feitas primeiro** — sem autenticação funcionando, o tour não pode ser testado de forma significativa (usuário não consegue logar para ver o dashboard).

**Tasks 5 e 6 são independentes** entre si e podem ser feitas em paralelo.

**Task 7 (retry)** deve ser feita antes da **Task 8 (onTourTargetReady)** — Task 8 complementa a 7.

**Task 9 (simulação visual)** é independente e pode ser feita em qualquer ordem após Tasks 5-8.
