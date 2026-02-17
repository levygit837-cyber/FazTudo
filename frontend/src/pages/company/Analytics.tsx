import React, { useState, useEffect } from "react";
import {
  TrendingUp, Users, Package, Star, CheckCircle,
  DollarSign, Activity,
} from "lucide-react";
import api from "../../services/api";
import {
  AnalyticsOverview, RevenueDataPoint, MemberPerformance, TopService,
} from "../../types";
import { formatCurrency, formatRating } from "../../utils/formatters";
import RevenueChart from "../../components/company/RevenueChart";
import MemberPerformanceTable from "../../components/company/MemberPerformanceTable";

const CompanyAnalytics: React.FC = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [members, setMembers] = useState<MemberPerformance[]>([]);
  const [services, setServices] = useState<TopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [overviewRes, revenueRes, membersRes, servicesRes] = await Promise.all([
          api.get("/company/analytics/overview"),
          api.get("/company/analytics/revenue"),
          api.get("/company/analytics/members"),
          api.get("/company/analytics/services"),
        ]);
        setOverview(overviewRes.data.data);
        setRevenue(revenueRes.data.data);
        setMembers(membersRes.data.data);
        setServices(servicesRes.data.data);
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

      <div className="card p-6">
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
    </div>
  );
};

export default CompanyAnalytics;
