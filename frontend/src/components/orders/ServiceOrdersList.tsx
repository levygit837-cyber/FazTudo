import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { OrderCard } from "./OrderCard";
import { SkeletonOrderCard } from "../common/Skeleton";
import { EmptyState } from "../common/EmptyState";
import { EmptyStateGuided } from "../common/EmptyStateGuided";
import { ShoppingBag, Briefcase } from "lucide-react";
import { SearchBar } from "../common/SearchBar";
import Tabs from "../common/Tabs";
import { listOrders, acceptOrder, cancelOrder } from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";
import { useSocket } from "../../hooks/useSocket";
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
      [ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: "Aguardando Profissional",
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
      [ServiceOrderStatus.PENDING]: "Novos",
      [ServiceOrderStatus.ACCEPTED]: "Aceitos",
      [ServiceOrderStatus.IN_PROGRESS]: "Em Andamento",
      [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: "Aguard. Cliente",
      [ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: "Aguard. Voce",
      [ServiceOrderStatus.COMPLETED]: "Concluidos",
      [ServiceOrderStatus.CANCELLED]: "Cancelados",
    },
  },
};

interface ServiceOrdersListProps {
  role: "client" | "professional";
}

const ServiceOrdersList: React.FC<ServiceOrdersListProps> = ({ role }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const config = roleConfigs[role];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [buttonLoading, setButtonLoading] = useState<number | null>(null);
  const isInitialLoad = useRef(true);

  // Socket.io: real-time status updates
  const handleStatusChanged = useCallback(
    (data: { orderId: number; status: string }) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === data.orderId ? { ...o, status: data.status as ServiceOrderStatus } : o,
        ),
      );
    },
    [],
  );
  useSocket("order:statusChanged", handleStatusChanged);

  const statusTabs = [
    { id: "all", label: "Todos" },
    { id: ServiceOrderStatus.PENDING, label: config.statusLabels[ServiceOrderStatus.PENDING] || "Pendentes" },
    { id: ServiceOrderStatus.ACCEPTED, label: config.statusLabels[ServiceOrderStatus.ACCEPTED] || "Aceitos" },
    { id: ServiceOrderStatus.IN_PROGRESS, label: config.statusLabels[ServiceOrderStatus.IN_PROGRESS] || "Em Andamento" },
    { id: ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION, label: config.statusLabels[ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION] || "Aguard. Cliente" },
    { id: ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION, label: config.statusLabels[ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION] || "Aguard. Profissional" },
    { id: ServiceOrderStatus.COMPLETED, label: config.statusLabels[ServiceOrderStatus.COMPLETED] || "Concluidos" },
    { id: ServiceOrderStatus.CANCELLED, label: config.statusLabels[ServiceOrderStatus.CANCELLED] || "Cancelados" },
  ];

  const loadOrders = async () => {
    try {
      if (isInitialLoad.current || orders.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
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
      setRefreshing(false);
      isInitialLoad.current = false;
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

  const handleAcceptOrder = async (orderId: number) => {
    try {
      setButtonLoading(orderId);
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: ServiceOrderStatus.ACCEPTED } : o)),
      );
      await acceptOrder(orderId);
      toast.success("Pedido aceito com sucesso!");
    } catch {
      toast.error("Erro ao aceitar pedido");
      loadOrders(); // Revert by reloading
    } finally {
      setButtonLoading(null);
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    try {
      setButtonLoading(orderId);
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: ServiceOrderStatus.CANCELLED } : o)),
      );
      await cancelOrder(orderId, "Recusado pelo profissional");
      toast.info("Pedido recusado");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Erro ao recusar pedido";
      toast.error(message);
      loadOrders(); // Revert by reloading
    } finally {
      setButtonLoading(null);
    }
  };

  return (
    <div className="space-y-4">
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
      {loading && orders.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonOrderCard key={i} />
          ))}
        </div>
      ) : filteredOrders.length === 0 && !refreshing ? (
        activeTab !== "all" ? (
          <EmptyState
            icon="package"
            title="Nenhum pedido encontrado"
            description="Nenhum pedido com este status."
            action={{
              label: config.emptyActionLabel,
              onClick: () => navigate(config.emptyActionPath),
            }}
          />
        ) : role === "client" ? (
          <EmptyStateGuided
            icon={ShoppingBag}
            title="Nenhum pedido ainda"
            description="Você ainda não fez nenhum pedido. Explore nossos serviços e encontre o profissional ideal para o que você precisa."
            actions={[
              { label: "Explorar serviços", to: "/services" },
              { label: "Como funciona?", to: "/#como-funciona", variant: "secondary" },
            ]}
            tip="Profissionais disponíveis 24h. Receba orçamentos em minutos!"
          />
        ) : (
          <EmptyStateGuided
            icon={Briefcase}
            title="Nenhum pedido recebido ainda"
            description="Quando clientes solicitarem seus serviços, os pedidos aparecerão aqui. Certifique-se de ter serviços publicados e um perfil completo."
            actions={[
              { label: "Criar serviço", to: "/professional/create-service" },
              { label: "Completar perfil", to: "/profile", variant: "secondary" },
            ]}
            tip="Perfis com foto e descrição completa recebem 3x mais pedidos!"
          />
        )
      ) : (
        <div className="relative">
          {refreshing && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden z-10">
              <div className="h-full bg-primary-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          )}
          <div className={`space-y-2.5 ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
            {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              id={order.id}
              title={order.title}
              description={order.description}
              status={order.status}
              price={order.price}
              scheduledDate={order.scheduledDate || undefined}
              deadlineDate={order.deadlineDate || undefined}
              createdAt={order.createdAt}
              address={order.address ? {
                neighborhood: order.address.neighborhood,
                city: order.address.city,
              } : undefined}
              {...(role === "professional"
                ? {
                    client: order.client
                      ? {
                          id: order.client.id,
                          name: order.client.name,
                          profileImage: order.client.profileImage || undefined,
                          ratingAverage: order.client.ratingAverage,
                        }
                      : undefined,
                    isProfessionalView: true,
                    onAccept: handleAcceptOrder,
                    onReject: handleRejectOrder,
                    loading: buttonLoading === order.id,
                  }
                : {
                    professional: order.professional
                      ? {
                          id: order.professional.id,
                          name: order.professional.name,
                          profileImage: order.professional.profileImage || undefined,
                          ratingAverage: order.professional.ratingAverage,
                        }
                      : undefined,
                  })}
            />
          ))}
          </div>
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
