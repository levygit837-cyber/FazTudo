import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OrderCard } from "./OrderCard";
import { SkeletonOrderCard } from "../common/Skeleton";
import { EmptyState } from "../common/EmptyState";
import { SearchBar } from "../common/SearchBar";
import Tabs from "../common/Tabs";
import { listOrders } from "../../services/serviceService";
import { ServiceOrder, ServiceOrderStatus } from "../../types";

interface RoleConfig {
  role: "client" | "professional";
  title: string;
  subtitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  emptyActionPath: string;
  statusLabels: Record<string, string>;
}

const roleConfigs: Record<"client" | "professional", RoleConfig> = {
  client: {
    role: "client",
    title: "Meus Pedidos",
    subtitle: "Acompanhe todos os seus pedidos de servicos",
    emptyDescription: "Voce ainda nao fez nenhum pedido.",
    emptyActionLabel: "Buscar servicos",
    emptyActionPath: "/services",
    statusLabels: {
      [ServiceOrderStatus.PENDING]: "Pendentes",
      [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: "Aguardando Confirmacao",
    },
  },
  professional: {
    role: "professional",
    title: "Meus Servicos",
    subtitle: "Gerencie os pedidos de servicos que voce recebeu",
    emptyDescription: "Voce ainda nao recebeu pedidos.",
    emptyActionLabel: "Gerenciar catalogo",
    emptyActionPath: "/professional/catalog",
    statusLabels: {
      [ServiceOrderStatus.PENDING]: "Aguardando Resposta",
      [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: "Aguardando Cliente",
    },
  },
};

interface ServiceOrdersListProps {
  role: "client" | "professional";
}

const ServiceOrdersList: React.FC<ServiceOrdersListProps> = ({ role }) => {
  const navigate = useNavigate();
  const config = roleConfigs[role];

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const statusTabs = [
    { id: "all", label: "Todos" },
    { id: ServiceOrderStatus.PENDING, label: config.statusLabels[ServiceOrderStatus.PENDING] || "Pendentes" },
    { id: ServiceOrderStatus.ACCEPTED, label: "Aceitos" },
    { id: ServiceOrderStatus.IN_PROGRESS, label: "Em Andamento" },
    { id: ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION, label: config.statusLabels[ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION] || "Aguardando Confirmacao" },
    { id: ServiceOrderStatus.COMPLETED, label: "Concluidos" },
    { id: ServiceOrderStatus.CANCELLED, label: "Cancelados" },
  ];

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (role === "professional") params.role = "professional";
      if (activeTab !== "all") params.status = activeTab;

      const result = await listOrders(params);
      setOrders(result.items);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeTab, page]);

  const filteredOrders = search
    ? orders.filter((o) => o.title.toLowerCase().includes(search.toLowerCase()))
    : orders;

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{config.title}</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {config.subtitle}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="overflow-x-auto pb-2">
          <Tabs
            tabs={statusTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            variant="pill"
          />
        </div>
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar pedidos..."
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonOrderCard key={i} />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon="package"
          title="Nenhum pedido encontrado"
          description={activeTab !== "all" ? "Nenhum pedido com este status." : config.emptyDescription}
          action={{
            label: config.emptyActionLabel,
            onClick: () => navigate(config.emptyActionPath),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              id={order.id}
              title={order.title}
              status={order.status}
              price={order.price}
              scheduledDate={order.scheduledDate || undefined}
              deadlineDate={order.deadlineDate || undefined}
              createdAt={order.createdAt}
              {...(role === "professional"
                ? {
                    client: order.client
                      ? {
                          id: order.client.id,
                          name: order.client.name,
                          profileImage: order.client.profileImage || undefined,
                        }
                      : undefined,
                    isProfessionalView: true,
                  }
                : {
                    professional: order.professional
                      ? {
                          id: order.professional.id,
                          name: order.professional.name,
                          profileImage: order.professional.profileImage || undefined,
                        }
                      : undefined,
                  })}
            />
          ))}
        </div>
      )}

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn btn-outline btn-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="flex items-center px-4 text-sm text-slate-600 dark:text-slate-400">
            Pagina {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn btn-outline btn-sm disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceOrdersList;
