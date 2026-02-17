import React, { useState, useEffect } from "react";
import { Building2, Check, X, Clock } from "lucide-react";
import api from "../../services/api";
import { PendingCompany } from "../../types";
import { useToast } from "../../context/ToastContext";

const CompanyVerifications: React.FC = () => {
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const toast = useToast();

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/companies/pending");
      setCompanies(res.data.data);
    } catch {
      toast.error("Erro ao carregar empresas pendentes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);

  const handleVerify = async (companyId: number, approved: boolean) => {
    try {
      setProcessing(companyId);
      await api.post(`/admin/companies/${companyId}/verify`, { approved });
      toast.success(approved ? "Empresa verificada!" : "Verificação recusada");
      setCompanies(prev => prev.filter(c => c.id !== companyId));
    } catch {
      toast.error("Erro ao processar verificação");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-28 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificação de Empresas
        </h1>
        {companies.length > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            {companies.length} pendente{companies.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-16">
          <Check className="h-12 w-12 mx-auto text-green-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Nenhuma empresa pendente</h3>
          <p className="text-slate-500">Todas as solicitações de verificação foram processadas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map(company => (
            <div key={company.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{company.companyName}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                      <Clock className="h-3 w-3" />
                      Pendente
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    CNPJ: {company.cnpj} · {company.industry || "Setor não informado"}
                  </p>
                  <p className="text-sm text-slate-500">
                    Responsável: {company.user.name} ({company.user.email})
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {company._count.members} membro{company._count.members !== 1 ? "s" : ""}
                  </p>
                  {company.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{company.description}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleVerify(company.id, false)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors disabled:opacity-50"
                    title="Recusar verificação"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleVerify(company.id, true)}
                    disabled={processing === company.id}
                    className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors disabled:opacity-50"
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

export default CompanyVerifications;
