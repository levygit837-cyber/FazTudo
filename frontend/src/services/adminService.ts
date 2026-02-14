import api, { ApiResponse, extractData } from "./api";

// ==================== TYPES ====================

export interface AdminStats {
  users: {
    total: number;
    clients: number;
    professionals: number;
    admins: number;
    active: number;
    suspended: number;
    pending: number;
    newLast30Days: number;
  };
  services: {
    total: number;
    available: number;
    unavailable: number;
  };
  orders: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    newLast30Days: number;
  };
  financial: {
    totalRevenue: number;
    heldInEscrow: number;
  };
  verifications: {
    pending: number;
  };
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
  isVerified: boolean;
  profileImage: string | null;
  ratingAverage: number;
  totalReviews: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    clientOrders: number;
    professionalOrders: number;
    serviceListings: number;
  };
}

export interface AdminUserDetails extends Omit<AdminUser, "_count"> {
  document: string | null;
  bio: string | null;
  addresses: any[];
  categories: any[];
  serviceListings: {
    id: number;
    title: string;
    price: number;
    isAvailable: boolean;
    createdAt: string;
  }[];
  certifications: any[];
  _count: {
    clientOrders: number;
    professionalOrders: number;
    serviceListings: number;
    reviewsReceived: number;
    notifications: number;
  };
}

export interface VerificationSubmission {
  id: number;
  userId: number;
  type: "DOCUMENT" | "FACIAL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  metadata: any;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    profileImage: string | null;
    isVerified: boolean;
  };
}

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== API CALLS ====================

export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await api.get<ApiResponse<AdminStats>>("/admin/stats");
  return extractData(response);
};

export const listUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}): Promise<PaginatedResult<AdminUser>> => {
  const response = await api.get<ApiResponse<{ users: AdminUser[]; pagination: any }>>(
    "/admin/users",
    { params },
  );
  const data = extractData(response);
  return {
    items: data.users,
    pagination: data.pagination,
  };
};

export const getUserDetails = async (id: number): Promise<AdminUserDetails> => {
  const response = await api.get<ApiResponse<{ user: AdminUserDetails }>>(
    `/admin/users/${id}`,
  );
  const data = extractData(response);
  return data.user;
};

export const updateUserStatus = async (
  id: number,
  status: string,
): Promise<AdminUser> => {
  const response = await api.put<ApiResponse<{ user: AdminUser }>>(
    `/admin/users/${id}/status`,
    { status },
  );
  const data = extractData(response);
  return data.user;
};

export const listVerifications = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResult<VerificationSubmission>> => {
  const response = await api.get<
    ApiResponse<{ verifications: VerificationSubmission[]; pagination: any }>
  >("/admin/verifications", { params });
  const data = extractData(response);
  return {
    items: data.verifications,
    pagination: data.pagination,
  };
};

export const reviewVerification = async (
  id: number,
  action: "APPROVED" | "REJECTED",
  rejectionReason?: string,
): Promise<VerificationSubmission> => {
  const response = await api.put<
    ApiResponse<{ verification: VerificationSubmission }>
  >(`/admin/verifications/${id}`, { action, rejectionReason });
  const data = extractData(response);
  return data.verification;
};
