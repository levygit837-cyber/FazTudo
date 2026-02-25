import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";

interface OnboardingWizardProps {
  currentStep: number;
  onboardingDone: boolean;
  onStepComplete?: (step: number) => void;
}

const STEPS = [
  { label: "Complete o perfil da empresa", description: "Adicione logo, descrição e informações de contato." },
  { label: "Configure sua vitrine", description: "Personalize blocos de hero, sobre e seções de serviços." },
  { label: "Adicione membros à equipe", description: "Convide colaboradores com funções e permissões." },
  { label: "Publique seu primeiro serviço", description: "Crie um anúncio no catálogo para atrair clientes." },
  { label: "Receba sua primeira avaliação", description: "Complete um pedido e peça ao cliente uma avaliação." },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ currentStep, onboardingDone, onStepComplete }) => {
  const [expanded, setExpanded] = useState(false);

  if (onboardingDone) return null;

  const progress = Math.round((currentStep / STEPS.length) * 100);

  return (
    <div className="card p-4 mb-6 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
      {/* Collapsed banner */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5">
            Onboarding:{" "}
            <span className="text-blue-600 dark:text-blue-400">{currentStep} de {STEPS.length} etapas concluídas</span>
          </p>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors whitespace-nowrap"
        >
          {expanded ? (
            <><ChevronUp className="h-4 w-4" /> Ocultar</>
          ) : (
            <><ChevronDown className="h-4 w-4" /> Ver detalhes</>
          )}
        </button>
      </div>

      {/* Expanded step list */}
      {expanded && (
        <ul className="mt-4 space-y-3">
          {STEPS.map((step, index) => {
            const done = index < currentStep;
            const active = index === currentStep;
            return (
              <li
                key={index}
                className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                  active
                    ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                    : "bg-white dark:bg-slate-800/40"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className={`h-5 w-5 ${active ? "text-blue-500" : "text-slate-300 dark:text-slate-600"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    done ? "line-through text-slate-400 dark:text-slate-500"
                    : active ? "text-blue-700 dark:text-blue-300"
                    : "text-slate-600 dark:text-slate-400"
                  }`}>
                    {step.label}
                  </p>
                  {!done && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                  )}
                  {active && onStepComplete && (
                    <button
                      onClick={() => onStepComplete(index)}
                      className="mt-2 btn text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                      Concluir esta etapa
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default OnboardingWizard;
