import { NotificationType } from "./enums";
import { Notification } from "./entities";

// ============================================
// UTILITY TYPES
// ============================================

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type RequireKeys<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;

// ============================================
// THEME TYPES
// ============================================

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// ============================================
// EVENT TYPES
// ============================================

export interface ServiceOrderEvent {
  type:
    | "created"
    | "accepted"
    | "started"
    | "completed"
    | "cancelled"
    | "expired";
  orderId: number;
  userId: number;
  timestamp: string;
  metadata?: any;
}

export interface PaymentEvent {
  type: "created" | "held" | "released" | "refunded" | "failed";
  paymentId: number;
  orderId: number;
  amount: number;
  timestamp: string;
  metadata?: any;
}

export interface NotificationEvent {
  type: NotificationType;
  notificationId: number;
  userId: number;
  timestamp: string;
  data: Notification;
}
