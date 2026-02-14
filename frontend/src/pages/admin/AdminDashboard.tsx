import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Briefcase,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Shield,
  AlertCircle,
  ArrowRight,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { getAdminStats, AdminStats } from "../../services/adminService";
import { formatCurrency } from "../../utils/formatters";

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminStats();
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao carregar estatisticas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Painel Administrativo
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Visao geral da plataforma FazTudo
        </p>
      </div>

      {/* Alert: Pending verifications */}
      {stats.verifications.pending > 0 && (
        <Link
          to="/admin/verifications"
          className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4 transition-colors hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
        >
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              {stats.verifications.pending} verificacao(oes) pendente(s)
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Clique aqui para revisar
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-yellow-600" />
        </Link>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-grid">
        {/* Total Users */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Usuarios
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.users.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            +{stats.users.newLast30Days} nos ultimos 30 dias
          </p>
        </div>

        {/* Total Services */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Servicos
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.services.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100 dark:bg-secondary-900/30">
              <Briefcase className="h-6 w-6 text-secondary-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {stats.services.available} disponiveis
          </p>
        </div>

        {/* Total Orders */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Pedidos
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.orders.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            +{stats.orders.newLast30Days} nos ultimos 30 dias
          </p>
        </div>

        {/* Revenue */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Receita Total
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(stats.financial.totalRevenue)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {formatCurrency(stats.financial.heldInEscrow)} em escrow
          </p>
        </div>
      </div>

      {/* Detail sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users breakdown */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Usuarios</h2>
            <Link
              to="/admin/users"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Ativos</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.users.active}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Clientes</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.users.clients}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-secondary-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Profissionais</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.users.professionals}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Pendentes</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.users.pending}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-red-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Suspensos</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.users.suspended}
              </span>
            </div>
          </div>
        </div>

        {/* Orders breakdown */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Pedidos</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Pendentes</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.orders.pending}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Em andamento</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.orders.inProgress}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Concluidos</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.orders.completed}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-red-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Cancelados</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {stats.orders.cancelled}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Acoes rapidas
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/admin/users"
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <Users className="h-8 w-8 text-primary-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Gerenciar Usuarios</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.users.total} usuarios
                </p>
              </div>
            </Link>
            <Link
              to="/admin/verifications"
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <Shield className="h-8 w-8 text-secondary-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Verificacoes</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.verifications.pending} pendentes
                </p>
              </div>
            </Link>
            <Link
              to="/admin/users?role=PROFESSIONAL"
              className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <Briefcase className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Profissionais</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {stats.users.professionals} cadastrados
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
