import React, { useState, useEffect } from "react";
import {
  TrendingUp, Users, Package, Star, CheckCircle,
  DollarSign, Activity, Filter, BarChart2, Smile,
} from "lucide-react";
import api from "../../services/api";
import {
  AnalyticsOverview, RevenueDataPoint, MemberPerformance, TopService,
  ConversionFunnel, TeamOccupancyEntry, NPSData,
} from "../../types";
import { formatCurrency, formatRating } from "../../utils/formatters";
import RevenueChart from "../../components/company/RevenueChart";
import MemberPerformanceTable from "../../components/company/MemberPerformanceTable";

const CompanyAnalytics: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [members, setMembers] = useState<MemberPerformance[]>([]);
  const [services, setServices] = useState<TopService[]>([]);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [occupancy, setOccupancy] = useState<TeamOccupancyEntry[]>([]);
  const [nps, setNps] = useState<NPSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [
          overviewRes, revenueRes, membersRes, servicesRes,
          funnelRes, occupancyRes, npsRes,
        ] = await Promise.all([
          api.get("/company/analytics/overview"),
          api.get("/company/analytics/revenue"),
          api.get("/company/analytics/members"),
          api.get("/company/analytics/services"),
          api.get("/company/analytics/conversion-funnel"),
          api.get("/company/analytics/team-occupancy"),
          api.get("/company/analytics/nps"),
        ]);
        setOverview(overviewRes.data.data);
        setRevenue(revenueRes.data.data);
        setMembers(membersRes.data.data);
        setServices(servicesRes.data.data);
        setFunnel(funnelRes.data.data);
        setOccupancy(occupancyRes.data.data ?? []);
        setNps(npsRes.data.data);
      } catch {
        setError("Erro ao carregar analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="card h-24 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />)}
      </div>
      <div className="card h-64 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl mb-6" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-12 text-center text-slate-500">{error}</div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Analytics</h1>

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pedidos (30d)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{overview.ordersLast30Days}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Taxa de Conclusão</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{overview.completionRate}%</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Receita (30d)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(overview.revenueLast30Days)}</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Avaliação Média</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatRating(overview.averageRating)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Receita Mensal (6 meses)
        </h2>
        <RevenueChart data={revenue} />
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Users className="h-5 w-5 text-blue-600" />
          Performance da Equipe
        </h2>
        <MemberPerformanceTable members={members} />
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Package className="h-5 w-5 text-blue-600" />
          Top Serviços
        </h2>
        {services.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum serviço com pedidos ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500 font-medium">Serviço</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Pedidos</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Concluídos</th>
                  <th className="text-right py-2 text-slate-500 font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {services.map(service => (
                  <tr key={service.id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <td className="py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{service.title}</p>
                      <p className="text-xs text-slate-500">{service.category}</p>
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{service.totalOrders}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">{service.completedOrders}</td>
                    <td className="py-3 text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(service.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Insights Section ─────────────────────────────────────────── */}
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 mt-2">
        Insights
      </h2>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">

        {/* 1. Conversion Funnel */}
        <div className="card p-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Filter className="h-4 w-4 text-blue-600" />
            Funil de Conversão
          </h3>
          {funnel ? (() => {
            const max = funnel.received || 1;
            const stages: { label: string; value: number }[] = [
              { label: "Recebidos",    value: funnel.received },
              { label: "Aceitos",      value: funnel.accepted },
              { label: "Em andamento", value: funnel.inProgress },
              { label: "Concluídos",   value: funnel.completed },
            ];
            return (
              <div className="space-y-3">
                {stages.map(({ label, value }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400">{label}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.round((value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })() : (
            <p className="text-slate-500 text-sm">Sem dados de funil.</p>
          )}
        </div>

        {/* 2. Team Occupancy */}
        <div className="card p-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <BarChart2 className="h-4 w-4 text-blue-600" />
            Ocupação da Equipe
          </h3>
          {occupancy.length === 0 ? (
            <p className="text-slate-500 text-sm">Nenhum membro com pedidos ativos.</p>
          ) : (() => {
            const maxOrders = Math.max(...occupancy.map(e => e.activeOrders), 1);
            return (
              <div className="space-y-3">
                {occupancy.map(entry => (
                  <div key={entry.memberId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                        {entry.memberName}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap ml-2">
                        {entry.activeOrders} {entry.activeOrders === 1 ? "pedido" : "pedidos"}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.round((entry.activeOrders / maxOrders) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* 3. NPS Score */}
        <div className="card p-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Smile className="h-4 w-4 text-blue-600" />
            NPS (Net Promoter Score)
          </h3>
          {nps && nps.total > 0 ? (
            <div className="flex flex-col items-center">
              <span
                className={[
                  "text-6xl font-extrabold leading-none mb-4",
                  nps.nps > 50
                    ? "text-green-500"
                    : nps.nps >= 0
                    ? "text-amber-500"
                    : "text-red-500",
                ].join(" ")}
              >
                {nps.nps > 0 ? `+${nps.nps}` : nps.nps}
              </span>
              <div className="w-full grid grid-cols-3 gap-2 text-center text-sm mt-2">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                  <p className="text-xs text-slate-500 mb-0.5">Promotores</p>
                  <p className="font-bold text-green-600 dark:text-green-400">{nps.promoters}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                  <p className="text-xs text-slate-500 mb-0.5">Passivos</p>
                  <p className="font-bold text-amber-600 dark:text-amber-400">{nps.passives}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                  <p className="text-xs text-slate-500 mb-0.5">Detratores</p>
                  <p className="font-bold text-red-600 dark:text-red-400">{nps.detractors}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500 text-sm">
              <Smile className="h-8 w-8 mb-2 opacity-40" />
              Sem avaliações suficientes
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CompanyAnalytics;
