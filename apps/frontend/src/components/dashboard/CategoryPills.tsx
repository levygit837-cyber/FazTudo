import React from "react";
import { Link } from "react-router";

export interface CategoryPillItem {
  id: string;
  name: string;
  count?: number;
  icon?: string;
}

export interface CategoryPillsProps {
  categories: CategoryPillItem[];
  maxItems?: number;
  onCategoryClick?: (id: string) => void;
  className?: string;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  maxItems = 8,
  className = "",
}) => {
  const visibleCategories = categories.slice(0, maxItems);

  if (visibleCategories.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visibleCategories.map((cat, index) => (
        <Link
          key={cat.id}
          to={`/services?category=${cat.id}`}
          className="
            inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full
            bg-slate-100 dark:bg-slate-800
            text-sm font-medium text-slate-700 dark:text-slate-300
            hover:bg-primary-50 hover:text-primary-700
            dark:hover:bg-primary-900/20 dark:hover:text-primary-300
            transition-all duration-200 hover:scale-105
            active:scale-100
          "
          style={{
            animation: `staggerFadeIn 250ms ease-out both`,
            animationDelay: `${index * 50}ms`,
          }}
        >
          {cat.icon && <span className="text-base leading-none">{cat.icon}</span>}
          <span>{cat.name}</span>
          {cat.count !== undefined && cat.count > 0 && (
            <span className="
              inline-flex items-center justify-center
              min-w-[20px] h-5 px-1.5 rounded-full
              text-xs font-semibold
              bg-slate-200 dark:bg-slate-700
              text-slate-600 dark:text-slate-400
            ">
              {cat.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};

export default CategoryPills;
