import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock,
  Star,
  ArrowRight,
  FileText,
  Wallet,
  AlertTriangle,
  Sun,
  Sunrise,
  Moon,
  TrendingUp,
  BarChart3,
  Calendar,
  Award,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { MoneyCard } from "../../components/dashboard/MoneyCard";
import { ProgressRing } from "../../components/dashboard/ProgressRing";
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
    return { text: "Bom dia", icon: <Sunrise className="w-7 h-7 text-amber-500" /> };
  if (hour >= 12 && hour < 18)
    return { text: "Boa tarde", icon: <Sun className="w-7 h-7 text-orange-500" /> };
  return { text: "Boa noite", icon: <Moon className="w-7 h-7 text-indigo-400" /> };
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

  const completionRate =
    stats.totalOrders > 0
      ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
      : 0;

  const ratingStars = Math.round(stats.averageRating);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ──────── COMMAND CENTER HEADER ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            {greeting.icon}
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {greeting.text}, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Gerencie seus servicos e acompanhe seus ganhos.
            </p>
          </div>
        </div>

        {/* Rating visual with ranking */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl px-5 py-3 border border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 transition-all duration-500 ${
                      star <= ratingStars
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-300 dark:text-slate-600"
                    }`}
                    style={{ animationDelay: `${star * 100}ms` }}
                  />
                ))}
              </div>
              <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                {formatRating(stats.averageRating)}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {stats.totalReviews} avaliacao{stats.totalReviews !== 1 ? "es" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ──────── ALERT BAR ──────── */}
      {stats.pendingOrders > 0 && (
        <Link
          to="/professional/services"
          className="
            flex items-center gap-3 p-4 rounded-2xl
            bg-amber-50 dark:bg-amber-900/15
            border-2 border-amber-200 dark:border-amber-800/50
            hover:bg-amber-100 dark:hover:bg-amber-900/25
            transition-all duration-200 group
          "
        >
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-amber-900 dark:text-amber-200">
              {stats.pendingOrders} pedido{stats.pendingOrders > 1 ? "s" : ""} pendente{stats.pendingOrders > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Responda rapidamente para manter uma boa reputacao.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-500 flex-shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* ──────── MONEY ROW ──────── */}
      {(stats.availableBalance > 0 || stats.pendingRevenue > 0 || stats.totalEarnings > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-grid">
          <MoneyCard
            label="Disponivel para Saque"
            value={formatCurrency(stats.availableBalance)}
            icon={<Wallet className="w-5 h-5 text-emerald-200" />}
            variant="emerald"
            action={{ label: "Sacar agora", to: "/professional/carteira" }}
          />
          <MoneyCard
            label="Em Escrow"
            value={formatCurrency(stats.pendingRevenue)}
            sublabel={`${stats.inProgressOrders} pedido${stats.inProgressOrders !== 1 ? "s" : ""} em andamento`}
            icon={<Clock className="w-5 h-5 text-teal-200" />}
            variant="teal"
          />
          <MoneyCard
            label="Total Acumulado"
            value={formatCurrency(stats.totalEarnings)}
            sublabel={`${stats.totalServices} servico${stats.totalServices !== 1 ? "s" : ""} ativo${stats.totalServices !== 1 ? "s" : ""}`}
            icon={<TrendingUp className="w-5 h-5 text-blue-200" />}
            variant="blue"
            sparklineData={[200, 350, 300, 500, 450, 600, 550, 700]}
          />
        </div>
      )}

      {/* ──────── PERFORMANCE + QUICK ACTIONS ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-grid">
        {/* Performance Card */}
        <div className="card p-6">
          <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-5">
            Performance
          </h3>

          <div className="flex items-center gap-6">
            {/* Donut chart */}
            <ProgressRing
              value={completionRate}
              size={100}
              strokeWidth={10}
              color="#059669"
              label="Conclusao"
            />

            {/* Stats list */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Pendentes</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {stats.pendingOrders}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Em andamento</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {stats.inProgressOrders}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Concluidos</span>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {stats.completedOrders}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Taxa de conclusao
                  </span>
                  <span className="font-mono font-bold text-emerald-600">
                    {completionRate}%
                  </span>
                </div>
                <div className="mt-1.5 w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions 2x2 */}
        <div className="card p-6">
          <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-5">
            Acoes Rapidas
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/professional/services"
              className="
                flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-slate-50 dark:bg-slate-800/50
                hover:bg-primary-50 dark:hover:bg-primary-900/20
                border border-slate-100 dark:border-slate-700/50
                hover:border-primary-200 dark:hover:border-primary-800/50
                transition-all duration-200 group
              "
            >
              <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pedidos</span>
            </Link>

            <Link
              to="/professional/crm"
              className="
                flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-slate-50 dark:bg-slate-800/50
                hover:bg-cyan-50 dark:hover:bg-cyan-900/20
                border border-slate-100 dark:border-slate-700/50
                hover:border-cyan-200 dark:hover:border-cyan-800/50
                transition-all duration-200 group
              "
            >
              <div className="w-11 h-11 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-cyan-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">CRM</span>
            </Link>

            <Link
              to="/professional/agenda"
              className="
                flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-slate-50 dark:bg-slate-800/50
                hover:bg-violet-50 dark:hover:bg-violet-900/20
                border border-slate-100 dark:border-slate-700/50
                hover:border-violet-200 dark:hover:border-violet-800/50
                transition-all duration-200 group
              "
            >
              <div className="w-11 h-11 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-violet-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Agenda</span>
            </Link>

            <Link
              to="/professional/reputacao"
              className="
                flex flex-col items-center gap-2.5 p-4 rounded-xl
                bg-slate-50 dark:bg-slate-800/50
                hover:bg-amber-50 dark:hover:bg-amber-900/20
                border border-slate-100 dark:border-slate-700/50
                hover:border-amber-200 dark:hover:border-amber-800/50
                transition-all duration-200 group
              "
            >
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reputacao</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ──────── PEDIDOS RECENTES ──────── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
            Pedidos Recentes
          </h2>
          <Link
            to="/professional/services"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 group"
          >
            Ver todos
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
      </section>
    </div>
  );
};

export default ProfessionalDashboard;
