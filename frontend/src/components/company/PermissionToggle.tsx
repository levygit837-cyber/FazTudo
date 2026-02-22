import React from "react";

interface Props {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const PermissionToggle: React.FC<Props> = ({ label, description, value, onChange, disabled }) => (
  <div className="flex items-start justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
    <div className="flex-1 mr-4">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
        value ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  </div>
);

export default PermissionToggle;
