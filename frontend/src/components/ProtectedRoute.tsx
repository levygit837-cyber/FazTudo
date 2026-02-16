import React, { useState } from "react";
import { Navigate, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import api from "../services/api";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  requireVerified?: boolean;
  redirectTo?: string;
  children?: React.ReactNode;
}

const AccountStatusScreen: React.FC<{
  user: { status: string; emailVerified?: boolean; name?: string };
  navigate: (path: string) => void;
}> = ({ user, navigate }) => {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { logout } = useAuth();

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await api.post("/auth/resend-verification");
      if (res.data.success) {
        setResendMessage("Email de verificação reenviado! Verifique sua caixa de entrada.");
      }
    } catch (err: any) {
      setResendMessage(
        err.response?.data?.message || "Erro ao reenviar email. Tente novamente."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const statusMessages: Record<string, { title: string; message: string }> = {
    PENDING: {
      title: "Verifique seu Email",
      message:
        "Enviamos um email de verificação para você. Clique no link do email para ativar sua conta.",
    },
    SUSPENDED: {
      title: "Conta Suspensa",
      message:
        "Sua conta foi suspensa. Entre em contato com o suporte para mais informações.",
    },
    INACTIVE: {
      title: "Conta Inativa",
      message:
        "Sua conta está inativa. Entre em contato com o suporte para reativá-la.",
    },
  };

  const statusInfo = statusMessages[user.status];

  if (!statusInfo) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {user.status === "PENDING" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            )}
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {statusInfo.title}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {statusInfo.message}
        </p>
        {resendMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            resendMessage.includes("reenviado")
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
              : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
          }`}>
            {resendMessage}
          </div>
        )}
        <div className="space-y-3">
          {user.status === "PENDING" && (
            <button
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="btn btn-primary w-full"
            >
              {resendLoading ? "Enviando..." : "Reenviar email de verificação"}
            </button>
          )}
          <button
            onClick={() => navigate("/contact")}
            className="btn btn-outline w-full"
          >
            Entrar em Contato
          </button>
          <button
            onClick={logout}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 underline"
          >
            Sair e usar outra conta
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles = [],
  requireVerified = true,
  redirectTo = "/login",
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    user,
    isProfessional,
    isClient,
    isAdmin,
  } = useAuth();

  // Se estiver carregando, mostrar loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loader w-12 h-12 border-4 border-primary-500 border-r-transparent mx-auto mb-4"></div>
          <p className="text-slate-600">
            Verificando autenticação...
          </p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, redirecionar para login
  if (!isAuthenticated) {
    return (
      <Navigate to={redirectTo} state={{ from: location.pathname }} replace />
    );
  }

  // Se precisar de verificação de email e usuário não está verificado
  if (requireVerified && user && !user.isVerified) {
    return (
      <Navigate
        to="/verify-email"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Se houver roles permitidas, verificar se o usuário tem alguma delas
  if (allowedRoles.length > 0 && user) {
    const hasAllowedRole = allowedRoles.some((role) => {
      switch (role) {
        case UserRole.PROFESSIONAL:
          return isProfessional;
        case UserRole.CLIENT:
          return isClient;
        case UserRole.ADMIN:
          return isAdmin;
        default:
          return false;
      }
    });

    if (!hasAllowedRole) {
      // Redirecionar para dashboard apropriado baseado no role do usuário
      let dashboardPath = "/";

      if (isProfessional) {
        dashboardPath = "/professional/dashboard";
      } else if (isClient) {
        dashboardPath = "/client/dashboard";
      } else if (isAdmin) {
        dashboardPath = "/admin/dashboard";
      }

      return <Navigate to={dashboardPath} replace />;
    }
  }

  // Verificar se conta está ativa
  if (user && user.status !== "ACTIVE") {
    return <AccountStatusScreen user={user} navigate={navigate} />;
  }

  // Se passar em todas as verificações, renderizar rotas filhas ou children
  return children ? <>{children}</> : <Outlet />;
};

// Helper hook para verificar permissões
export const useRoleCheck = () => {
  const { isProfessional, isClient, isAdmin, user } = useAuth();

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;

    return roles.some((role) => {
      switch (role) {
        case UserRole.PROFESSIONAL:
          return isProfessional;
        case UserRole.CLIENT:
          return isClient;
        case UserRole.ADMIN:
          return isAdmin;
        default:
          return false;
      }
    });
  };

  const hasAnyRole = (): boolean => {
    return isProfessional || isClient || isAdmin;
  };

  const requireVerified = (): boolean => {
    return user?.isVerified || false;
  };

  return {
    hasRole,
    hasAnyRole,
    requireVerified,
    isProfessional,
    isClient,
    isAdmin,
    user,
  };
};

// Higher Order Component para proteção de componentes
export const withProtectedRoute = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: UserRole[],
  requireVerified: boolean = true,
): React.FC<P> => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ProtectedRoute
        allowedRoles={allowedRoles}
        requireVerified={requireVerified}
      >
        <Component {...props} />
      </ProtectedRoute>
    );
  };

  // Preservar nome do componente para debugging
  WrappedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ProtectedRoute;
