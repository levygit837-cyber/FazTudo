import React from "react";
import { Link } from "react-router";
import { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
}

interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

const variantClasses: Record<NonNullable<QuickAction["variant"]>, string> = {
  primary:
    "bg-primary-600 hover:bg-primary-700 text-white shadow-glow-blue focus-visible:ring-primary-500",
  secondary:
    "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 focus-visible:ring-slate-500",
  ghost:
    "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 focus-visible:ring-slate-400",
};

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  actions,
  className = "",
}) => {
  return (
    <nav
      className={`flex flex-wrap gap-2 mb-6 ${className}`}
      aria-label="Ações rápidas"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const variant = action.variant ?? "secondary";
        return (
          <Link
            key={action.to}
            to={action.to}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClasses[variant]}`}
          >
            <Icon size={16} aria-hidden="true" />
            {action.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default QuickActionBar;
