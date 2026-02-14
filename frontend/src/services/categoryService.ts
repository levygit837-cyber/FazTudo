import api, { ApiResponse, extractData } from "./api";
import { ServiceCategory, ServiceCategoryType } from "../types";

// ==================== TIPOS ====================

export interface CategoryListParams {
  type?: ServiceCategoryType;
  parentOnly?: boolean;
  includeSubcategories?: boolean;
}

export interface CategorySearchParams {
  q: string;
  type?: ServiceCategoryType;
}

export interface CategoryWithCounts extends ServiceCategory {
  _count?: {
    serviceListings: number;
    professionalCategories: number;
    subcategories?: number;
  };
  subcategories?: CategoryWithCounts[];
  parentCategory?: ServiceCategory;
}

export interface CategoryTreeResponse {
  all: CategoryWithCounts[];
  homeServices: CategoryWithCounts[];
  businessServices: CategoryWithCounts[];
  totalCategories: number;
  totalSubcategories: number;
}

// ==================== SERVIÇOS ====================

/**
 * Lista todas as categorias
 */
export const listCategories = async (
  params?: CategoryListParams,
): Promise<{ categories: CategoryWithCounts[]; total: number }> => {
  const response = await api.get<
    ApiResponse<{ categories: CategoryWithCounts[]; total: number }>
  >("/categories", { params });
  return extractData(response);
};

/**
 * Obtém categoria por ID
 */
export const getCategoryById = async (
  id: number,
): Promise<CategoryWithCounts> => {
  const response = await api.get<ApiResponse<CategoryWithCounts>>(
    `/categories/${id}`,
  );
  return extractData(response);
};

/**
 * Obtém categoria por nome/slug
 */
export const getCategoryByName = async (
  name: string,
): Promise<CategoryWithCounts> => {
  const encodedName = encodeURIComponent(name);
  const response = await api.get<ApiResponse<CategoryWithCounts>>(
    `/categories/slug/${encodedName}`,
  );
  return extractData(response);
};

/**
 * Obtém categorias principais para home page
 */
export const getMainCategories = async (
  type?: ServiceCategoryType,
  limit?: number,
): Promise<{ categories: CategoryWithCounts[]; total: number }> => {
  const params: Record<string, any> = {};
  if (type) params.type = type;
  if (limit) params.limit = limit;

  const response = await api.get<
    ApiResponse<{ categories: CategoryWithCounts[]; total: number }>
  >("/categories/main", { params });
  return extractData(response);
};

/**
 * Busca categorias
 */
export const searchCategories = async (
  params: CategorySearchParams,
): Promise<{
  categories: CategoryWithCounts[];
  total: number;
  searchTerm: string;
}> => {
  const response = await api.get<
    ApiResponse<{
      categories: CategoryWithCounts[];
      total: number;
      searchTerm: string;
    }>
  >("/categories/search", { params });
  return extractData(response);
};

/**
 * Obtém árvore completa de categorias
 */
export const getCategoryTree = async (
  type?: ServiceCategoryType,
): Promise<CategoryTreeResponse> => {
  const params = type ? { type } : undefined;
  const response = await api.get<ApiResponse<CategoryTreeResponse>>(
    "/categories/tree",
    { params },
  );
  return extractData(response);
};

/**
 * Obtém categorias populares
 */
export const getPopularCategories = async (
  limit?: number,
  type?: ServiceCategoryType,
): Promise<{ categories: CategoryWithCounts[]; total: number }> => {
  const params: Record<string, any> = {};
  if (limit) params.limit = limit;
  if (type) params.type = type;

  const response = await api.get<
    ApiResponse<{ categories: CategoryWithCounts[]; total: number }>
  >("/categories/popular", { params });
  return extractData(response);
};

export default {
  listCategories,
  getCategoryById,
  getCategoryByName,
  getMainCategories,
  searchCategories,
  getCategoryTree,
  getPopularCategories,
};
