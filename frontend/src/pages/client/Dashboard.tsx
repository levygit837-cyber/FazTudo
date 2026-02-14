import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  Search,
  Bell,
  ArrowRight,
  Calendar,
  DollarSign,
  Lightbulb,
  Sun,
  Sunrise,
  Moon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { StatsCard } from "../../components/dashboard/StatsCard";
import { OrderCard } from "../../components/orders/OrderCard";
import { ServiceCard } from "../../components/services/ServiceCard";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  getDashboardStats,
  getRecentOrders,
  ClientDashboardStats,
} from "../../services/dashboardService";
import {
  getRecommendations,
  RecommendedService,
} from "../../services/recommendationService";
import {
  getMainCategories,
  CategoryWithCounts,
} from "../../services/categoryService";
import { ServiceOrder } from "../../types";
import { formatCurrency } from "../../utils/formatters";

/* ── Helpers ───────────────────────────────────────────── */

const TIPS = [
  { text: "Sempre verifique as avaliacoes do profissional antes de contratar um servico. Isso ajuda a garantir a qualidade!", cta: "Explorar servicos", to: "/services" },
  { text: "Voce sabia que pode acompanhar o status dos seus pedidos em tempo real? Fique por dentro de cada etapa!", cta: "Ver pedidos", to: "/client/orders" },
  { text: "Deixe uma avaliacao apos cada servico. Isso ajuda outros clientes e motiva os profissionais!", cta: "Meus pedidos", to: "/client/orders" },
  { text: "Configure suas notificacoes para nao perder nenhuma atualizacao importante sobre seus servicos.", cta: "Configuracoes", to: "/profile/settings" },
  { text: "Compare precos e descricoes antes de contratar. Cada profissional tem um diferencial unico!", cta: "Buscar servicos", to: "/services" },
];

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)
    return { text: "Bom dia", icon: <Sunrise className="w-6 h-6 text-amber-500" /> };
  if (hour >= 12 && hour < 18)
    return { text: "Boa tarde", icon: <Sun className="w-6 h-6 text-orange-500" /> };
  return { text: "Boa noite", icon: <Moon className="w-6 h-6 text-indigo-400" /> };
}

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedService[]>(
    [],
  );
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [stats, setStats] = useState<ClientDashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inProgressOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalSpent: 0,
    averageRating: 0,
    totalReviews: 0,
  });

  const greeting = useMemo(() => getGreeting(), []);
  const currentTip = TIPS[tipIndex];

  // Auto-rotate tips every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [statsData, ordersData, recsData, catsData] = await Promise.all([
          getDashboardStats().catch(() => null),
          getRecentOrders(5).catch(() => []),
          getRecommendations(6).catch(() => ({
            recommendations: [],
            total: 0,
          })),
          getMainCategories(undefined, 8).catch(() => ({ categories: [] })),
        ]);

        if (statsData) setStats(statsData as ClientDashboardStats);
        setOrders(ordersData);
        setRecommendations(recsData.recommendations);
        setCategories(catsData.categories);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        {greeting.icon}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {greeting.text}, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Bem-vindo ao seu painel. Aqui voce pode gerenciar seus servicos.
          </p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Total de Pedidos"
          value={stats.totalOrders}
          icon={<ShoppingBag className="w-6 h-6" />}
          color="primary"
        />
        <StatsCard
          title="Em Andamento"
          value={stats.pendingOrders + stats.inProgressOrders}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatsCard
          title="Concluidos"
          value={stats.completedOrders}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Total Gasto"
          value={formatCurrency(stats.totalSpent)}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
        />
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-grid">
        <Link
          to="/services"
          className="card card-hover flex items-center gap-4 p-6"
        >
          <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <Search className="w-6 h-6 text-primary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              Buscar Servicos
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
              Encontre profissionais qualificados
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link
          to="/client/orders"
          className="card card-hover flex items-center gap-4 p-6"
        >
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              Meus Pedidos
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Acompanhe seus servicos</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>

        <Link
          to="/client/notifications"
          className="card card-hover flex items-center gap-4 p-6"
        >
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Bell className="w-6 h-6 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              Notificacoes
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Veja suas atualizacoes</p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        </Link>
      </div>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Recomendados para Voce
            </h2>
            <Link
              to="/services"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver mais
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-grid">
            {recommendations.map((rec) => (
              <div key={rec.service.id} className="relative">
                <ServiceCard
                  id={rec.service.id}
                  title={rec.service.title}
                  description={rec.service.description}
                  price={rec.service.price}
                  estimatedHours={rec.service.estimatedHours}
                  images={rec.service.images}
                  professional={rec.service.professional}
                  category={rec.service.category}
                />
                {rec.reasons.length > 0 && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 text-xs">
                      {rec.reasons[0]}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pedidos recentes */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Pedidos Recentes
            </h2>
            <Link
              to="/client/orders"
              className="text-sm text-primary-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon="package"
              title="Nenhum pedido ainda"
              description="Voce ainda nao fez nenhum pedido. Que tal buscar um servico?"
              action={{
                label: "Buscar servicos",
                onClick: () => navigate("/services"),
              }}
            />
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  id={order.id}
                  title={order.title}
                  status={order.status}
                  price={order.price}
                  scheduledDate={order.scheduledDate || undefined}
                  deadlineDate={order.deadlineDate || undefined}
                  createdAt={order.createdAt}
                  professional={
                    order.professional
                      ? {
                          id: order.professional.id,
                          name: order.professional.name,
                          profileImage:
                            order.professional.profileImage || undefined,
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Categorias Populares
            </h3>
            <div className="space-y-2">
              {categories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={`/services?category=${category.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {category._count?.serviceListings || 0}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              to="/services"
              className="block text-center text-sm text-primary-600 hover:underline mt-4"
            >
              Ver todas as categorias
            </Link>
          </div>

          <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-primary-200" />
              <h3 className="font-semibold">Dica do FazTudo</h3>
            </div>
            <p className="text-sm text-primary-100 mb-4 min-h-[3rem] transition-opacity duration-300">
              {currentTip.text}
            </p>
            <div className="flex items-center justify-between">
              <Link
                to={currentTip.to}
                className="inline-block text-sm font-medium hover:underline"
              >
                {currentTip.cta}
              </Link>
              <div className="flex gap-1.5">
                {TIPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTipIndex(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === tipIndex
                        ? "bg-white w-4"
                        : "bg-primary-300 hover:bg-primary-200"
                    }`}
                    aria-label={`Dica ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
