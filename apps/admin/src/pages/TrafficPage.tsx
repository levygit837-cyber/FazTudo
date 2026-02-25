import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Monitor,
  UserCheck,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Smartphone,
  Tablet,
  AlertCircle,
  RefreshCw,
  ChevronRight,
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
type MetricSection = "sessions" | "devices" | "retention" | "chat";

interface SidebarItem {
  id: MetricSection;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  accentBg: string;
  accentText: string;
}

// ==================== Constants ====================

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: "sessions",
    label: "Sessões",
    sublabel: "Volume e frequência",
    icon: Activity,
    color: "#6366f1",
    accentBg: "bg-indigo-500/10",
    accentText: "text-indigo-400",
  },
  {
    id: "devices",
    label: "Dispositivos",
    sublabel: "Mobile, desktop, tablet",
    icon: Monitor,
    color: "#10b981",
    accentBg: "bg-emerald-500/10",
    accentText: "text-emerald-400",
  },
  {
    id: "retention",
    label: "Retenção",
    sublabel: "Coortes semanais",
    icon: UserCheck,
    color: "#f59e0b",
    accentBg: "bg-amber-500/10",
    accentText: "text-amber-400",
  },
  {
    id: "chat",
    label: "Chat",
    sublabel: "Mensagens e conversas",
    icon: MessageSquare,
    color: "#8b5cf6",
    accentBg: "bg-violet-500/10",
    accentText: "text-violet-400",
  },
];

const DEVICE_COLORS: Record<string, string> = {
  mobile: "#6366f1",
  desktop: "#10b981",
  tablet: "#f59e0b",
  unknown: "#64748b",
};

const DEVICE_ICON: Record<string, React.ElementType> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
  unknown: Monitor,
};

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
  const parts = dateStr.split("-");
  return `${parts[2]}/${parts[1]}`;
}

// ==================== Skeleton ====================

const ChartSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700/60 rounded" />
    <div className="h-72 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
  </div>
);

const StatSkeleton: React.FC = () => (
  <div className="animate-pulse glass-card p-5">
    <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700/60 rounded mb-3" />
    <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700/60 rounded mb-2" />
    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700/60 rounded" />
  </div>
);

// ==================== KPI Card ====================

interface KpiProps {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const KpiCard: React.FC<KpiProps> = ({
  label,
  value,
  change,
  icon: Icon,
  iconColor,
  iconBg,
}) => (
  <div className="glass-card p-5 group hover:border-white/20 transition-all duration-300">
    <div className="flex items-start justify-between mb-4">
      <div
        className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
      >
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <div
        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
          change >= 0
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}
      >
        {change >= 0 ? (
          <TrendingUp size={11} />
        ) : (
          <TrendingDown size={11} />
        )}
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}%
      </div>
    </div>
    <p className="text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
      {value}
    </p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
  </div>
);

// ==================== Section: Sessions ====================

const SessionsSection: React.FC<{
  stats: TrafficStats;
  period: Period;
}> = ({ stats, period }) => {
  const dailyData = stats.charts.dailySessions.map((d) => ({
    date: formatDateShort(d.date),
    sessoes: d.sessions,
    unicos: d.uniqueUsers,
  }));

  const tickInterval =
    period === "7d" ? 0 : period === "30d" ? 4 : 9;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total de Sessões"
          value={formatNumber(stats.kpis.totalSessions.value)}
          change={stats.kpis.totalSessions.change}
          icon={Activity}
          iconColor="#6366f1"
          iconBg="bg-indigo-500/10"
        />
        <KpiCard
          label="Duração Média"
          value={formatDuration(stats.kpis.avgDuration.value)}
          change={stats.kpis.avgDuration.change}
          icon={Clock}
          iconColor="#10b981"
          iconBg="bg-emerald-500/10"
        />
        <KpiCard
          label="Usuários Ativos"
          value={formatNumber(stats.kpis.activeUsers.value)}
          change={stats.kpis.activeUsers.change}
          icon={Users}
          iconColor="#8b5cf6"
          iconBg="bg-violet-500/10"
        />
      </div>

      {/* Daily sessions chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Sessões Diárias
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sessões totais vs. usuários únicos
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />
              Sessões
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 bg-emerald-500 inline-block rounded"
                style={{ borderTop: "2px dashed #10b981" }}
              />
              Únicos
            </span>
          </div>
        </div>
        {dailyData.length === 0 || dailyData.every((d) => d.sessoes === 0) ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Activity size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhuma sessão no período</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <defs>
                  <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  strokeOpacity={0.4}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "10px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessoes"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                  name="Sessões"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="unicos"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 4"
                  activeDot={{ r: 4, fill: "#10b981" }}
                  name="Únicos"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Hourly heatmap-style bar chart */}
      <div className="glass-card p-6">
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Distribuição por Hora do Dia
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pico de acesso ao longo das 24 horas
          </p>
        </div>
        {stats.charts.hourlyDistribution.every((v) => v === 0) ? (
          <div className="h-52 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Clock size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sem dados de hora no período</p>
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.charts.hourlyDistribution.map((count, i) => ({
                  hour: `${String(i).padStart(2, "0")}h`,
                  sessoes: count,
                }))}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: "10px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="sessoes"
                  name="Sessões"
                  radius={[3, 3, 0, 0]}
                  fill="#6366f1"
                  fillOpacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Section: Devices ====================

const DevicesSection: React.FC<{ stats: TrafficStats }> = ({ stats }) => {
  const deviceData = stats.charts.deviceDistribution.map((d) => ({
    name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: d.count,
    key: d.device.toLowerCase(),
  }));

  const total = deviceData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {deviceData.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center text-center">
          <Monitor size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Sem dados de dispositivo no período
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Os dados aparecem conforme sessões são registradas
          </p>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-6">
              Distribuição por Dispositivo
            </h3>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-64 h-64 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {deviceData.map((d, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            DEVICE_COLORS[d.key] ?? "#64748b"
                          }
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "10px",
                        color: "#f1f5f9",
                        fontSize: "12px",
                      }}
                      formatter={(value: number | undefined, name: string | undefined) => [
                        `${formatNumber(value ?? 0)} sessões`,
                        name ?? "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Device breakdown */}
              <div className="flex-1 space-y-3 w-full">
                {deviceData.map((d) => {
                  const Icon = DEVICE_ICON[d.key] ?? Monitor;
                  const pct =
                    total > 0 ? Math.round((d.value / total) * 100) : 0;
                  const color = DEVICE_COLORS[d.key] ?? "#64748b";
                  return (
                    <div key={d.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${color}18` }}
                          >
                            <Icon size={14} style={{ color }} />
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {d.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatNumber(d.value)}
                          </span>
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Total sessions badge */}
          <div className="glass-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total de sessões rastreadas
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-display mt-1">
                {formatNumber(total)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Activity size={20} className="text-slate-400" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==================== Section: Retention ====================

const RetentionSection: React.FC<{ stats: TrafficStats }> = ({ stats }) => {
  const retention = stats.retention ?? [];
  return (
  <div className="space-y-6 animate-fade-in">
    <div className="glass-card p-6">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Retenção por Coorte Semanal
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          % de usuários que retornaram em D1, D7, D14 e D30 após cadastro
        </p>
      </div>

      {retention.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <UserCheck size={28} className="text-amber-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Dados de retenção insuficientes
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Necessário ao menos 30 dias de dados de sessão para calcular
            coortes
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 pr-6 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Coorte
                </th>
                {["D1", "D7", "D14", "D30"].map((d) => (
                  <th
                    key={d}
                    className="text-center py-2 px-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {retention.map((row) => (
                <tr
                  key={row.cohort}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 pr-6 font-medium text-slate-700 dark:text-slate-200">
                    {row.cohort}
                  </td>
                  {([row.d1, row.d7, row.d14, row.d30] as number[]).map(
                    (pct, i) => {
                      const color =
                        pct >= 60
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : pct >= 30
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          : "bg-red-500/15 text-red-400 border border-red-500/20";
                      return (
                        <td key={i} className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums ${color}`}
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

    {/* Legend */}
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30 inline-block" />
        <span className="text-slate-500 dark:text-slate-400">≥ 60% — Excelente</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30 inline-block" />
        <span className="text-slate-500 dark:text-slate-400">30–59% — Médio</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30 inline-block" />
        <span className="text-slate-500 dark:text-slate-400">{"< 30% — Baixo"}</span>
      </span>
    </div>
  </div>
  );
};

// ==================== Section: Chat ====================

const ChatSection: React.FC<{ stats: TrafficStats }> = ({ stats }) => {
  const { chat } = stats;

  const metrics = [
    {
      label: "Total de Mensagens",
      value: formatNumber(chat.totalMessages),
      icon: MessageSquare,
      color: "#8b5cf6",
      bg: "bg-violet-500/10",
    },
    {
      label: "Média por Dia",
      value: chat.avgMessagesPerDay.toFixed(1),
      icon: Activity,
      color: "#6366f1",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Média por Conversa",
      value: chat.avgMessagesPerConversation.toFixed(1),
      icon: Users,
      color: "#10b981",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Duração Média",
      value: formatDuration(chat.avgChatDurationSeconds),
      icon: Clock,
      color: "#f59e0b",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="glass-card p-5">
              <div
                className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center mb-4`}
              >
                <Icon size={18} style={{ color: m.color }} />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-display">
                {m.value}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {m.label}
              </p>
            </div>
          );
        })}
      </div>

      {chat.totalMessages === 0 && (
        <div className="glass-card p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <MessageSquare size={24} className="text-violet-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Nenhuma mensagem registrada no período
          </p>
        </div>
      )}
    </div>
  );
};

// ==================== Main Component ====================

const TrafficPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>("30d");
  const [activeSection, setActiveSection] =
    useState<MetricSection>("sessions");
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
        err instanceof Error ? err.message : "Erro ao carregar dados de tráfego"
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeItem = SIDEBAR_ITEMS.find((i) => i.id === activeSection)!;

  // ---- Error ----
  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
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
    <div className="space-y-5">
      {/* ---- Page header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display tracking-tight">
            Tráfego
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Análise de sessões, dispositivos, retenção e chat
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
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

      {/* ---- Layout: sidebar + content ---- */}
      <div className="flex gap-5 items-start">
        {/* Metric sidebar */}
        <aside className="w-52 shrink-0 sticky top-4 space-y-1.5">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition-all duration-200 group border ${
                  isActive
                    ? `${item.accentBg} border-transparent`
                    : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? item.accentBg
                      : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                  }`}
                >
                  <Icon
                    size={16}
                    style={{ color: isActive ? item.color : undefined }}
                    className={
                      !isActive ? "text-slate-400 dark:text-slate-500" : ""
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold truncate ${
                      isActive
                        ? item.accentText
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {item.sublabel}
                  </p>
                </div>
                {isActive && (
                  <ChevronRight size={14} style={{ color: item.color }} />
                )}
              </button>
            );
          })}

          {/* Current section label */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50">
            <p className="text-xs text-slate-400 dark:text-slate-500 px-3">
              Visualizando
            </p>
            <p
              className={`text-sm font-semibold px-3 mt-0.5 ${activeItem.accentText}`}
            >
              {activeItem.label}
            </p>
          </div>
        </aside>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <StatSkeleton key={i} />
                ))}
              </div>
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : stats ? (
            <>
              {activeSection === "sessions" && (
                <SessionsSection stats={stats} period={period} />
              )}
              {activeSection === "devices" && (
                <DevicesSection stats={stats} />
              )}
              {activeSection === "retention" && (
                <RetentionSection stats={stats} />
              )}
              {activeSection === "chat" && <ChatSection stats={stats} />}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TrafficPage;
