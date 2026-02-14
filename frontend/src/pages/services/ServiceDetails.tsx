import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Clock,
  MessageCircle,
  Shield,
  CheckCircle,
  Share2,
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Skeleton, SkeletonText } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import ModalPortal from "../../components/common/ModalPortal";
import {
  createOrder,
  getServiceById,
  ServiceListingWithProfessional,
} from "../../services/serviceService";
import { formatCurrency, formatRating, formatReviewCount } from "../../utils/formatters";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const ServiceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [service, setService] = useState<ServiceListingWithProfessional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);
  const toast = useToast();

  // Share handler
  const handleShare = async () => {
    const shareData = {
      title: service?.title || "FazTudo",
      text: service?.description?.slice(0, 100) || "",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled - ignore
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

  // Favorite toggle
  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    if (!isFavorited) {
      toast.success("Servico salvo nos favoritos");
    } else {
      toast.info("Servico removido dos favoritos");
    }
  };

  // Lightbox navigation
  const lightboxPrev = () => {
    if (!service) return;
    const imgs = (service.images as string[]) || [];
    setSelectedImage((prev) => (prev - 1 + imgs.length) % imgs.length);
  };
  const lightboxNext = () => {
    if (!service) return;
    const imgs = (service.images as string[]) || [];
    setSelectedImage((prev) => (prev + 1) % imgs.length);
  };

  // Lightbox keyboard navigation & body scroll lock
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLightbox) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          setShowLightbox(false);
          break;
        case "ArrowLeft":
          lightboxPrev();
          break;
        case "ArrowRight":
          lightboxNext();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the lightbox container for screen readers
    lightboxRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showLightbox]);

  useEffect(() => {
    const loadService = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getServiceById(parseInt(id, 10));
        setService(data);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar servico");
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  const handleHireService = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/services/${id}` } });
      return;
    }

    if (user?.role !== "CLIENT") {
      setHireError("Somente clientes podem contratar servicos.");
      return;
    }

    if (!service) return;

    try {
      setHiring(true);
      setHireError(null);

      const order = await createOrder({
        serviceListingId: service.id,
        title: service.title,
        description: `Pedido criado a partir da pagina do servico "${service.title}"`,
      });

      navigate(`/client/orders/${order.id}`);
    } catch (error: any) {
      setHireError(
        error?.response?.data?.message ||
          "Nao foi possivel criar o pedido agora.",
      );
    } finally {
      setHiring(false);
    }
  };

  const handleContactProfessional = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/services/${id}` } });
      return;
    }

    setShowContactModal(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl animate-pulse">
        <Skeleton className="h-64 w-full rounded-xl mb-6" />
        <Skeleton className="h-8 w-2/3 rounded mb-4" />
        <SkeletonText lines={4} className="mb-6" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState
          icon="alert"
          title="Servico nao encontrado"
          description={error || "O servico que voce esta procurando nao existe ou foi removido."}
          action={{
            label: "Voltar para busca",
            onClick: () => navigate("/services"),
          }}
        />
      </div>
    );
  }

  const images = (service.images as string[]) || [];
  const tags = (service.tags as string[]) || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 pb-20 lg:pb-0">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Galeria de imagens */}
            <div className="card">
              {images.length > 0 ? (
                <>
                  <div
                    className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4 cursor-pointer group"
                    onClick={() => setShowLightbox(true)}
                  >
                    <img
                      src={images[selectedImage]}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-service.jpg";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                  {images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {images.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === index
                              ? "border-primary-500 ring-2 ring-primary-500/20"
                              : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <img
                            src={img}
                            alt={`${service.title} - Imagem ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-400 dark:text-slate-500">Sem imagens</span>
                </div>
              )}
            </div>

            {/* Informações do serviço */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Link
                    to={`/services?category=${service.category.id}`}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    {service.category.name}
                  </Link>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {service.title}
                  </h1>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Compartilhar"
                    title="Compartilhar"
                  >
                    <Share2 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </button>
                  <button
                    onClick={handleFavorite}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label={isFavorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
                    title={isFavorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  >
                    <Heart className={`w-5 h-5 transition-colors ${isFavorited ? "text-red-500 fill-red-500" : "text-slate-400 dark:text-slate-500"}`} />
                  </button>
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Descrição */}
              <div className="prose prose-slate max-w-none">
                <h3 className="text-lg font-semibold mb-2">Descricao</h3>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {service.description}
                </p>
              </div>

              {/* Informações adicionais */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                {service.estimatedHours && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Tempo estimado</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {service.estimatedHours} horas
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pagamento seguro</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Escrow garantido
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sobre o profissional */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Sobre o profissional</h3>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                  {service.professional.profileImage ? (
                    <img
                      src={service.professional.profileImage}
                      alt={service.professional.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-medium text-slate-400 dark:text-slate-500">
                      {service.professional.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    to={`/professionals/${service.professional.id}`}
                    className="font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 transition-colors"
                  >
                    {service.professional.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">
                        {formatRating(service.professional.ratingAverage)}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      ({formatReviewCount(service.professional.totalReviews)})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Profissional verificado</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Servicos concluidos</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {(service.completedOrdersCount || service.completedOrders || 0).toString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Avaliacoes totais</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {service.professional.totalReviews}
                  </p>
                </div>
              </div>

              {/* Botão de contato */}
              <button
                onClick={handleContactProfessional}
                className="w-full mt-4 btn btn-outline flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar mensagem
              </button>
            </div>
          </div>

          {/* Sidebar - Card de contratação */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              {hireError && (
                <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  {hireError}
                </div>
              )}

              {/* Preco */}
              <div className="text-center pb-6 border-b border-slate-200 dark:border-slate-700">
                <span className="text-3xl font-bold text-primary-600">
                  {formatCurrency(service.price)}
                </span>
                {service.estimatedHours && (
                  <span className="text-slate-500 dark:text-slate-400 ml-2">
                    / ~{service.estimatedHours}h
                  </span>
                )}
              </div>

              {/* O que está incluso */}
              <div className="py-6 space-y-3">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  O que esta incluso:
                </h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Pagamento protegido por escrow
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Chat direto com o profissional
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Garantia de conclusao
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Suporte em caso de problemas
                  </li>
                </ul>
              </div>

              {/* Botões de ação */}
              <div className="space-y-3">
                <button
                  onClick={handleHireService}
                  disabled={hiring}
                  className="w-full btn btn-primary py-3 disabled:opacity-70"
                >
                  {hiring ? "Criando pedido..." : "Contratar servico"}
                </button>
                <button
                  onClick={handleContactProfessional}
                  className="w-full btn btn-outline py-3"
                >
                  Tirar duvidas
                </button>
              </div>

              {/* Aviso de segurança */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex gap-3">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      Pagamento seguro
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      O pagamento fica retido ate o servico ser concluido e confirmado por voce.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Avaliações (placeholder) */}
        <div className="mt-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">
              Avaliacoes ({service.professional.totalReviews})
            </h3>
            {service.professional.totalReviews === 0 ? (
              <EmptyState
                icon="question"
                title="Sem avaliacoes ainda"
                description="Este servico ainda nao possui avaliacoes."
                className="py-8"
              />
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                Carregando avaliacoes...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de contato */}
      {showContactModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Enviar mensagem">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowContactModal(false)}
              aria-hidden="true"
            />
            <div className="relative mx-4 w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Enviar mensagem para {service.professional.name}
              </h3>
              <textarea
                placeholder="Escreva sua mensagem..."
                rows={4}
                className="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-slate-100 px-4 py-3 focus:ring-2 focus:ring-primary-500"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="btn btn-outline flex-1"
                >
                  Cancelar
                </button>
                <button className="btn btn-primary flex-1">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Image Lightbox */}
      {showLightbox && images.length > 0 && (
        <ModalPortal>
          <div
            ref={lightboxRef}
            className="fixed inset-0 z-[130] bg-black/95 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={`Galeria de imagens - ${selectedImage + 1} de ${images.length}`}
            tabIndex={-1}
          >
            {/* Close button */}
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Image counter */}
            <div className="absolute top-4 left-4 text-white/70 text-sm">
              {selectedImage + 1} / {images.length}
            </div>

            {/* Previous button */}
            {images.length > 1 && (
              <button
                onClick={lightboxPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main image */}
            <img
              src={images[selectedImage]}
              alt={`${service.title} - Imagem ${selectedImage + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-service.jpg";
              }}
            />

            {/* Next button */}
            {images.length > 1 && (
              <button
                onClick={lightboxNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Proxima imagem"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                      selectedImage === index
                        ? "border-white scale-110"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ModalPortal>
      )}

      {/* Sticky Mobile CTA Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-xl font-bold text-primary-600">
              {formatCurrency(service.price)}
            </span>
            {service.estimatedHours && (
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                / ~{service.estimatedHours}h
              </span>
            )}
          </div>
          <button
            onClick={handleHireService}
            disabled={hiring}
            className="btn btn-primary py-2.5 px-6 disabled:opacity-70"
          >
            {hiring ? "Criando..." : "Contratar"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetails;
