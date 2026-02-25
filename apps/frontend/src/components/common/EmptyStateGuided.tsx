import React from "react";
import { Link } from "react-router";
import { LucideIcon } from "lucide-react";

interface Action {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

interface EmptyStateGuidedProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: Action[];
  tip?: string;
}

export const EmptyStateGuided: React.FC<EmptyStateGuidedProps> = ({
  icon: Icon,
  title,
  description,
  actions = [],
  tip,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-5">
        <Icon size={40} className="text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-6">{description}</p>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center">
          {actions.map((action, i) => {
            const classes = `btn ${action.variant === "secondary" ? "btn-secondary" : "btn-primary"}`;
            if (action.to) {
              return (
                <Link key={i} to={action.to} className={classes}>
                  {action.label}
                </Link>
              );
            }
            return (
              <button key={i} onClick={action.onClick} className={classes}>
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {tip && (
        <p className="mt-6 text-sm text-gray-400 dark:text-gray-500 max-w-xs">
          💡 {tip}
        </p>
      )}
    </div>
  );
};

export default EmptyStateGuided;
