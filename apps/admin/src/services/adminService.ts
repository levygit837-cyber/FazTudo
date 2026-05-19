import api, { ApiResponse } from "./api";

// ==================== Types ====================

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  platformFees: number;
  activeDisputes: number;
  pendingVerifications: number;
  newUsersToday: number;
  ordersToday: number;
}

export interface TrafficStats {
  kpis: {
    totalSessions: { value: number; change: number };
    avgDuration: { value: number; change: number };
    activeUsers: { value: number; change: number };
  };
  charts: {
    dailySessions: Array<{ date: string; sessions: number; uniqueUsers: number }>;
    hourlyDistribution: number[]; // 24 elements, index = hour
    deviceDistribution: Array<{ device: string; count: number }>;
  };
  chat: {
    totalMessages: number;
    avgMessagesPerDay: number;
    avgMessagesPerConversation: number;
    avgChatDurationSeconds: number;
  };
  retention?: Array<{ cohort: string; d1: number; d7: number; d14: number; d30: number }>;
}

export interface AdminStats {
  usersByRole: Record<string, number>;
  usersByStatus: Record<string, number>;
  ordersByStatus: Record<string, number>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
}

export interface UserListItem {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
  ratingAverage: number;
  totalReviews: number;
}

export interface UserDetails extends UserListItem {
  phone?: string;
  bio?: string;
  profileImage?: string;
  document?: string;
  balance: number;
  updatedAt: string;
}

export interface Verification {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  documentType: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface Dispute {
  id: number;
  orderId: number;
  reason: string;
  status: string;
  createdAt: string;
  clientName: string;
  professionalName: string;
  orderTitle: string;
}

export interface PlatformConfig {
  platformFeePercentage: number;
  escrowHoldDays: number;
  maxFileUploadSize: number;
  maintenanceMode: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== Dashboard ====================

export async function getDashboardStats(period?: string) {
  const params = period ? { period } : {};
  const res = await api.get<ApiResponse<DashboardStats>>("/admin/stats/dashboard", {
    params,
  });
  return res.data.data;
}

export async function getTrafficStats(period?: string) {
  const params = period ? { period } : {};
  const res = await api.get<ApiResponse<TrafficStats>>("/admin/stats/traffic", {
    params,
  });
  return res.data.data;
}

export async function getAdminStats() {
  const res = await api.get<ApiResponse<AdminStats>>("/admin/stats");
  return res.data.data;
}

// ==================== Users ====================

export async function listUsers(
  page?: number,
  limit?: number,
  search?: string,
  role?: string,
  status?: string
): Promise<PaginatedResponse<UserListItem>> {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search) params.search = search;
  if (role) params.role = role;
  if (status) params.status = status;

  const res = await api.get<ApiResponse<{ users: UserListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
    "/admin/users",
    { params }
  );
  const { users, pagination } = res.data.data;
  return {
    items: users,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: pagination.totalPages,
  };
}

export async function getUserDetails(id: number) {
  const res = await api.get<ApiResponse<UserDetails>>(`/admin/users/${id}`);
  return res.data.data;
}

export async function updateUserStatus(id: number, status: string) {
  const res = await api.put<ApiResponse<UserDetails>>(
    `/admin/users/${id}/status`,
    { status }
  );
  return res.data.data;
}

export async function forceLogout(id: number) {
  const res = await api.post<ApiResponse<{ success: boolean }>>(
    `/admin/users/${id}/force-logout`
  );
  return res.data.data;
}

// ==================== Verifications ====================

export async function listVerifications(
  page?: number,
  limit?: number,
  status?: string
) {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (status) params.status = status;

  const res = await api.get<ApiResponse<PaginatedResponse<Verification>>>(
    "/admin/verifications",
    { params }
  );
  return res.data.data;
}

export async function reviewVerification(
  id: number,
  action: string,
  rejectionReason?: string
) {
  const res = await api.post<ApiResponse<Verification>>(
    `/admin/verifications/${id}/review`,
    { action, rejectionReason }
  );
  return res.data.data;
}

// ==================== Disputes ====================

export async function listDisputes(
  page?: number,
  limit?: number,
  status?: string
) {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (status) params.status = status;

  const res = await api.get<ApiResponse<PaginatedResponse<Dispute>>>(
    "/admin/disputes",
    { params }
  );
  return res.data.data;
}

export async function resolveDispute(
  id: number,
  resolution: string,
  action: string
) {
  const res = await api.put<ApiResponse<Dispute>>(
    `/admin/disputes/${id}/resolve`,
    { resolution, action }
  );
  return res.data.data;
}

// ==================== Platform Config ====================

// Raw API shape from backend (GET /admin/config)
interface RawConfigResponse {
  escrow: {
    platformFeePercentage: number;
    defaultHoldDays: number;
    disputePeriodDays: number;
    [key: string]: unknown;
  } | null;
  system: Array<{ key: string; value: string }>;
}

function normalizeConfig(raw: RawConfigResponse): PlatformConfig {
  const sysMap: Record<string, string> = {};
  for (const entry of raw.system) {
    sysMap[entry.key] = entry.value;
  }
  return {
    platformFeePercentage: raw.escrow?.platformFeePercentage ?? 10,
    escrowHoldDays: raw.escrow?.defaultHoldDays ?? 7,
    maxFileUploadSize: sysMap["max_file_upload_size"]
      ? Number(JSON.parse(sysMap["max_file_upload_size"]))
      : 10485760,
    maintenanceMode: sysMap["maintenance_mode"]
      ? JSON.parse(sysMap["maintenance_mode"]) === true
      : false,
  };
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const res = await api.get<ApiResponse<RawConfigResponse>>("/admin/config");
  return normalizeConfig(res.data.data);
}

export async function updatePlatformConfig(data: Partial<PlatformConfig>): Promise<void> {
  await api.put("/admin/config", {
    platformFeePercentage: data.platformFeePercentage,
    defaultHoldDays: data.escrowHoldDays,
    max_file_upload_size: data.maxFileUploadSize,
    maintenance_mode: data.maintenanceMode,
  });
  // Backend returns null — caller should re-fetch after save
}
