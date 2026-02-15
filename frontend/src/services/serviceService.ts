import api, { ApiResponse, extractData } from "./api";
import { ChatConversation, CheckoutFormData, TransparentCheckoutResponse, MPConfig, Message, ServiceListing, ServiceOrder, ServiceOrderStatus } from "../types";

// ==================== TIPOS ====================

export interface ServiceListParams {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  availableOnly?: "true" | "false" | "all";
  professionalId?: number;
  page?: number;
  limit?: number;
  sortBy?: "price" | "rating" | "recent";
  sortOrder?: "asc" | "desc";
}

export interface ProfessionalCertification {
  id: number;
  title: string;
  issuer: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  verificationUrl?: string;
}

export interface ProfessionalCategoryInfo {
  id: number;
  experienceYears: number;
  hourlyRate?: number;
  isPrimary: boolean;
  category: {
    id: number;
    name: string;
    icon?: string;
  };
}

export interface ServiceReview {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
    profileImage?: string;
  };
}

export interface ServiceOrderWithReviews {
  id: number;
  reviews: ServiceReview[];
}

export interface ServiceListingWithProfessional extends Omit<
  ServiceListing,
  "professional" | "category" | "serviceOrders"
> {
  professional: {
    id: number;
    name: string;
    profileImage?: string;
    bio?: string;
    ratingAverage: number;
    totalReviews: number;
    certifications?: ProfessionalCertification[];
    categories?: ProfessionalCategoryInfo[];
  };
  category: {
    id: number;
    name: string;
    icon?: string;
  };
  serviceOrders?: ServiceOrderWithReviews[];
  completedOrders?: number;
  completedOrdersCount?: number;
}

export interface NormalizedPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateServiceListingData {
  title: string;
  description: string;
  price: number;
  estimatedHours?: number;
  categoryId: number;
  images?: string[];
  tags?: string[];
}

export interface UpdateServiceListingData
  extends Partial<CreateServiceListingData> {
  isAvailable?: boolean;
}

export interface CreateOrderData {
  serviceListingId: number;
  title: string;
  scheduledDate?: string;
  addressId?: number;
  addressNotes?: string;
  description?: string;
}

interface BackendPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BackendServiceListData {
  services: ServiceListingWithProfessional[];
  pagination: BackendPagination;
}

interface BackendOrderListData {
  serviceOrders: ServiceOrder[];
  pagination: BackendPagination;
}

interface BackendMessagesData {
  messages: Message[];
  pagination: BackendPagination;
}

type RawPagePayload<T> = {
  data?: T[];
  items?: T[];
  services?: T[];
  serviceOrders?: T[];
  messages?: T[];
  pagination?: BackendPagination;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

const normalizePage = <T>(raw: RawPagePayload<T>): NormalizedPage<T> => {
  const items =
    raw.items ||
    raw.data ||
    raw.services ||
    raw.serviceOrders ||
    raw.messages ||
    [];

  if (raw.pagination) {
    return {
      items,
      total: raw.pagination.total,
      page: raw.pagination.page,
      limit: raw.pagination.limit,
      totalPages: raw.pagination.totalPages,
    };
  }

  return {
    items,
    total: raw.total || items.length,
    page: raw.page || 1,
    limit: raw.limit || items.length || 1,
    totalPages: raw.totalPages || 1,
  };
};

// ==================== SERVIÇOS - LISTINGS ====================

/**
 * Lista serviços disponíveis
 */
export const listServices = async (
  params?: ServiceListParams,
): Promise<NormalizedPage<ServiceListingWithProfessional>> => {
  const normalizedParams: Record<string, unknown> = { ...(params || {}) };

  if (params?.availableOnly) {
    normalizedParams.availableOnly = params.availableOnly;
  } else if (typeof params?.available === "boolean") {
    normalizedParams.availableOnly = params.available ? "true" : "false";
  }

  delete normalizedParams.available;

  const response = await api.get<ApiResponse<BackendServiceListData | any>>(
    "/services",
    { params: normalizedParams },
  );
  return normalizePage<ServiceListingWithProfessional>(extractData(response));
};

/**
 * Obtém detalhes de um serviço
 */
export const getServiceById = async (
  id: number,
): Promise<ServiceListingWithProfessional> => {
  const response = await api.get<ApiResponse<any>>(`/services/${id}`);
  const data = extractData(response);
  return data.service || data;
};

/**
 * Cria um novo serviço (profissional)
 */
export const createService = async (
  data: CreateServiceListingData,
): Promise<ServiceListing> => {
  const response = await api.post<ApiResponse<any>>("/services", data);
  const payload = extractData(response);
  return payload.service || payload;
};

/**
 * Atualiza um serviço (profissional)
 */
export const updateService = async (
  id: number,
  data: UpdateServiceListingData,
): Promise<ServiceListing> => {
  const response = await api.put<ApiResponse<any>>(`/services/${id}`, data);
  const payload = extractData(response);
  return payload.service || payload;
};

/**
 * Remove um serviço (profissional)
 */
export const deleteService = async (id: number): Promise<void> => {
  await api.delete(`/services/${id}`);
};

// ==================== SERVIÇOS - ORDERS ====================

/**
 * Cria um novo pedido (cliente)
 */
export const createOrder = async (data: CreateOrderData): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>("/services/orders", data);
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Lista pedidos do usuário
 */
export const listOrders = async (params?: {
  status?: ServiceOrderStatus | "all";
  role?: "client" | "professional";
  page?: number;
  limit?: number;
}): Promise<NormalizedPage<ServiceOrder>> => {
  const response = await api.get<ApiResponse<BackendOrderListData | any>>(
    "/services/orders",
    { params },
  );
  return normalizePage<ServiceOrder>(extractData(response));
};

/**
 * Obtém detalhes de um pedido
 */
export const getOrderById = async (id: number): Promise<ServiceOrder> => {
  const response = await api.get<ApiResponse<any>>(`/services/orders/${id}`);
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Aceita um pedido (profissional)
 */
export const acceptOrder = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/accept`,
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Inicia um serviço (profissional)
 */
export const startOrder = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(`/services/orders/${id}/start`);
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Profissional marca serviço como entregue
 */
export const submitOrderCompletion = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/submit-completion`,
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Compatibilidade: endpoint antigo /complete
 */
export const completeOrder = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/complete`,
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Cliente confirma conclusão
 */
export const confirmOrderCompletion = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/confirm-completion`,
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

/**
 * Cancela um pedido
 */
export const cancelOrder = async (
  id: number,
  reason?: string,
): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/cancel`,
    { reason },
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};

// ==================== SERVIÇOS - PAYMENTS ====================

/**
 * Obtém configuração do MercadoPago (public key)
 */
export const getMPConfig = async (): Promise<MPConfig> => {
  const response = await api.get<ApiResponse<MPConfig>>("/services/payments/config");
  return extractData(response);
};

/**
 * Cria pagamento via checkout transparente (cartão/PIX/boleto)
 */
export const createPayment = async (
  orderId: number,
  data: CheckoutFormData,
): Promise<TransparentCheckoutResponse> => {
  const response = await api.post<ApiResponse<TransparentCheckoutResponse>>(
    `/services/orders/${orderId}/payments`,
    data,
  );
  return extractData(response);
};

/**
 * Libera pagamento do escrow
 */
export const releasePayment = async (orderId: number): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/payments/release`,
  );
  return extractData(response);
};

// ==================== SERVIÇOS - REVIEWS ====================

/**
 * Cria avaliação para um pedido
 */
export const createReview = async (
  orderId: number,
  data: { rating: number; comment?: string; isProfessional?: boolean },
): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/reviews`,
    data,
  );
  return extractData(response);
};

// ==================== SERVIÇOS - CHATS ====================

/**
 * Lista conversas ativas do usuário
 */
export const getUserChats = async (): Promise<ChatConversation[]> => {
  const response = await api.get<ApiResponse<any>>("/services/chats");
  const data = extractData(response);
  return data.chats || [];
};

/**
 * Upload de arquivo para o chat
 */
export const uploadChatFile = async (
  orderId: number,
  file: File,
): Promise<{
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/messages/upload`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  const data = extractData(response);
  return data.file;
};

// ==================== SERVIÇOS - MESSAGES ====================

/**
 * Envia mensagem em um pedido
 */
export const sendMessage = async (
  orderId: number,
  content: string,
  options?: {
    type?: "TEXT" | "ATTACHMENT" | "LOCATION";
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    locationLat?: number;
    locationLng?: number;
    locationLabel?: string;
  },
): Promise<Message> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/messages`,
    { content, ...options },
  );
  const payload = extractData(response);
  return payload.message || payload;
};

/**
 * Lista mensagens de um pedido
 */
export const getOrderMessages = async (
  orderId: number,
  params?: { page?: number; limit?: number },
): Promise<NormalizedPage<Message>> => {
  const response = await api.get<ApiResponse<BackendMessagesData | any>>(
    `/services/orders/${orderId}/messages`,
    { params },
  );
  return normalizePage<Message>(extractData(response));
};

// ==================== SERVIÇOS - SCHEDULE ====================

/**
 * Obtém agenda semanal de um profissional
 */
export const getProfessionalSchedule = async (professionalId: number): Promise<any> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/professionals/${professionalId}/schedule`,
  );
  return extractData(response);
};

/**
 * Obtém slots disponíveis para uma data
 */
export const getAvailableSlots = async (professionalId: number, date: string): Promise<any> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/professionals/${professionalId}/available-slots`,
    { params: { date } },
  );
  return extractData(response);
};

/**
 * Reagenda um pedido
 */
export const rescheduleOrder = async (orderId: number, data: {
  newDate: string;
  reason?: string;
}): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/reschedule`,
    data,
  );
  return extractData(response);
};

// ==================== SERVIÇOS - DISPUTES ====================

/**
 * Abre uma disputa para um pedido
 */
export const createDispute = async (orderId: number, data: {
  reason: string;
  description: string;
  attachments?: string[];
}): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/disputes`,
    data,
  );
  return extractData(response);
};

/**
 * Obtém disputas de um pedido
 */
export const getOrderDisputes = async (orderId: number): Promise<any> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/orders/${orderId}/disputes`,
  );
  return extractData(response);
};

// ==================== SERVIÇOS - PROPOSALS ====================

/**
 * Obtém propostas para um pedido
 */
export const getProposals = async (orderId: number): Promise<any[]> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/orders/${orderId}/proposals`,
  );
  const data = extractData(response);
  return data.proposals || [];
};

/**
 * Profissional cria proposta para um pedido
 */
export const createProposal = async (orderId: number, data: {
  price: number;
  estimatedDays?: number;
  estimatedHours?: number;
  description: string;
  guaranteeDays?: number;
}): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/proposals`,
    data,
  );
  return extractData(response);
};

/**
 * Cliente aceita uma proposta
 */
export const acceptProposal = async (orderId: number, proposalId: number): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/proposals/${proposalId}/accept`,
  );
  return extractData(response);
};

/**
 * Cliente rejeita uma proposta
 */
export const rejectProposal = async (orderId: number, proposalId: number): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${orderId}/proposals/${proposalId}/reject`,
  );
  return extractData(response);
};

// ==================== SERVIÇOS - BRIEFS ====================

/**
 * Obtém template de brief para uma categoria
 */
export const getBriefTemplate = async (categorySlug: string): Promise<any> => {
  const response = await api.get<ApiResponse<any>>(
    `/services/briefs/templates/${categorySlug}`,
  );
  return extractData(response);
};

/**
 * Cria pedido com brief inteligente
 */
export const createOrderWithBrief = async (data: {
  title: string;
  description?: string;
  categoryId?: number;
  urgencyLevel?: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  briefData?: Record<string, any>;
  mediaUrls?: string[];
  notes?: string;
  addressId?: number;
  addressNotes?: string;
  scheduledDate?: string;
  serviceListingId?: number;
}): Promise<any> => {
  const response = await api.post<ApiResponse<any>>(
    "/services/orders/with-brief",
    data,
  );
  return extractData(response);
};

export default {
  // Listings
  listServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  // Orders
  createOrder,
  listOrders,
  getOrderById,
  acceptOrder,
  startOrder,
  submitOrderCompletion,
  completeOrder,
  confirmOrderCompletion,
  cancelOrder,
  // Payments
  getMPConfig,
  createPayment,
  releasePayment,
  // Reviews
  createReview,
  // Chats
  getUserChats,
  uploadChatFile,
  // Messages
  sendMessage,
  getOrderMessages,
  // Briefs
  getBriefTemplate,
  createOrderWithBrief,
  // Proposals
  getProposals,
  createProposal,
  acceptProposal,
  rejectProposal,
};
