import React, { useState } from "react";
import { Link } from "react-router";
import { UserCheck, Briefcase, TrendingUp, Star, X } from "lucide-react";

interface ProfessionalOnboardingProps {
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: UserCheck,
    title: "Complete seu perfil",
    description: "Adicione foto, descrição e experiências. Profissionais com perfil completo recebem até 3x mais pedidos.",
    action: { label: "Completar perfil", to: "/profile" },
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    icon: Briefcase,
    title: "Crie seus serviços",
    description: "Publique os serviços que você oferece com preços, descrições e fotos. Seja específico para atrair os clientes certos.",
    action: { label: "Criar serviço", to: "/professional/create-service" },
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: TrendingUp,
    title: "Gerencie seus pedidos",
    description: "Aceite, acompanhe e finalize pedidos pela plataforma. Mantenha comunicação clara com os clientes via chat.",
    action: null,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: Star,
    title: "Construa sua reputação",
    description: "Avaliações 5 estrelas melhoram seu ranking. Cumpra prazos e mantenha qualidade para aparecer no topo das buscas.",
    action: { label: "Ver reputação", to: "/professional/reputation" },
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
];

export const ProfessionalOnboarding: React.FC<ProfessionalOnboardingProps> = ({ onDismiss }) => {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];
  const Icon = step.icon;
  const progress = ((activeStep + 1) / STEPS.length) * 100;

  return (
    <div className="card mb-6 border-2 border-indigo-100 dark:border-indigo-800 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Fechar guia de configuração"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-500" />
            Configure sua conta profissional
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeStep + 1}/{STEPS.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
          <div
            className="h-1.5 bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={activeStep + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
          />
        </div>

        {/* Step list */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  i === activeStep
                    ? "bg-indigo-500 text-white"
                    : i < activeStep
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                }`}
              >
                <StepIcon size={12} />
                {s.title}
              </button>
            );
          })}
        </div>

        {/* Active step content */}
        <div className={`rounded-xl p-4 ${step.bg}`}>
          <div className="flex gap-3 items-start">
            <div className="rounded-full p-2 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
              <Icon size={22} className={step.color} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{step.description}</p>
              {step.action && (
                <Link
                  to={step.action.to}
                  className="btn btn-primary btn-sm mt-3 inline-flex items-center gap-1.5"
                >
                  {step.action.label} →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30"
          >
            ← Anterior
          </button>
          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStep((prev) => prev + 1)}
              className="btn btn-primary btn-sm"
            >
              Próximo →
            </button>
          ) : (
            <button onClick={onDismiss} className="btn btn-success btn-sm">
              Tudo pronto! Começar →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalOnboarding;
