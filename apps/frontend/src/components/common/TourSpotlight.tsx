// frontend/src/components/common/TourSpotlight.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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

// ─── Simulation Cards ────────────────────────────────────────────────────────

type SimVariant = "order" | "map" | "confirm" | "payment";

const SimulationContent: React.FC<{ variant: SimVariant }> = ({ variant }) => {
  const base =
    "mt-3 rounded-xl border border-slate-200 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm";

  if (variant === "order")
    return (
      <div className={base}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-sm font-bold">
            J
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              João Silva
            </p>
            <p className="text-xs text-slate-500">
              Instalação Elétrica • R$ 350,00
            </p>
          </div>
          <span className="ml-auto rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            Novo pedido
          </span>
        </div>
        <p className="text-xs text-slate-500">
          <span aria-hidden="true">📅</span> Agendado para amanhã às 14h00
        </p>
      </div>
    );

  if (variant === "map")
    return (
      <div className={base}>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-primary-500 flex-shrink-0" />
          <p className="font-medium text-slate-800 dark:text-slate-100 text-xs">
            Rua das Flores, 123 — São Paulo
          </p>
        </div>
        <div className="h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <p className="text-xs text-slate-400">🗺️ Mapa integrado</p>
        </div>
        <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">
          → Ver rota no mapa
        </p>
      </div>
    );

  if (variant === "confirm")
    return (
      <div className={base}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
            Instalação Elétrica — concluída
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Você confirmou
            </p>
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
        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          + R$ 315,00
        </span>
      </div>
      <div className="text-xs text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>Valor do serviço</span>
          <span>R$ 350,00</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Taxa plataforma (10%)</span>
          <span>− R$ 35,00</span>
        </div>
        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span>Seu ganho</span>
          <span>R$ 315,00</span>
        </div>
      </div>
    </div>
  );
};

// ─── Arrow positions ─────────────────────────────────────────────────────────

type ArrowDir = "top" | "bottom" | "left" | "right";

function getArrowPoints(dir: ArrowDir): string {
  switch (dir) {
    case "top":
      return "12,0 24,16 0,16";
    case "bottom":
      return "12,16 24,0 0,0";
    case "left":
      return "0,12 16,0 16,24";
    case "right":
      return "16,12 0,0 0,24";
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const TourSpotlight: React.FC = () => {
  const {
    isActive,
    currentStep,
    steps,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    readyNonce,
  } = useTour();

  const [cardPos, setCardPos] = useState<{
    top: number;
    left: number;
    arrowDir: ArrowDir;
  } | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  // Timer ref for retry back-off cancellation
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStepData = isActive ? steps[currentStep] : null;
  const isLastStep = isActive && currentStep === steps.length - 1;
  const isSimulation = currentStepData?.simulationMode === true;
  const Icon =
    currentStepData ? (ICON_MAP[currentStepData.icon] ?? Sparkles) : Sparkles;

  // Extract positioning logic into a stable callback so it can be called from
  // both the useLayoutEffect and from retry timeouts.
  const positionCard = useCallback(
    (stepData: NonNullable<typeof currentStepData>) => {
      if (stepData.simulationMode) return false;

      const target = document.querySelector<HTMLElement>(
        `[data-tour="${stepData.id}"]`
      );
      if (!target) return false; // element not in DOM yet

      // Remove highlight from previous target if different
      if (highlightRef.current && highlightRef.current !== target) {
        highlightRef.current.style.outline = "";
        highlightRef.current.style.outlineOffset = "";
        highlightRef.current.style.position = "";
        highlightRef.current.style.zIndex = "";
      }

      // Apply highlight
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
      const cardH = 260;
      const gap = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top = 0;
      let left = 0;
      let arrowDir: ArrowDir = "top";

      if (rect.bottom + cardH + gap < vh) {
        top = rect.bottom + gap;
        left = Math.min(
          Math.max(rect.left + rect.width / 2 - cardW / 2, 16),
          vw - cardW - 16
        );
        arrowDir = "top";
      } else if (rect.top - cardH - gap > 0) {
        top = rect.top - cardH - gap;
        left = Math.min(
          Math.max(rect.left + rect.width / 2 - cardW / 2, 16),
          vw - cardW - 16
        );
        arrowDir = "bottom";
      } else if (rect.right + cardW + gap < vw) {
        top = Math.min(
          Math.max(rect.top + rect.height / 2 - cardH / 2, 16),
          vh - cardH - 16
        );
        left = rect.right + gap;
        arrowDir = "left";
      } else {
        top = Math.min(
          Math.max(rect.top + rect.height / 2 - cardH / 2, 16),
          vh - cardH - 16
        );
        left = Math.max(rect.left - cardW - gap, 16);
        arrowDir = "right";
      }

      setCardPos({ top, left, arrowDir });
      return true;
    },
    [] // no deps — only touches refs and DOM
  );

  // Highlight target element and calculate card position.
  // Uses retry with back-off to handle the race between navigate() and DOM mount.
  useLayoutEffect(() => {
    // Cancel any pending retry from a previous step
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Clear previous highlight
    if (highlightRef.current) {
      highlightRef.current.style.outline = "";
      highlightRef.current.style.outlineOffset = "";
      highlightRef.current.style.position = "";
      highlightRef.current.style.zIndex = "";
      highlightRef.current = null;
    }

    if (!isActive || !currentStepData) return;

    if (isSimulation) {
      setCardPos(null); // centred via CSS
      return;
    }

    // First attempt — element might already be in DOM (same-route step)
    const found = positionCard(currentStepData);
    if (!found) {
      // Element not yet in DOM (navigate() just fired). Retry with back-off:
      // 100ms → 300ms → 600ms, then give up and centre.
      const delays = [100, 300, 600];
      let attempt = 0;

      const tryAgain = () => {
        if (attempt >= delays.length) {
          setCardPos(null); // best effort: centre
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
  }, [isActive, currentStep, currentStepData, isSimulation, positionCard, readyNonce]);

  // Reposition on window resize
  useEffect(() => {
    if (!isActive || !currentStepData || isSimulation) return;

    const handleResize = () => {
      positionCard(currentStepData);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive, currentStepData, isSimulation, positionCard]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightRef.current) {
        highlightRef.current.style.outline = "";
        highlightRef.current.style.outlineOffset = "";
        highlightRef.current.style.position = "";
        highlightRef.current.style.zIndex = "";
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
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
        {/* Arrow (not shown in simulation mode or when no target found) */}
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
            <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
              <polygon
                points={getArrowPoints(cardPos.arrowDir)}
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

          {/* Simulation content — variant-specific mini-card */}
          {isSimulation && currentStepData.simulationVariant && (
            <SimulationContent variant={currentStepData.simulationVariant} />
          )}

          {/* Progress dots */}
          <div
            className="flex items-center gap-1.5 mt-4 mb-4"
            aria-hidden="true"
          >
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
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded px-1 min-h-[44px]"
                >
                  ← Anterior
                </button>
              )}
              <button
                onClick={skipTour}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded px-1 min-h-[44px]"
              >
                Pular tour
              </button>
            </div>

            {isLastStep ? (
              <button
                onClick={completeTour}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
              >
                Começar!
                <CheckCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-glow-blue transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 min-h-[44px]"
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
