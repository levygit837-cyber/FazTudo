import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  DollarSign,
  Users,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  ClipboardCheck,
  Layers,
  CircleDot,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getDashboardStats } from "../services/adminService";

// ==================== Types ====================

type Period = "7d" | "30d" | "90d";

// Real backend shape from /admin/stats/dashboard
interface DashboardData {
  kpis: {
    completedOrders: { value: number; change: number };
    platformRevenue: { value: number; change: number };
    newUsers: { value: number; change: number };
    averageTicket: { value: number; change: number };
  };
  charts: {
    dailyUsers: Array<{ date: string; value: number }>;
    dailyRevenue: Array<{ date: string; value: number }>;
  };
  funnel: {
    totalUsers: number;
    usersWithOrders: number;
    usersWithCompletedOrders: number;
  };
  topCategories: Array<{ id: number; name: string; count: number }>;
  rates: {
    cancellationRate: number;
    disputeRate: number;
    avgMessagesPerDay: number;
  };
  quickStats?: {
    activeDisputes: number;
    pendingVerifications: number;
    ordersToday: number;
    totalRevenue: number;
  };
}

// ==================== Helpers ====================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateShort(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}`;
}

// ==================== Skeletons ====================

const KpiSkeleton: React.FC = () => (
  <div className="glass-card p-5 animate-pulse">
    <div className="flex items-start justify-between mb-5">
      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700/60" />
      <div className="w-14 h-5 rounded-full bg-slate-200 dark:bg-slate-700/60" />
    </div>
    <div className="h-8 w-28 bg-slate-200 dark:bg-slate-700/60 rounded mb-2" />
    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/60 rounded" />
  </div>
);

const ChartSkeleton: React.FC = () => (
  <div className="glass-card p-6 animate-pulse">
    <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700/60 rounded mb-1" />
    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700/60 rounded mb-6" />
    <div className="h-64 bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
  </div>
);

// ==================== KPI Card ====================

interface KpiCardProps {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  borderAccent: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  change,
  icon: Icon,
  iconColor,
  iconBg,
  borderAccent,
}) => (
  <div
    className={`glass-card p-5 relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-l-2 ${borderAccent}`}
  >
    {/* Subtle background glow */}
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      style={{
        background: `radial-gradient(circle at 0% 50%, ${iconColor}08 0%, transparent 60%)`,
      }}
    />
    <div className="relative">
      <div className="flex items-start justify-between mb-5">
        <div
          className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        <span
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            change >= 0
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
        {label}
      </p>
    </div>
  </div>
);

// ==================== Funnel Step ====================

interface FunnelStepProps {
  step: number;
  label: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
}

const FunnelStep: React.FC<FunnelStepProps> = ({
  step,
  label,
  value,
  pct,
  color,
  bg,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center shrink-0`}
        >
          <span className="text-xs font-bold" style={{ color }}>
            {step}
          </span>
        </div>
        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
          {formatNumber(value)}
        </span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bg}`}
          style={{ color }}
        >
          {pct}%
        </span>
      </div>
    </div>
    <div className="h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden ml-8">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

// ==================== Quick Stat ====================

interface QuickStatProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  alert?: boolean;
}

const QuickStat: React.FC<QuickStatProps> = ({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  alert,
}) => (
  <div className="glass-card p-4 flex items-center gap-3">
    <div
      className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
    >
      <Icon size={16} style={{ color: iconColor }} />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-bold text-slate-900 dark:text-white font-display tabular-nums leading-tight">
        {value}
        {alert && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />
        )}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {label}
      </p>
    </div>
  </div>
);

// ==================== Chart Tooltip ====================

const darkTooltip = {
  contentStyle: {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    color: "#f1f5f9",
    fontSize: "12px",
  },
};

// ==================== Main Component ====================

const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>("30d");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats(
        period === "7d" ? "7" : period === "30d" ? "30" : "90"
      );
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---- Derived ----
  const d = stats as DashboardData | null;

  const kpis = d
    ? [
        {
          label: "Pedidos Concluídos",
          value: formatNumber(d.kpis.completedOrders.value),
          change: d.kpis.completedOrders.change,
          icon: ShoppingCart,
          iconColor: "#6366f1",
          iconBg: "bg-indigo-500/10",
          borderAccent: "border-indigo-500",
        },
        {
          label: "Receita da Plataforma",
          value: formatCurrency(d.kpis.platformRevenue.value),
          change: d.kpis.platformRevenue.change,
          icon: DollarSign,
          iconColor: "#10b981",
          iconBg: "bg-emerald-500/10",
          borderAccent: "border-emerald-500",
        },
        {
          label: "Novos Usuários",
          value: formatNumber(d.kpis.newUsers.value),
          change: d.kpis.newUsers.change,
          icon: Users,
          iconColor: "#8b5cf6",
          iconBg: "bg-violet-500/10",
          borderAccent: "border-violet-500",
        },
        {
          label: "Ticket Médio",
          value: formatCurrency(d.kpis.averageTicket.value),
          change: d.kpis.averageTicket.change,
          icon: BarChart3,
          iconColor: "#f59e0b",
          iconBg: "bg-amber-500/10",
          borderAccent: "border-amber-500",
        },
      ]
    : [];

  const dailyUsersData =
    d?.charts?.dailyUsers?.map((p: { date: string; value: number }) => ({
      name: formatDateShort(p.date),
      usuarios: p.value,
    })) ?? [];

  const dailyRevenueData =
    d?.charts?.dailyRevenue?.map(
      (p: { date: string; value: number }) => ({
        name: formatDateShort(p.date),
        receita: p.value,
      })
    ) ?? [];

  const funnel = d?.funnel
    ? [
        {
          label: "Total de Usuários",
          value: d.funnel.totalUsers,
          pct: 100,
          color: "#6366f1",
          bg: "bg-indigo-500/10",
        },
        {
          label: "Com Pedidos",
          value: d.funnel.usersWithOrders,
          pct:
            d.funnel.totalUsers > 0
              ? Math.round(
                  (d.funnel.usersWithOrders / d.funnel.totalUsers) * 100
                )
              : 0,
          color: "#8b5cf6",
          bg: "bg-violet-500/10",
        },
        {
          label: "Pedidos Concluídos",
          value: d.funnel.usersWithCompletedOrders,
          pct:
            d.funnel.totalUsers > 0
              ? Math.round(
                  (d.funnel.usersWithCompletedOrders / d.funnel.totalUsers) *
                    100
                )
              : 0,
          color: "#10b981",
          bg: "bg-emerald-500/10",
        },
      ]
    : [];

  const topCategories: Array<{ id: number; name: string; count: number }> =
    d?.topCategories ?? [];
  const maxCatCount =
    topCategories.length > 0
      ? Math.max(...topCategories.map((c) => c.count ?? 1))
      : 1;

  // ---- Error ----
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error}</p>
        <button
          onClick={() => void fetchData()}
          className="btn bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
        >
          <RefreshCw size={15} />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Visão geral da plataforma FazTudo
          </p>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50 self-start sm:self-auto">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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

      {/* ---- KPIs ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {/* ---- Charts ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Daily Users */}
            <div className="glass-card p-6">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Novos Usuários por Período
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cadastros diários no intervalo selecionado
                </p>
              </div>
              {dailyUsersData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                  <Users size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Sem dados no período</p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyUsersData}>
                      <defs>
                        <linearGradient
                          id="usersGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#6366f1"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="100%"
                            stopColor="#6366f1"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        strokeOpacity={0.3}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        interval={
                          period === "7d" ? 0 : period === "30d" ? 4 : 9
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip
                        {...darkTooltip}
                        formatter={(v: number) => [
                          formatNumber(v),
                          "Usuários",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="usuarios"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#usersGrad)"
                        activeDot={{ r: 4, fill: "#6366f1" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Daily Revenue */}
            <div className="glass-card p-6">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Receita por Período
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Receita diária da plataforma (10% das ordens)
                </p>
              </div>
              {dailyRevenueData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                  <DollarSign size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">Sem dados no período</p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenueData}>
                      <defs>
                        <linearGradient
                          id="revGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10b981"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="100%"
                            stopColor="#10b981"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        strokeOpacity={0.3}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        interval={
                          period === "7d" ? 0 : period === "30d" ? 4 : 9
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) =>
                          `R$${(v / 1000).toFixed(0)}k`
                        }
                        width={40}
                      />
                      <Tooltip
                        {...darkTooltip}
                        formatter={(v: number) => [
                          formatCurrency(v),
                          "Receita",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#revGrad)"
                        activeDot={{ r: 4, fill: "#10b981" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- Funnel + Categories ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Funnel */}
            <div className="glass-card p-6">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Funil de Conversão
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Do cadastro até pedido concluído
                </p>
              </div>
              {funnel.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-slate-400">
                  <p className="text-sm">Sem dados disponíveis</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {funnel.map((step, i) => (
                    <FunnelStep key={step.label} step={i + 1} {...step} />
                  ))}
                </div>
              )}
            </div>

            {/* Top Categories */}
            <div className="glass-card p-6">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Top Categorias
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Por volume de pedidos no período
                </p>
              </div>
              {topCategories.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                  <Layers size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">Sem dados disponíveis</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {topCategories.slice(0, 6).map((cat, i) => {
                    const count = cat.count ?? 0;
                    const pct = Math.round((count / maxCatCount) * 100);
                    const colors = [
                      "#6366f1",
                      "#8b5cf6",
                      "#10b981",
                      "#f59e0b",
                      "#ef4444",
                      "#06b6d4",
                    ];
                    const color = colors[i % colors.length] ?? "#6366f1";
                    return (
                      <div key={cat.id ?? cat.name} className="group">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                            <CircleDot
                              size={12}
                              style={{ color }}
                              className="shrink-0"
                            />
                            <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                              {cat.name}
                            </span>
                          </div>
                          {count > 0 && (
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatNumber(count)}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: color,
                              opacity: 0.8,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- Platform Rates ---- */}
      {!loading && d?.rates && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Taxas da Plataforma
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Taxa de Cancelamento",
                value: `${d.rates.cancellationRate.toFixed(1)}%`,
                icon: AlertCircle,
                good: d.rates.cancellationRate < 10,
                iconColor:
                  d.rates.cancellationRate < 10 ? "#10b981" : "#ef4444",
                iconBg:
                  d.rates.cancellationRate < 10
                    ? "bg-emerald-500/10"
                    : "bg-red-500/10",
              },
              {
                label: "Taxa de Disputas",
                value: `${d.rates.disputeRate.toFixed(1)}%`,
                icon: ShieldAlert,
                good: d.rates.disputeRate < 5,
                iconColor: d.rates.disputeRate < 5 ? "#10b981" : "#f59e0b",
                iconBg:
                  d.rates.disputeRate < 5
                    ? "bg-emerald-500/10"
                    : "bg-amber-500/10",
              },
              {
                label: "Mensagens por Dia",
                value: d.rates.avgMessagesPerDay.toFixed(1),
                icon: ClipboardCheck,
                good: true,
                iconColor: "#6366f1",
                iconBg: "bg-indigo-500/10",
              },
            ].map((r) => {
              const RIcon = r.icon;
              return (
                <div
                  key={r.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40"
                >
                  <div
                    className={`w-9 h-9 rounded-lg ${r.iconBg} flex items-center justify-center shrink-0`}
                  >
                    <RIcon size={16} style={{ color: r.iconColor }} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-white font-display">
                      {r.value}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Quick Stats ---- */}
      {!loading && d?.quickStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickStat
            label="Disputas Ativas"
            value={formatNumber(d.quickStats.activeDisputes)}
            icon={ShieldAlert}
            iconColor="#ef4444"
            iconBg="bg-red-500/10"
            alert={d.quickStats.activeDisputes > 0}
          />
          <QuickStat
            label="Verificações Pendentes"
            value={formatNumber(d.quickStats.pendingVerifications)}
            icon={ClipboardCheck}
            iconColor="#f59e0b"
            iconBg="bg-amber-500/10"
            alert={d.quickStats.pendingVerifications > 0}
          />
          <QuickStat
            label="Pedidos Hoje"
            value={formatNumber(d.quickStats.ordersToday)}
            icon={ShoppingCart}
            iconColor="#6366f1"
            iconBg="bg-indigo-500/10"
          />
          <QuickStat
            label="Receita Total"
            value={formatCurrency(d.quickStats.totalRevenue)}
            icon={DollarSign}
            iconColor="#10b981"
            iconBg="bg-emerald-500/10"
          />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
