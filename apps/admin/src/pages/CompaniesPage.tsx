import React, { useState, useEffect, useCallback } from "react";
import { Building2, Check, X, Clock, RefreshCw } from "lucide-react";
import api from "../services/api";

interface PendingCompany {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  industry?: string;
  createdAt: string;
  isVerified: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
    createdAt: string;
  };
  _count: { members: number };
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: PendingCompany[] }>(
        "/admin/companies/pending"
      );
      setCompanies(res.data.data ?? []);
    } catch {
      showFeedback("error", "Erro ao carregar empresas pendentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleVerify = async (companyId: number, approved: boolean) => {
    try {
      setProcessing(companyId);
      await api.post(`/admin/companies/${companyId}/verify`, { approved });
      showFeedback(
        "success",
        approved ? "Empresa verificada com sucesso!" : "Verificação recusada."
      );
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    } catch {
      showFeedback("error", "Erro ao processar verificação. Tente novamente.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary-500" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Verificação de Empresas
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aprovar ou recusar cadastros de empresas pendentes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {companies.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-sm font-medium">
              {companies.length} pendente{companies.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={loadCompanies}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            title="Recarregar"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && companies.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">
            Nenhuma empresa pendente
          </h3>
          <p className="text-slate-500">
            Todas as solicitações de verificação foram processadas.
          </p>
        </div>
      )}

      {/* Companies list */}
      {!loading && companies.length > 0 && (
        <div className="space-y-3">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-slate-900 border border-slate-800/50 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-100 truncate">
                      {company.companyName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs shrink-0">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    CNPJ: {company.cnpj}
                    {company.industry ? ` · ${company.industry}` : ""}
                  </p>
                  <p className="text-sm text-slate-400">
                    Responsável: {company.user.name} ({company.user.email})
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {company._count.members} membro
                    {company._count.members !== 1 ? "s" : ""}
                  </p>
                  {company.description && (
                    <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleVerify(company.id, false)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    title="Recusar verificação"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleVerify(company.id, true)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    title="Aprovar verificação"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompaniesPage;
