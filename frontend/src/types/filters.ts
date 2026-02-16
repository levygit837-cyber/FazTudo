import { ServiceOrderStatus, NotificationStatus, NotificationType } from "./enums";

// ============================================
// FILTER & QUERY TYPES
// ============================================

export interface ServiceFilter {
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  professionalId?: number;
  availableOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface ServiceOrderFilter {
  status?: ServiceOrderStatus;
  role?: "client" | "professional";
  page?: number;
  limit?: number;
}

export interface NotificationFilter {
  status?: NotificationStatus;
  type?: NotificationType;
  limit?: number;
}
