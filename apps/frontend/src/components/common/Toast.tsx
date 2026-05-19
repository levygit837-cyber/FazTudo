import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast, Toast as ToastType } from "../../context/ToastContext";

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap = {
  success: {
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-500 dark:text-green-400",
    title: "text-green-800 dark:text-green-200",
    message: "text-green-700 dark:text-green-300",
    progress: "bg-green-500",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-500 dark:text-red-400",
    title: "text-red-800 dark:text-red-200",
    message: "text-red-700 dark:text-red-300",
    progress: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-500 dark:text-amber-400",
    title: "text-amber-800 dark:text-amber-200",
    message: "text-amber-700 dark:text-amber-300",
    progress: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-500 dark:text-blue-400",
    title: "text-blue-800 dark:text-blue-200",
    message: "text-blue-700 dark:text-blue-300",
    progress: "bg-blue-500",
  },
};

const ToastItem: React.FC<{ toast: ToastType; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const Icon = iconMap[toast.type];
  const style = styleMap[toast.type];

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  // Auto-exit animation before removal
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 200);
      return () => clearTimeout(exitTimer);
    }
  }, [toast.duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border ${style.bg} ${style.border} shadow-lg backdrop-blur-sm transition-all duration-300 ${
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : "translate-x-8 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${style.title}`}>{toast.title}</p>
          {toast.message && (
            <p className={`mt-1 text-xs ${style.message}`}>{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Fechar notificacao"
        >
          <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="h-0.5 w-full bg-black/5 dark:bg-white/5">
          <div
            className={`h-full ${style.progress} transition-none`}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2"
      aria-label="Notificacoes"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>,
    document.body,
  );
};

export default ToastContainer;
