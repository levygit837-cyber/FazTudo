import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Shield,
  Star,
  Mail,
  Phone,
  Calendar,
  X,
} from "lucide-react";
import { Skeleton, SkeletonTable, SkeletonText } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  listUsers,
  getUserDetails,
  updateUserStatus,
  AdminUser,
  AdminUserDetails,
} from "../../services/adminService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useToast } from "../../context/ToastContext";

const ROLE_LABELS: Record<string, string> = {
  CLIENT: "Cliente",
  PROFESSIONAL: "Profissional",
  ADMIN: "Admin",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  INACTIVE: "Inativo",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  SUSPENDED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  INACTIVE: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const ROLE_COLORS: Record<string, string> = {
  CLIENT: "bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300",
  PROFESSIONAL: "bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-300",
  ADMIN: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
};

const AdminUsers: React.FC = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Detail modal
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Filters from URL
  const search = searchParams.get("search") || "";
  const roleFilter = searchParams.get("role") || "";
  const statusFilter = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const result = await listUsers(params);
      setUsers(result.items);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string) || "";
    const newParams = new URLSearchParams(searchParams);
    if (q) {
      newParams.set("search", q);
    } else {
      newParams.delete("search");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const setFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const goToPage = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", p.toString());
    setSearchParams(newParams);
  };

  const openUserDetails = async (userId: number) => {
    try {
      setLoadingDetails(true);
      const details = await getUserDetails(userId);
      setSelectedUser(details);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (userId: number, newStatus: string) => {
    try {
      setStatusUpdating(true);
      await updateUserStatus(userId, newStatus);
      // Refresh the list and details
      await loadUsers();
      if (selectedUser && selectedUser.id === userId) {
        const updated = await getUserDetails(userId);
        setSelectedUser(updated);
      }
    } catch (err: any) {
      toast.error("Erro ao atualizar", err?.response?.data?.message || "Erro ao atualizar status");
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Gerenciar Usuarios
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Buscar, visualizar e gerenciar contas de usuarios
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              name="q"
              defaultValue={search}
              placeholder="Buscar por nome ou email..."
              className="input pl-10"
            />
          </div>
        </form>

        <div className="flex gap-2">
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setFilter("role", e.target.value)}
              className="appearance-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos os papeis</option>
              <option value="CLIENT">Cliente</option>
              <option value="PROFESSIONAL">Profissional</option>
              <option value="ADMIN">Admin</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setFilter("status", e.target.value)}
              className="appearance-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 pl-3 pr-8 text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos os status</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PENDING">Pendente</option>
              <option value="SUSPENDED">Suspenso</option>
              <option value="INACTIVE">Inativo</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum usuario encontrado"
          description="Tente ajustar os filtros de busca"
        />
      ) : (
        <>
          {/* Results count */}
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {pagination.total} usuario(s) encontrado(s)
          </p>

          {/* Users table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Papel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 md:table-cell">
                      Verificado
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 lg:table-cell">
                      Pedidos
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 lg:table-cell">
                      Cadastro
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-sm font-medium text-primary-700 dark:text-primary-400">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {u.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${ROLE_COLORS[u.role] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`badge ${STATUS_COLORS[u.status] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                        >
                          {STATUS_LABELS[u.status] || u.status}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {u.isVerified ? (
                          <Shield className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-slate-600 dark:text-slate-400 lg:table-cell">
                        {u._count.clientOrders + u._count.professionalOrders}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-slate-600 dark:text-slate-400 lg:table-cell">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openUserDetails(u.id)}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pagina {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn btn-outline btn-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn btn-outline btn-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* User Detail Modal */}
      {(selectedUser || loadingDetails) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Detalhes do usuario">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !loadingDetails && setSelectedUser(null)}
            aria-hidden="true"
          />
          <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>

            {loadingDetails ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
                <SkeletonText lines={3} />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ) : selectedUser ? (
              <div>
                {/* User header */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-xl font-bold text-primary-700 dark:text-primary-400">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedUser.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${ROLE_COLORS[selectedUser.role]}`}
                      >
                        {ROLE_LABELS[selectedUser.role]}
                      </span>
                      <span
                        className={`badge ${STATUS_COLORS[selectedUser.status]}`}
                      >
                        {STATUS_LABELS[selectedUser.status]}
                      </span>
                      {selectedUser.isVerified && (
                        <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Verificado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    {selectedUser.email}
                  </div>
                  {selectedUser.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      {selectedUser.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    Cadastro: {formatDate(selectedUser.createdAt)}
                  </div>
                  {selectedUser.ratingAverage > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Star className="h-4 w-4 text-yellow-400" />
                      {selectedUser.ratingAverage.toFixed(1)} (
                      {selectedUser.totalReviews} avaliacoes)
                    </div>
                  )}
                </div>

                {selectedUser.bio && (
                  <div className="mb-6">
                    <h3 className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Bio
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedUser.bio}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="mb-6 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedUser._count.clientOrders +
                        selectedUser._count.professionalOrders}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pedidos</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedUser._count.serviceListings}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Servicos</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(selectedUser.balance)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Saldo</p>
                  </div>
                </div>

                {/* Service listings (if professional) */}
                {selectedUser.serviceListings.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Servicos cadastrados
                    </h3>
                    <div className="space-y-2">
                      {selectedUser.serviceListings.slice(0, 5).map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {s.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(s.price)}
                            </span>
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                s.isAvailable ? "bg-green-500" : "bg-slate-300"
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status actions */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h3 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Alterar status
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.status !== "ACTIVE" && (
                      <button
                        onClick={() =>
                          handleStatusChange(selectedUser.id, "ACTIVE")
                        }
                        disabled={statusUpdating}
                        className="btn btn-sm btn-success flex items-center gap-1.5"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Ativar
                      </button>
                    )}
                    {selectedUser.status !== "SUSPENDED" && (
                      <button
                        onClick={() =>
                          handleStatusChange(selectedUser.id, "SUSPENDED")
                        }
                        disabled={statusUpdating}
                        className="btn btn-sm btn-danger flex items-center gap-1.5"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Suspender
                      </button>
                    )}
                    {selectedUser.status !== "INACTIVE" && (
                      <button
                        onClick={() =>
                          handleStatusChange(selectedUser.id, "INACTIVE")
                        }
                        disabled={statusUpdating}
                        className="btn btn-sm btn-outline flex items-center gap-1.5"
                      >
                        Desativar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
