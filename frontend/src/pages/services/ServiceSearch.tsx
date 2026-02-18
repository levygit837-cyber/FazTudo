import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import { Filter, Grid, List, ChevronDown, ChevronLeft, X, Pause, Play, Edit3, Trash2, Sparkles } from "lucide-react";
import { ServiceCard } from "../../components/services/ServiceCard";
import { CategoryGrid } from "../../components/services/CategoryGrid";
import { SearchBar } from "../../components/common/SearchBar";
import { SkeletonServiceCard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import ModalPortal from "../../components/common/ModalPortal";
import {
  listServices,
  updateService,
  deleteService,
  ServiceListParams,
  ServiceListingWithProfessional,
} from "../../services/serviceService";
import {
  getMainCategories,
  getCategoryById,
  CategoryWithCounts,
} from "../../services/categoryService";
import { formatCurrency } from "../../utils/formatters";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";

interface ServiceSearchProps {
  showProfessionalCatalog?: boolean;
}

const ServiceSearch: React.FC<ServiceSearchProps> = ({
  showProfessionalCatalog = false,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado
  const [services, setServices] = useState<ServiceListingWithProfessional[]>(
    [],
  );
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const toast = useToast();

  // Helper: check if service was created in last 7 days
  const isNewService = (createdAt: string | Date) => {
    const created = new Date(createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return created >= sevenDaysAgo;
  };

  // Parâmetros de busca
  const searchTerm = searchParams.get("q") || "";
  const categoryId = searchParams.get("category");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const sortBy =
    (searchParams.get("sortBy") as "price" | "rating" | "recent") || "recent";

  const ITEMS_PER_PAGE = 12;

  // Carregar categorias
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await getMainCategories(undefined, 12);
        setCategories(result.categories);
      } catch (err) {
        console.error("Erro ao carregar categorias:", err);
      }
    };
    loadCategories();
  }, []);

  // Carregar categoria selecionada
  useEffect(() => {
    const loadSelectedCategory = async () => {
      if (categoryId) {
        try {
          const category = await getCategoryById(parseInt(categoryId, 10));
          setSelectedCategory(category);
        } catch (err) {
          console.error("Erro ao carregar categoria:", err);
          setSelectedCategory(null);
        }
      } else {
        setSelectedCategory(null);
      }
    };
    loadSelectedCategory();
  }, [categoryId]);

  // Carregar serviços
  const loadServices = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        if (showProfessionalCatalog && !user?.id) {
          setServices([]);
          setTotalItems(0);
          setHasMore(false);
          return;
        }

        const params: ServiceListParams = {
          page: pageNum,
          limit: ITEMS_PER_PAGE,
          sortBy,
        };

        if (showProfessionalCatalog) {
          params.professionalId = user?.id;
          params.availableOnly = "all";
        } else {
          params.availableOnly = "true";
        }

        if (searchTerm) params.search = searchTerm;
        if (categoryId) params.categoryId = parseInt(categoryId, 10);
        if (minPrice) params.minPrice = parseFloat(minPrice);
        if (maxPrice) params.maxPrice = parseFloat(maxPrice);

        const result = await listServices(params);

        if (append) {
          setServices((prev) => [...prev, ...result.items]);
        } else {
          setServices(result.items);
        }

        setTotalItems(result.total);
        setHasMore(pageNum < result.totalPages);
        setPage(pageNum);
      } catch (err: any) {
        if (axios.isAxiosError(err)) {
          if (!err.response) {
            setError("Erro de conexão. Verifique se o servidor está acessível.");
          } else if (err.response.status === 401) {
            setError("Sessão expirada. Faça login novamente.");
          } else if (err.response.status === 403) {
            setError("Sem permissão para acessar estes serviços.");
          } else {
            setError(err.response.data?.message || "Erro ao carregar serviços");
          }
        } else {
          setError(err.message || "Erro ao carregar serviços");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      searchTerm,
      categoryId,
      minPrice,
      maxPrice,
      sortBy,
      showProfessionalCatalog,
      user?.id,
    ],
  );

  // Recarregar quando filtros mudarem
  useEffect(() => {
    loadServices(1, false);
  }, [loadServices]);

  // Handlers
  const handleSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set("q", value);
    } else {
      newParams.delete("q");
    }
    setSearchParams(newParams);
  };

  const handleCategorySelect = (catId: number | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (catId) {
      newParams.set("category", catId.toString());
    } else {
      newParams.delete("category");
    }
    setSearchParams(newParams);
  };

  const handleSortChange = (newSort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sortBy", newSort);
    setSearchParams(newParams);
  };

  const handlePriceFilter = (min: string, max: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (min) {
      newParams.set("minPrice", min);
    } else {
      newParams.delete("minPrice");
    }
    if (max) {
      newParams.set("maxPrice", max);
    } else {
      newParams.delete("maxPrice");
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadServices(page + 1, true);
    }
  };

  const hasActiveFilters = searchTerm || categoryId || minPrice || maxPrice;

  // Professional catalog actions
  const handleToggleAvailability = async (service: ServiceListingWithProfessional) => {
    try {
      await updateService(service.id, { isAvailable: !service.isAvailable });
      setServices((prev) =>
        prev.map((s) =>
          s.id === service.id ? { ...s, isAvailable: !s.isAvailable } : s,
        ),
      );
    } catch (err) {
      console.error("Erro ao alterar disponibilidade:", err);
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    try {
      await deleteService(serviceId);
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      setTotalItems((prev) => prev - 1);
      toast.success("Servico excluido com sucesso");
    } catch (err) {
      console.error("Erro ao excluir servico:", err);
      toast.error("Erro ao excluir", "Nao foi possivel excluir o servico.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      {/* Header de busca */}
       <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-16 z-10">
        <div className="container mx-auto px-4 py-4">
          {showProfessionalCatalog && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Meu Catalogo de Servicos
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Crie e gerencie os servicos do seu perfil profissional.
                </p>
              </div>
              <Link to="/professional/catalog/new" className="btn btn-primary">
                Criar novo servico
              </Link>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4">
            {/* Barra de busca */}
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar servicos..."
                value={searchTerm}
                onChange={handleSearch}
                onSearch={handleSearch}
              />
            </div>

            {/* Controles */}
            <div className="flex items-center gap-2">
              {/* Filtros mobile */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden btn btn-outline flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>

              {/* Ordenação */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="price">Menor preco</option>
                  <option value="rating">Melhor avaliacao</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              </div>

              {/* View mode */}
              <div className="hidden md:flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 ${viewMode === "list" ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filtros ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">Filtros:</span>
              {searchTerm && (
                <span className="badge badge-primary flex items-center gap-1">
                  Busca: {searchTerm}
                  <button onClick={() => handleSearch("")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="badge badge-primary flex items-center gap-1">
                  {selectedCategory.name}
                  <button onClick={() => handleCategorySelect(null)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="badge badge-primary flex items-center gap-1">
                  Preco: {minPrice ? formatCurrency(parseFloat(minPrice)) : "0"}{" "}
                  - {maxPrice ? formatCurrency(parseFloat(maxPrice)) : "..."}
                  <button onClick={() => handlePriceFilter("", "")}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:underline"
              >
                Limpar todos
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar de filtros (desktop) */}
          <aside className={`hidden md:block flex-shrink-0 transition-all duration-300 ease-in-out ${sidebarOpen ? "w-64" : "w-10"}`} role="complementary" aria-label="Filtros de busca">
            <div className="sticky top-36">
              {/* Toggle button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center justify-center gap-2 mb-2 py-1.5 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label={sidebarOpen ? "Recolher filtros" : "Expandir filtros"}
              >
                {sidebarOpen ? (
                  <>
                    <ChevronLeft className="w-4 h-4" />
                    <span>Recolher filtros</span>
                  </>
                ) : (
                  <Filter className="w-4 h-4" />
                )}
              </button>

              {/* Collapsible content */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? "opacity-100 max-h-[2000px]" : "opacity-0 max-h-0"}`}>
                <div className="card">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Categorias
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => handleCategorySelect(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        !categoryId
                          ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Todas as categorias
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          categoryId === cat.id.toString()
                            ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span>{cat.name}</span>
                          {cat._count?.serviceListings ? (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {cat._count.serviceListings}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Filtro de preco */}
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                      Faixa de preco
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={minPrice || ""}
                        onChange={(e) =>
                          handlePriceFilter(e.target.value, maxPrice || "")
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm dark:text-slate-100"
                      />
                      <span className="text-slate-400 dark:text-slate-500 self-center">-</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxPrice || ""}
                        onChange={(e) =>
                          handlePriceFilter(minPrice || "", e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Conteúdo principal */}
          <main className="flex-1">
            {/* Categoria selecionada */}
            {selectedCategory && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.description && (
                  <p className="text-slate-600 dark:text-slate-400">
                    {selectedCategory.description}
                  </p>
                )}

                {/* Subcategorias */}
                {selectedCategory.subcategories &&
                  selectedCategory.subcategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedCategory.subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => handleCategorySelect(sub.id)}
                          className="px-3 py-1.5 rounded-full text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary-100 hover:text-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors"
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Resultados */}
            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {totalItems}{" "}
                {totalItems === 1
                  ? "servico encontrado"
                  : "servicos encontrados"}
              </p>
            </div>

            {/* Lista de serviços */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonServiceCard key={i} />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon="alert"
                title="Erro ao carregar"
                description={error}
                action={{
                  label: "Tentar novamente",
                  onClick: () => loadServices(1, false),
                }}
              />
            ) : services.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nenhum servico encontrado"
                description="Tente ajustar os filtros ou buscar por outro termo"
                action={
                  hasActiveFilters
                    ? { label: "Limpar filtros", onClick: clearFilters }
                    : undefined
                }
              />
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-grid"
                      : "space-y-4"
                  }
                >
                  {services.map((service) => (
                    <div key={service.id} className="relative">
                      {/* "Novo" badge for recent services */}
                      {!showProfessionalCatalog && service.createdAt && isNewService(service.createdAt) && (
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-medium shadow-sm">
                          <Sparkles className="w-3 h-3" />
                          Novo
                        </div>
                      )}
                      {/* Availability badge for professional catalog */}
                      {showProfessionalCatalog && !service.isAvailable && (
                        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md bg-slate-800/80 text-white text-xs font-medium">
                          Pausado
                        </div>
                      )}
                      <ServiceCard
                        id={service.id}
                        title={service.title}
                        description={service.description}
                        price={service.price}
                        estimatedHours={service.estimatedHours || undefined}
                        images={(service.images as string[]) || undefined}
                        professional={service.professional}
                        category={service.category}
                        className={showProfessionalCatalog && !service.isAvailable ? "opacity-60" : ""}
                      />
                      {/* Professional action buttons */}
                      {showProfessionalCatalog && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggleAvailability(service);
                            }}
                            className={`flex-1 btn btn-sm flex items-center justify-center gap-1.5 ${
                              service.isAvailable
                                ? "btn-outline text-yellow-600 border-yellow-300 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-600 dark:hover:bg-yellow-900/20"
                                : "btn-outline text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-600 dark:hover:bg-green-900/20"
                            }`}
                          >
                            {service.isAvailable ? (
                              <><Pause className="w-3.5 h-3.5" /> Pausar</>
                            ) : (
                              <><Play className="w-3.5 h-3.5" /> Ativar</>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/professional/catalog/${service.id}/edit`);
                            }}
                            className="btn btn-outline btn-sm flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteTarget(service.id);
                            }}
                            className="btn btn-outline btn-sm text-red-500 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Carregar mais */}
                {hasMore && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="btn btn-outline"
                    >
                      {loadingMore ? "Carregando..." : "Carregar mais"}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Categorias populares (quando não há busca) */}
            {!searchTerm && !categoryId && services.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                  Explorar categorias
                </h2>
                <CategoryGrid categories={categories} columns={4} />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Filtros mobile (modal) */}
      {showFilters && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowFilters(false)}
            />
            <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-white dark:bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
                <h3 className="font-semibold">Filtros</h3>
                <button onClick={() => setShowFilters(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="h-[calc(100vh-60px)] space-y-6 overflow-y-auto p-4">
                {/* Categorias */}
                <div>
                  <h4 className="mb-3 font-medium">Categorias</h4>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          handleCategorySelect(cat.id);
                          setShowFilters(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                          categoryId === cat.id.toString()
                            ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preco */}
                <div>
                  <h4 className="mb-3 font-medium">Faixa de preco</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice || ""}
                      onChange={(e) =>
                        handlePriceFilter(e.target.value, maxPrice || "")
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice || ""}
                      onChange={(e) =>
                        handlePriceFilter(minPrice || "", e.target.value)
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Botão aplicar */}
                <button
                  onClick={() => setShowFilters(false)}
                  className="btn btn-primary w-full"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteService(deleteTarget)}
        title="Excluir servico"
        message="Tem certeza que deseja excluir este servico? Esta acao nao pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
};

export default ServiceSearch;
