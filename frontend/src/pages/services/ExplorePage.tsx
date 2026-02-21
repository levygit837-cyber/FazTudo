import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import axios from "axios";
import {
  Star,
  Store,
  ChevronDown,
  X,
  Filter,
  Verified,
} from "lucide-react";
import { SearchBar } from "../../components/common/SearchBar";
import { EmptyState } from "../../components/common/EmptyState";
import { Skeleton } from "../../components/common/Skeleton";
import {
  getMainCategories,
  CategoryWithCounts,
} from "../../services/categoryService";
import { listStorefronts } from "../../services/storefrontService";
import { StorefrontListItem, StorefrontFilters } from "../../types";
import { formatRating } from "../../utils/formatters";
import ModalPortal from "../../components/common/ModalPortal";

// ── Skeleton for storefront cards ─────────────────────────
const SkeletonStorefrontCard: React.FC = () => (
  <div className="card overflow-hidden">
    <Skeleton className="h-20 w-full rounded-none" />
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
    </div>
  </div>
);

// ── Storefront Card Component ─────────────────────────────
interface StorefrontCardProps {
  storefront: StorefrontListItem;
}

const StorefrontCard: React.FC<StorefrontCardProps> = ({ storefront }) => {
  const hasRating = storefront.totalReviews > 0;

  return (
    <Link
      to={`/explorar/${storefront.slug}`}
      className="card overflow-hidden hover:shadow-lg transition-shadow group"
    >
      {/* Banner area */}
      <div className="h-20 bg-gradient-to-r from-primary-500 to-primary-600 relative">
        {storefront.mainCategory && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs backdrop-blur-sm">
            {storefront.mainCategory.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Avatar + Name */}
        <div className="flex items-start gap-3 -mt-10">
          <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            {storefront.logo ? (
              <img
                src={storefront.logo}
                alt={storefront.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <Store className="w-6 h-6 text-primary-500" />
            )}
          </div>
          <div className="pt-6 min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors flex items-center gap-1.5">
              {storefront.name}
              {storefront.user.isVerified && (
                <Verified className="w-4 h-4 text-primary-500 shrink-0" />
              )}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {storefront.user.name}
            </p>
          </div>
        </div>

        {/* Description */}
        {storefront.description && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {storefront.description}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          {hasRating ? (
            <span className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-medium">{formatRating(storefront.ratingAverage)}</span>
              <span className="text-slate-400 dark:text-slate-500">
                ({storefront.totalReviews})
              </span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs">
              Sem avaliacoes
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500">
            {storefront.totalServices}{" "}
            {storefront.totalServices === 1 ? "servico" : "servicos"}
          </span>
        </div>
      </div>
    </Link>
  );
};

// ── Main Explore Page ─────────────────────────────────────
const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [storefronts, setStorefronts] = useState<StorefrontListItem[]>([]);
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Search params
  const searchTerm = searchParams.get("q") || "";
  const categoryId = searchParams.get("category");
  const sortBy =
    (searchParams.get("sort") as StorefrontFilters["sort"]) || "relevance";

  const ITEMS_PER_PAGE = 12;

  // Load categories once
  useEffect(() => {
    const loadCats = async () => {
      try {
        const result = await getMainCategories(undefined, 20);
        setCategories(result.categories);
      } catch {
        // Silent — categories are supplementary
      }
    };
    loadCats();
  }, []);

  // Load storefronts
  const loadStorefronts = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const filters: StorefrontFilters = {
          page: pageNum,
          limit: ITEMS_PER_PAGE,
          sort: sortBy,
        };

        if (searchTerm) filters.search = searchTerm;
        if (categoryId) filters.categoryId = parseInt(categoryId, 10);

        const result = await listStorefronts(filters);

        if (append) {
          setStorefronts((prev) => [...prev, ...result.items]);
        } else {
          setStorefronts(result.items);
        }

        setTotal(result.total);
        setHasMore(pageNum < result.totalPages);
        setPage(pageNum);
      } catch (err: any) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.message || "Erro ao carregar vitrines",
          );
        } else {
          setError("Erro ao carregar vitrines");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchTerm, categoryId, sortBy],
  );

  // Reload on filter change
  useEffect(() => {
    loadStorefronts(1, false);
  }, [loadStorefronts]);

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
    newParams.set("sort", newSort);
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadStorefronts(page + 1, true);
    }
  };

  const hasActiveFilters = searchTerm || categoryId;
  const selectedCategory = categories.find(
    (c) => c.id === parseInt(categoryId || "0", 10),
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-16 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Explorar
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Encontre profissionais e empresas para o que voce precisa
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            {/* Search bar */}
            <div className="flex-1">
              <SearchBar
                placeholder="Buscar vitrines, servicos..."
                value={searchTerm}
                onChange={handleSearch}
                onSearch={handleSearch}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Mobile filters */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="md:hidden btn btn-outline flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="relevance">Relevancia</option>
                  <option value="rating">Melhor avaliacao</option>
                  <option value="recent">Mais recentes</option>
                  <option value="services">Mais servicos</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Filtros:
              </span>
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

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar — categories (desktop) */}
          <aside
            className="hidden md:block w-56 flex-shrink-0"
            role="complementary"
            aria-label="Filtro por categoria"
          >
            <div className="sticky top-36">
              <div className="card p-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Categorias
                </h3>
                <div
                  className="space-y-1 max-h-96 overflow-y-auto"
                  role="group"
                  aria-label="Categorias"
                >
                  <button
                    onClick={() => handleCategorySelect(null)}
                    aria-pressed={!categoryId}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !categoryId
                        ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      aria-pressed={categoryId === cat.id.toString()}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        categoryId === cat.id.toString()
                          ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1">
            {/* Count */}
            <div className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {total}{" "}
                {total === 1 ? "vitrine encontrada" : "vitrines encontradas"}
              </p>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonStorefrontCard key={i} />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                icon="alert"
                title="Erro ao carregar"
                description={error}
                action={{
                  label: "Tentar novamente",
                  onClick: () => loadStorefronts(1, false),
                }}
              />
            ) : storefronts.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nenhuma vitrine encontrada"
                description="Tente ajustar os filtros ou buscar por outro termo"
                action={
                  hasActiveFilters
                    ? { label: "Limpar filtros", onClick: clearFilters }
                    : undefined
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {storefronts.map((sf) => (
                    <StorefrontCard key={sf.id} storefront={sf} />
                  ))}
                </div>

                {/* Load more */}
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

            {/* Category chips when no filters */}
            {!searchTerm && !categoryId && storefronts.length > 0 && categories.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  Explorar por categoria
                </h2>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 12).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 hover:border-primary-300 hover:text-primary-600 dark:hover:border-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile filter modal */}
      {showMobileFilters && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-white dark:bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Filtros
                </h3>
                <button onClick={() => setShowMobileFilters(false)}>
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              <div className="h-[calc(100vh-60px)] space-y-6 overflow-y-auto p-4">
                <div>
                  <h4 className="mb-3 font-medium text-slate-900 dark:text-slate-100">
                    Categorias
                  </h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        handleCategorySelect(null);
                        setShowMobileFilters(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        !categoryId
                          ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Todas as categorias
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          handleCategorySelect(cat.id);
                          setShowMobileFilters(false);
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
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="btn btn-primary w-full"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ExplorePage;
