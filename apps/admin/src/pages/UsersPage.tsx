import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Star,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  listUsers,
  type UserListItem,
  type PaginatedResponse,
} from "../services/adminService";

// ==================== Helpers ====================

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

const ROLE_BADGE: Record<string, string> = {
  CLIENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PROFESSIONAL: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ==================== Skeleton ====================

const RowSkeleton: React.FC = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
      </td>
    ))}
  </tr>
);

// ==================== Component ====================

const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse<UserListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers(
        page,
        limit,
        debouncedSearch || undefined,
        roleFilter || undefined,
        statusFilter || undefined
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const users = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Usuarios
          </h2>
        </div>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Erro ao carregar dados
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => void fetchUsers()}
            className="btn bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Usuarios
        </h2>
        {data && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            ({data.total} total)
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todos os Roles</option>
            <option value="CLIENT">Cliente</option>
            <option value="PROFESSIONAL">Profissional</option>
            <option value="ADMIN">Admin</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todos os Status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PENDING">Pendente</option>
            <option value="SUSPENDED">Suspenso</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Avaliacao
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <RowSkeleton key={i} />
                  ))
                : users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {user.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ROLE_BADGE[user.role] ?? ROLE_BADGE.CLIENT
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[user.status] ?? STATUS_BADGE.PENDING
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star
                            size={14}
                            className="text-amber-400 fill-amber-400"
                          />
                          <span className="text-slate-700 dark:text-slate-300">
                            {user.ratingAverage.toFixed(1)}
                          </span>
                          <span className="text-slate-400 text-xs">
                            ({user.totalReviews})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/users/${user.id}`);
                          }}
                          className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum usuario encontrado
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pagina {page} de {totalPages}
              {data && ` (${data.total} usuarios)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pageNum === page
                        ? "bg-primary-600 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading indicator for filter changes */}
      {loading && data && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Carregando...
        </div>
      )}
    </div>
  );
};

export default UsersPage;
