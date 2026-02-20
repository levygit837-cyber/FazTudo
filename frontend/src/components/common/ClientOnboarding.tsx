import React, { useState } from "react";
import { Link } from "react-router";
import { Search, ShoppingBag, MessageCircle, Shield, X } from "lucide-react";

interface ClientOnboardingProps {
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Search,
    title: "Encontre um serviço",
    description: "Busque por categoria ou nome. Veja avaliações reais, portfólio e certificações dos profissionais.",
    action: { label: "Explorar serviços", to: "/services" },
    color: "text-primary-500",
    bg: "bg-primary-50 dark:bg-primary-900/20",
  },
  {
    icon: ShoppingBag,
    title: "Faça seu pedido",
    description: "Escolha o serviço, defina os detalhes e envie sua solicitação. O profissional responde em até 2 horas.",
    action: { label: "Criar pedido agora", to: "/client/orders/new" },
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: Shield,
    title: "Pague com segurança",
    description: "Seu dinheiro fica em escrow — protegido na plataforma — e só é liberado quando você confirmar que o serviço foi entregue.",
    action: null,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: MessageCircle,
    title: "Acompanhe e avalie",
    description: "Chat direto com o profissional. Quando terminar, confirme e deixe sua avaliação para ajudar outros clientes.",
    action: { label: "Ver meus pedidos", to: "/client/orders" },
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
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
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded"
        aria-label="Fechar guia de boas-vindas"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Bem-vindo ao FazTudo! Como funciona?
          </h2>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 ${
                i === activeStep
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
              aria-label={`Passo ${i + 1}: ${s.title}`}
              aria-current={i === activeStep ? "step" : undefined}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>

        {/* Active step content */}
        <div className={`rounded-xl p-4 ${step.bg} flex gap-4 items-start`}>
          <div className={`rounded-full p-2 bg-white dark:bg-slate-800 shadow-sm flex-shrink-0`}>
            <Icon size={24} className={step.color} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{step.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{step.description}</p>
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
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded"
          >
            ← Anterior
          </button>
          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStep((prev) => prev + 1)}
              className="btn btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              Próximo →
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="btn btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
            >
              Começar agora!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientOnboarding;
