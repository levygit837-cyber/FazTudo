import React from "react";
import { Link } from "react-router";
import {
  Shield,
  BadgeCheck,
  MessageCircle,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Users,
} from "lucide-react";

const Security: React.FC = () => {
  const pillars = [
    {
      icon: <Shield className="h-7 w-7" />,
      title: "Pagamento Protegido",
      description:
        "Todo pagamento e retido em garantia ate que o servico seja concluido e aprovado pelo cliente. Se algo der errado, voce recebe o reembolso integral.",
      features: [
        "Retencao automatica em conta segura",
        "Liberacao apenas apos aprovacao",
        "Reembolso integral em caso de disputa",
      ],
      iconBg: "bg-primary-100 dark:bg-primary-900/30",
      iconColor: "text-primary-600 dark:text-primary-400",
      borderColor: "border-t-primary-500/50",
    },
    {
      icon: <BadgeCheck className="h-7 w-7" />,
      title: "Profissionais Verificados",
      description:
        "Todos os profissionais passam por um processo de verificacao em 3 etapas antes de atender clientes na plataforma.",
      features: [
        "Verificacao de identidade com documento",
        "Validacao de habilidades e experiencia",
        "Checagem de antecedentes criminais",
      ],
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-t-emerald-500/50",
    },
    {
      icon: <MessageCircle className="h-7 w-7" />,
      title: "Chat Seguro",
      description:
        "Toda comunicacao acontece dentro da plataforma, protegendo suas informacoes pessoais e garantindo um historico completo.",
      features: [
        "Mensagens criptografadas",
        "Historico completo de conversas",
        "Compartilhamento seguro de arquivos",
      ],
      iconBg: "bg-primary-100 dark:bg-primary-900/30",
      iconColor: "text-primary-600 dark:text-primary-400",
      borderColor: "border-t-primary-500/50",
    },
    {
      icon: <ShieldCheck className="h-7 w-7" />,
      title: "Garantia de Servico",
      description:
        "Se o servico nao atender ao combinado, mediamos a situacao e garantimos que o problema seja resolvido ou o pagamento devolvido.",
      features: [
        "Mediacao profissional de disputas",
        "Prazo para reclamacao apos conclusao",
        "Resolucao em ate 48 horas",
      ],
      iconBg: "bg-primary-100 dark:bg-primary-900/30",
      iconColor: "text-primary-600 dark:text-primary-400",
      borderColor: "border-t-primary-500/50",
    },
  ];

  const platformStats = [
    { value: "99,8%", label: "Taxa de conclusao" },
    { value: "4,9/5", label: "Avaliacao media" },
    { value: "<2h", label: "Tempo medio de resposta" },
    { value: "100%", label: "Pagamentos seguros" },
  ];

  return (
    <div className="space-y-16 md:space-y-24 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl md:rounded-4xl bg-slate-900 dark:bg-slate-900/80 dark:border dark:border-slate-800/50">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary-600/10 blur-3xl" />
        <div className="container-responsive relative z-10 py-12 md:py-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/20 shadow-glow-blue">
              <Lock className="h-8 w-8 text-primary-400" />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Sua seguranca e nossa prioridade
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Construimos cada camada da plataforma para proteger profissionais e
            clientes. Conheca os pilares de seguranca do FazTudo.
          </p>
        </div>
      </section>

      {/* 4 Pillars */}
      <section className="container-responsive">
        <div className="grid gap-8 md:grid-cols-2">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className={`rounded-2xl p-6 md:p-8 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 border-t-2 ${pillar.borderColor} transition-all duration-200 hover:shadow-lg dark:hover:shadow-glow-blue`}
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${pillar.iconBg} ${pillar.iconColor}`}>
                {pillar.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {pillar.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {pillar.description}
              </p>
              <ul className="space-y-2">
                {pillar.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Platform Stats */}
      <section className="container-responsive">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Numeros que comprovam
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Resultados reais da nossa plataforma
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {platformStats.map((stat) => (
            <div
              key={stat.label}
              className="text-center rounded-xl p-5 md:p-6 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 border-t-2 border-t-primary-500/50"
            >
              <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-responsive">
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 text-center bg-slate-900 dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-800/50">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary-600/15 blur-3xl" />
          <div className="relative">
            <div className="flex justify-center mb-4">
              <Users className="h-8 w-8 text-primary-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Faca parte da plataforma mais segura
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-8">
              Junte-se a milhares de clientes e profissionais que confiam no
              FazTudo para seus servicos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/services"
                className="btn px-7 py-3 font-semibold bg-primary-600 text-white hover:bg-primary-500 shadow-glow-blue hover:-translate-y-0.5 transition-all no-underline"
              >
                Encontrar Profissional
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
              <Link
                to="/profissionais"
                className="btn border-2 border-slate-700 text-white px-7 py-3 font-semibold hover:bg-slate-800/50 transition-all no-underline"
              >
                Seja um Profissional
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Security;
