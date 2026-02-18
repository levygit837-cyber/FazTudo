import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Activity,
  MessageSquare,
  Monitor,
  Smartphone,
  Tablet,
  AlertCircle,
  RefreshCw,
  UserCheck,
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
  Legend,
} from "recharts";
import { getTrafficStats, type TrafficStats } from "../services/adminService";

// ==================== Types ====================

type Period = "7d" | "30d" | "90d";

// ==================== Helpers ====================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

const DEVICE_COLORS: Record<string, string> = {
  mobile: "#6366f1",
  desktop: "#10b981",
  tablet: "#f59e0b",
  unknown: "#94a3b8",
};

const DEVICE_ICON: Record<string, React.ElementType> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
};

// ==================== Skeletons ====================

const KpiSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
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
      const days = period === "7d" ? "7" : period === "30d" ? "30" : "90";
      const data = await getTrafficStats(days);
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

  // ==================== Derived data ====================

  // Hourly distribution — convert 24-element array to chart data
  const hourlyData =
    stats?.charts.hourlyDistribution.map((count, i) => ({
      hour: `${String(i).padStart(2, "0")}h`,
      sessoes: count,
    })) ?? [];

  // Device distribution — from real backend data
  const deviceData =
    stats?.charts.deviceDistribution.map((d) => ({
      name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
      value: d.count,
      key: d.device.toLowerCase(),
    })) ?? [];

  // Daily sessions — from real backend data, with formatted dates
  const dailySessionsData =
    stats?.charts.dailySessions.map((d) => ({
      date: formatDateShort(d.date),
      sessoes: d.sessions,
      unicos: d.uniqueUsers,
    })) ?? [];

  // Chat duration formatted
  const chatDuration = stats
    ? formatDuration(stats.chat.avgChatDurationSeconds)
    : "—";

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

      {/* KPI Cards — dados reais do backend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : stats ? (
          [
            {
              label: "Total de Sessoes",
              value: formatNumber(stats.kpis.totalSessions.value),
              change: stats.kpis.totalSessions.change,
              icon: Activity,
              color: "bg-blue-500",
            },
            {
              label: "Duracao Media",
              value: formatDuration(stats.kpis.avgDuration.value),
              change: stats.kpis.avgDuration.change,
              icon: Clock,
              color: "bg-emerald-500",
            },
            {
              label: "Usuarios Ativos",
              value: formatNumber(stats.kpis.activeUsers.value),
              change: stats.kpis.activeUsers.change,
              icon: Users,
              color: "bg-violet-500",
            },
          ].map((kpi) => (
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
                      {kpi.change.toFixed(1)}% vs periodo anterior
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
          ))
        ) : null}
      </div>

      {/* Daily Sessions Chart — sessoes reais + usuarios unicos */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <div className="card">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Sessoes Diarias
          </h3>
          {dailySessionsData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <p className="text-sm">Nenhuma sessao registrada no periodo</p>
            </div>
          ) : (
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
                    interval={period === "7d" ? 0 : period === "30d" ? 4 : 9}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
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
          )}
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-indigo-500 rounded" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Sessoes totais
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-0.5 bg-emerald-500 rounded"
                style={{ borderTop: "2px dashed #10b981" }}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Usuarios unicos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Row: Hourly + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution — dados reais da API */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Distribuicao por Hora do Dia
            </h3>
            {hourlyData.every((h) => h.sessoes === 0) ? (
              <div className="h-64 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <p className="text-sm">Sem dados de hora no periodo</p>
              </div>
            ) : (
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
                      allowDecimals={false}
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
            )}
          </div>
        )}

        {/* Device Distribution — dados reais da API */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Distribuicao por Dispositivo
            </h3>
            {deviceData.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Monitor
                    size={40}
                    className="text-slate-300 dark:text-slate-600 mx-auto mb-2"
                  />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Sem dados de dispositivo no periodo
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {deviceData.map((d, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              DEVICE_COLORS[d.key] ??
                              DEVICE_COLORS[
                                Object.keys(DEVICE_COLORS)[
                                  index % Object.keys(DEVICE_COLORS).length
                                ] as string
                              ] ??
                              "#94a3b8"
                            }
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
                        formatter={(value: number, name: string) => [
                          formatNumber(value),
                          name,
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {deviceData.map((d) => {
                    const Icon = DEVICE_ICON[d.key] ?? Monitor;
                    const total = deviceData.reduce(
                      (s, x) => s + x.value,
                      0
                    );
                    const pct =
                      total > 0
                        ? Math.round((d.value / total) * 100)
                        : 0;
                    return (
                      <div
                        key={d.key}
                        className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <Icon
                          size={16}
                          className="mx-auto mb-1 text-slate-400"
                        />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {d.name}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {pct}%
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatNumber(d.value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chat Metrics — dados reais da API */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        stats && (
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-primary-500" />
              Metricas de Chat
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {formatNumber(stats.chat.totalMessages)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Total de Mensagens
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.chat.avgMessagesPerDay.toFixed(1)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Media por Dia
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.chat.avgMessagesPerConversation.toFixed(1)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Media por Conversa
                </p>
              </div>
              <div className="card text-center py-4">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {chatDuration}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Duracao Media
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Retention — tabela de cohorte */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        stats && (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <UserCheck size={18} className="text-primary-500" />
              Retencao de Usuarios (por coorte semanal)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              % de usuarios que retornaram apos D1, D7, D14 e D30 do cadastro
            </p>

            {stats.retention.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <UserCheck size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Dados de retencao insuficientes no periodo.
                </p>
                <p className="text-xs mt-1">
                  Necessario pelo menos 30 dias de dados de sessao.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left py-2 pr-4 text-slate-500 dark:text-slate-400 font-medium">
                        Coorte
                      </th>
                      {["D1", "D7", "D14", "D30"].map((d) => (
                        <th
                          key={d}
                          className="text-center py-2 px-4 text-slate-500 dark:text-slate-400 font-medium"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.retention.map((row) => (
                      <tr
                        key={row.cohort}
                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-2 pr-4 font-medium text-slate-700 dark:text-slate-300">
                          {row.cohort}
                        </td>
                        {([row.d1, row.d7, row.d14, row.d30] as number[]).map(
                          (pct, i) => {
                            const bg =
                              pct >= 60
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : pct >= 30
                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
                            return (
                              <td key={i} className="py-2 px-4 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${bg}`}
                                >
                                  {pct}%
                                </span>
                              </td>
                            );
                          }
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default TrafficPage;
