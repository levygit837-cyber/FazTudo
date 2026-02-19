import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  Loader,
  Building2,
  CreditCard,
  Shield,
  TrendingUp,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface DashboardData {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalServices: number;
  totalMembers: number;
  walletBalance: number;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  </div>
);

const CompanyDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/company/dashboard")
      .then((r) => setData(r.data.data))
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const stats = data ?? {
    totalOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    totalServices: 0,
    totalMembers: 0,
    walletBalance: 0,
  };

  const quickLinks = [
    { to: "/company/profile", icon: <Building2 className="h-5 w-5" />, label: "Perfil da Empresa", desc: "Editar informações" },
    { to: "/company/members", icon: <Users className="h-5 w-5" />, label: "Membros", desc: "Gerenciar equipe" },
    { to: "/company/orders", icon: <ShoppingBag className="h-5 w-5" />, label: "Pedidos", desc: "Ver todos os pedidos" },
    { to: "/company/salary", icon: <DollarSign className="h-5 w-5" />, label: "Salários", desc: "Regras e pagamentos" },
    { to: "/company/roles", icon: <Shield className="h-5 w-5" />, label: "Cargos", desc: "Permissões e hierarquia" },
    { to: "/company/carteira", icon: <CreditCard className="h-5 w-5" />, label: "Carteira", desc: "Saldo e transações" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Building2 className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard Empresarial
          </h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 ml-10">
          Bem-vindo, {user?.name}. Aqui está um resumo da sua empresa.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total de Pedidos"
          value={stats.totalOrders}
          icon={<ShoppingBag className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          title="Pendentes"
          value={stats.pendingOrders}
          icon={<Clock className="h-6 w-6 text-yellow-600" />}
          color="bg-yellow-100 dark:bg-yellow-900/30"
        />
        <StatCard
          title="Em Andamento"
          value={stats.inProgressOrders}
          icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
          color="bg-purple-100 dark:bg-purple-900/30"
        />
        <StatCard
          title="Concluídos"
          value={stats.completedOrders}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          color="bg-green-100 dark:bg-green-900/30"
        />
        <StatCard
          title="Serviços Oferecidos"
          value={stats.totalServices}
          icon={<LayoutDashboard className="h-6 w-6 text-indigo-600" />}
          color="bg-indigo-100 dark:bg-indigo-900/30"
        />
        <StatCard
          title="Membros na Equipe"
          value={stats.totalMembers}
          icon={<Users className="h-6 w-6 text-teal-600" />}
          color="bg-teal-100 dark:bg-teal-900/30"
        />
        <StatCard
          title="Saldo em Carteira"
          value={`R$ ${stats.walletBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<CreditCard className="h-6 w-6 text-emerald-600" />}
          color="bg-emerald-100 dark:bg-emerald-900/30"
          subtitle="Disponível para saque"
        />
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                {link.icon}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                  {link.label}
                </p>
                <p className="text-xs text-slate-500">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboard;
