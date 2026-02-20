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
  const Icon =
    currentStepData ? (ICON_MAP[currentStepData.icon] ?? Sparkles) : Sparkles;

  // Highlight target element and calculate card position
  useLayoutEffect(() => {
    // Always remove previous highlight first (even when tour becomes inactive)
    if (highlightRef.current) {
      highlightRef.current.style.outline = "";
      highlightRef.current.style.outlineOffset = "";
      highlightRef.current.style.position = "";
      highlightRef.current.style.zIndex = "";
      highlightRef.current = null;
    }

    if (!isActive || !currentStepData) return;

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
    const cardH = 260; // approx
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
      left = Math.max(rect.left - cardW - gap, 16);
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

          {/* Simulation content */}
          {isSimulation && <SimulationOrderCard />}

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
