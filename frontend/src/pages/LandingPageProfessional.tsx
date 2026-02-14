import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  LogOut,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import PageTransition from "../components/navigation/PageTransition";
import RegisterPromptClient from "../components/landing/RegisterPromptClient";
import RegisterPromptProfessional from "../components/landing/RegisterPromptProfessional";
import FixedSwitchCard from "../components/landing/FixedSwitchCard";
import { formatCurrency } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";

const LandingPageProfessional: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isProfessional, isAdmin, logout } = useAuth();
  const [isRegisterPromptOpen, setIsRegisterPromptOpen] = useState(false);
  const [registerRole, setRegisterRole] = useState<"CLIENT" | "PROFESSIONAL">("PROFESSIONAL");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const dashboardPath = isAdmin
    ? "/admin"
    : isProfessional
      ? "/professional/dashboard"
      : "/client/dashboard";

  const features = [
    {
      icon: <CircleDollarSign className="h-6 w-6" />,
      title: "Autonomia total",
      description: "Defina seus precos por hora ou por projeto e trabalhe no seu ritmo.",
      iconBg: "bg-primary-100 dark:bg-primary-900/30",
      iconColor: "text-primary-600 dark:text-primary-400",
    },
    {
      icon: <CalendarCheck2 className="h-6 w-6" />,
      title: "Agenda inteligente",
      description: "Receba solicitacoes somente nos horarios em que voce estiver disponivel.",
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: "Pagamentos seguros",
      description: "Pagamentos protegidos e liberados apos confirmacao do servico.",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const profileBenefits = [
    "Selo de verificacao para ganhar confianca",
    "Galeria de trabalhos e certificacoes",
    "Avaliacoes publicas de clientes reais",
    "Destaque nos resultados de busca",
  ];

  const earningsData = [
    { label: "Receita media mensal", value: formatCurrency(4500) },
    { label: "Ticket medio por servico", value: formatCurrency(280) },
    { label: "Novos clientes / mes", value: "15+" },
  ];

  const openRegisterPrompt = (role: "CLIENT" | "PROFESSIONAL") => {
    setRegisterRole(role);
    setIsRegisterPromptOpen(true);
  };

  return (
    <PageTransition routeKey={location.pathname}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/50">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              to="/profissionais"
              className="inline-flex items-center no-underline"
            >
              <img src="/logo.png" alt="FazTudo" className="h-16 w-auto object-contain" />
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
              <a href="#vantagens" className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline">
                Vantagens
              </a>
              <a href="#perfil" className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline">
                Seu perfil
              </a>
              {!isAuthenticated && (
                <Link to="/login" className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline">
                  Entrar
                </Link>
              )}
              {isAuthenticated && (
                <Link to={dashboardPath} className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline">
                  Dashboard
                </Link>
              )}
            </nav>

            <div className="inline-flex items-center gap-2">
              {!isAuthenticated ? (
                <>
                  <button
                    className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => openRegisterPrompt("PROFESSIONAL")}
                  >
                    <span className="sm:hidden">Conta</span>
                    <span className="hidden sm:inline">Criar conta</span>
                  </button>
                  <Link
                    to="/"
                    className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm bg-primary-600 text-white hover:bg-primary-700 shadow-glow-blue no-underline"
                  >
                    <span className="sm:hidden">Cliente</span>
                    <span className="hidden sm:inline">Quero ser cliente</span>
                  </Link>
                </>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {user?.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline">{user?.name?.split(" ")[0]}</span>
                  </button>
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl py-1 shadow-lg bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50">
                        <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setShowUserMenu(false)}>
                          <User className="h-4 w-4" /> Meu Perfil
                        </Link>
                        <Link to={dashboardPath} className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setShowUserMenu(false)}>
                          <Briefcase className="h-4 w-4" /> Dashboard
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-800/50 my-1" />
                        <button onClick={() => { setShowUserMenu(false); logout(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <LogOut className="h-4 w-4" /> Sair
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          {/* ─── HERO ─── */}
          <section className="relative overflow-hidden bg-slate-950">
            {/* Decorative */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-primary-600/10 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary-600/5 blur-3xl" />
            </div>

            <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider bg-primary-900/30 text-primary-400 border border-primary-800/30">
                  <Sparkles className="h-3.5 w-3.5" />
                  Agora com mais oportunidades
                </div>

                <p className="font-black leading-[1.1] text-white m-0" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
                  Cresca o seu negocio com clientes{" "}
                  <span className="text-primary-400">prontos para contratar</span>
                </p>

                <p className="max-w-lg leading-relaxed text-lg text-slate-400">
                  Voce controla precos, agenda e servicos. O FazTudo cuida de
                  visibilidade, reputacao e seguranca dos pagamentos.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {isAuthenticated ? (
                    <>
                      <Link to={dashboardPath} className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 no-underline text-[0.9375rem]">
                        Ir ao Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link to="/services" className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline text-[0.9375rem]">
                        Explorar servicos
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 text-[0.9375rem]"
                        onClick={() => openRegisterPrompt("PROFESSIONAL")}
                      >
                        Comecar agora
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline text-[0.9375rem]">
                        Ja tenho conta
                      </Link>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  Mais de 2.000 profissionais entraram no ultimo mes
                </div>
              </div>

              {/* Hero right: Earnings preview card */}
              <div className="relative hidden lg:block">
                <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/5 border border-white/10">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-900/30">
                      <TrendingUp className="h-5 w-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Seus ganhos potenciais</p>
                      <p className="text-slate-500 text-xs">Media dos profissionais ativos</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {earningsData.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl px-5 py-3.5 bg-white/5 border border-white/10"
                      >
                        <span className="text-slate-400 text-sm">{item.label}</span>
                        <span className="font-bold text-white text-base">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-2 rounded-xl px-5 py-3 bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-400 text-[0.8125rem] font-medium">
                      Novo pagamento de {formatCurrency(1240)} processado agora
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── FEATURES ─── */}
          <section id="vantagens" className="bg-white dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <p className="font-bold text-2xl text-slate-900 dark:text-white m-0" style={{ letterSpacing: "-0.03em" }}>
                  Por que os profissionais escolhem o FazTudo
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base mt-2">
                  Ferramentas para voce focar no servico, sem perder tempo com burocracia.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {features.map((feature) => (
                  <article
                    key={feature.title}
                    className="rounded-2xl p-6 md:p-8 transition-all duration-200 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 hover:border-primary-300 dark:hover:border-primary-700 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-glow-blue"
                  >
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg} ${feature.iconColor}`}>
                      {feature.icon}
                    </div>
                    <p className="font-bold text-lg text-slate-900 dark:text-white">
                      {feature.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {feature.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ─── PROFILE SHOWCASE ─── */}
          <section id="perfil" className="py-16 bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
              <div>
                <p className="font-bold text-2xl text-slate-900 dark:text-white m-0" style={{ letterSpacing: "-0.03em" }}>
                  Seu perfil e sua vitrine
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base mt-3 leading-relaxed">
                  Monte uma presenca profissional forte para atrair clientes com
                  maior ticket e recorrencia.
                </p>
                <div className="mt-8 space-y-4">
                  {profileBenefits.map((benefit) => (
                    <div key={benefit} className="flex items-start gap-3 text-[0.9375rem]">
                      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300">{benefit}</span>
                    </div>
                  ))}
                </div>
                {!isAuthenticated && (
                  <button
                    className="mt-8 inline-flex items-center gap-2 font-semibold transition-colors text-[0.9375rem] text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    onClick={() => openRegisterPrompt("PROFESSIONAL")}
                  >
                    Criar meu perfil profissional
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Mock profile card */}
              <div className="rounded-2xl p-6 shadow-lg bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50">
                <div className="rounded-xl h-16 bg-gradient-to-br from-primary-900 to-primary-600" />
                <div className="-mt-8 flex items-end justify-between px-2">
                  <img
                    src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=320&q=80"
                    alt="Foto de perfil de profissional"
                    className="h-20 w-20 rounded-xl object-cover border-4 border-white dark:border-slate-900 shadow-lg"
                  />
                  <p className="font-bold text-lg text-slate-900 dark:text-white">
                    {formatCurrency(85)}
                    <span className="text-slate-400 dark:text-slate-500 text-sm font-normal">/h</span>
                  </p>
                </div>
                <div className="mt-3 px-2">
                  <p className="font-bold text-lg text-slate-900 dark:text-white">Sarah Jenkins</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Eletricista licenciada &middot; 5 anos de experiencia
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-500" />
                      ))}
                    </div>
                    <span className="font-semibold text-[0.8125rem] text-slate-900 dark:text-slate-100">4,9</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">(124 avaliacoes)</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Mensagem
                    </button>
                    <button className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors bg-primary-600 text-white hover:bg-primary-700 shadow-glow-blue">
                      Contratar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── SOCIAL PROOF NUMBERS ─── */}
          <section className="bg-white dark:bg-slate-950">
            <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-6 px-4 py-12 text-center sm:px-6 lg:grid-cols-4 lg:px-8">
              {[
                { value: "10 mil+", label: "Profissionais ativos" },
                { value: "50 mil+", label: "Servicos entregues" },
                { value: formatCurrency(6500000), label: "Pagos a profissionais" },
                { value: "< 2h", label: "Tempo medio de match" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-5 md:p-6 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/50 border-t-2 border-t-primary-500/50">
                  <p className="font-black text-xl md:text-2xl leading-tight text-slate-900 dark:text-white">
                    {s.value}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── FINAL CTA ─── */}
          <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center md:px-16 bg-slate-900 dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-800/50">
              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary-600/15 blur-3xl" />
              <div className="relative">
                <p className="mx-auto font-bold text-white m-0" style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", letterSpacing: "-0.03em" }}>
                  {isAuthenticated ? "Gerencie seus servicos" : "Pronto para escalar seu negocio?"}
                </p>
                <p className="mx-auto mt-3 max-w-xl text-base text-slate-400">
                  {isAuthenticated
                    ? "Acesse seu painel para acompanhar pedidos, catalogo e pagamentos."
                    : "Leva menos de 5 minutos para criar sua conta profissional e comecar a receber oportunidades."}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  {isAuthenticated ? (
                    <>
                      <Link to={dashboardPath} className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 no-underline">
                        Ver meu painel
                      </Link>
                      <Link to="/services" className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline">
                        Explorar servicos
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5"
                        onClick={() => openRegisterPrompt("PROFESSIONAL")}
                      >
                        Abrir cadastro profissional
                      </button>
                      <Link to="/login" className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline">
                        Entrar na minha conta
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ─── FOOTER ─── */}
        <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/50">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="FazTudo" className="h-12 w-auto object-contain" />
              <span className="text-sm text-slate-400 dark:text-slate-500">
                &copy; {new Date().getFullYear()} FazTudo Pro. Todos os direitos reservados.
              </span>
            </div>
            <div className="flex items-center gap-6">
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 no-underline">
                    Meu Perfil
                  </Link>
                  <Link to={dashboardPath} className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 no-underline">
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 no-underline">
                    Entrar
                  </Link>
                  <button className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400" onClick={() => openRegisterPrompt("PROFESSIONAL")}>
                    Cadastro profissional
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>

        <FixedSwitchCard onGoToClients={() => navigate("/")} />
      </div>

      {registerRole === "PROFESSIONAL" ? (
        <RegisterPromptProfessional
          isOpen={isRegisterPromptOpen}
          onClose={() => setIsRegisterPromptOpen(false)}
          onSwitchToClient={() => setRegisterRole("CLIENT")}
        />
      ) : (
        <RegisterPromptClient
          isOpen={isRegisterPromptOpen}
          onClose={() => setIsRegisterPromptOpen(false)}
          onSwitchToProfessional={() => setRegisterRole("PROFESSIONAL")}
        />
      )}
    </PageTransition>
  );
};

export default LandingPageProfessional;
