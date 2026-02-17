// ============================================
// FazTudo Types - Barrel File
// Re-exports all types from domain-specific modules
// ============================================

// Enums
export * from "./enums";

// Core entity interfaces
export * from "./entities";

// Authentication types
export * from "./auth";

// API request/response types
export * from "./api";

// Form & validation types
export * from "./forms";

// Filter & query types
export * from "./filters";

// Wallet types
export * from "./wallet";

// Dashboard & statistics types
export * from "./dashboard";

// Component prop types
export * from "./components";

// Utility, theme & event types
export * from "./utils";

// Map types
export * from "./map";

// ============================================
// COMPATIBILITY RE-EXPORTS
// ============================================

export type {
  User as UserType,
  ServiceListing as ServiceListingType,
  ServiceOrder as ServiceOrderType,
  Payment as PaymentType,
  Review as ReviewType,
  Notification as NotificationModel,
  Address as AddressType,
  Certification as CertificationType,
} from "./entities";

// Company types
export * from "./company";
