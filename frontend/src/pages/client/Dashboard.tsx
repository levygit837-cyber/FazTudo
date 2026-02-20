import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  Search,
  ArrowRight,
  DollarSign,
  Lightbulb,
  MessageSquare,
  PlusCircle,
  FileText,
  Sun,
  Sunrise,
  Moon,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTour } from "../../context/TourContext";
import { StatsCard } from "../../components/dashboard/StatsCard";
import { ActivityTimeline, ActivityItem } from "../../components/dashboard/ActivityTimeline";
import { CategoryPills, CategoryPillItem } from "../../components/dashboard/CategoryPills";
import { OrderCard } from "../../components/orders/OrderCard";
import { ServiceCard } from "../../components/services/ServiceCard";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { QuickActionBar } from "../../components/dashboard/QuickActionBar";
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


function getGreeting(): { text: string; icon: React.ReactNode; period: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)
    return { text: "Bom dia", icon: <Sunrise className="w-7 h-7 text-amber-500" />, period: "morning" };
  if (hour >= 12 && hour < 18)
    return { text: "Boa tarde", icon: <Sun className="w-7 h-7 text-orange-500" />, period: "afternoon" };
  return { text: "Boa noite", icon: <Moon className="w-7 h-7 text-indigo-400" />, period: "evening" };
}

function buildActivityItems(orders: ServiceOrder[]): ActivityItem[] {
  return orders.slice(0, 5).map((order) => {
    const typeMap: Record<string, ActivityItem["type"]> = {
      PENDING: "order",
      ACCEPTED: "order",
      IN_PROGRESS: "order",
      COMPLETED: "payment",
      CANCELLED: "system",
    };
    const statusMap: Record<string, ActivityItem["status"]> = {
      PENDING: "warning",
      ACCEPTED: "info",
      IN_PROGRESS: "info",
      COMPLETED: "success",
      CANCELLED: "error",
    };
    const titleMap: Record<string, string> = {
      PENDING: "Pedido aguardando resposta",
      ACCEPTED: "Pedido aceito",
      IN_PROGRESS: "Servico em andamento",
      COMPLETED: "Servico concluido",
      CANCELLED: "Pedido cancelado",
    };

    return {
      id: String(order.id),
      title: titleMap[order.status] || order.title,
      description: order.title,
      time: formatTimeAgo(order.createdAt),
      type: typeMap[order.status] || "system",
      status: statusMap[order.status] || "info",
    };
  });
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}sem`;
}

const ClientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startTour } = useTour();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedService[]>([]);
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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const tipDragRef = React.useRef<{ startX: number; isDragging: boolean }>({ startX: 0, isDragging: false });

  // Disparar tour na primeira visita
  useEffect(() => {
    if (!localStorage.getItem("faztudo_client_tour_done")) {
      const timer = setTimeout(() => startTour("client"), 500);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  const handleTipPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tipDragRef.current = { startX: e.clientX, isDragging: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleTipPointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!tipDragRef.current.isDragging) return;
    tipDragRef.current.isDragging = false;
    const delta = e.clientX - tipDragRef.current.startX;
    const THRESHOLD = 40;
    if (delta < -THRESHOLD) {
      setTipIndex((i) => (i + 1) % TIPS.length);
    } else if (delta > THRESHOLD) {
      setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length);
    }
  }, []);

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

  const activityItems = useMemo(() => buildActivityItems(orders), [orders]);

  const categoryPills: CategoryPillItem[] = useMemo(
    () =>
      categories.slice(0, 8).map((cat) => ({
        id: String(cat.id),
        name: cat.name,
        count: cat._count?.serviceListings || 0,
      })),
    [categories],
  );

  if (loading) {
    return <SkeletonDashboard />;
  }

  const activeOrders = stats.pendingOrders + stats.inProgressOrders;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ──────── HERO ZONE ──────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4" data-tour="tour-client-welcome">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            {greeting.icon}
          </div>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {greeting.text}, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              O que precisa resolver hoje?
            </p>
          </div>
        </div>

        {/* CTA Principal */}
        <Link
          to="/services"
          data-tour="tour-search-services"
          className="
            group inline-flex items-center gap-3 px-6 py-3.5
            bg-gradient-to-r from-primary-600 to-primary-700
            hover:from-primary-700 hover:to-primary-800
            text-white font-semibold rounded-2xl
            shadow-lg shadow-primary-600/25 hover:shadow-xl hover:shadow-primary-600/30
            transition-all duration-300 hover:-translate-y-0.5
            active:translate-y-0 active:shadow-md
          "
        >
          <Search className="w-5 h-5" />
          <span>Buscar Servico</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* ──────── QUICK ACTIONS ──────── */}
      <div data-tour="tour-new-order-btn">
        <QuickActionBar
          actions={[
            { label: "Novo pedido", to: "/client/orders/new", icon: PlusCircle, variant: "primary" },
            { label: "Buscar serviços", to: "/services", icon: Search, variant: "secondary" },
            { label: "Meus pedidos", to: "/client/orders", icon: FileText, variant: "secondary" },
            { label: "Mensagens", to: "/messages", icon: MessageSquare, variant: "ghost" },
          ]}
        />
      </div>

      {/* ──────── STAT STRIP — Assimétrico ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Total de Pedidos"
          value={stats.totalOrders}
          icon={<ShoppingBag className="w-6 h-6" />}
          color="primary"
        />
        <StatsCard
          title="Em Andamento"
          value={activeOrders}
          subtitle={`${stats.pendingOrders} pendente${stats.pendingOrders !== 1 ? "s" : ""}`}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
          highlight={activeOrders > 0}
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
          sparklineData={[40, 65, 50, 80, 70, 95, 85, 110]}
        />
      </div>

      {/* ──────── RECOMENDAÇÕES — Scroll horizontal ──────── */}
      {recommendations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Recomendados para Voce
              </h2>
            </div>
            <Link
              to="/services"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 group"
            >
              Ver mais
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scroll-snap-x scrollbar-hide pb-2 -mx-1 px-1"
          >
            {recommendations.map((rec, idx) => (
              <div
                key={rec.service.id}
                className="min-w-[280px] max-w-[320px] flex-shrink-0"
                style={{
                  animation: `staggerFadeIn 250ms ease-out both`,
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                <div className="relative">
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
                      <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold shadow-sm">
                        {rec.reasons[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ──────── CONTENT ZONE — 2/3 + 1/3 ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna principal — Pedidos recentes */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Pedidos Recentes
              </h2>
              <Link
                to="/client/orders"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 group"
              >
                Ver todos
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
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
              <div className="space-y-3 stagger-grid">
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
        </div>

        {/* ──────── SIDEBAR ──────── */}
        <div className="space-y-6">
          {/* Atividade Recente */}
          {activityItems.length > 0 && (
            <div className="card">
              <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
                Atividade Recente
              </h3>
              <ActivityTimeline items={activityItems} maxItems={5} />
            </div>
          )}

          {/* Categorias como Pills */}
          {categoryPills.length > 0 && (
            <div className="card">
              <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
                Explorar Categorias
              </h3>
              <CategoryPills categories={categoryPills} maxItems={8} />
            </div>
          )}

          {/* Dica do FazTudo — redesigned */}
          <div
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-600 text-white p-6 shadow-lg shadow-primary-600/20 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleTipPointerDown}
            onPointerUp={handleTipPointerUp}
            onPointerCancel={() => { tipDragRef.current.isDragging = false; }}
          >
            {/* Decorative shapes */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-primary-100" />
                </div>
                <h3 className="font-display font-bold text-sm uppercase tracking-wider text-primary-100">
                  Dica do FazTudo
                </h3>
              </div>
              <p className="text-sm text-white/90 leading-relaxed mb-4 min-h-[3.5rem] transition-opacity duration-300">
                {currentTip.text}
              </p>
              <div className="flex items-center justify-between">
                <Link
                  to={currentTip.to}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-white/90 transition-colors group"
                >
                  {currentTip.cta}
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <div className="flex gap-1.5">
                  {TIPS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTipIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === tipIndex
                          ? "bg-white w-5"
                          : "bg-white/30 w-1.5 hover:bg-white/50"
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
    </div>
  );
};

export default ClientDashboard;
