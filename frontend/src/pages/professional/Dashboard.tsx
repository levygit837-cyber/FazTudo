import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle,
  DollarSign,
  Star,
  ArrowRight,
  FileText,
  Wallet,
  AlertTriangle,
  Sun,
  Sunrise,
  Moon,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { StatsCard } from "../../components/dashboard/StatsCard";
import { OrderCard } from "../../components/orders/OrderCard";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  getDashboardStats,
  getRecentOrders,
  ProfessionalDashboardStats,
} from "../../services/dashboardService";
import { ServiceOrder } from "../../types";
import { formatCurrency, formatRating } from "../../utils/formatters";

/* ── Helpers ───────────────────────────────────────────── */

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)
    return { text: "Bom dia", icon: <Sunrise className="w-6 h-6 text-amber-500" /> };
  if (hour >= 12 && hour < 18)
    return { text: "Boa tarde", icon: <Sun className="w-6 h-6 text-orange-500" /> };
  return { text: "Boa noite", icon: <Moon className="w-6 h-6 text-indigo-400" /> };
}

const ProfessionalDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<ServiceOrder[]>([]);
  const [stats, setStats] = useState<ProfessionalDashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    totalServices: 0,
    totalEarnings: 0,
    pendingRevenue: 0,
    availableBalance: 0,
    averageRating: 0,
    totalReviews: 0,
  });

  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsData, ordersData] = await Promise.all([
          getDashboardStats().catch(() => null),
          getRecentOrders(5).catch(() => []),
        ]);

        if (statsData) setStats(statsData as ProfessionalDashboardStats);
        setRecentOrders(ordersData);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {greeting.icon}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {greeting.text}, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Gerencie seus servicos e acompanhe seus ganhos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 transition-all duration-500 ${
                  star <= Math.round(stats.averageRating)
                    ? "text-yellow-400 fill-yellow-400 scale-110"
                    : "text-slate-300 dark:text-slate-600"
                }`}
                style={{ animationDelay: `${star * 100}ms` }}
              />
            ))}
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {formatRating(stats.averageRating)}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            ({stats.totalReviews} avaliacoes)
          </span>
        </div>
      </div>

      {/* Urgent action alert */}
      {stats.pendingOrders > 0 && (
        <Link
          to="/professional/services"
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Voce tem {stats.pendingOrders} pedido{stats.pendingOrders > 1 ? "s" : ""} pendente{stats.pendingOrders > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Responda rapidamente para manter uma boa reputacao.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-500 flex-shrink-0" />
        </Link>
      )}

      {/* Earnings callout */}
      {(stats.availableBalance > 0 || stats.pendingRevenue > 0) && (
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-emerald-200" />
              <div>
                <p className="text-sm text-emerald-100">Saldo disponivel para saque</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.availableBalance)}</p>
              </div>
            </div>
            {stats.pendingRevenue > 0 && (
              <div className="text-right">
                <p className="text-sm text-emerald-100">Em escrow</p>
                <p className="text-lg font-semibold text-emerald-50">
                  {formatCurrency(stats.pendingRevenue)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Pedidos Pendentes"
          value={stats.pendingOrders}
          subtitle={`${stats.inProgressOrders} em andamento`}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatsCard
          title="Concluidos"
          value={stats.completedOrders}
          subtitle={`${stats.totalOrders} total`}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Saldo Disponivel"
          value={formatCurrency(stats.availableBalance)}
          subtitle={`${formatCurrency(stats.pendingRevenue)} em escrow`}
          icon={<Wallet className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Total Ganho"
          value={formatCurrency(stats.totalEarnings)}
          subtitle={`${stats.totalServices} servicos ativos`}
          icon={<DollarSign className="w-6 h-6" />}
          color="primary"
        />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 stagger-grid">
        <Link to="/professional/services" className="card card-hover flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Meus Pedidos</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Gerencie seus pedidos</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link to="/professional/crm" className="card card-hover flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-cyan-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">CRM</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Pedidos e faturamento</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link to="/professional/agenda" className="card card-hover flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-violet-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Agenda</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Calendario operacional</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link to="/professional/financeiro" className="card card-hover flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Financeiro</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Ganhos e saques</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link to="/professional/reputacao" className="card card-hover flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Star className="w-6 h-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">Reputacao</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Avaliacoes e ranking</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>
      </div>

      {/* Pedidos recentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Pedidos Recentes
          </h2>
          <Link
            to="/professional/services"
            className="text-sm text-primary-600 hover:underline"
          >
            Ver todos
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon="package"
            title="Nenhum pedido ainda"
            description="Voce ainda nao recebeu pedidos. Cadastre servicos no seu catalogo para comecar a receber!"
            action={{
              label: "Gerenciar catalogo",
              onClick: () => navigate("/professional/catalog"),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-grid">
            {recentOrders.map((order) => (
              <OrderCard
                key={order.id}
                id={order.id}
                title={order.title}
                status={order.status}
                price={order.price}
                scheduledDate={order.scheduledDate || undefined}
                deadlineDate={order.deadlineDate || undefined}
                createdAt={order.createdAt}
                client={
                  order.client
                    ? {
                        id: order.client.id,
                        name: order.client.name,
                        profileImage: order.client.profileImage || undefined,
                      }
                    : undefined
                }
                isProfessionalView
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalDashboard;
