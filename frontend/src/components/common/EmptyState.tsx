import React from "react";
import { Search, Package, FileQuestion, AlertCircle } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: "search" | "package" | "question" | "alert" | React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const iconComponents = {
  search: Search,
  package: Package,
  question: FileQuestion,
  alert: AlertCircle,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = "package",
  action,
  className = "",
}) => {
  const IconComponent =
    typeof icon === "string" && icon in iconComponents
      ? iconComponents[icon as keyof typeof iconComponents]
      : null;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        {IconComponent ? (
          <IconComponent className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        ) : (
          icon
        )}
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
