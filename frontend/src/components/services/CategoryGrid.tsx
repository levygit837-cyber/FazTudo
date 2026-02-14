import React from "react";
import { Link } from "react-router-dom";
import {
  Wrench,
  Leaf,
  Sparkles,
  Settings,
  Plug,
  Truck,
  Building,
  Building2,
  Laptop,
  Cog,
  Home,
  PawPrint,
  PartyPopper,
} from "lucide-react";
import { CategoryWithCounts } from "../../services/categoryService";

// Mapeamento de ícones
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  wrench: Wrench,
  leaf: Leaf,
  sparkles: Sparkles,
  settings: Settings,
  "plug-zap": Plug,
  truck: Truck,
  building: Building,
  "building-2": Building2,
  laptop: Laptop,
  cog: Cog,
  home: Home,
  "paw-print": PawPrint,
  "party-popper": PartyPopper,
};

interface CategoryCardProps {
  category: CategoryWithCounts;
  showCount?: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  showCount = true,
}) => {
  const IconComponent = category.icon
    ? iconMap[category.icon] || Settings
    : Settings;

  const serviceCount = category._count?.serviceListings || 0;

  return (
    <Link
      to={`/services?category=${category.id}`}
      className="card card-hover flex flex-col items-center text-center p-6 group"
    >
      <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30  flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
        <IconComponent className="w-7 h-7 text-primary-600" />
      </div>
      <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-1 group-hover:text-primary-600 transition-colors">
        {category.name}
      </h3>
      {showCount && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {serviceCount} {serviceCount === 1 ? "servico" : "servicos"}
        </p>
      )}
    </Link>
  );
};

interface CategoryGridProps {
  categories: CategoryWithCounts[];
  columns?: 2 | 3 | 4 | 6;
  showCount?: boolean;
  className?: string;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  columns = 4,
  showCount = true,
  className = "",
}) => {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          showCount={showCount}
        />
      ))}
    </div>
  );
};

// Lista expandível com subcategorias
interface CategoryListProps {
  categories: CategoryWithCounts[];
  className?: string;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  className = "",
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {categories.map((category) => {
        const IconComponent = category.icon
          ? iconMap[category.icon] || Settings
          : Settings;

        return (
          <div key={category.id}>
            {/* Categoria pai */}
            <Link
              to={`/services?category=${category.id}`}
              className="flex items-center gap-3 mb-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30  flex items-center justify-center">
                <IconComponent className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {category.description}
                  </p>
                )}
              </div>
            </Link>

            {/* Subcategorias */}
            {category.subcategories && category.subcategories.length > 0 && (
              <div className="ml-13 pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                  {category.subcategories.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/services?category=${sub.id}`}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 transition-colors"
                    >
                      {sub.name}
                      {sub._count?.serviceListings ? (
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                          ({sub._count.serviceListings})
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CategoryGrid;
