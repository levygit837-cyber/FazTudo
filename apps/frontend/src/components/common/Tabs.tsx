import React from "react";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: "underline" | "pill";
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "underline",
}) => {
  if (variant === "pill") {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary-600 text-white shadow-md shadow-primary-200 dark:shadow-primary-900/40"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Underline variant (default)
  return (
    <div
      className={`flex border-b border-slate-200 dark:border-slate-700 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
            activeTab === tab.id
              ? "text-primary-600 dark:text-primary-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                activeTab === tab.id
                  ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {tab.count}
            </span>
          )}
          {/* Active indicator line */}
          {activeTab === tab.id && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
