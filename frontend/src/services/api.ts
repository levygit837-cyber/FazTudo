import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";

// ==================== CONFIGURAÇÃO ====================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Criar instância do Axios
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ==================== INTERCEPTORS ====================

// Request interceptor - adiciona token de autenticação
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - trata erros globalmente
let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Se receber 401, tentar refresh e depois redirecionar para login
    if (error.response?.status === 401 && !originalRequest._retry && !isRedirecting) {
      originalRequest._retry = true;

      // Não forçar logout/redirect se não havia token na request
      const hadToken = originalRequest.headers?.Authorization;
      if (!hadToken) {
        return Promise.reject(error);
      }

      // Tentar refresh token se disponível
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { token } = response.data.data;
          localStorage.setItem("token", token);

          // Refazer requisição original com novo token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        } catch {
          // Refresh falhou, fazer logout
        }
      }

      // Limpar e redirecionar (uma única vez)
      isRedirecting = true;
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
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
