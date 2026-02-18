import React from "react";
import { Link } from "react-router";
import { Star, Clock, Heart, BadgeCheck, Briefcase, TrendingUp, Zap } from "lucide-react";
import { formatCurrency, formatRating } from "../../utils/formatters";
import { useFavorites } from "../../hooks/useFavorites";

interface ServiceCardProps {
  id: number;
  title: string;
  description: string;
  price: number;
  estimatedHours?: number;
  images?: string[];
  professional: {
    id: number;
    name: string;
    profileImage?: string;
    ratingAverage: number;
    totalReviews: number;
  };
  category: {
    id: number;
    name: string;
    icon?: string;
  };
  isVerified?: boolean;
  completedJobs?: number;
  completionRate?: number;
  avgResponseTimeHours?: number;
  className?: string;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  id,
  title,
  description,
  price,
  estimatedHours,
  images,
  professional,
  category,
  isVerified = false,
  completedJobs,
  completionRate,
  avgResponseTimeHours,
  className = "",
}) => {
  const { isFavorite, toggleFavorite } = useFavorites();

  const imageUrl =
    images && images.length > 0 ? images[0] : "/placeholder-service.jpg";

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id);
  };

  const favorited = isFavorite(id);

  return (
    <Link
      to={`/services/${id}`}
      className={`card card-hover block group ${className}`}
    >
      {/* Imagem */}
      <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder-service.jpg";
          }}
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span className="badge badge-primary text-xs backdrop-blur-sm">
            {category.name}
          </span>
        </div>

        {/* Favorite button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart
            className={`h-4 w-4 transition-all ${
              favorited ? "fill-red-500 text-red-500 scale-110" : "fill-transparent"
            }`}
          />
        </button>

        {/* Completed jobs count */}
        {completedJobs != null && completedJobs > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1 text-white text-[0.6875rem] font-medium">
            <Briefcase className="h-3 w-3" />
            {completedJobs} servicos
          </div>
        )}
      </div>

      {/* Conteudo */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Titulo */}
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-[0.9375rem]">
          {title}
        </h3>

        {/* Descricao */}
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {description}
        </p>

        {/* Profissional */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              {professional.profileImage ? (
                <img
                  src={professional.profileImage}
                  alt={professional.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                  {professional.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Online indicator dot */}
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Link
                to={`/profissional/${professional.id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {professional.name}
              </Link>
              {isVerified && (
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {formatRating(professional.ratingAverage)} (
                {professional.totalReviews})
              </span>
            </div>
          </div>
        </div>

        {/* Trust signals */}
        {(completionRate != null || avgResponseTimeHours != null) && (
          <div className="flex flex-wrap gap-1.5">
            {completionRate != null && completionRate > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                <TrendingUp className="w-3 h-3" />
                {completionRate}% concluídos
              </span>
            )}
            {avgResponseTimeHours != null && avgResponseTimeHours > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20">
                <Zap className="w-3 h-3" />
                Responde em ~{avgResponseTimeHours}h
              </span>
            )}
          </div>
        )}

        {/* Rodape */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50">
          <div>
            <span className="text-[0.6875rem] text-slate-500 dark:text-slate-500 block">
              a partir de
            </span>
            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(price)}
            </span>
            {estimatedHours && (
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                / ~{estimatedHours}h
              </span>
            )}
          </div>
          {estimatedHours && (
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{estimatedHours}h estimadas</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ServiceCard;
