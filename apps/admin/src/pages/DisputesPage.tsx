import React, { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Search as SearchIcon,
  Shield,
} from "lucide-react";
import {
  listDisputes,
  resolveDispute,
  type Dispute,
  type PaginatedResponse,
} from "../services/adminService";

// ==================== Types ====================

type TabStatus = "" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
type ResolutionAction =
  | "FAVOR_CLIENT"
  | "FAVOR_PROFESSIONAL"
  | "MUTUAL_AGREEMENT";

// ==================== Helpers ====================

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  UNDER_REVIEW:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  RESOLVED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  CLOSED: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN: <AlertTriangle size={14} className="text-amber-500" />,
  UNDER_REVIEW: <SearchIcon size={14} className="text-blue-500" />,
  RESOLVED: <CheckCircle size={14} className="text-emerald-500" />,
  CLOSED: <XCircle size={14} className="text-slate-400" />,
};

const ACTION_LABELS: Record<ResolutionAction, string> = {
  FAVOR_CLIENT: "Favor do Cliente",
  FAVOR_PROFESSIONAL: "Favor do Profissional",
  MUTUAL_AGREEMENT: "Acordo Mutuo",
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
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
      </td>
    ))}
  </tr>
);

// ==================== Component ====================

const DisputesPage: React.FC = () => {
  const [tab, setTab] = useState<TabStatus>("");
  const [data, setData] = useState<PaginatedResponse<Dispute> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 15;

  // Resolve modal
  const [resolvingDispute, setResolvingDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionAction, setResolutionAction] =
    useState<ResolutionAction>("FAVOR_CLIENT");
  const [resolveLoading, setResolveLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDisputes(page, limit, tab || undefined);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar disputas"
      );
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleResolve = async () => {
    if (!resolvingDispute || !resolution.trim()) return;
    setResolveLoading(true);
    try {
      await resolveDispute(resolvingDispute.id, resolution, resolutionAction);
      setResolvingDispute(null);
      setResolution("");
      setToast("Disputa resolvida com sucesso");
      setTimeout(() => setToast(null), 3000);
      void fetchData();
    } catch (err) {
      setToast(
        `Erro: ${err instanceof Error ? err.message : "Falha ao resolver"}`
      );
    } finally {
      setResolveLoading(false);
    }
  };

  const disputes = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  const tabs: { value: TabStatus; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "OPEN", label: "Abertas" },
    { value: "UNDER_REVIEW", label: "Em Analise" },
    { value: "RESOLVED", label: "Resolvidas" },
    { value: "CLOSED", label: "Encerradas" },
  ];

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Disputas
          </h2>
        </div>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => void fetchData()}
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.startsWith("Erro")
              ? "bg-red-500 text-white"
              : "bg-emerald-500 text-white"
          }`}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Disputas
        </h2>
        {data && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            ({data.total} total)
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.value
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {t.value && STATUS_ICON[t.value]}
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Profissional
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
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
                : disputes.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {d.orderTitle}
                          </span>
                          <p className="text-xs text-slate-400">
                            #{d.orderId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {d.clientName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {d.professionalName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px]">
                        <span className="truncate block">{d.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[d.status] ?? STATUS_BADGE.OPEN
                          }`}
                        >
                          {STATUS_ICON[d.status]}
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatDate(d.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {(d.status === "OPEN" ||
                          d.status === "UNDER_REVIEW") && (
                          <button
                            onClick={() => setResolvingDispute(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
                          >
                            <Shield size={12} />
                            Resolver
                          </button>
                        )}
                        {d.status !== "OPEN" &&
                          d.status !== "UNDER_REVIEW" && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!loading && disputes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock
              size={40}
              className="text-slate-300 dark:text-slate-600 mb-3"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma disputa encontrada
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pagina {page} de {totalPages}
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

      {/* Resolve Modal */}
      {resolvingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Resolver Disputa
              </h3>
              <button
                onClick={() => {
                  setResolvingDispute(null);
                  setResolution("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dispute summary */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                {resolvingDispute.orderTitle}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {resolvingDispute.clientName} vs{" "}
                {resolvingDispute.professionalName}
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                <strong>Motivo:</strong> {resolvingDispute.reason}
              </p>
            </div>

            {/* Action select */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Acao
              </label>
              <select
                value={resolutionAction}
                onChange={(e) =>
                  setResolutionAction(e.target.value as ResolutionAction)
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {(Object.entries(ACTION_LABELS) as [ResolutionAction, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Resolution text */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Resolucao
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Descreva a resolucao da disputa..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setResolvingDispute(null);
                  setResolution("");
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleResolve()}
                disabled={resolveLoading || !resolution.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resolveLoading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Resolver Disputa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputesPage;
