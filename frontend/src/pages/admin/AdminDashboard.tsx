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
  RefreshCw,
} from "lucide-react";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { ProgressRing } from "../../components/dashboard/ProgressRing";
import { SparklineChart } from "../../components/dashboard/SparklineChart";
import { getAdminStats, AdminStats } from "../../services/adminService";
import { formatCurrency } from "../../utils/formatters";

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminStats();
      setStats(data);
      setLastUpdated(
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
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
        <div className="rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-6 py-4 text-sm text-red-700 dark:text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Compute breakdown percentages
  const userTotal = stats.users.total || 1;
  const clientPct = Math.round((stats.users.clients / userTotal) * 100);

  const orderTotal = stats.orders.total || 1;
  const completedPct = Math.round((stats.orders.completed / orderTotal) * 100);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8 animate-fadeIn">
      {/* ──────── HEADER ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Painel Administrativo
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Visao geral da plataforma FazTudo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Atualizado as {lastUpdated}
            </span>
          )}
          <button
            onClick={loadStats}
            className="
              inline-flex items-center gap-2 px-3.5 py-2
              text-sm font-medium text-slate-600 dark:text-slate-400
              bg-slate-100 dark:bg-slate-800 rounded-xl
              hover:bg-slate-200 dark:hover:bg-slate-700
              transition-colors active:scale-[0.97]
            "
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* ──────── ALERTS ──────── */}
      {stats.verifications.pending > 0 && (
        <Link
          to="/admin/verifications"
          className="
            flex items-center gap-3 rounded-2xl
            border-2 border-yellow-200 dark:border-yellow-800/50
            bg-yellow-50 dark:bg-yellow-900/15
            p-4 transition-all duration-200
            hover:bg-yellow-100 dark:hover:bg-yellow-900/25 group
          "
        >
          <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-600 animate-pulse-soft" />
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-yellow-800 dark:text-yellow-300">
              {stats.verifications.pending} verificacao{stats.verifications.pending > 1 ? "es" : ""} pendente{stats.verifications.pending > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Clique aqui para revisar
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-yellow-600 flex-shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* ──────── MEGA STATS ──────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-grid">
        {/* Total Users */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Usuarios
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {stats.users.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">
              +{stats.users.newLast30Days}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">ultimos 30 dias</span>
          </div>
          <div className="absolute bottom-0 right-0 opacity-40">
            <SparklineChart
              data={[20, 35, 28, 45, 40, 55, 50, stats.users.total]}
              width={80}
              height={30}
              color="#3b82f6"
              showDot={false}
              fillOpacity={0.05}
            />
          </div>
        </div>

        {/* Total Services */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Servicos
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {stats.services.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100 dark:bg-secondary-900/30">
              <Briefcase className="h-6 w-6 text-secondary-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-medium text-secondary-600">{stats.services.available}</span> disponiveis
          </p>
        </div>

        {/* Total Orders */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Pedidos
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {stats.orders.total}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">
              +{stats.orders.newLast30Days}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">ultimos 30 dias</span>
          </div>
          <div className="absolute bottom-0 right-0 opacity-40">
            <SparklineChart
              data={[10, 18, 15, 25, 22, 30, 28, stats.orders.total]}
              width={80}
              height={30}
              color="#a855f7"
              showDot={false}
              fillOpacity={0.05}
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Receita Total
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {formatCurrency(stats.financial.totalRevenue)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-medium text-amber-600">
              {formatCurrency(stats.financial.heldInEscrow)}
            </span> em escrow
          </p>
        </div>
      </div>

      {/* ──────── BREAKDOWN ZONE — 3 columns ──────── */}
      <div className="grid gap-6 lg:grid-cols-3 stagger-grid">
        {/* Users breakdown */}
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">Usuarios</h2>
            <Link
              to="/admin/users"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 group"
            >
              Ver todos
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Donut */}
          <div className="flex justify-center mb-5">
            <ProgressRing
              value={clientPct}
              size={90}
              strokeWidth={10}
              color="#3b82f6"
              label="Clientes"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Ativos</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.users.active}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-primary-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Clientes</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.users.clients}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-secondary-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Profissionais</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.users.professionals}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Pendentes</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.users.pending}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Suspensos</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.users.suspended}
              </span>
            </div>
          </div>
        </div>

        {/* Orders breakdown */}
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">Pedidos</h2>
          </div>

          {/* Donut */}
          <div className="flex justify-center mb-5">
            <ProgressRing
              value={completedPct}
              size={90}
              strokeWidth={10}
              color="#059669"
              label="Concluidos"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Pendentes</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.orders.pending}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Em andamento</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.orders.inProgress}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Concluidos</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.orders.completed}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <UserX className="h-4 w-4 text-red-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Cancelados</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {stats.orders.cancelled}
              </span>
            </div>
          </div>
        </div>

        {/* Financial breakdown */}
        <div className="card p-6">
          <div className="mb-5">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">Financeiro</h2>
          </div>

          {/* Revenue visualization */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <ProgressRing
                value={
                  stats.financial.totalRevenue > 0
                    ? Math.round(
                        ((stats.financial.totalRevenue - stats.financial.heldInEscrow) /
                          stats.financial.totalRevenue) *
                          100,
                      )
                    : 0
                }
                size={90}
                strokeWidth={10}
                color="#f59e0b"
                label="Liberado"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Receita Total</span>
              </div>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                {formatCurrency(stats.financial.totalRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Em Escrow</span>
              </div>
              <span className="font-mono font-bold text-amber-600 text-sm">
                {formatCurrency(stats.financial.heldInEscrow)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Liberado</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 text-sm">
                {formatCurrency(stats.financial.totalRevenue - stats.financial.heldInEscrow)}
              </span>
            </div>
          </div>

          {/* Mini sparkline for revenue trend */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Tendencia de receita</p>
            <SparklineChart
              data={[100, 180, 150, 250, 220, 300, 280, 350]}
              width={240}
              height={36}
              color="#10b981"
              fillOpacity={0.08}
            />
          </div>
        </div>
      </div>

      {/* ──────── QUICK ACTIONS ──────── */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-5">
          Acoes Rapidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 stagger-grid">
          <Link
            to="/admin/users"
            className="
              flex items-center gap-4 rounded-2xl
              border-2 border-slate-100 dark:border-slate-700/50
              bg-slate-50/50 dark:bg-slate-800/30
              p-5 transition-all duration-200
              hover:border-primary-200 hover:bg-primary-50
              dark:hover:border-primary-800/50 dark:hover:bg-primary-900/20
              group
            "
          >
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900 dark:text-slate-100">
                Gerenciar Usuarios
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-medium">{stats.users.total}</span> usuarios
              </p>
            </div>
          </Link>
          <Link
            to="/admin/verifications"
            className="
              flex items-center gap-4 rounded-2xl
              border-2 border-slate-100 dark:border-slate-700/50
              bg-slate-50/50 dark:bg-slate-800/30
              p-5 transition-all duration-200
              hover:border-secondary-200 hover:bg-secondary-50
              dark:hover:border-secondary-800/50 dark:hover:bg-secondary-900/20
              group
            "
          >
            <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="h-6 w-6 text-secondary-600" />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900 dark:text-slate-100">
                Verificacoes
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-medium text-amber-600">{stats.verifications.pending}</span> pendentes
              </p>
            </div>
          </Link>
          <Link
            to="/admin/users?role=PROFESSIONAL"
            className="
              flex items-center gap-4 rounded-2xl
              border-2 border-slate-100 dark:border-slate-700/50
              bg-slate-50/50 dark:bg-slate-800/30
              p-5 transition-all duration-200
              hover:border-purple-200 hover:bg-purple-50
              dark:hover:border-purple-800/50 dark:hover:bg-purple-900/20
              group
            "
          >
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Briefcase className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900 dark:text-slate-100">
                Profissionais
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-medium">{stats.users.professionals}</span> cadastrados
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
