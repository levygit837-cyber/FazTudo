import React from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Shield,
  Clock,
  TrendingUp,
  Users,
  Star,
  Briefcase,
  Home as HomeIcon,
  Wrench,
  Zap,
  Award,
  ArrowRight,
  Search,
  FileText,
  CreditCard,
  CheckSquare,
  DollarSign,
} from "lucide-react";

const Home: React.FC = () => {
  const popularCategories = [
    { icon: <HomeIcon size={24} />, name: "Reparos Domesticos", count: 245, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
    { icon: <Wrench size={24} />, name: "Eletricista", count: 189, color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
    { icon: <Zap size={24} />, name: "Encanamento", count: 167, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
    { icon: <Briefcase size={24} />, name: "Limpeza", count: 312, color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" },
    { icon: <Award size={24} />, name: "Jardinagem", count: 134, color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
    { icon: <Shield size={24} />, name: "Montagem", count: 98, color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" },
  ];

  const howItWorks = [
    { step: 1, title: "Encontre", description: "Busque servicos por categoria ou profissional", icon: <Search size={24} /> },
    { step: 2, title: "Solicite", description: "Faca o pedido com detalhes e agendamento", icon: <FileText size={24} /> },
    { step: 3, title: "Pague", description: "Pagamento seguro em sistema de garantia", icon: <CreditCard size={24} /> },
    { step: 4, title: "Aproveite", description: "Servico realizado com qualidade", icon: <CheckSquare size={24} /> },
    { step: 5, title: "Libere", description: "Pagamento liberado apos sua aprovacao", icon: <DollarSign size={24} /> },
  ];

  const professionalBenefits = [
    { icon: <TrendingUp size={20} />, text: "Aumente sua renda" },
    { icon: <Shield size={20} />, text: "Pagamento garantido" },
    { icon: <Clock size={20} />, text: "Controle sua agenda" },
    { icon: <Star size={20} />, text: "Construa reputacao" },
  ];

  const clientBenefits = [
    { icon: <CheckCircle size={20} />, text: "Profissionais verificados" },
    { icon: <Shield size={20} />, text: "Pagamento seguro" },
    { icon: <Clock size={20} />, text: "Agendamento flexivel" },
    { icon: <Star size={20} />, text: "Transparencia total" },
  ];

  const stats = [
    { value: "10.000+", label: "Profissionais" },
    { value: "50.000+", label: "Servicos" },
    { value: "4.8", label: "Avaliacao media" },
    { value: "R$ 5M+", label: "Processados" },
  ];

  return (
    <div className="space-y-16 md:space-y-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl md:rounded-4xl bg-slate-900 dark:bg-slate-900/80 dark:border dark:border-slate-800/50">
        {/* Blue glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary-600/10 blur-3xl" />
        <div className="container-responsive relative z-10 py-12 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              Profissionais{" "}
              <span className="text-primary-400">confiaveis</span> para
              qualquer servico
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 mb-10 max-w-3xl mx-auto">
              Da jardinagem a eletrica, conectamos voce aos melhores
              profissionais com seguranca e qualidade.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/services"
                className="btn text-lg px-8 py-4 rounded-xl font-semibold bg-primary-600 text-white hover:bg-primary-500 shadow-glow-blue-lg hover:-translate-y-0.5 transition-all no-underline"
              >
                <Search className="w-5 h-5 mr-2" />
                Buscar Servicos
              </Link>
              <Link
                to="/register"
                className="btn text-lg px-8 py-4 rounded-xl font-semibold border-2 border-slate-700 text-white hover:bg-slate-800/50 transition-all no-underline"
              >
                <Briefcase className="w-5 h-5 mr-2" />
                Ser Profissional
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container-responsive">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center rounded-xl p-6 md:p-8 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/50 border-t-2 border-t-primary-500/50">
              <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container-responsive">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Como funciona
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Simples, seguro e eficiente. Do pedido ao pagamento, cuidamos de
            tudo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {howItWorks.map((step) => (
            <div key={step.step} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 dark:border dark:border-slate-800/50 flex items-center justify-center mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-glow-blue">
                  {step.icon}
                </div>
              </div>
              <div className="mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {step.step}
                </span>
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                {step.title}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular Categories */}
      <section className="container-responsive">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Categorias populares
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Encontre o profissional ideal
            </p>
          </div>
          <Link
            to="/services"
            className="hidden md:flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-semibold no-underline"
          >
            Ver todos
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {popularCategories.map((category, index) => (
            <Link
              key={index}
              to={`/services?category=${category.name.toLowerCase()}`}
              className="card card-hover p-5 text-center no-underline"
            >
              <div className={`w-11 h-11 rounded-lg ${category.color} flex items-center justify-center mx-auto mb-3`}>
                {category.icon}
              </div>
              <p className="font-semibold text-slate-900 dark:text-white mb-0.5 text-sm">
                {category.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {category.count} profissionais
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 md:hidden text-center">
          <Link to="/services" className="btn btn-outline w-full no-underline">
            Explorar todos os servicos
          </Link>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="container-responsive">
        <div className="grid md:grid-cols-2 gap-8">
          {/* For Professionals */}
          <div className="rounded-2xl p-6 md:p-8 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-primary-800/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow-glow-blue">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  Para Profissionais
                </p>
                <p className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
                  Cresca seu negocio
                </p>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {professionalBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mr-3 mt-0.5 text-primary-600 dark:text-primary-400">
                    {benefit.icon}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    {benefit.text}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              to="/register?role=professional"
              className="btn btn-primary w-full justify-center no-underline"
            >
              Cadastrar como Profissional
            </Link>
          </div>

          {/* For Clients */}
          <div className="rounded-2xl p-6 md:p-8 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-glow-green">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  Para Clientes
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  Servicos com qualidade
                </p>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {clientBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mr-3 mt-0.5 text-emerald-600 dark:text-emerald-400">
                    {benefit.icon}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    {benefit.text}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              to="/services"
              className="btn btn-secondary w-full justify-center no-underline"
            >
              Encontrar Servicos
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container-responsive">
        <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 text-center bg-slate-900 dark:bg-slate-900/80 dark:backdrop-blur-xl border border-slate-800/50">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-primary-600/15 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para comecar?
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de profissionais e clientes que ja confiam no
              FazTudo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn px-8 py-3 font-semibold bg-primary-600 text-white hover:bg-primary-500 shadow-glow-blue hover:-translate-y-0.5 transition-all no-underline"
              >
                Criar Conta Gratuita
              </Link>
              <Link
                to="/login"
                className="btn border-2 border-slate-700 text-white px-8 py-3 font-semibold hover:bg-slate-800/50 transition-all no-underline"
              >
                Fazer Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
