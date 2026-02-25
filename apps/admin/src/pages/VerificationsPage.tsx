import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Calendar,
  X,
  Loader2,
} from "lucide-react";
import {
  listVerifications,
  reviewVerification,
  type Verification,
  type PaginatedResponse,
} from "../services/adminService";

// ==================== Types ====================

type TabStatus = "PENDING" | "APPROVED" | "REJECTED";

// ==================== Helpers ====================

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock size={16} className="text-amber-500" />,
  APPROVED: <CheckCircle size={16} className="text-emerald-500" />,
  REJECTED: <XCircle size={16} className="text-red-500" />,
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  RG: "RG",
  CPF: "CPF",
  CNPJ: "CNPJ",
  CNH: "CNH",
  PASSPORT: "Passaporte",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==================== Skeleton ====================

const CardSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
  </div>
);

// ==================== Component ====================

const VerificationsPage: React.FC = () => {
  const [tab, setTab] = useState<TabStatus>("PENDING");
  const [data, setData] = useState<PaginatedResponse<Verification> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listVerifications(page, limit, tab);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar verificacoes"
      );
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await reviewVerification(id, "APPROVE");
      setToast("Verificacao aprovada com sucesso");
      setTimeout(() => setToast(null), 3000);
      void fetchData();
    } catch (err) {
      setToast(
        `Erro: ${err instanceof Error ? err.message : "Falha ao aprovar"}`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (rejectingId === null) return;
    setActionLoading(rejectingId);
    try {
      await reviewVerification(rejectingId, "REJECT", rejectReason || undefined);
      setRejectingId(null);
      setRejectReason("");
      setToast("Verificacao rejeitada");
      setTimeout(() => setToast(null), 3000);
      void fetchData();
    } catch (err) {
      setToast(
        `Erro: ${err instanceof Error ? err.message : "Falha ao rejeitar"}`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const verifications = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Verificacoes
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
        <ShieldCheck className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificacoes
        </h2>
        {data && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            ({data.total} total)
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(["PENDING", "APPROVED", "REJECTED"] as TabStatus[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {STATUS_ICON[t]}
            {t === "PENDING"
              ? "Pendentes"
              : t === "APPROVED"
                ? "Aprovadas"
                : "Rejeitadas"}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : verifications.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck
            size={48}
            className="text-slate-300 dark:text-slate-600 mb-3"
          />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-1">
            Nenhuma verificacao encontrada
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {tab === "PENDING"
              ? "Nao ha verificacoes pendentes no momento"
              : `Nenhuma verificacao com status ${tab.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {verifications.map((v) => (
            <div key={v.id} className="card hover:shadow-lg transition-shadow">
              {/* User info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-sm shrink-0">
                  <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {v.userName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {v.userEmail}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    STATUS_BADGE[v.status] ?? STATUS_BADGE.PENDING
                  }`}
                >
                  {STATUS_ICON[v.status]}
                  {v.status}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    Tipo:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {DOC_TYPE_LABEL[v.documentType] ?? v.documentType}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400">
                    Enviado:
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {formatDate(v.submittedAt)}
                  </span>
                </div>
                {v.reviewedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-400">
                      Revisado:
                    </span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {formatDate(v.reviewedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {v.status === "PENDING" && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => void handleApprove(v.id)}
                    disabled={actionLoading === v.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading === v.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Aprovar
                  </button>
                  <button
                    onClick={() => setRejectingId(v.id)}
                    disabled={actionLoading === v.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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

      {/* Rejection Modal */}
      {rejectingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Rejeitar Verificacao
              </h3>
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Informe o motivo da rejeicao para o usuario:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeicao..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleReject()}
                disabled={actionLoading === rejectingId}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {actionLoading === rejectingId && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Rejeitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationsPage;
