import React, { useState } from "react";
import { Link } from "react-router";
import { Search, ShoppingBag, MessageCircle, CheckCircle, X } from "lucide-react";

interface ClientOnboardingProps {
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Search,
    title: "Encontre um serviço",
    description: "Busque por categoria ou nome. Temos centenas de profissionais prontos para te atender.",
    action: { label: "Explorar serviços", to: "/services" },
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: ShoppingBag,
    title: "Faça seu pedido",
    description: "Escolha o serviço, personalize os detalhes e pague com segurança via PIX, cartão ou boleto.",
    action: null,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: MessageCircle,
    title: "Acompanhe e converse",
    description: "Chat direto com o profissional, acompanhe o progresso e confirme quando estiver satisfeito.",
    action: null,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
];

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ onDismiss }) => {
  const [activeStep, setActiveStep] = useState(0);
  const step = STEPS[activeStep];
  const Icon = step.icon;

  return (
    <div className="card mb-6 border-2 border-blue-100 dark:border-blue-800 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        aria-label="Fechar guia de boas-vindas"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Bem-vindo ao FazTudo! Como funciona?
          </h2>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                i === activeStep
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Passo ${i + 1}: ${s.title}`}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>

        {/* Active step content */}
        <div className={`rounded-xl p-4 ${step.bg} flex gap-4 items-start`}>
          <div className={`rounded-full p-2 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0`}>
            <Icon size={24} className={step.color} />
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
            <button onClick={onDismiss} className="btn btn-primary btn-sm">
              Começar agora!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientOnboarding;
