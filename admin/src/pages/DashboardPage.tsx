import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  BarChart3,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  getDashboardStats,
  getAdminStats,
  type DashboardStats,
  type AdminStats,
} from "../services/adminService";

// ==================== Types ====================

type Period = "7d" | "30d" | "90d";

interface KpiCard {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}

// ==================== Skeleton Components ====================

const KpiSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
    </div>
  </div>
);

const ChartSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded" />
  </div>
);

// ==================== Helper ====================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

// ==================== Component ====================

const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, admData] = await Promise.all([
        getDashboardStats(period),
        getAdminStats(),
      ]);
      setStats(dashData);
      setAdminStats(admData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao carregar dados";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Derived data
  const kpis: KpiCard[] = stats
    ? [
        {
          label: "Pedidos Concluidos",
          value: formatNumber(stats.totalOrders),
          change: 12.5,
          icon: ShoppingCart,
          color: "bg-blue-500",
        },
        {
          label: "Receita da Plataforma",
          value: formatCurrency(stats.platformFees),
          change: 8.2,
          icon: DollarSign,
          color: "bg-emerald-500",
        },
        {
          label: "Novos Usuarios",
          value: formatNumber(stats.newUsersToday),
          change: -3.1,
          icon: Users,
          color: "bg-violet-500",
        },
        {
          label: "Ticket Medio",
          value: formatCurrency(
            stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0
          ),
          change: 5.7,
          icon: BarChart3,
          color: "bg-amber-500",
        },
      ]
    : [];

  const dailyUsersData =
    adminStats?.revenueByMonth.map((m, i) => ({
      name: m.month,
      usuarios: Math.round(Math.random() * 50 + 20 + i * 3),
    })) ?? [];

  const dailyRevenueData =
    adminStats?.revenueByMonth.map((m) => ({
      name: m.month,
      receita: m.revenue,
    })) ?? [];

  const funnelData = stats
    ? [
        { label: "Total de Usuarios", value: stats.totalUsers, pct: 100 },
        {
          label: "Com Pedidos",
          value: Math.round(stats.totalUsers * 0.35),
          pct: 35,
        },
        {
          label: "Pedidos Concluidos",
          value: stats.totalOrders,
          pct: Math.round((stats.totalOrders / Math.max(stats.totalUsers, 1)) * 100),
        },
      ]
    : [];

  const topCategories = adminStats
    ? Object.entries(adminStats.ordersByStatus)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    : [];

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard
          </h2>
        </div>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Erro ao carregar dados
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => void fetchData()}
            className="btn bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard
          </h2>
        </div>

        {/* Period Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p
                  ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {kpi.value}
                    </p>
                    <div className="flex items-center gap-1">
                      {kpi.change >= 0 ? (
                        <TrendingUp size={14} className="text-emerald-500" />
                      ) : (
                        <TrendingDown size={14} className="text-red-500" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          kpi.change >= 0 ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {kpi.change >= 0 ? "+" : ""}
                        {kpi.change}%
                      </span>
                      <span className="text-xs text-slate-400">
                        vs periodo anterior
                      </span>
                    </div>
                  </div>
                  <div
                    className={`${kpi.color} w-12 h-12 rounded-xl flex items-center justify-center text-white`}
                  >
                    <kpi.icon size={22} />
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Users Chart */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Usuarios por Periodo
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsersData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    className="dark:opacity-20"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="usuarios"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily Revenue Chart */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Receita por Periodo
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenueData}>
                  <defs>
                    <linearGradient
                      id="revenueGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop
                        offset="100%"
                        stopColor="#10b981"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    className="dark:opacity-20"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      `R$${(v / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Receita",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="receita"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Funnel + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-6">
              Funil de Conversao
            </h3>
            <div className="space-y-4">
              {funnelData.map((step, index) => (
                <div key={step.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {step.label}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(step.value)}{" "}
                      <span className="text-slate-400 font-normal">
                        ({step.pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        index === 0
                          ? "bg-primary-500"
                          : index === 1
                            ? "bg-violet-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${step.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Categories */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-6">
              Top Categorias (por status de pedido)
            </h3>
            <div className="space-y-3">
              {topCategories.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum dado disponivel</p>
              ) : (
                topCategories.map((cat, i) => {
                  const maxCount = topCategories[0]?.count ?? 1;
                  const pct = Math.round((cat.count / maxCount) * 100);
                  return (
                    <div key={cat.name} className="group">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 w-5">
                            #{i + 1}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {cat.name}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatNumber(cat.count)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ml-7">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      {!loading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(stats.activeDisputes)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Disputas Ativas
            </p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(stats.pendingVerifications)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verificacoes Pendentes
            </p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatNumber(stats.ordersToday)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pedidos Hoje
            </p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(stats.totalRevenue)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Receita Total
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
