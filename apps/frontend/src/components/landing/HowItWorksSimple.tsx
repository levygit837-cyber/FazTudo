// frontend/src/components/landing/HowItWorksSimple.tsx
import React from "react";
import { Search, ShoppingBag, CheckCircle } from "lucide-react";

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
