import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AxiosError } from "axios";
import api, { ApiResponse } from "../services/api";

// ==================== Types ====================

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "ADMIN";
  status: string;
  profileImage?: string;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

interface ApiError {
  success: false;
  message: string;
}

interface LoginResponseData {
  user: AdminUser;
  token: string;
}

// ==================== Context ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const userStr = localStorage.getItem("admin_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AdminUser;
        if (user.role !== "ADMIN") {
          throw new Error("Not an admin");
        }
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.post<ApiResponse<LoginResponseData>>(
        "/admin/login",
        { email, password }
      );
      const { user, token } = response.data.data;

      if (user.role !== "ADMIN") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Acesso negado. Apenas administradores podem acessar este painel.",
        }));
        return;
      }

      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(user));

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      const errorMessage =
        axiosError.response?.data?.message || "Erro ao fazer login";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
