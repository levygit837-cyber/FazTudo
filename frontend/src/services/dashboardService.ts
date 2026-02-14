import api, { ApiResponse, extractData } from "./api";
import { ServiceOrder } from "../types";

export interface ClientDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageRating: number;
  totalReviews: number;
}

export interface ProfessionalDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  totalServices: number;
  totalEarnings: number;
  pendingRevenue: number;
  availableBalance: number;
  averageRating: number;
  totalReviews: number;
}

export const getDashboardStats = async (): Promise<ClientDashboardStats | ProfessionalDashboardStats> => {
  const response = await api.get<ApiResponse<ClientDashboardStats | ProfessionalDashboardStats>>(
    "/dashboard/stats"
  );
  return extractData(response);
};

export const getRecentOrders = async (limit: number = 5): Promise<ServiceOrder[]> => {
  const response = await api.get<ApiResponse<{ orders: ServiceOrder[] }>>(
    "/dashboard/recent-orders",
    { params: { limit } }
  );
  return extractData(response).orders;
};
