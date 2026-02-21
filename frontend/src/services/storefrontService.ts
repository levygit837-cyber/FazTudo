import api, { ApiResponse, extractData } from "./api";
import {
  Storefront,
  StorefrontListItem,
  StorefrontDetail,
  StorefrontCategory,
  StorefrontService,
  StorefrontServiceOption,
  StorefrontFilters,
  CreateStorefrontInput,
  UpdateStorefrontInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
  CreateServiceInput,
  UpdateServiceInput,
  CreateOptionInput,
  UpdateOptionInput,
  CartCheckoutInput,
  ServiceOrderItem,
} from "../types";
import { ServiceOrder } from "../types";

// ==================== TIPOS INTERNOS ====================

interface StorefrontListData {
  items: StorefrontListItem[];
  total: number;
  page: number;
  totalPages: number;
}

// ==================== PUBLIC ENDPOINTS ====================

/**
 * Lista vitrines publicadas (publico)
 */
export const listStorefronts = async (
  filters?: StorefrontFilters,
): Promise<StorefrontListData> => {
  const response = await api.get<ApiResponse<StorefrontListData>>(
    "/storefronts",
    { params: filters },
  );
  return extractData(response);
};

/**
 * Obtem detalhes de uma vitrine por slug (publico)
 */
export const getStorefrontBySlug = async (
  slug: string,
): Promise<StorefrontDetail> => {
  const response = await api.get<ApiResponse<StorefrontDetail>>(
    `/storefronts/${slug}`,
  );
  return extractData(response);
};

// ==================== MANAGEMENT (AUTH REQUIRED) ====================

/**
 * Obtem a vitrine do usuario logado
 */
export const getMyStorefront = async (): Promise<Storefront | null> => {
  const response = await api.get<ApiResponse<Storefront | null>>(
    "/storefronts/mine",
  );
  return extractData(response);
};

/**
 * Cria vitrine para o usuario logado
 */
export const createStorefront = async (
  data: CreateStorefrontInput,
): Promise<Storefront> => {
  const response = await api.post<ApiResponse<Storefront>>(
    "/storefronts",
    data,
  );
  return extractData(response);
};

/**
 * Atualiza vitrine do usuario logado
 */
export const updateStorefront = async (
  data: UpdateStorefrontInput,
): Promise<Storefront> => {
  const response = await api.put<ApiResponse<Storefront>>(
    "/storefronts/mine",
    data,
  );
  return extractData(response);
};

/**
 * Publica ou despublica a vitrine
 */
export const publishStorefront = async (
  isPublished: boolean,
): Promise<Storefront> => {
  const response = await api.put<ApiResponse<Storefront>>(
    "/storefronts/mine/publish",
    { isPublished },
  );
  return extractData(response);
};

// ==================== CATEGORIES ====================

/**
 * Lista categorias da vitrine do usuario
 */
export const listMyCategories = async (): Promise<StorefrontCategory[]> => {
  const response = await api.get<ApiResponse<StorefrontCategory[]>>(
    "/storefronts/mine/categories",
  );
  return extractData(response);
};

/**
 * Cria categoria na vitrine
 */
export const createCategory = async (
  data: CreateCategoryInput,
): Promise<StorefrontCategory> => {
  const response = await api.post<ApiResponse<StorefrontCategory>>(
    "/storefronts/mine/categories",
    data,
  );
  return extractData(response);
};

/**
 * Atualiza categoria da vitrine
 */
export const updateCategory = async (
  categoryId: number,
  data: UpdateCategoryInput,
): Promise<StorefrontCategory> => {
  const response = await api.put<ApiResponse<StorefrontCategory>>(
    `/storefronts/mine/categories/${categoryId}`,
    data,
  );
  return extractData(response);
};

/**
 * Reordena categorias da vitrine
 */
export const reorderCategories = async (
  data: ReorderCategoriesInput,
): Promise<void> => {
  await api.put("/storefronts/mine/categories/reorder", data);
};

/**
 * Remove categoria da vitrine
 */
export const deleteCategory = async (categoryId: number): Promise<void> => {
  await api.delete(`/storefronts/mine/categories/${categoryId}`);
};

// ==================== SERVICES ====================

/**
 * Lista servicos da vitrine do usuario
 */
export const listMyServices = async (): Promise<StorefrontService[]> => {
  const response = await api.get<ApiResponse<StorefrontService[]>>(
    "/storefronts/mine/services",
  );
  return extractData(response);
};

/**
 * Cria servico na vitrine
 */
export const createService = async (
  data: CreateServiceInput,
): Promise<StorefrontService> => {
  const response = await api.post<ApiResponse<StorefrontService>>(
    "/storefronts/mine/services",
    data,
  );
  return extractData(response);
};

/**
 * Atualiza servico da vitrine
 */
export const updateService = async (
  serviceId: number,
  data: UpdateServiceInput,
): Promise<StorefrontService> => {
  const response = await api.put<ApiResponse<StorefrontService>>(
    `/storefronts/mine/services/${serviceId}`,
    data,
  );
  return extractData(response);
};

/**
 * Remove servico da vitrine
 */
export const deleteService = async (serviceId: number): Promise<void> => {
  await api.delete(`/storefronts/mine/services/${serviceId}`);
};

// ==================== OPTIONS ====================

/**
 * Cria opcao para um servico
 */
export const createOption = async (
  data: CreateOptionInput,
): Promise<StorefrontServiceOption> => {
  const response = await api.post<ApiResponse<StorefrontServiceOption>>(
    "/storefronts/mine/options",
    data,
  );
  return extractData(response);
};

/**
 * Atualiza opcao de um servico
 */
export const updateOption = async (
  optionId: number,
  data: UpdateOptionInput,
): Promise<StorefrontServiceOption> => {
  const response = await api.put<ApiResponse<StorefrontServiceOption>>(
    `/storefronts/mine/options/${optionId}`,
    data,
  );
  return extractData(response);
};

/**
 * Remove opcao de um servico
 */
export const deleteOption = async (optionId: number): Promise<void> => {
  await api.delete(`/storefronts/mine/options/${optionId}`);
};

// ==================== CART CHECKOUT ====================

/**
 * Cria pedido a partir do carrinho da vitrine
 */
export const checkoutCart = async (
  data: CartCheckoutInput,
): Promise<ServiceOrder & { items: ServiceOrderItem[] }> => {
  const response = await api.post<
    ApiResponse<ServiceOrder & { items: ServiceOrderItem[] }>
  >("/services/orders/from-cart", data);
  return extractData(response);
};

// ==================== DEFAULT EXPORT ====================

export default {
  // Public
  listStorefronts,
  getStorefrontBySlug,
  // Management
  getMyStorefront,
  createStorefront,
  updateStorefront,
  publishStorefront,
  // Categories
  listMyCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  // Services
  listMyServices,
  createService,
  updateService,
  deleteService,
  // Options
  createOption,
  updateOption,
  deleteOption,
  // Cart
  checkoutCart,
};
