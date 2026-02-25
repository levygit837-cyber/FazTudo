import React, { useState, useEffect } from "react";
import {
  Star,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Zap,
  MessageCircle,
  ThumbsDown,
} from "lucide-react";
import { Link } from "react-router";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import {
  getReputationAnalytics,
  ReputationAnalytics,
} from "../../services/reputationService";
import { formatRelativeTime, formatRating } from "../../utils/formatters";

const CHURN_RISK_CONFIG = {
  LOW: {
    label: "Baixo",
    color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30",
    icon: Shield,
  },
  MEDIUM: {
    label: "Medio",
    color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    icon: AlertTriangle,
  },
  HIGH: {
    label: "Alto",
    color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
    icon: XCircle,
  },
};

const PRIORITY_CONFIG = {
  HIGH: { label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  MEDIUM: { label: "Media", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  LOW: { label: "Baixa", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  RESPONSE_TIME: <Zap className="w-5 h-5" />,
  COMPLETION_RATE: <CheckCircle className="w-5 h-5" />,
  QUALITY: <Star className="w-5 h-5" />,
  RELIABILITY: <Shield className="w-5 h-5" />,
  KEEP_GOING: <TrendingUp className="w-5 h-5" />,
};

const ProfessionalReputation: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReputationAnalytics | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const analytics = await getReputationAnalytics();
        setData(analytics);
      } catch (error) {
        console.error("Erro ao carregar reputacao:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <SkeletonDashboard />;
  if (!data) return null;

  const churnConfig = CHURN_RISK_CONFIG[data.churnRisk];
  const ChurnIcon = churnConfig.icon;

  const maxRatingCount = Math.max(...Object.values(data.ratingDistribution), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reputacao Profissional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Analise seu desempenho e descubra como melhorar seu ranking.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Rating Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Avaliacao Media</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatRating(data.averageRating)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">{data.totalReviews} avaliacoes</p>
        </div>

        {/* Completion Rate */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Taxa de Conclusao</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.completionRate}%
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {data.stats.completedOrders}/{data.stats.totalOrders} pedidos
          </p>
        </div>

        {/* Response Time */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Tempo de Resposta</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data.avgResponseTimeHours}h
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            {data.avgResponseTimeHours <= 2 ? "Excelente" : data.avgResponseTimeHours <= 4 ? "Bom" : "Precisa melhorar"}
          </p>
        </div>

        {/* Churn Risk */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${churnConfig.color}`}>
              <ChurnIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Risco de Churn</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {churnConfig.label}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Baseado nas ultimas 5 avaliacoes
          </p>
        </div>
      </div>

      {/* Churn Alert (only if HIGH) */}
      {data.churnRisk === "HIGH" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">
              Atencao: Risco alto de perda de clientes
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">
              Suas avaliacoes recentes estao abaixo da media. Siga as recomendacoes abaixo para melhorar.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Distribuicao de Avaliacoes
          </h2>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.ratingDistribution[star] || 0;
              const percentage = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{star}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        star >= 4 ? "bg-emerald-500" : star === 3 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Recomendacoes para Melhorar
          </h2>
          <div className="space-y-3">
            {data.recommendations.map((rec, idx) => {
              const priorityConfig = PRIORITY_CONFIG[rec.priority];
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 flex-shrink-0 mt-0.5">
                      {RECOMMENDATION_ICONS[rec.type] || <TrendingUp className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {rec.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Low Rating Reviews */}
      {data.lowRatingReviews.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsDown className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Avaliacoes com Notas Baixas
            </h2>
          </div>
          <div className="space-y-3">
            {data.lowRatingReviews.map((review) => (
              <div
                key={review.id}
                className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= review.rating
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-slate-500">
                      {formatRelativeTime(review.createdAt)}
                    </span>
                  </div>
                  <Link
                    to={`/professional/services/${review.serviceOrder.id}`}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Pedido #{review.serviceOrder.id}
                  </Link>
                </div>
                {review.comment && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MessageCircle className="w-3 h-3" />
                  <span>por {review.author.name}</span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>{review.serviceOrder.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalReputation;
