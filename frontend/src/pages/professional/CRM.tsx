import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  CalendarDays,
  DollarSign,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCard } from "../../components/dashboard/StatsCard";
import { OrderCard } from "../../components/orders/OrderCard";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  getProfessionalCrmStats,
  getRecentOrders,
  ProfessionalCrmStats,
} from "../../services/dashboardService";
import { ServiceOrder } from "../../types";
import { formatCurrency } from "../../utils/formatters";

const ProfessionalCRM: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfessionalCrmStats>({
    ordersToday: 0,
    ordersLast7Days: 0,
    pendingOrders: 0,
    monthlyRevenue: 0,
    feePercentage: 10,
  });
  const [pendingOrdersList, setPendingOrdersList] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [crmData, ordersData] = await Promise.all([
          getProfessionalCrmStats().catch(() => null),
          getRecentOrders(10).catch(() => []),
        ]);

        if (crmData) setStats(crmData);

        const pending = ordersData.filter(
          (o) => o.status === "PENDING" || o.status === "ACCEPTED"
        );
        setPendingOrdersList(pending);
      } catch (error) {
        console.error("Erro ao carregar CRM:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          CRM Profissional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Acompanhe seus pedidos e faturamento em tempo real.
        </p>
      </div>

      {/* Monthly Revenue Callout */}
      {stats.monthlyRevenue > 0 && (
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-200" />
            <div>
              <p className="text-sm text-emerald-100">Faturado este mes (liquido)</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              <p className="text-xs text-emerald-200 mt-1">
                Taxa da plataforma: {stats.feePercentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Pedidos Hoje"
          value={stats.ordersToday}
          icon={<CalendarCheck className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Ultimos 7 Dias"
          value={stats.ordersLast7Days}
          icon={<CalendarDays className="w-6 h-6" />}
          color="primary"
        />
        <StatsCard
          title="Faturado no Mes"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Pedidos Pendentes"
          value={stats.pendingOrders}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Pending Orders List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Pedidos Pendentes
          </h2>
          <Link
            to="/professional/services"
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {pendingOrdersList.length === 0 ? (
          <EmptyState
            icon="package"
            title="Nenhum pedido pendente"
            description="Todos os seus pedidos estao em dia!"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-grid">
            {pendingOrdersList.map((order) => (
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

export default ProfessionalCRM;
