import React, { useState } from "react";
import { Link } from "react-router";
import {
  Search, ShoppingBag, MessageCircle, CheckCircle,
  Briefcase, UserCheck, TrendingUp
} from "lucide-react";

type Role = "client" | "professional";

const CLIENT_STEPS = [
  {
    number: 1,
    icon: Search,
    title: "Encontre o serviço ideal",
    description: "Busque entre centenas de profissionais por categoria, localização ou palavra-chave. Veja avaliações reais e portfólios.",
    tip: "💡 Dica: Use filtros de preço e avaliação para encontrar mais rápido!",
    color: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    number: 2,
    icon: ShoppingBag,
    title: "Faça seu pedido com segurança",
    description: "Solicite o serviço com as suas condições. Pague com PIX, cartão ou boleto — o dinheiro fica em escrow até você confirmar o serviço.",
    tip: "🔒 Seu dinheiro fica protegido até você aprovar o trabalho.",
    color: "bg-purple-500",
    lightBg: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  {
    number: 3,
    icon: MessageCircle,
    title: "Acompanhe e comunique-se",
    description: "Chat direto com o profissional, envie arquivos e acompanhe o progresso em tempo real pelo seu painel.",
    tip: "📱 Acesse pelo celular ou computador a qualquer hora.",
    color: "bg-green-500",
    lightBg: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  {
    number: 4,
    icon: CheckCircle,
    title: "Confirme e avalie",
    description: "Aprove o serviço concluído e o pagamento é liberado. Sua avaliação ajuda outros clientes a escolherem bem.",
    tip: "⭐ Avaliações honestas fazem a plataforma melhor para todos!",
    color: "bg-yellow-500",
    lightBg: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
];

const PROFESSIONAL_STEPS = [
  {
    number: 1,
    icon: UserCheck,
    title: "Crie seu perfil profissional",
    description: "Monte um perfil completo com suas habilidades, experiências, certificações e portfólio. Perfis completos recebem 3x mais pedidos.",
    tip: "📸 Adicione foto profissional — aumenta a taxa de conversão em 80%!",
    color: "bg-indigo-500",
    lightBg: "bg-indigo-50 dark:bg-indigo-900/20",
    borderColor: "border-indigo-200 dark:border-indigo-800",
  },
  {
    number: 2,
    icon: Briefcase,
    title: "Publique seus serviços",
    description: "Crie listings dos seus serviços com preços transparentes, prazo estimado e descrição detalhada. Seja encontrado por quem precisa de você.",
    tip: "💰 Defina preços competitivos comparando com outros profissionais.",
    color: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    number: 3,
    icon: MessageCircle,
    title: "Atenda com excelência",
    description: "Aceite pedidos, negocie via chat, execute com qualidade e submeta para confirmação do cliente. Cada detalhe conta para sua reputação.",
    tip: "⚡ Responder em menos de 1h aumenta suas chances de contratação.",
    color: "bg-green-500",
    lightBg: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
  {
    number: 4,
    icon: TrendingUp,
    title: "Cresça sua renda",
    description: "Receba pagamentos seguros direto na sua carteira FazTudo (90% do valor). Saque quando quiser. Construa uma base de clientes recorrentes.",
    tip: "📈 Top profissionais faturam R$5.000+ por mês na plataforma.",
    color: "bg-orange-500",
    lightBg: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
];

export const HowItWorksInteractive: React.FC = () => {
  const [role, setRole] = useState<Role>("client");
  const [activeStep, setActiveStep] = useState(0);
  const steps = role === "client" ? CLIENT_STEPS : PROFESSIONAL_STEPS;
  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <section className="py-16 px-4 bg-white dark:bg-gray-900" id="como-funciona" aria-labelledby="how-it-works-title">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 id="how-it-works-title" className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Como funciona o FazTudo?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Simples, rápido e seguro para todos
          </p>
        </div>

        {/* Role toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setRole("client"); setActiveStep(0); }}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                role === "client"
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
              aria-pressed={role === "client"}
            >
              👤 Sou Cliente
            </button>
            <button
              onClick={() => { setRole("professional"); setActiveStep(0); }}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                role === "professional"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
              aria-pressed={role === "professional"}
            >
              🔧 Sou Profissional
            </button>
          </div>
        </div>

        {/* Step navigation */}
        <div className="flex gap-2 mb-6 justify-center flex-wrap">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all border ${
                  i === activeStep
                    ? `${s.color} text-white border-transparent shadow-md scale-105`
                    : i < activeStep
                    ? `${s.lightBg} ${s.borderColor} text-gray-600 dark:text-gray-300`
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300"
                }`}
                aria-current={i === activeStep ? "step" : undefined}
              >
                <StepIcon size={16} />
                <span className="hidden sm:inline">{i + 1}. {s.title.split(" ").slice(0, 2).join(" ")}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Active step detail */}
        <div className={`rounded-2xl border-2 ${current.borderColor} ${current.lightBg} p-6 transition-all`}>
          <div className="flex gap-4 items-start mb-4">
            <div className={`rounded-xl p-3 ${current.color} text-white flex-shrink-0 shadow-md`}>
              <Icon size={28} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                Passo {current.number} de {steps.length}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{current.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{current.description}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
            {current.tip}
          </div>
        </div>

        {/* Navigation + CTA */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 transition-opacity"
          >
            ← Anterior
          </button>
          {activeStep < steps.length - 1 ? (
            <button
              onClick={() => setActiveStep((prev) => prev + 1)}
              className={`px-6 py-2 rounded-xl font-medium text-sm text-white transition-all shadow-md hover:shadow-lg ${current.color}`}
            >
              Próximo passo →
            </button>
          ) : (
            <Link
              to={role === "client" ? "/register?role=client" : "/register?role=professional"}
              className={`px-6 py-2 rounded-xl font-medium text-sm text-white transition-all shadow-md hover:shadow-lg ${current.color}`}
            >
              {role === "client" ? "Começar agora — é grátis!" : "Cadastre-se como profissional!"}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksInteractive;
