import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Star, CheckCircle, Briefcase, Award, MessageCircle } from "lucide-react";
import api from "../services/api";
import { ProfessionalStorefront } from "../types";
import { formatCurrency, formatRating } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";

const ProfessionalStorefrontPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<ProfessionalStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/services/professional/${userId}/storefront`);
        setData(res.data.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Profissional não encontrado");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="card h-48 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-2xl mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="card h-36 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-slate-500">{error || "Profissional não encontrado"}</p>
        <button onClick={() => navigate(-1)} className="btn btn-ghost mt-4">Voltar</button>
      </div>
    );
  }

  const { user, services, stats, recentReviews } = data;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 overflow-hidden">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              user.name.charAt(0)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h1>
              {user.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  <CheckCircle className="h-3 w-3" />
                  Verificado
                </span>
              )}
            </div>
            {user.bio && <p className="text-slate-500 mt-1 text-sm">{user.bio}</p>}

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-semibold text-sm">{formatRating(user.ratingAverage)}</span>
                <span className="text-slate-400 text-sm">({user.totalReviews} avaliações)</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500 text-sm">
                <Briefcase className="h-4 w-4" />
                {stats.completedOrders} serviços concluídos
              </div>
            </div>

            {user.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {user.categories.map(cat => (
                  <span key={cat.category.id} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                    {cat.category.icon} {cat.category.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {user.certifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <Award className="h-4 w-4" />
              Certificações
            </div>
            <div className="flex flex-wrap gap-2">
              {user.certifications.map(cert => (
                <span key={cert.id} className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
                  {cert.title} — {cert.issuer}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
        Serviços ({services.length})
      </h2>
      {services.length === 0 ? (
        <p className="text-slate-500 text-sm mb-6">Nenhum serviço disponível no momento.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {services.map(service => (
            <Link
              key={service.id}
              to={`/services/${service.id}`}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 mr-3">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{service.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{service.category.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{service.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(service.price)}</p>
                  {service.estimatedHours && (
                    <p className="text-xs text-slate-400 mt-0.5">{service.estimatedHours}h</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {recentReviews.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Avaliações Recentes</h2>
          <div className="space-y-3 mb-8">
            {recentReviews.map(review => (
              <div key={review.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
                    {review.author.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{review.author.name}</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "text-amber-400 fill-current" : "text-slate-300"}`} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {isAuthenticated && (
        <div className="fixed bottom-6 right-6">
          <Link
            to={`/services?professional=${userId}`}
            className="btn btn-primary shadow-lg flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Ver serviços
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProfessionalStorefrontPage;
