import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  Star,
  Store,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ShoppingCart,
  MessageCircle,
  Verified,
  Share2,
  Loader2,
  MapPin,
  Clock,
  Home,
  Users,
  Building2,
  Globe,
  Calendar,
  Award,
  TrendingUp,
} from "lucide-react";
import { Skeleton, SkeletonText } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { getStorefrontBySlug } from "../../services/storefrontService";
import api from "../../services/api";
import { useStorefrontCart } from "../../hooks/useStorefrontCart";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  StorefrontDetail,
  StorefrontService,
  StorefrontServiceOption,
  StorefrontCategory,
} from "../../types";
import {
  formatCurrency,
  formatRating,
} from "../../utils/formatters";

type VitrineTab = "servicos" | "sobre" | "avaliacoes";

// ── Service Card (inside vitrine) ─────────────────────────
interface ServiceItemProps {
  service: StorefrontService & { options: StorefrontServiceOption[] };
  storefrontId: number;
  storefrontName: string;
  storefrontSlug: string;
  onAddToCart: (
    service: StorefrontService,
    qty: number,
    options: StorefrontServiceOption[],
  ) => void;
  onAskQuestion: (service: StorefrontService) => void;
}

const ServiceItem: React.FC<ServiceItemProps> = ({
  service,
  onAddToCart,
  onAskQuestion,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<StorefrontServiceOption[]>([]);
  const [quantity, setQuantity] = useState(1);

  const hasOptions = service.options.length > 0;

  const toggleOption = (opt: StorefrontServiceOption) => {
    setSelectedOptions((prev) => {
      const exists = prev.find((o) => o.id === opt.id);
      return exists ? prev.filter((o) => o.id !== opt.id) : [...prev, opt];
    });
  };

  const calcPrice = () => {
    let price = service.price;
    for (const opt of selectedOptions) {
      if (opt.price != null) price += opt.price;
    }
    return price;
  };

  const handleAdd = () => {
    onAddToCart(service, quantity, selectedOptions);
    setQuantity(1);
    setSelectedOptions([]);
    setExpanded(false);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-primary-300 dark:hover:border-primary-600 transition-colors bg-white dark:bg-slate-900 shadow-sm hover:shadow-md">
      {/* Thumbnail if images available */}
      {service.images && Array.isArray(service.images) && (service.images as string[]).length > 0 && (
        <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <img
            src={(service.images as string[])[0]}
            alt={service.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 md:p-6 flex items-start justify-between gap-4"
      >
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-base md:text-lg text-slate-900 dark:text-slate-100">
            {service.title}
          </h4>
          {service.description && (
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          )}
          <p className="text-base md:text-lg font-bold text-primary-600 dark:text-primary-400 mt-3">
            {formatCurrency(service.price)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {hasOptions && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              {service.options.length} opc.
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6 border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-4">
          {/* Options */}
          {hasOptions && (
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Opcionais:
              </p>
              <div className="space-y-2">
                {service.options.map((opt) => {
                  const isSelected = selectedOptions.some(
                    (o) => o.id === opt.id,
                  );
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleOption(opt)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors flex items-center justify-between ${
                        isSelected
                          ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <span className={isSelected ? "text-primary-700 dark:text-primary-300 font-medium" : "text-slate-700 dark:text-slate-300"}>
                        {opt.name}
                      </span>
                      {opt.price != null && (
                        <span className={`text-sm font-medium ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-500"}`}>
                          +{formatCurrency(opt.price)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-semibold text-lg text-slate-900 dark:text-slate-100">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAskQuestion(service);
                }}
                className="btn btn-outline flex items-center gap-2 px-4 py-2.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tirar duvida</span>
                <span className="sm:hidden">Duvida</span>
              </button>

              <button
                onClick={handleAdd}
                className="btn btn-primary flex items-center gap-2 px-5 py-2.5"
              >
                <ShoppingCart className="w-4 h-4" />
                Adicionar {formatCurrency(calcPrice() * quantity)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Category Section ──────────────────────────────────────
interface CategorySectionProps {
  category: StorefrontCategory & {
    services: (StorefrontService & { options: StorefrontServiceOption[] })[];
  };
  storefrontId: number;
  storefrontName: string;
  storefrontSlug: string;
  onAddToCart: (
    service: StorefrontService,
    qty: number,
    options: StorefrontServiceOption[],
  ) => void;
  onAskQuestion: (service: StorefrontService) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  storefrontId,
  storefrontName,
  storefrontSlug,
  onAddToCart,
  onAskQuestion,
}) => {
  if (category.services.length === 0) return null;

  return (
    <section className="mb-10" id={`category-${category.id}`}>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 sticky top-28 bg-slate-50 dark:bg-slate-800 py-3 z-[5]">
        {category.name}
        <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
          ({category.services.length} {category.services.length === 1 ? "servico" : "servicos"})
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {category.services.map((service) => (
          <ServiceItem
            key={service.id}
            service={{ ...service, options: service.options || [] }}
            storefrontId={storefrontId}
            storefrontName={storefrontName}
            storefrontSlug={storefrontSlug}
            onAddToCart={onAddToCart}
            onAskQuestion={onAskQuestion}
          />
        ))}
      </div>
    </section>
  );
};

// ── Cart Floating Bar ─────────────────────────────────────
interface CartBarProps {
  itemCount: number;
  totalPrice: number;
  storefrontSlug: string;
  onCheckout: () => void;
}

const CartBar: React.FC<CartBarProps> = ({
  itemCount,
  totalPrice,
  onCheckout,
}) => {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg lg:hidden">
      <div className="px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <ShoppingCart className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">
              {itemCount}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </p>
            <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
              {formatCurrency(totalPrice)}
            </p>
          </div>
        </div>
        <button onClick={onCheckout} className="btn btn-primary px-8 py-3 text-base font-semibold">
          Fazer pedido
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────
const StorefrontViewPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [storefront, setStorefront] = useState<StorefrontDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<VitrineTab>("servicos");

  const { cart, addItem, itemCount, clearCart, getCheckoutPayload } =
    useStorefrontCart();

  const categoryNavRef = useRef<HTMLDivElement>(null);

  // Load storefront
  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStorefrontBySlug(slug);
        setStorefront(data);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError("Vitrine nao encontrada");
        } else {
          setError("Erro ao carregar vitrine");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  // Handle add to cart
  const handleAddToCart = (
    service: StorefrontService,
    qty: number,
    options: StorefrontServiceOption[],
  ) => {
    if (!storefront) return;

    // If cart is from a different storefront, warn
    if (cart && cart.storefrontId !== storefront.id) {
      const confirmed = window.confirm(
        `Voce ja tem itens de "${cart.storefrontName}" no carrinho. Deseja limpar o carrinho e adicionar de "${storefront.name}"?`,
      );
      if (!confirmed) return;
    }

    addItem({
      storefrontId: storefront.id,
      storefrontName: storefront.name,
      storefrontSlug: storefront.slug,
      service,
      quantity: qty,
      selectedOptions: options,
    });

    toast.success("Adicionado ao carrinho", `${service.title} x${qty}`);
  };

  // Checkout
  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast.warning("Faca login para fazer pedidos");
      navigate("/login");
      return;
    }

    const payload = getCheckoutPayload();
    if (!payload) return;

    setCheckingOut(true);
    try {
      const { checkoutCart } = await import("../../services/storefrontService");
      const order = await checkoutCart(payload);
      clearCart();
      toast.success("Pedido criado!", `Pedido #${order.id} criado com sucesso`);
      const basePath = user?.role === "PROFESSIONAL" ? "/professional" : "/client";
      navigate(`${basePath}/orders/${order.id}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Erro ao criar pedido";
      toast.error("Erro no pedido", msg);
    } finally {
      setCheckingOut(false);
    }
  };

  // Share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storefront?.name || "FazTudo",
          text: storefront?.description || "",
          url: window.location.href,
        });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copiado!");
      } catch {
        toast.error("Erro ao copiar link");
      }
    }
  };

  // Ask question about a specific storefront service
  const handleAskQuestion = async (service: StorefrontService) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    try {
      const response = await api.post("/api/services/orders/draft", {
        storefrontServiceId: service.id,
      });
      const draft = response.data.data.serviceOrder;
      const basePath =
        user?.role === "PROFESSIONAL"
          ? "/professional/services"
          : "/client/orders";
      navigate(`${basePath}/${draft.id}/chat`);
    } catch (err: any) {
      toast.error(
        "Erro",
        err?.response?.data?.message || "Erro ao iniciar conversa",
      );
    }
  };

  // Scroll to category
  const scrollToCategory = (categoryId: number) => {
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Cart is for this storefront?
  const cartForThis =
    cart && storefront && cart.storefrontId === storefront.id;
  const cartItemCount = cartForThis ? itemCount : 0;
  const cartTotalPrice = cartForThis ? cart!.totalPrice : 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 h-56 md:h-72" />
        <div className="px-4 md:px-8 lg:px-16 -mt-20">
          <div className="card p-6 md:p-8 space-y-4">
            <div className="flex items-start gap-5">
              <Skeleton className="w-28 h-28 md:w-32 md:h-32 rounded-2xl shrink-0 -mt-14" />
              <div className="flex-1 space-y-3 pt-2">
                <Skeleton className="h-8 w-56 rounded" />
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
            <SkeletonText lines={2} />
          </div>
          <div className="mt-8 space-y-6">
            <Skeleton className="h-8 w-48 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !storefront) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
        <EmptyState
          icon="alert"
          title={error || "Vitrine nao encontrada"}
          description="A vitrine que voce procura pode nao existir ou estar desativada"
          action={{
            label: "Voltar para Explorar",
            onClick: () => navigate("/explorar"),
          }}
        />
      </div>
    );
  }

  const hasRating = storefront.totalReviews > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 pb-24 lg:pb-8">

      {/* Banner — full-width, altura maior */}
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 h-56 md:h-72 lg:h-80 relative">
        {storefront.banner && (
          <img
            src={storefront.banner}
            alt=""
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute top-4 left-4 md:top-6 md:left-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute top-4 right-4 md:top-6 md:right-8">
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Header card — sem max-w, full-width com padding */}
      <div className="px-4 md:px-8 lg:px-16 xl:px-24 -mt-20 relative z-10">
        <div className="card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Logo maior */}
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl flex items-center justify-center shrink-0 overflow-hidden -mt-16 md:-mt-20">
              {storefront.logo ? (
                <img
                  src={storefront.logo}
                  alt={storefront.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <Store className="w-12 h-12 md:w-14 md:h-14 text-primary-500" />
              )}
            </div>

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {storefront.name}
                    {storefront.user.isVerified && (
                      <Verified className="w-7 h-7 text-primary-500 shrink-0" />
                    )}
                  </h1>
                  <p className="text-base text-slate-500 dark:text-slate-400 mt-1">
                    {storefront.user.name}
                    {storefront.mainCategory && (
                      <span className="ml-2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {storefront.mainCategory.name}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                {hasRating && (
                  <span className="flex items-center gap-1.5 text-amber-500 font-semibold text-base">
                    <Star className="w-5 h-5 fill-current" />
                    {formatRating(storefront.ratingAverage)}
                    <span className="text-slate-400 dark:text-slate-500 font-normal text-sm">
                      ({storefront.totalReviews} {storefront.totalReviews === 1 ? "avaliação" : "avaliações"})
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  {storefront.totalServices} {storefront.totalServices === 1 ? "serviço" : "serviços"}
                </span>
                {storefront.serviceLocation && (
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    {storefront.serviceLocation === "HOME" && <Home className="w-4 h-4" />}
                    {storefront.serviceLocation === "CLIENT" && <MapPin className="w-4 h-4" />}
                    {storefront.serviceLocation === "BOTH" && <Users className="w-4 h-4" />}
                    {storefront.serviceLocation === "ONLINE" && <Globe className="w-4 h-4" />}
                    {storefront.serviceLocation === "HOME" && "Atendo em domicílio"}
                    {storefront.serviceLocation === "CLIENT" && "Atendo no local do cliente"}
                    {storefront.serviceLocation === "BOTH" && "Domicílio ou local do cliente"}
                    {storefront.serviceLocation === "ONLINE" && "Atendimento online"}
                  </span>
                )}
              </div>

              {/* Description */}
              {storefront.description && (
                <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  {storefront.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de navegação */}
      <div className="sticky top-16 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 mt-0">
        <div className="px-4 md:px-8 lg:px-16 xl:px-24 flex gap-1 overflow-x-auto scrollbar-hide">
          {(["servicos", "sobre", "avaliacoes"] as VitrineTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab === "servicos" && "Serviços"}
              {tab === "sobre" && "Sobre"}
              {tab === "avaliacoes" && "Avaliações"}
            </button>
          ))}
        </div>
      </div>

      {/* Layout principal: conteúdo + sidebar */}
      <div className="px-4 md:px-8 lg:px-16 xl:px-24 mt-6 pb-28 lg:pb-8">
        <div className="flex gap-8 items-start">

          {/* CONTEÚDO PRINCIPAL */}
          <div className="flex-1 min-w-0">

            {/* Tab: Serviços */}
            {activeTab === "servicos" && (
              <>
                {/* Category navigation pills */}
                {storefront.categories.length > 1 && (
                  <div ref={categoryNavRef} className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
                    {storefront.categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => scrollToCategory(cat.id)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:border-primary-600 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-colors"
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {storefront.categories.length === 0 ? (
                  <EmptyState
                    icon="package"
                    title="Nenhum serviço disponível"
                    description="Esta vitrine ainda não possui serviços cadastrados"
                  />
                ) : (
                  storefront.categories.map((cat) => (
                    <CategorySection
                      key={cat.id}
                      category={cat as any}
                      storefrontId={storefront.id}
                      storefrontName={storefront.name}
                      storefrontSlug={storefront.slug}
                      onAddToCart={handleAddToCart}
                      onAskQuestion={handleAskQuestion}
                    />
                  ))
                )}
              </>
            )}

            {/* Tab: Sobre */}
            {activeTab === "sobre" && (
              <div className="card p-6 md:p-8 space-y-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Sobre {storefront.name}</h2>
                {storefront.description ? (
                  <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {storefront.description}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">Nenhuma descrição cadastrada.</p>
                )}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Informações</h3>
                  <dl className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary-500 shrink-0" />
                      <span>Profissional {storefront.user.isVerified ? "verificado" : "não verificado"}</span>
                    </div>
                    {storefront.mainCategory && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary-500 shrink-0" />
                        <span>Categoria: {storefront.mainCategory.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary-500 shrink-0" />
                      <span>{storefront.totalServices} serviços disponíveis</span>
                    </div>
                    {hasRating && (
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{formatRating(storefront.ratingAverage)} de avaliação média ({storefront.totalReviews} avaliações)</span>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}

            {/* Tab: Avaliações */}
            {activeTab === "avaliacoes" && (
              <div className="card p-6 md:p-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Avaliações</h2>
                {!hasRating ? (
                  <EmptyState
                    icon="star"
                    title="Sem avaliações ainda"
                    description="Este profissional ainda não recebeu avaliações"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-amber-500">{formatRating(storefront.ratingAverage)}</div>
                        <div className="flex justify-center mt-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`w-4 h-4 ${n <= Math.round(storefront.ratingAverage) ? "text-amber-400 fill-current" : "text-slate-300"}`} />
                          ))}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">{storefront.totalReviews} avaliações</div>
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
                      Avaliações detalhadas em breve
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR DIREITA — sticky, visível apenas em desktop */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <div className="sticky top-32 space-y-4">

              {/* Card: Informações de atendimento */}
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider">
                  Informações
                </h3>
                <dl className="space-y-3 text-sm">
                  {storefront.serviceLocation && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Atendimento</dt>
                        <dd className="text-slate-500 dark:text-slate-400">
                          {storefront.serviceLocation === "HOME" && "Atendo em domicílio"}
                          {storefront.serviceLocation === "CLIENT" && "No local do cliente"}
                          {storefront.serviceLocation === "BOTH" && "Domicílio ou local do cliente"}
                          {storefront.serviceLocation === "ONLINE" && "Online / Remoto"}
                        </dd>
                      </div>
                    </div>
                  )}
                  {storefront.workingHours && (() => {
                    try {
                      const wh = JSON.parse(storefront.workingHours);
                      const monFrom = wh?.mon?.from || "08:00";
                      const monTo = wh?.mon?.to || "18:00";
                      return (
                        <div className="flex items-start gap-2.5">
                          <Clock className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                          <div>
                            <dt className="font-medium text-slate-700 dark:text-slate-300">Horários</dt>
                            <dd className="text-slate-500 dark:text-slate-400 text-xs">
                              Seg-Sex: {monFrom} – {monTo}
                            </dd>
                          </div>
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                  {storefront.averageServiceTime && (
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Duração média</dt>
                        <dd className="text-slate-500 dark:text-slate-400">
                          {storefront.averageServiceTime === "30min" && "~30 minutos"}
                          {storefront.averageServiceTime === "1h" && "~1 hora"}
                          {storefront.averageServiceTime === "2h" && "~2 horas"}
                          {storefront.averageServiceTime === "half_day" && "Meio período"}
                          {storefront.averageServiceTime === "full_day" && "Dia inteiro"}
                          {storefront.averageServiceTime === "variable" && "Varia por serviço"}
                        </dd>
                      </div>
                    </div>
                  )}
                  {storefront.teamSize != null && storefront.teamSize > 1 && (
                    <div className="flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Equipe</dt>
                        <dd className="text-slate-500 dark:text-slate-400">{storefront.teamSize} profissionais</dd>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Award className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                    <div>
                      <dt className="font-medium text-slate-700 dark:text-slate-300">Status</dt>
                      <dd className="text-slate-500 dark:text-slate-400">
                        {storefront.user.isVerified ? "✓ Profissional verificado" : "Não verificado"}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Card: CTA — fazer pedido (sidebar desktop) */}
              {cartItemCount > 0 && (
                <div className="card p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {cartItemCount} {cartItemCount === 1 ? "item" : "itens"} no carrinho
                    </span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">
                      {formatCurrency(cartTotalPrice)}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    className="btn btn-primary w-full py-3 font-semibold flex items-center justify-center gap-2"
                  >
                    {checkingOut ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Criando pedido...</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" /> Fazer pedido</>
                    )}
                  </button>
                </div>
              )}

              {/* Card: Reputação */}
              {hasRating && (
                <div className="card p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider mb-3">
                    Reputação
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-amber-500">{formatRating(storefront.ratingAverage)}</div>
                    <div>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-4 h-4 ${n <= Math.round(storefront.ratingAverage) ? "text-amber-400 fill-current" : "text-slate-200 dark:text-slate-700"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{storefront.totalReviews} avaliações</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {/* Floating cart bar — apenas mobile (sidebar cuida do desktop) */}
      <CartBar
        itemCount={cartItemCount}
        totalPrice={cartTotalPrice}
        storefrontSlug={storefront.slug}
        onCheckout={handleCheckout}
      />

      {/* Loading overlay for checkout */}
      {checkingOut && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            <span className="text-slate-900 dark:text-slate-100 font-medium">
              Criando pedido...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontViewPage;
