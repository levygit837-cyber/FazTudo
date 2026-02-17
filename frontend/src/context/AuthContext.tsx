import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
  isVerified: boolean;
  profileImage?: string;
  bio?: string;
  ratingAverage: number;
  totalReviews: number;
  balance: number;
  document?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "CLIENT" | "PROFESSIONAL";
  document?: string;
}

export interface RegisterOptions {
  redirectOnSuccess?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: any[];
  timestamp?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData, options?: RegisterOptions) => Promise<User>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  isProfessional: boolean;
  isClient: boolean;
  isAdmin: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const navigate = useNavigate();

  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        // Clear invalid storage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        token: null,
      }));
      return;
    }

    try {
      const response = await api.get<AuthResponse>("/auth/profile");
      const user = response.data.data.user;

      localStorage.setItem("user", JSON.stringify(user));
      setState((prev) => ({
        ...prev,
        user,
        token,
        isAuthenticated: true,
        error: null,
      }));
    } catch (error) {
      // Token is invalid or expired
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        token: null,
        error: "Sessão expirada. Faça login novamente.",
      }));
    }
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.post<AuthResponse>("/auth/login", credentials);
      const { user, token } = response.data.data;

      // Store in localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      if ((response.data.data as any).refreshToken) {
        localStorage.setItem("refreshToken", (response.data.data as any).refreshToken);
      }

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Redirect based on role
      if (user.role === "PROFESSIONAL") {
        navigate("/professional/dashboard");
      } else if (user.role === "CLIENT") {
        navigate("/client/dashboard");
      } else if (user.role === "ADMIN") {
        navigate("/admin/dashboard");
      }
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
  };

  // Register function
  const register = async (
    data: RegisterData,
    options: RegisterOptions = {},
  ): Promise<User> => {
    const { redirectOnSuccess = true } = options;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.post<AuthResponse>("/auth/register", data);
      const { user, token } = response.data.data;

      // Store in localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      if ((response.data.data as any).refreshToken) {
        localStorage.setItem("refreshToken", (response.data.data as any).refreshToken);
      }

      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      if (redirectOnSuccess) {
        // Redirect based on role
        if (user.role === "PROFESSIONAL") {
          navigate("/professional/dashboard");
        } else {
          navigate("/client/dashboard");
        }
      }

      return user;
    } catch (error) {
      const axiosError = error as AxiosError<ApiError>;
      const errorMessage =
        axiosError.response?.data?.message || "Erro ao registrar";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("refreshToken");

    // Reset state
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    // Navigate to login
    navigate("/login");
  };

  // Update user profile
  const updateProfile = (userData: Partial<User>) => {
    if (!state.user) return;

    const updatedUser = { ...state.user, ...userData };

    // Update localStorage
    localStorage.setItem("user", JSON.stringify(updatedUser));

    setState((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  };

  // Clear error message
  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  // Helper properties
  const isProfessional = state.user?.role === "PROFESSIONAL";
  const isClient = state.user?.role === "CLIENT";
  const isAdmin = state.user?.role === "ADMIN";

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    clearError,
    checkAuth,
    isProfessional,
    isClient,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
