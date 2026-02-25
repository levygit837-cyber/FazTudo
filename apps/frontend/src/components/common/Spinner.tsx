import React from "react";
import ModalPortal from "./ModalPortal";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className = "" }) => {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-primary-600 ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Carregando"
    >
      <span className="sr-only">Carregando...</span>
    </div>
  );
};

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = "Carregando...",
}) => {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-white dark:bg-slate-900 p-6 shadow-xl">
          <Spinner size="lg" />
          <p className="text-slate-700 dark:text-slate-300">{message}</p>
        </div>
      </div>
    </ModalPortal>
  );
};

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Carregando...",
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Spinner size="lg" />
      <p className="mt-4 text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
};

export default Spinner;
