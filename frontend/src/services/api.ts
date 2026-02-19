import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

// ==================== CONFIGURAÇÃO ====================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Criar instância do Axios
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Send httpOnly cookies automatically
  headers: {
    "Content-Type": "application/json",
  },
});

// ==================== INTERCEPTORS ====================

// Request interceptor - adds token from localStorage as fallback (cookies are preferred)
api.interceptors.request.use(
  (config) => {
    // Only add Authorization header as backward compat fallback
    // httpOnly cookies are sent automatically via withCredentials
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Prevent stale 304 responses by disabling GET cache
    if (config.method === "get") {
      config.headers["Cache-Control"] = "no-cache";
      config.headers["Pragma"] = "no-cache";
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - trata erros globalmente
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Só tentar refresh se recebeu 401 e tinha token na request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const hadToken = originalRequest.headers?.Authorization;
    if (!hadToken) {
      return Promise.reject(error);
    }

    // Se já estamos fazendo refresh, enfileirar a request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refreshToken");
    // Try refresh — cookie-based refresh is sent automatically via withCredentials
    // localStorage refreshToken is kept as backward compat fallback
    if (!refreshToken) {
      // Even without localStorage refreshToken, try cookie-based refresh
      // The httpOnly cookie will be sent automatically
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken: refreshToken || undefined },
        { withCredentials: true },
      );
      const { token, refreshToken: _newRefreshToken } = response.data.data;

      localStorage.setItem("token", token);
      // Don't store refreshToken in localStorage — it's in httpOnly cookie now

      processQueue(null, token);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh falhou — agora sim, limpar e redirecionar
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/login";

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ==================== TIPOS ====================

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: any[];
}

// ==================== HELPERS ====================

/**
 * Extrai dados da resposta da API
 */
export const extractData = <T>(response: { data: ApiResponse<T> }): T => {
  return response.data.data;
};

/**
 * Trata erro da API e retorna mensagem amigável
 */
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError | undefined;
    return apiError?.message || error.message || "Erro ao conectar com o servidor";
  }
  return "Erro desconhecido";
};

// ==================== EXPORTS ====================

export default api;
export { API_BASE_URL };
