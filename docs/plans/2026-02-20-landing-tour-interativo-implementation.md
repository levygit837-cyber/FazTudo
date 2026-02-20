# Landing Page Refactor + Tutorial Interativo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remover a seção "Como funciona" da landing de clientes, substituir por fluxo visual 3 etapas, e implementar um sistema de tour interativo global (TourContext + TourSpotlight) para guiar clientes e profissionais na primeira entrada.

**Architecture:** TourContext global gerencia estado do tour (tourId, currentStep), TourSpotlight usa `getBoundingClientRect()` + `ReactDOM.createPortal` para renderizar card flutuante via `position:fixed` sobre qualquer elemento marcado com `data-tour="id"`. Tours são disparados automaticamente na primeira visita ao dashboard (localStorage flag). A landing perde o HowItWorksInteractive e ganha HowItWorksSimple com visual coeso ao design system.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first, slate-* NUNCA gray-*), Lucide React, react-router v7, localStorage para persistência do estado do tour.

**Design System obrigatório** (ver `docs/plans/2026-02-20-design-system-reference.md`):
- Cinzas: `slate-*` SEMPRE (nunca `gray-*`)
- Card padrão: `rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl`
- Botão primário: `bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue`
- Touch targets mínimos: 44×44px
- Emojis sempre com `<span aria-hidden="true">`
- Focus rings: `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2`

---

## Task 1: Criar `TourContext`

**Files:**
- Create: `frontend/src/context/TourContext.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Criar o arquivo TourContext.tsx**

```tsx
// frontend/src/context/TourContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TourId = "client" | "professional";

export interface TourStep {
  id: string; // data-tour value (e.g. "tour-client-welcome")
  route: string | null; // navigate to this route before showing (null = stay)
  icon: string; // lucide icon name (string, TourSpotlight resolves it)
  title: string;
  description: string;
  simulationMode?: boolean; // true = no target element, center on screen
  simulationContent?: React.ReactNode; // mini mockup inside card
}

interface TourState {
  isActive: boolean;
  tourId: TourId | null;
  currentStep: number;
  steps: TourStep[];
}

interface TourContextValue extends TourState {
  startTour: (id: TourId) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: (id: TourId) => void; // limpa localStorage e permite rever
}

// ─── Steps definitions ───────────────────────────────────────────────────────

export const CLIENT_STEPS: TourStep[] = [
  {
    id: "tour-client-welcome",
    route: "/client/dashboard",
    icon: "Sparkles",
    title: "Bem-vindo ao FazTudo!",
    description:
      "Este é seu painel. Aqui você acompanha pedidos, mensagens e encontra novos profissionais.",
  },
  {
    id: "tour-search-services",
    route: "/client/dashboard",
    icon: "Search",
    title: "Busque profissionais",
    description:
      'Clique aqui para encontrar profissionais por categoria, localização ou nome do serviço.',
  },
  {
    id: "tour-service-card-first",
    route: "/services",
    icon: "Star",
    title: "Compare avaliações e preços",
    description:
      "Veja avaliações reais, portfólio e o preço de cada profissional antes de contratar.",
  },
  {
    id: "tour-service-chat-btn",
    route: null, // já está em /services
    icon: "MessageCircle",
    title: "Tire dúvidas antes de contratar",
    description:
      "Use o chat para conversar com o profissional antes de criar o pedido. Sem compromisso.",
  },
  {
    id: "tour-request-service-btn",
    route: null,
    icon: "ShoppingBag",
    title: "Solicite o serviço",
    description:
      "Quando estiver pronto, clique aqui para criar seu pedido. O pagamento fica em escrow até você aprovar.",
  },
  {
    id: "tour-new-order-btn",
    route: "/client/dashboard",
    icon: "Plus",
    title: 'Ou use "Novo Serviço"',
    description:
      'Não achou o que precisa? Clique em "Novo Serviço" e descreva o que você quer — profissionais enviarão propostas.',
  },
];

export const PROFESSIONAL_STEPS: TourStep[] = [
  {
    id: "tour-pro-welcome",
    route: "/professional/dashboard",
    icon: "Sparkles",
    title: "Bem-vindo, profissional!",
    description:
      "Este é seu painel. Para ter acesso completo — incluindo receber pagamentos — você precisa verificar sua identidade.",
  },
  {
    id: "tour-kyc-cta",
    route: "/professional/dashboard",
    icon: "BadgeCheck",
    title: "Complete a verificação (KYC)",
    description:
      "Clique aqui para enviar seus documentos. É rápido e garante mais confiança para os seus clientes.",
  },
  {
    id: "tour-verify-form",
    route: "/verify-account",
    icon: "FileText",
    title: "Envie seus documentos",
    description:
      "Preencha seus dados e envie uma foto do documento. Você será notificado por email quando aprovado.",
  },
  {
    id: "tour-create-service-btn",
    route: "/professional/dashboard",
    icon: "Briefcase",
    title: "Crie seu primeiro serviço",
    description:
      "Enquanto aguarda a verificação, você já pode criar seus serviços. Clique aqui para começar.",
  },
  {
    id: "tour-create-service-form",
    route: "/professional/create-service",
    icon: "Edit",
    title: "Descreva seu serviço",
    description:
      "Adicione título, descrição, preço e fotos. Serviços com descrição detalhada recebem até 3× mais pedidos.",
  },
  {
    id: "sim-order-received",
    route: "/professional/dashboard",
    icon: "Clock",
    title: "Simulação: pedido recebido!",
    description:
      "João Silva acabou de solicitar sua Instalação Elétrica. Após o dia agendado, você terá 15 minutos para chegar ao local combinado.",
    simulationMode: true,
  },
  {
    id: "sim-navigate-map",
    route: "/professional/dashboard",
    icon: "MapPin",
    title: "Navegue até o cliente",
    description:
      "O mapa integrado mostra a rota até o endereço do cliente. Clique em 'Ver rota' para abrir a navegação passo a passo.",
    simulationMode: true,
  },
  {
    id: "sim-confirm-completion",
    route: "/professional/dashboard",
    icon: "CheckCircle",
    title: "Confirme a conclusão",
    description:
      "Ao terminar o serviço, confirme a conclusão. O cliente também confirma. O pagamento fica em escrow até os dois confirmarem.",
    simulationMode: true,
  },
  {
    id: "sim-payment-released",
    route: "/professional/dashboard",
    icon: "Wallet",
    title: "Pagamento liberado!",
    description:
      "Na simulação paramos aqui. Na realidade, 90% do valor vai direto para sua carteira FazTudo. Agora você está pronto para atender!",
    simulationMode: true,
  },
];

const STEPS_MAP: Record<TourId, TourStep[]> = {
  client: CLIENT_STEPS,
  professional: PROFESSIONAL_STEPS,
};

const STORAGE_KEYS: Record<TourId, string> = {
  client: "faztudo_client_tour_done",
  professional: "faztudo_pro_tour_done",
};

// ─── Context ──────────────────────────────────────────────────────────────────

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TourState>({
    isActive: false,
    tourId: null,
    currentStep: 0,
    steps: [],
  });

  // ref to avoid stale closure in navigate
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const navigateToStep = useCallback(
    (step: TourStep) => {
      if (step.route && typeof window !== "undefined") {
        navigate(step.route);
      }
    },
    [navigate]
  );

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

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = prev.currentStep + 1;
      if (next >= prev.steps.length) return prev; // completeTour handles this
      const nextStepData = prev.steps[next];
      if (nextStepData.route) navigate(nextStepData.route);
      return { ...prev, currentStep: next };
    });
  }, [navigate]);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const p = prev.currentStep - 1;
      if (p < 0) return prev;
      const prevStepData = prev.steps[p];
      if (prevStepData.route) navigate(prevStepData.route);
      return { ...prev, currentStep: p };
    });
  }, [navigate]);

  const closeTour = useCallback((id: TourId | null) => {
    if (id) localStorage.setItem(STORAGE_KEYS[id], "1");
    setState({ isActive: false, tourId: null, currentStep: 0, steps: [] });
  }, []);

  const skipTour = useCallback(() => {
    closeTour(stateRef.current.tourId);
  }, [closeTour]);

  const completeTour = useCallback(() => {
    closeTour(stateRef.current.tourId);
  }, [closeTour]);

  const resetTour = useCallback(
    (id: TourId) => {
      localStorage.removeItem(STORAGE_KEYS[id]);
      startTour(id);
    },
    [startTour]
  );

  return (
    <TourContext.Provider
      value={{
        ...state,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        resetTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = (): TourContextValue => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
};

export default TourContext;
```

**Step 2: Verificar que não há erro de TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: sem erros relacionados ao TourContext.

**Step 3: Adicionar TourProvider ao App.tsx**

Abra `frontend/src/App.tsx`. Encontre onde `AuthProvider` e `ThemeProvider` envolvem a aplicação. Adicione `TourProvider` **dentro** de `<BrowserRouter>` (porque usa `useNavigate`) mas envolvendo as rotas.

Exemplo — antes:
```tsx
// App.tsx (trecho relevante)
<BrowserRouter>
  <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        {/* rotas */}
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
</BrowserRouter>
```

Depois (adicionar TourProvider e TourSpotlight):
```tsx
import { TourProvider } from "./context/TourContext";
import { TourSpotlight } from "./components/common/TourSpotlight";

// dentro de BrowserRouter:
<ThemeProvider>
  <AuthProvider>
    <TourProvider>
      <ToastProvider>
        <TourSpotlight />
        {/* rotas */}
      </ToastProvider>
    </TourProvider>
  </AuthProvider>
</ThemeProvider>
```

> **Nota**: `TourSpotlight` ainda não existe. Ele será criado na Task 2. O App.tsx pode ser editado agora mas vai ter erro de import até a Task 2 ser concluída. Edite o App.tsx e deixe o import comentado `// import { TourSpotlight } from "./components/common/TourSpotlight";` por enquanto, descomentando na Task 2.

**Step 4: Commit**

```bash
git add frontend/src/context/TourContext.tsx frontend/src/App.tsx
git commit -m "feat: add TourContext with client and professional step definitions"
```

---

## Task 2: Criar `TourSpotlight` Component

**Files:**
- Create: `frontend/src/components/common/TourSpotlight.tsx`

**Step 1: Criar o componente**

```tsx
// frontend/src/components/common/TourSpotlight.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle,
  Clock,
  Edit,
  FileText,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { useTour } from "../../context/TourContext";

// ─── Icon resolver ──────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  Search,
  Star,
  MessageCircle,
  ShoppingBag,
  Plus,
  BadgeCheck,
  FileText,
  Briefcase,
  Edit,
  Clock,
  MapPin,
  CheckCircle,
  Wallet,
};

// ─── Simulation Card ─────────────────────────────────────────────────────────

const SimulationOrderCard: React.FC = () => (
  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/60 p-4">
    <div className="flex items-center gap-3 mb-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold">
        J
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          João Silva
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Instalação Elétrica • R$ 350,00
        </p>
      </div>
      <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        Pendente
      </span>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">
      <span aria-hidden="true">📍</span>{" "}
      <span className="sr-only">Localização:</span>Rua das Flores, 123 — São Paulo
    </p>
  </div>
);

// ─── Arrow positions ─────────────────────────────────────────────────────────

type ArrowDir = "top" | "bottom" | "left" | "right";

function getArrowPath(dir: ArrowDir): string {
  switch (dir) {
    case "top":
      return "M12 0 L24 16 L0 16 Z";
    case "bottom":
      return "M12 16 L24 0 L0 0 Z";
    case "left":
      return "M0 12 L16 0 L16 24 Z";
    case "right":
      return "M16 12 L0 0 L0 24 Z";
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const TourSpotlight: React.FC = () => {
  const {
    isActive,
    currentStep,
    steps,
    tourId,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useTour();

  const [cardPos, setCardPos] = useState<{
    top: number;
    left: number;
    arrowDir: ArrowDir;
  } | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);

  const currentStepData = isActive ? steps[currentStep] : null;
  const isLastStep = isActive && currentStep === steps.length - 1;
  const isSimulation = currentStepData?.simulationMode === true;
  const Icon = currentStepData ? ICON_MAP[currentStepData.icon] ?? Sparkles : Sparkles;

  // Highlight target element and calculate card position
  useLayoutEffect(() => {
    if (!isActive || !currentStepData) return;

    // Remove previous highlight
    if (highlightRef.current) {
      highlightRef.current.style.outline = "";
      highlightRef.current.style.outlineOffset = "";
      highlightRef.current.style.position = "";
      highlightRef.current.style.zIndex = "";
      highlightRef.current = null;
    }

    if (isSimulation) {
      setCardPos(null); // centered via CSS
      return;
    }

    const target = document.querySelector<HTMLElement>(
      `[data-tour="${currentStepData.id}"]`
    );

    if (!target) {
      setCardPos(null);
      return;
    }

    // Highlight the element
    target.style.outline = "2px solid var(--color-primary-500, #3b82f6)";
    target.style.outlineOffset = "4px";
    target.style.position = "relative";
    target.style.zIndex = "9999";
    highlightRef.current = target;

    // Scroll into view
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // Calculate card position
    const rect = target.getBoundingClientRect();
    const cardW = 320;
    const cardH = 220; // approx
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowDir: ArrowDir = "top";

    // Prefer below the element
    if (rect.bottom + cardH + gap < vh) {
      top = rect.bottom + gap;
      left = Math.min(
        Math.max(rect.left + rect.width / 2 - cardW / 2, 16),
        vw - cardW - 16
      );
      arrowDir = "top";
    } else if (rect.top - cardH - gap > 0) {
      // Above
      top = rect.top - cardH - gap;
      left = Math.min(
        Math.max(rect.left + rect.width / 2 - cardW / 2, 16),
        vw - cardW - 16
      );
      arrowDir = "bottom";
    } else if (rect.right + cardW + gap < vw) {
      // Right
      top = Math.min(
        Math.max(rect.top + rect.height / 2 - cardH / 2, 16),
        vh - cardH - 16
      );
      left = rect.right + gap;
      arrowDir = "left";
    } else {
      // Left
      top = Math.min(
        Math.max(rect.top + rect.height / 2 - cardH / 2, 16),
        vh - cardH - 16
      );
      left = rect.left - cardW - gap;
      arrowDir = "right";
    }

    setCardPos({ top, left, arrowDir });
  }, [isActive, currentStep, currentStepData, isSimulation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightRef.current) {
        highlightRef.current.style.outline = "";
        highlightRef.current.style.outlineOffset = "";
        highlightRef.current.style.position = "";
        highlightRef.current.style.zIndex = "";
      }
    };
  }, []);

  if (!isActive || !currentStepData) return null;

  const cardStyle: React.CSSProperties = isSimulation
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        width: "min(360px, calc(100vw - 2rem))",
      }
    : cardPos
    ? {
        position: "fixed",
        top: cardPos.top,
        left: cardPos.left,
        zIndex: 9999,
        width: "min(320px, calc(100vw - 2rem))",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        width: "min(320px, calc(100vw - 2rem))",
      };

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-black/50"
        style={{ zIndex: 9998 }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-label={`Tutorial passo ${currentStep + 1} de ${steps.length}: ${currentStepData.title}`}
        aria-modal="true"
        style={cardStyle}
      >
        {/* Arrow (not shown in simulation mode) */}
        {!isSimulation && cardPos && (
          <div
            aria-hidden="true"
            className={`absolute ${
              cardPos.arrowDir === "top"
                ? "-top-3 left-1/2 -translate-x-1/2"
                : cardPos.arrowDir === "bottom"
                ? "-bottom-3 left-1/2 -translate-x-1/2 rotate-180"
                : cardPos.arrowDir === "left"
                ? "-left-3 top-1/2 -translate-y-1/2 -rotate-90"
                : "-right-3 top-1/2 -translate-y-1/2 rotate-90"
            }`}
          >
            <svg width="24" height="16" viewBox="0 0 24 16">
              <polygon
                points={getArrowPath(cardPos.arrowDir)}
                className="fill-white dark:fill-slate-900"
              />
            </svg>
          </div>
        )}

        {/* Card body */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl shadow-2xl dark:shadow-glow-blue p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex-shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Passo {currentStep + 1} de {steps.length}
                </p>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                  {currentStepData.title}
                </h3>
              </div>
            </div>
            <button
              onClick={skipTour}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 flex-shrink-0"
              aria-label="Pular tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {currentStepData.description}
          </p>

          {/* Simulation content */}
          {isSimulation && <SimulationOrderCard />}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4 mb-4" aria-hidden="true">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === currentStep
                    ? "w-4 h-1.5 bg-primary-500"
                    : i < currentStep
                    ? "w-1.5 h-1.5 bg-primary-300 dark:bg-primary-700"
                    : "w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded px-1"
                >
                  ← Anterior
                </button>
              )}
              <button
                onClick={skipTour}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded px-1"
              >
                Pular tour
              </button>
            </div>

            {isLastStep ? (
              <button
                onClick={completeTour}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                Começar!
                <CheckCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default TourSpotlight;
```

**Step 2: Descomentar o import no App.tsx**

Em `frontend/src/App.tsx`, descomentar:
```tsx
import { TourSpotlight } from "./components/common/TourSpotlight";
```
E adicionar `<TourSpotlight />` logo após a abertura do `<TourProvider>` (antes das rotas).

**Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: sem erros novos.

**Step 4: Verificar que o App.tsx renderiza sem crash**

```bash
cd frontend && npm run dev
```
Abrir http://localhost:5173 e verificar que a página carrega normalmente (sem tour ativo, pois nenhum dashboard foi visitado ainda).

**Step 5: Commit**

```bash
git add frontend/src/components/common/TourSpotlight.tsx frontend/src/App.tsx
git commit -m "feat: add TourSpotlight component with portal rendering and position detection"
```

---

## Task 3: Integrar Tour no Dashboard do Cliente

**Files:**
- Modify: `frontend/src/pages/client/Dashboard.tsx`
- Modify: `frontend/src/components/common/ClientOnboarding.tsx` (não deletar ainda, só parar de usar)

**Step 1: Abrir `frontend/src/pages/client/Dashboard.tsx`**

Localizar:
1. O import de `ClientOnboarding` — **remover** o import e o uso do componente.
2. O estado `showOnboarding` — **remover** (substituído pelo TourContext).
3. O `localStorage.getItem("faztudo_client_onboarding_done")` — **remover**.

**Step 2: Adicionar gatilho do tour e atributos `data-tour`**

Adicionar no topo do arquivo:
```tsx
import { useTour } from "../../context/TourContext";
```

Dentro do componente `ClientDashboard`, após as declarações de estado:
```tsx
const { startTour } = useTour();

// Disparar tour na primeira visita
useEffect(() => {
  if (!localStorage.getItem("faztudo_client_tour_done")) {
    // Pequeno delay para a página renderizar
    const timer = setTimeout(() => startTour("client"), 500);
    return () => clearTimeout(timer);
  }
}, [startTour]);
```

**Step 3: Adicionar atributos `data-tour` aos elementos alvo**

Localize os seguintes elementos no JSX do Dashboard do cliente e adicione o atributo:

```tsx
// No heading/título do dashboard (ex: div ou h1 com "Bom dia, {nome}")
<div data-tour="tour-client-welcome" ...>

// No botão/link "Explorar serviços" ou SearchBar (qual vier primeiro no JSX)
// Se houver um Link ou button para /services:
<Link to="/services" data-tour="tour-search-services" ...>

// No botão "Novo Serviço" ou equivalente (Link para /client/new-order)
<Link to="/client/new-order" data-tour="tour-new-order-btn" ...>
```

> **Nota**: Se não houver um botão de busca explícito no dashboard, adicione o `data-tour="tour-search-services"` no componente `SearchBar` ou no primeiro link que leva para `/services`.

**Step 4: Verificar visualmente**

```bash
cd frontend && npm run dev
```
1. Limpar localStorage no DevTools (`faztudo_client_tour_done` → deletar)
2. Navegar para `/client/dashboard` (faça login como `cliente@teste.com / Teste@123`)
3. Verificar que o tour inicia após 500ms
4. Verificar que o passo 1 aponta para o heading do dashboard
5. Clicar "Próximo" — verificar que vai para o passo 2

**Step 5: Commit**

```bash
git add frontend/src/pages/client/Dashboard.tsx
git commit -m "feat: integrate tour trigger and data-tour attributes in client dashboard"
```

---

## Task 4: Integrar Tour no Dashboard do Profissional

**Files:**
- Modify: `frontend/src/pages/professional/Dashboard.tsx`

**Step 1: Remover `ProfessionalOnboarding` inline**

Em `frontend/src/pages/professional/Dashboard.tsx`, remover:
- Import de `ProfessionalOnboarding`
- Estado `showOnboarding` e `handleDismissOnboarding`
- O `localStorage.getItem("faztudo_pro_onboarding_done")` (a key antiga)
- O JSX `{showOnboarding && <ProfessionalOnboarding ... />}`

**Step 2: Adicionar gatilho do tour**

```tsx
import { useTour } from "../../context/TourContext";

// dentro do componente:
const { startTour } = useTour();

useEffect(() => {
  if (!localStorage.getItem("faztudo_pro_tour_done")) {
    const timer = setTimeout(() => startTour("professional"), 500);
    return () => clearTimeout(timer);
  }
}, [startTour]);
```

**Step 3: Adicionar atributos `data-tour`**

```tsx
// Heading/título do dashboard profissional
<div data-tour="tour-pro-welcome" ...>

// Banner ou alerta de KYC (se existir) ou botão de "Verificar conta"
// Procurar por: isVerified, verificationStatus, VerifyAccount link
<Link to="/verify-account" data-tour="tour-kyc-cta" ...>

// Botão "Criar Serviço" ou link para /professional/create-service
<Link to="/professional/create-service" data-tour="tour-create-service-btn" ...>
```

**Step 4: Verificar no browser**

1. Login como `profissional@teste.com / Teste@123`
2. Limpar `faztudo_pro_tour_done` no localStorage
3. Navegar para `/professional/dashboard`
4. Verificar que o tour profissional inicia
5. Clicar pelos passos 1-5 (com navegação real para `/verify-account` e `/professional/create-service`)
6. Verificar passos 6-9 em modo simulação (cards centralizados, sem alvo, com SimulationOrderCard)

**Step 5: Commit**

```bash
git add frontend/src/pages/professional/Dashboard.tsx
git commit -m "feat: integrate professional tour trigger and data-tour attributes"
```

---

## Task 5: Adicionar `data-tour` nas Páginas de Serviço

**Files:**
- Modify: `frontend/src/pages/services/ServiceSearch.tsx`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`
- Modify: `frontend/src/pages/VerifyAccount.tsx`
- Modify: `frontend/src/pages/professional/CreateService.tsx`

**Step 1: `ServiceSearch.tsx` — primeiro card**

Abrir `frontend/src/pages/services/ServiceSearch.tsx`. Localizar o componente que renderiza a lista de serviços (provavelmente um `.map()` sobre `ServiceCard`).

No primeiro card (índice 0), adicionar o atributo:
```tsx
// Exemplo:
{services.map((service, index) => (
  <div
    key={service.id}
    data-tour={index === 0 ? "tour-service-card-first" : undefined}
  >
    <ServiceCard service={service} />
  </div>
))}
```

**Step 2: `ServiceDetails.tsx` — botões de chat e solicitar**

Abrir `frontend/src/pages/services/ServiceDetails.tsx`. Localizar:
1. O botão/link que abre o chat com o profissional — adicionar `data-tour="tour-service-chat-btn"`
2. O botão/link que leva para solicitação de pedido — adicionar `data-tour="tour-request-service-btn"`

**Step 3: `VerifyAccount.tsx` — form principal**

Abrir `frontend/src/pages/VerifyAccount.tsx`. Localizar a tag `<form>` ou o container principal do formulário. Adicionar:
```tsx
<form data-tour="tour-verify-form" ...>
```

**Step 4: `CreateService.tsx` — form principal**

Abrir `frontend/src/pages/professional/CreateService.tsx`. Localizar o `<form>` ou container principal. Adicionar:
```tsx
<form data-tour="tour-create-service-form" ...>
```
Ou no heading da página se o form não for o primeiro elemento visível.

**Step 5: Verificar tour completo do cliente**

1. Limpar `faztudo_client_tour_done`
2. Login como cliente
3. Percorrer todos os 6 passos do tour
4. Verificar que o card aponta corretamente para o elemento em cada página

**Step 6: Commit**

```bash
git add frontend/src/pages/services/ServiceSearch.tsx \
        frontend/src/pages/services/ServiceDetails.tsx \
        frontend/src/pages/VerifyAccount.tsx \
        frontend/src/pages/professional/CreateService.tsx
git commit -m "feat: add data-tour attributes to service search, details, verify and create-service pages"
```

---

## Task 6: Criar `HowItWorksSimple` e Atualizar Landing Page

**Files:**
- Create: `frontend/src/components/landing/HowItWorksSimple.tsx`
- Modify: `frontend/src/pages/LandingPageUser.tsx`

**Step 1: Criar `HowItWorksSimple.tsx`**

```tsx
// frontend/src/components/landing/HowItWorksSimple.tsx
import React from "react";
import { Search, ShoppingBag, CheckCircle, ArrowRight } from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: Search,
    title: "Busque e compare",
    description:
      "Encontre profissionais com avaliações reais, portfólio e preço transparente. Filtre por categoria ou localização.",
    color: "text-primary-600 dark:text-primary-400",
    bg: "bg-primary-50 dark:bg-primary-900/20",
    border: "border-primary-100 dark:border-primary-800/30",
  },
  {
    number: 2,
    icon: ShoppingBag,
    title: "Solicite com segurança",
    description:
      "Crie seu pedido e pague via PIX, cartão ou boleto. O valor fica em escrow — só é liberado quando você aprovar.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-100 dark:border-emerald-800/30",
  },
  {
    number: 3,
    icon: CheckCircle,
    title: "Confirme e avalie",
    description:
      "Acompanhe o progresso pelo chat. Quando o serviço estiver concluído, confirme e libere o pagamento.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-100 dark:border-amber-800/30",
  },
];

export const HowItWorksSimple: React.FC = () => (
  <section className="py-16 bg-slate-50 dark:bg-slate-950">
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Heading */}
      <div className="mb-10 text-center">
        <p
          className="font-bold text-2xl text-slate-900 dark:text-white m-0"
          style={{ letterSpacing: "-0.03em" }}
        >
          Como contratar em 3 passos
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-base mt-2">
          Simples, rápido e com pagamento protegido.
        </p>
      </div>

      {/* Steps */}
      <div className="relative grid gap-6 md:grid-cols-3">
        {/* Connector line (desktop only) */}
        <div
          aria-hidden="true"
          className="absolute hidden md:block top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px border-t-2 border-dashed border-slate-200 dark:border-slate-800"
        />

        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="relative flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-6 shadow-sm"
            >
              {/* Step number badge */}
              <div className="absolute -top-3 left-5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow">
                  {step.number}
                </span>
              </div>

              {/* Icon */}
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.bg} border ${step.border} mt-2`}
              >
                <Icon className={`h-6 w-6 ${step.color}`} />
              </div>

              {/* Content */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default HowItWorksSimple;
```

**Step 2: Atualizar `LandingPageUser.tsx`**

a) Remover import de `HowItWorksInteractive`:
```tsx
// REMOVER esta linha:
import { HowItWorksInteractive } from "../components/landing/HowItWorksInteractive";
```

b) Adicionar import de `HowItWorksSimple`:
```tsx
import { HowItWorksSimple } from "../components/landing/HowItWorksSimple";
```

c) No nav header, remover o link "Como funciona":
```tsx
// REMOVER:
<a
  href="#como-funciona"
  className="..."
>
  Como funciona
</a>
```

d) Substituir `<HowItWorksInteractive />` por `<HowItWorksSimple />`:
```tsx
// REMOVER:
{/* ─── HOW IT WORKS ─── */}
<HowItWorksInteractive />

// SUBSTITUIR POR:
{/* ─── HOW IT WORKS ─── */}
<HowItWorksSimple />
```

**Step 3: Verificar no browser**

```bash
cd frontend && npm run dev
```
1. Abrir http://localhost:5173
2. Verificar que a seção "Como contratar em 3 passos" aparece com visual correto
3. Verificar modo dark (toggle)
4. Verificar que o link "Como funciona" sumiu do nav

**Step 4: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: sem erros.

**Step 5: Commit**

```bash
git add frontend/src/components/landing/HowItWorksSimple.tsx \
        frontend/src/pages/LandingPageUser.tsx
git commit -m "feat: replace HowItWorksInteractive with HowItWorksSimple on client landing page"
```

---

## Task 7: Opção "Rever Tutorial" no Perfil

**Files:**
- Modify: `frontend/src/pages/Profile.tsx` (ou `Settings.tsx` — verificar qual tem mais seções de configuração)

**Step 1: Verificar qual arquivo usar**

```bash
head -50 frontend/src/pages/Profile.tsx
head -50 frontend/src/pages/Settings.tsx
```
Usar o arquivo que tem mais seções de configuração de conta.

**Step 2: Adicionar seção "Tutorial"**

Localizar o último `<section>` ou `<div>` de configurações e adicionar após ele:

```tsx
import { useTour, TourId } from "../context/TourContext";
import { useAuth } from "../context/AuthContext";
// (se não estiverem importados)

// No componente:
const { resetTour } = useTour();
const { isProfessional } = useAuth();

// JSX — adicionar antes do fechamento do container principal:
<section className="card p-6">
  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
    Tutorial da plataforma
  </h2>
  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
    Rever o tutorial de boas-vindas a qualquer momento.
  </p>
  <div className="flex flex-wrap gap-3">
    {!isProfessional && (
      <button
        onClick={() => resetTour("client")}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Rever tutorial do cliente
      </button>
    )}
    {isProfessional && (
      <button
        onClick={() => resetTour("professional")}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Rever tutorial profissional
      </button>
    )}
  </div>
</section>
```

**Step 3: Verificar**

1. Login como cliente → ir para `/profile`
2. Verificar que botão "Rever tutorial do cliente" aparece
3. Clicar → verificar que o tour reinicia
4. Login como profissional → ir para `/profile`
5. Verificar que botão "Rever tutorial profissional" aparece

**Step 4: Commit**

```bash
git add frontend/src/pages/Profile.tsx  # ou Settings.tsx
git commit -m "feat: add 'replay tutorial' option to profile settings"
```

---

## Task 8: Limpeza Final e Verificação

**Files:**
- Delete (opcional): `frontend/src/components/landing/HowItWorksInteractive.tsx`
- Delete (opcional): `frontend/src/components/common/ClientOnboarding.tsx`
- Delete (opcional): `frontend/src/components/common/ProfessionalOnboarding.tsx`

**Step 1: Verificar que os arquivos não estão sendo usados em lugar nenhum**

```bash
grep -r "HowItWorksInteractive" frontend/src --include="*.tsx" --include="*.ts"
grep -r "ClientOnboarding" frontend/src --include="*.tsx" --include="*.ts"
grep -r "ProfessionalOnboarding" frontend/src --include="*.tsx" --include="*.ts"
```
Expected: nenhum resultado (exceto nos próprios arquivos que serão deletados).

**Step 2: Deletar arquivos obsoletos**

```bash
rm frontend/src/components/landing/HowItWorksInteractive.tsx
rm frontend/src/components/common/ClientOnboarding.tsx
rm frontend/src/components/common/ProfessionalOnboarding.tsx
```

**Step 3: Verificar build completo**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: `✓ built in X.XXs` sem erros.

**Step 4: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: sem erros.

**Step 5: Teste manual completo do tour cliente**

1. `localStorage.clear()` no DevTools
2. Login como `cliente@teste.com / Teste@123`
3. Ir para `/client/dashboard`
4. Tour deve iniciar após 500ms com spotlight no welcome element
5. Percorrer todos os 6 passos
6. Verificar navegação automática para `/services` no passo 3
7. Completar o tour — verificar que fecha corretamente
8. Recarregar — tour NÃO deve iniciar novamente

**Step 6: Teste manual completo do tour profissional**

1. `localStorage.clear()`
2. Login como `profissional@teste.com / Teste@123`
3. Ir para `/professional/dashboard`
4. Tour inicia — percorrer passos 1-5 (com navegação)
5. Passos 6-9 em modo simulação (card centralizado com mini pedido fictício)
6. Completar o tour

**Step 7: Teste da landing page**

1. Abrir http://localhost:5173 sem login
2. Verificar seção "Como contratar em 3 passos" — cards com visual correto
3. Verificar que link "Como funciona" NÃO aparece no nav
4. Verificar modo dark
5. Testar responsividade (mobile/tablet)

**Step 8: Commit final**

```bash
git add -A
git commit -m "feat: complete interactive tour system - remove legacy onboarding, add TourContext, TourSpotlight, HowItWorksSimple"
```

---

## Resumo dos Arquivos

| Ação | Arquivo |
|------|---------|
| **Criar** | `frontend/src/context/TourContext.tsx` |
| **Criar** | `frontend/src/components/common/TourSpotlight.tsx` |
| **Criar** | `frontend/src/components/landing/HowItWorksSimple.tsx` |
| **Modificar** | `frontend/src/App.tsx` |
| **Modificar** | `frontend/src/pages/client/Dashboard.tsx` |
| **Modificar** | `frontend/src/pages/professional/Dashboard.tsx` |
| **Modificar** | `frontend/src/pages/services/ServiceSearch.tsx` |
| **Modificar** | `frontend/src/pages/services/ServiceDetails.tsx` |
| **Modificar** | `frontend/src/pages/VerifyAccount.tsx` |
| **Modificar** | `frontend/src/pages/professional/CreateService.tsx` |
| **Modificar** | `frontend/src/pages/LandingPageUser.tsx` |
| **Modificar** | `frontend/src/pages/Profile.tsx` |
| **Deletar** | `frontend/src/components/landing/HowItWorksInteractive.tsx` |
| **Deletar** | `frontend/src/components/common/ClientOnboarding.tsx` |
| **Deletar** | `frontend/src/components/common/ProfessionalOnboarding.tsx` |
