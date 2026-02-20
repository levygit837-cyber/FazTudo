import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Loader,
  AlertCircle,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
} from "lucide-react";
import api from "../../services/api";
import { ServiceOrder, ServiceOrderStatus, CompanyMember } from "../../types";
import TeamBuilder from "../../components/company/TeamBuilder";

const statusLabel: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PENDING: { label: "Pendente", icon: <Clock className="h-4 w-4" />, color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30" },
  ACCEPTED: { label: "Aceito", icon: <CheckCircle className="h-4 w-4" />, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  IN_PROGRESS: { label: "Em Andamento", icon: <TrendingUp className="h-4 w-4" />, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  AWAITING_CLIENT_CONFIRMATION: { label: "Aguard. Cliente", icon: <Clock className="h-4 w-4" />, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  AWAITING_PROFESSIONAL_CONFIRMATION: { label: "Aguard. Profissional", icon: <Clock className="h-4 w-4" />, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  COMPLETED: { label: "Concluído", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  CANCELLED: { label: "Cancelado", icon: <XCircle className="h-4 w-4" />, color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  DISPUTED: { label: "Disputado", icon: <AlertCircle className="h-4 w-4" />, color: "text-red-600 bg-red-100 dark:bg-red-900/30" },
};

interface OrderWithTeam extends ServiceOrder {
  team?: { id: number; leaderId: number };
}

const CompanyOrders: React.FC = () => {
  const [orders, setOrders] = useState<OrderWithTeam[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamBuilderOrder, setTeamBuilderOrder] = useState<OrderWithTeam | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get("/company/orders"),
      api.get("/company/members"),
    ])
      .then(([ordersRes, membersRes]) => {
        // Backend returns { data: { orders: [...], pagination: {...} } }
        const ordersData = ordersRes.data.data;
        const ordersList = Array.isArray(ordersData)
          ? ordersData
          : (ordersData?.orders ?? []);
        setOrders(ordersList);
        setMembers(membersRes.data.data ?? []);
      })
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar pedidos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredOrders = statusFilter === "ALL"
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  const getStatusInfo = (status: string) => {
    return statusLabel[status] ?? { label: status, icon: null, color: "text-slate-600 bg-slate-100" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pedidos</h1>
          <p className="text-sm text-slate-500">{orders.length} pedido{orders.length !== 1 ? "s" : ""} no total</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {["ALL", ...Object.keys(statusLabel)].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {s === "ALL" ? "Todos" : (statusLabel[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const si = getStatusInfo(order.status as string);
            return (
              <div key={order.id} className="card p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {order.title}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>
                        {si.icon}
                        {si.label}
                      </span>
                    </div>
                    {order.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{order.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>R$ {order.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      {order.client && <span>Cliente: {order.client.name}</span>}
                      {order.scheduledDate && (
                        <span>Agendado: {new Date(order.scheduledDate).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                    {order.team && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                        <Users className="h-3.5 w-3.5" />
                        <span>Equipe designada</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <a
                      href={`/professional/services/${order.id}`}
                      className="btn btn-sm text-xs"
                    >
                      Ver Pedido
                    </a>
                    {!order.team &&
                      (order.status === ServiceOrderStatus.ACCEPTED ||
                        order.status === ServiceOrderStatus.IN_PROGRESS) && (
                        <button
                          onClick={() => setTeamBuilderOrder(order)}
                          className="btn btn-primary btn-sm text-xs flex items-center gap-1"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Designar Equipe
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Builder Modal */}
      {teamBuilderOrder && (
        <TeamBuilder
          orderId={teamBuilderOrder.id}
          members={members}
          onTeamCreated={() => {
            setTeamBuilderOrder(null);
            fetchData();
          }}
          onClose={() => setTeamBuilderOrder(null)}
        />
      )}
    </div>
  );
};

export default CompanyOrders;
