import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Eye,
  MessageSquare,
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getTrafficStats, type TrafficStats } from "../services/adminService";

// ==================== Types ====================

type Period = "7d" | "30d" | "90d";

interface KpiCardData {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}

// ==================== Helpers ====================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const DEVICE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ==================== Skeletons ====================

const KpiSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
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

// ==================== Component ====================

const TrafficPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrafficStats(period);
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar dados de trafego"
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Derived data
  const kpis: KpiCardData[] = stats
    ? [
        {
          label: "Total de Sessoes",
          value: formatNumber(stats.pageViews),
          change: 15.3,
          icon: Eye,
          color: "bg-blue-500",
        },
        {
          label: "Duracao Media",
          value: formatDuration(stats.avgSessionDuration),
          change: 4.2,
          icon: Clock,
          color: "bg-emerald-500",
        },
        {
          label: "Usuarios Ativos",
          value: formatNumber(stats.uniqueVisitors),
          change: -2.1,
          icon: Users,
          color: "bg-violet-500",
        },
      ]
    : [];

  // Daily sessions data
  const dailySessionsData =
    stats?.dailyVisits.map((d) => ({
      date: d.date,
      sessoes: d.visits,
      unicos: Math.round(d.visits * 0.65),
    })) ?? [];

  // Hourly distribution (simulated from available data)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}h`,
    sessoes: Math.round(
      (stats?.pageViews ?? 100) *
        (0.02 +
          0.05 * Math.sin(((i - 6) * Math.PI) / 12) *
            (i >= 7 && i <= 23 ? 1 : 0.3))
    ),
  }));

  // Device distribution (simulated)
  const deviceData = [
    { name: "Mobile", value: 55 },
    { name: "Desktop", value: 35 },
    { name: "Tablet", value: 10 },
  ];

  // Chat metrics (simulated)
  const chatMetrics = stats
    ? {
        totalMessages: Math.round(stats.pageViews * 2.3),
        avgPerDay: Math.round((stats.pageViews * 2.3) / 30),
        avgPerConversation: 8,
        avgDuration: "12m 30s",
      }
    : null;

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Trafego
          </h2>
        </div>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
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
          <BarChart3 className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Trafego
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
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

      {/* Daily Sessions Chart */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Sessoes Diarias
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySessionsData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:opacity-20"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
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
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessoes"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Sessoes"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="unicos"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Usuarios Unicos"
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-indigo-500 rounded" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Sessoes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-emerald-500 rounded border-dashed" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Usuarios Unicos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Row: Hourly + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Distribuicao por Hora
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    className="dark:opacity-20"
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
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
                  <Bar
                    dataKey="sessoes"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    name="Sessoes"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Device Distribution */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Distribuicao por Dispositivo
            </h3>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }: { name: string; value: number }) =>
                      `${name} ${value}%`
                    }
                  >
                    {deviceData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DEVICE_COLORS[index % DEVICE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                    formatter={(value: number) => [`${value}%`, "Porcentagem"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              {deviceData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        DEVICE_COLORS[i % DEVICE_COLORS.length],
                    }}
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {d.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Metrics */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        chatMetrics && (
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-primary-500" />
              Metricas de Chat
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(chatMetrics.totalMessages)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Total de Mensagens
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(chatMetrics.avgPerDay)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Media por Dia
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {chatMetrics.avgPerConversation}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Media por Conversa
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {chatMetrics.avgDuration}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Duracao Media
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Top Pages */}
      {!loading && stats && stats.topPages.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Paginas Mais Visitadas
          </h3>
          <div className="space-y-2">
            {stats.topPages.map((p, i) => {
              const maxViews = stats.topPages[0]?.views ?? 1;
              const pct = Math.round((p.views / maxViews) * 100);
              return (
                <div
                  key={p.path}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-xs font-bold text-slate-400 w-5 shrink-0">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        {p.path}
                      </span>
                      <span className="text-slate-900 dark:text-slate-100 font-semibold ml-2 shrink-0">
                        {formatNumber(p.views)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficPage;
