import React, { useCallback, useEffect, useState } from "react";
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { SkeletonCard } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import {
  listVerifications,
  reviewVerification,
  VerificationSubmission,
} from "../../services/adminService";
import { formatDate } from "../../utils/formatters";
import { useToast } from "../../context/ToastContext";

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT: "Documento",
  FACIAL: "Facial",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  DOCUMENT: <FileText className="h-5 w-5" />,
  FACIAL: <Camera className="h-5 w-5" />,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: "Pendente",
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    icon: <Clock className="h-4 w-4" />,
  },
  APPROVED: {
    label: "Aprovado",
    color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  REJECTED: {
    label: "Rejeitado",
    color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    icon: <XCircle className="h-4 w-4" />,
  },
};

const AdminVerifications: React.FC = () => {
  const toast = useToast();
  const [verifications, setVerifications] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadVerifications = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        setError(null);
        const result = await listVerifications({
          page,
          limit: 20,
          status: activeTab,
        });
        setVerifications(result.items);
        setPagination(result.pagination);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || "Erro ao carregar verificacoes",
        );
      } finally {
        setLoading(false);
      }
    },
    [activeTab],
  );

  useEffect(() => {
    loadVerifications(1);
  }, [loadVerifications]);

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(true);
      await reviewVerification(id, "APPROVED");
      await loadVerifications(pagination.page);
    } catch (err: any) {
      toast.error("Erro na aprovacao", err?.response?.data?.message || "Erro ao aprovar verificacao");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    try {
      setActionLoading(true);
      await reviewVerification(rejectingId, "REJECTED", rejectionReason.trim());
      setRejectingId(null);
      setRejectionReason("");
      await loadVerifications(pagination.page);
    } catch (err: any) {
      toast.error("Erro na rejeicao", err?.response?.data?.message || "Erro ao rejeitar verificacao");
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { key: "PENDING" as const, label: "Pendentes" },
    { key: "APPROVED" as const, label: "Aprovadas" },
    { key: "REJECTED" as const, label: "Rejeitadas" },
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 dark:bg-secondary-900/30">
            <Shield className="h-5 w-5 text-secondary-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Verificacoes</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Aprovar ou rejeitar verificacoes de identidade
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : verifications.length === 0 ? (
        <EmptyState
          icon="search"
          title={`Nenhuma verificacao ${activeTab === "PENDING" ? "pendente" : activeTab === "APPROVED" ? "aprovada" : "rejeitada"}`}
          description={
            activeTab === "PENDING"
              ? "Todas as verificacoes foram processadas"
              : "Nenhum registro encontrado"
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {pagination.total} verificacao(oes) encontrada(s)
          </p>

          <div className="space-y-4">
            {verifications.map((v) => {
              const config = STATUS_CONFIG[v.status];
              return (
                <div
                  key={v.id}
                  className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
                >
                  {/* User info */}
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      {v.user.profileImage ? (
                        <img
                          src={v.user.profileImage}
                          alt={v.user.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {v.user.name}
                        </p>
                        {v.user.isVerified && (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{v.user.email}</p>
                    </div>
                  </div>

                  {/* Verification type */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {TYPE_ICONS[v.type]}
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {TYPE_LABELS[v.type] || v.type}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge flex items-center gap-1 ${config.color}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(v.submittedAt)}
                  </div>

                  {/* Actions */}
                  {v.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(v.id)}
                        disabled={actionLoading}
                        className="btn btn-sm btn-success flex items-center gap-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => setRejectingId(v.id)}
                        disabled={actionLoading}
                        className="btn btn-sm btn-danger flex items-center gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Rejeitar
                      </button>
                    </div>
                  )}

                  {/* Rejection reason */}
                  {v.status === "REJECTED" && v.rejectionReason && (
                    <div className="w-full rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400 sm:w-auto">
                      Motivo: {v.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pagina {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadVerifications(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn btn-outline btn-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => loadVerifications(pagination.page + 1)}
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

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setRejectingId(null);
              setRejectionReason("");
            }}
          />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Rejeitar Verificacao
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Informe o motivo da rejeicao. O usuario sera notificado.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motivo da rejeicao..."
              className="input mb-4 min-h-24"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason("");
                }}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionLoading}
                className="btn btn-danger"
              >
                {actionLoading ? "Rejeitando..." : "Confirmar rejeicao"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
