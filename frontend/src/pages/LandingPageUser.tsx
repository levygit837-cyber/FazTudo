import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import clsx from "clsx";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Shield,
  Star,
  User,
  Users,
  Zap,
  Paintbrush,
  Droplets,
  Plug,
  Leaf,
  Monitor,
} from "lucide-react";

import RegisterPromptClient from "../components/landing/RegisterPromptClient";
import RegisterPromptProfessional from "../components/landing/RegisterPromptProfessional";
import { TrustBadge } from "../components/common/TrustBadge";
import { formatCurrency } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";
import { HowItWorksInteractive } from "../components/landing/HowItWorksInteractive";

const LandingPageUser: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isProfessional, isAdmin, logout } = useAuth();
  const [isRegisterPromptOpen, setIsRegisterPromptOpen] = useState(false);
  const [registerRole, setRegisterRole] = useState<"CLIENT" | "PROFESSIONAL">("CLIENT");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLandingSwitch = (path: string) => {
    if (isLeaving) return;
    setIsLeaving(true);
    setTimeout(() => navigate(path), 200);
  };

  const dashboardPath = isAdmin
    ? "/admin"
    : isProfessional
      ? "/professional/dashboard"
      : "/client/dashboard";

  const stats = [
    { value: "10 mil+", label: "Profissionais ativos" },
    { value: "50 mil+", label: "Servicos concluidos" },
    { value: "4,9/5", label: "Avaliacao media" },
    { value: formatCurrency(6500000), label: "Movimentados" },
  ];

  const categories = [
    { name: "Encanamento", icon: <Droplets className="h-5 w-5" /> },
    { name: "Limpeza", icon: <Zap className="h-5 w-5" /> },
    { name: "Eletrica", icon: <Plug className="h-5 w-5" /> },
    { name: "Pintura", icon: <Paintbrush className="h-5 w-5" /> },
    { name: "Jardinagem", icon: <Leaf className="h-5 w-5" /> },
    { name: "Design Web", icon: <Monitor className="h-5 w-5" /> },
  ];


  const testimonials = [
    {
      name: "Sofia Almeida",
      role: "Cliente desde 2024",
      quote: "Encontrei um encanador em menos de 20 minutos. Processo simples e seguro.",
      rating: 5,
    },
    {
      name: "Marcos Teixeira",
      role: "Cliente desde 2023",
      quote: "As avaliacoes me ajudaram a escolher o profissional certo para a reforma.",
      rating: 5,
    },
    {
      name: "Kelly Martins",
      role: "Cliente desde 2024",
      quote: "Consegui resolver o servico no mesmo dia com total transparencia.",
      rating: 5,
    },
  ];

  const openRegisterPrompt = (role: "CLIENT" | "PROFESSIONAL") => {
    setRegisterRole(role);
    setIsRegisterPromptOpen(true);
  };

  return (
    <>
      <div className={clsx("min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 animate-fadeIn", isLeaving && "landing-exit")}>

        {/* ─── HEADER ─── */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/50">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              to="/"
              className="inline-flex items-center no-underline"
            >
              <img src="/logo.png" alt="FazTudo" className="h-16 w-auto object-contain" />
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
              <a
                href="#como-funciona"
                className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline"
              >
                Como funciona
              </a>
              <a
                href="#categorias"
                className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline"
              >
                Categorias
              </a>
              {isAuthenticated && (
                <Link
                  to={dashboardPath}
                  className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline"
                >
                  Dashboard
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  to={isProfessional ? "/professional/services" : "/client/orders"}
                  className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 no-underline"
                >
                  {isProfessional ? "Meus Servicos" : "Meus Pedidos"}
                </Link>
              )}
            </nav>

            <div className="inline-flex items-center gap-2">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/login"
                    className="hidden rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:block text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 no-underline"
                  >
                    Entrar
                  </Link>
                  <button
                    className="hidden rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:block text-white bg-primary-600 hover:bg-primary-700 shadow-glow-blue"
                    onClick={() => openRegisterPrompt("CLIENT")}
                  >
                    Criar conta
                  </button>
                  <button
                    onClick={() => handleLandingSwitch("/profissionais")}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 sm:hidden"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Pro</span>
                  </button>
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
                        <Link
                          to="/profile"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <User className="h-4 w-4" />
                          Meu Perfil
                        </Link>
                        <Link
                          to={dashboardPath}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Briefcase className="h-4 w-4" />
                          Dashboard
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-800/50 my-1" />
                        <button
                          onClick={() => { setShowUserMenu(false); logout(); }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <LogOut className="h-4 w-4" />
                          Sair
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
            {/* Background grid pattern */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
            {/* Blue radial glow */}
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-primary-600/10 blur-3xl" />

            <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider bg-primary-900/30 text-primary-300 border border-primary-800/30">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Milhares de clientes atendidos
                </div>

                <p className="font-black leading-[1.1] text-white m-0" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}>
                  Especialistas para cada projeto da sua{" "}
                  <span className="text-primary-400">casa ou empresa</span>
                </p>

                <p className="max-w-lg leading-relaxed text-lg text-slate-400">
                  Encontre profissionais confiaveis com avaliacoes reais,
                  orcamento rapido e pagamento seguro em todo o Brasil.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/services"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue-lg transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 no-underline text-[0.9375rem]"
                  >
                    Encontrar profissional
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {isAuthenticated ? (
                    <Link
                      to={dashboardPath}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline text-[0.9375rem]"
                    >
                      Ir ao Dashboard
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleLandingSwitch("/profissionais")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 text-[0.9375rem]"
                    >
                      Oferecer servicos
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Users className="h-4 w-4" />
                  Mais de 1.000 novos clientes por semana
                </div>
              </div>

              {/* Hero image card */}
              <div className="relative hidden lg:block">
                <div className="overflow-hidden rounded-2xl shadow-2xl border-2 border-primary-500/20 shadow-glow-blue">
                  <img
                    src="https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=1200&q=80"
                    alt="Profissional executando servico residencial"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-xl p-4 shadow-xl backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Servico finalizado</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Reforma concluida antes do prazo</p>
                  </div>
                </div>
                {/* Floating rating */}
                <div className="absolute -right-4 top-6 flex items-center gap-2 rounded-xl px-4 py-3 shadow-xl backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/50">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current text-amber-500" />
                    ))}
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[0.8125rem]">4,9</span>
                </div>
              </div>
            </div>

            {/* Trust badges row */}
            <div className="relative mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
              <div className="flex flex-wrap justify-center gap-3">
                <TrustBadge type="payment-protected" size="lg" />
                <TrustBadge type="verified-professional" size="lg" />
                <TrustBadge type="service-guarantee" size="lg" />
              </div>
            </div>
          </section>

          {/* ─── STATS ─── */}
          <section className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/50">
            <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 lg:grid-cols-4 lg:px-8">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl p-5 md:p-6 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/50 border-t-2 border-t-primary-500/50">
                  <p className="font-black text-xl md:text-2xl leading-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── CATEGORIES ─── */}
          <section id="categorias" className="bg-slate-50 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="mb-10 flex items-end justify-between">
                <div>
                  <p className="font-bold text-2xl text-slate-900 dark:text-white m-0" style={{ letterSpacing: "-0.03em" }}>
                    Servicos em destaque
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-base mt-2">
                    Encontre especialistas nas categorias mais buscadas.
                  </p>
                </div>
                <Link
                  to="/services"
                  className="hidden items-center gap-1.5 font-semibold transition-colors md:inline-flex text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 no-underline text-sm"
                >
                  Ver todas
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    to="/services"
                    className="group flex flex-col items-center gap-3 rounded-2xl p-5 md:p-6 text-center transition-all duration-200 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 no-underline shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-glow-blue"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                      {cat.icon}
                    </div>
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <HowItWorksInteractive />

          {/* ─── TRUST BANNER ─── */}
          <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center gap-6 rounded-2xl px-8 py-8 sm:flex-row sm:gap-10 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 dark:shadow-glow-blue">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  Pagamento protegido
                </span>
              </div>
              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  Profissionais verificados
                </span>
              </div>
              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                  Avaliacoes reais
                </span>
              </div>
            </div>
          </section>

          {/* ─── TESTIMONIALS ─── */}
          <section className="py-16 bg-slate-50 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-10 text-center">
                <p className="font-bold text-2xl text-slate-900 dark:text-white m-0" style={{ letterSpacing: "-0.03em" }}>
                  O que nossos clientes dizem
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-base mt-2">
                  Historias reais de quem ja usou o FazTudo.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {testimonials.map((t) => (
                  <article
                    key={t.name}
                    className="rounded-2xl p-6 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-slate-800/50 shadow-sm"
                  >
                    <div className="mb-4 flex items-center gap-0.5">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current text-amber-500" />
                      ))}
                    </div>
                    <p className="leading-relaxed text-[0.9375rem] text-slate-600 dark:text-slate-400 italic">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t.role}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ─── FINAL CTA ─── */}
          <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center md:px-16 bg-slate-900 dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-800/50">
              {/* Blue glow aura */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" />

              <div className="relative">
                <p className="mx-auto font-bold text-white m-0" style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", letterSpacing: "-0.03em" }}>
                  {isAuthenticated ? "Explore mais servicos" : "Pronto para comecar?"}
                </p>
                <p className="mx-auto mt-3 max-w-xl text-base text-slate-400">
                  {isAuthenticated
                    ? "Descubra novos profissionais e acompanhe seus pedidos no painel."
                    : "Crie sua conta e publique seu primeiro pedido em menos de 5 minutos."}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  {isAuthenticated ? (
                    <>
                      <Link
                        to="/services"
                        className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5 no-underline"
                      >
                        Explorar servicos
                      </Link>
                      <Link
                        to={dashboardPath}
                        className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50 no-underline"
                      >
                        Ver meu painel
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold shadow-glow-blue transition-all duration-200 bg-primary-600 text-white hover:bg-primary-500 hover:-translate-y-0.5"
                        onClick={() => openRegisterPrompt("CLIENT")}
                      >
                        Criar conta de cliente
                      </button>
                      <button
                        onClick={() => handleLandingSwitch("/profissionais")}
                        className="inline-flex items-center justify-center rounded-xl px-7 py-3.5 font-semibold transition-all duration-200 border-2 border-slate-700 text-white hover:bg-slate-800/50"
                      >
                        Quero oferecer servicos
                      </button>
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
                &copy; {new Date().getFullYear()} FazTudo. Todos os direitos reservados.
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
                  <Link to="/register" className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 no-underline">
                    Cadastro
                  </Link>
                </>
              )}
              <button
                onClick={() => handleLandingSwitch("/profissionais")}
                className="font-medium transition-colors text-sm text-slate-500 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
              >
                Area de Profissionais
              </button>
            </div>
          </div>
        </footer>
      </div>

      {registerRole === "CLIENT" ? (
        <RegisterPromptClient
          isOpen={isRegisterPromptOpen}
          onClose={() => setIsRegisterPromptOpen(false)}
          onSwitchToProfessional={() => setRegisterRole("PROFESSIONAL")}
        />
      ) : (
        <RegisterPromptProfessional
          isOpen={isRegisterPromptOpen}
          onClose={() => setIsRegisterPromptOpen(false)}
          onSwitchToClient={() => setRegisterRole("CLIENT")}
        />
      )}
    </>
  );
};

export default LandingPageUser;
