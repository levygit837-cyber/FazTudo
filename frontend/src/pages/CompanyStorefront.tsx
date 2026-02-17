import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, Globe, Phone, Star } from "lucide-react";
import api from "../services/api";
import { CompanyProfile } from "../types";

const CompanyStorefront: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<CompanyProfile & { user: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/company/storefront/${companyId}`)
      .then(r => setCompany(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="container mx-auto px-4 py-12 text-center">Carregando...</div>;
  if (!company) return <div className="container mx-auto px-4 py-12 text-center">Empresa não encontrada</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="card p-8 mb-6">
        <div className="flex items-start gap-6">
          {company.logo ? (
            <img src={company.logo} alt={company.companyName} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="h-12 w-12 text-blue-600" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{company.companyName}</h1>
            {company.isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium mt-1">
                <Building2 className="h-3 w-3" /> Empresa Verificada
              </span>
            )}
            {company.industry && <p className="text-sm text-slate-500 mt-1">{company.industry}</p>}
            {company.description && <p className="text-slate-600 dark:text-slate-400 mt-3">{company.description}</p>}
            <div className="flex items-center gap-4 mt-3">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                  <Globe className="h-4 w-4" /> {company.website}
                </a>
              )}
              {company.phone && (
                <span className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <Phone className="h-4 w-4" /> {company.phone}
                </span>
              )}
            </div>
          </div>
          {company.user && (
            <div className="text-right">
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-semibold">{company.user.ratingAverage?.toFixed(1) || "0.0"}</span>
              </div>
              <p className="text-xs text-slate-500">{company.user.totalReviews || 0} avaliações</p>
            </div>
          )}
        </div>
      </div>

      {company.user?.serviceListings?.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">Serviços Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company.user.serviceListings.map((service: any) => (
              <div key={service.id} className="card p-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{service.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{service.category?.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-blue-600">
                    R$ {service.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <a href={`/services/${service.id}`} className="btn btn-primary btn-sm">
                    Contratar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyStorefront;
