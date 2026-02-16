// ============================================
// DASHBOARD & STATISTICS TYPES
// ============================================

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  pendingRevenue: number;
  availableBalance: number;
  averageRating: number;
  totalReviews: number;
}

export interface ProfessionalStats extends DashboardStats {
  activeServices: number;
  totalClients: number;
  completionRate: number;
  responseTime: number;
}

export interface ClientStats extends DashboardStats {
  activeRequests: number;
  favoriteProfessionals: number;
  totalSpent: number;
  averageServiceRating: number;
}
