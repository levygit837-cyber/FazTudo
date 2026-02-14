// ============================================
// ENUMS
// ============================================

export enum UserRole {
  CLIENT = "CLIENT",
  PROFESSIONAL = "PROFESSIONAL",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  INACTIVE = "INACTIVE",
}

export enum ServiceOrderStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  IN_PROGRESS = "IN_PROGRESS",
  AWAITING_CLIENT_CONFIRMATION = "AWAITING_CLIENT_CONFIRMATION",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  DISPUTED = "DISPUTED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  HELD = "HELD",
  RELEASED = "RELEASED",
  REFUNDED = "REFUNDED",
  FAILED = "FAILED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

export enum NotificationType {
  ORDER_CREATED = "ORDER_CREATED",
  ORDER_ACCEPTED = "ORDER_ACCEPTED",
  ORDER_COMPLETED = "ORDER_COMPLETED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  PAYMENT_RELEASED = "PAYMENT_RELEASED",
  DEADLINE_WARNING = "DEADLINE_WARNING",
  DEADLINE_EXPIRED = "DEADLINE_EXPIRED",
  NEW_MESSAGE = "NEW_MESSAGE",
  REVIEW_RECEIVED = "REVIEW_RECEIVED",
  SYSTEM_ALERT = "SYSTEM_ALERT",
}

export enum NotificationStatus {
  UNREAD = "UNREAD",
  READ = "READ",
  ARCHIVED = "ARCHIVED",
}

export enum ServiceCategoryType {
  HOME_SERVICES = "HOME_SERVICES",
  BUSINESS_SERVICES = "BUSINESS_SERVICES",
  BOTH = "BOTH",
}

export enum VerificationType {
  DOCUMENT = "DOCUMENT",
  FACIAL = "FACIAL",
}

export enum VerificationSubmissionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

// ============================================
// CORE ENTITY INTERFACES
// ============================================

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  document?: string;
  isVerified: boolean;
  bio?: string;
  profileImage?: string;
  ratingAverage: number;
  totalReviews: number;
  balance: number;
  createdAt: string;
  updatedAt: string;

  // Relational fields (optional)
  categories?: ProfessionalCategory[];
  serviceListings?: ServiceListing[];
  certifications?: Certification[];
  addresses?: Address[];
}

export interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  type: ServiceCategoryType;
  parentCategoryId?: number;
  parentCategory?: ServiceCategory;
  subcategories?: ServiceCategory[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalCategory {
  id: number;
  userId: number;
  categoryId: number;
  experienceYears?: number;
  hourlyRate?: number;
  isPrimary: boolean;
  user?: User;
  category?: ServiceCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListing {
  id: number;
  title: string;
  description: string;
  price: number;
  estimatedHours?: number;
  isAvailable: boolean;
  images: string[]; // Array de URLs como JSON
  tags: string[]; // Array de tags como JSON

  professionalId: number;
  categoryId: number;

  professional?: User;
  category?: ServiceCategory;
  serviceOrders?: ServiceOrder[];

  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrder {
  id: number;
  title: string;
  description?: string;
  price: number;
  status: ServiceOrderStatus;
  scheduledDate?: string;
  deadlineDays: number;
  deadlineDate?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;

  addressId?: number;
  addressNotes?: string;

  clientId: number;
  professionalId?: number;
  serviceListingId?: number;

  client?: User;
  professional?: User;
  serviceListing?: ServiceListing;
  address?: Address;
  payments?: Payment[];
  reviews?: Review[];
  notifications?: Notification[];
  messages?: Message[];
  files?: File[];

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  metadata?: any;

  dueDate?: string;
  paidAt?: string;
  heldUntil?: string;
  releasedAt?: string;
  refundedAt?: string;

  serviceOrderId: number;
  clientId: number;
  professionalId?: number;

  serviceOrder?: ServiceOrder;
  client?: User;
  professional?: User;
  transactions?: Transaction[];

  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  type: string; // DEPOSIT, WITHDRAWAL, PAYMENT, REFUND, FEE
  amount: number;
  description: string;
  balanceBefore: number;
  balanceAfter: number;

  userId: number;
  paymentId?: number;

  user?: User;
  payment?: Payment;

  createdAt: string;
}

export interface Review {
  id: number;
  rating: number;
  comment?: string;
  isProfessional: boolean;

  authorId: number;
  targetId: number;
  serviceOrderId: number;

  author?: User;
  target?: User;
  serviceOrder?: ServiceOrder;

  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  metadata?: any;

  userId: number;
  serviceOrderId?: number;

  user?: User;
  serviceOrder?: ServiceOrder;

  createdAt: string;
  readAt?: string;
}

export interface VerificationSubmission {
  id: number;
  userId: number;
  type: VerificationType;
  status: VerificationSubmissionStatus;
  metadata?: Record<string, unknown>;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: number;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;

  userId: number;
  serviceOrders?: ServiceOrder[];

  user?: User;

  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  content: string;
  isRead: boolean;

  senderId: number;
  recipientId: number;
  serviceOrderId: number;

  sender?: User;
  recipient?: User;
  serviceOrder?: ServiceOrder;

  createdAt: string;
  readAt?: string;
}

export interface File {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  description?: string;

  userId: number;
  serviceOrderId?: number;

  user?: User;
  serviceOrder?: ServiceOrder;

  createdAt: string;
}

export interface Certification {
  id: number;
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  verificationUrl?: string;

  professionalId: number;

  professional?: User;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CheckoutResponse {
  payment: Payment;
  checkout: {
    preferenceId: string;
    checkoutUrl: string;
  } | null;
  feeBreakdown: {
    totalAmount: number;
    platformFeePercentage: number;
    platformFee: number;
    professionalAmount: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: any[];
  timestamp?: string;
}

// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole.CLIENT | UserRole.PROFESSIONAL;
  document?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================
// FORM & VALIDATION TYPES
// ============================================

export interface CreateServiceListingForm {
  title: string;
  description: string;
  price: number;
  categoryId: number;
  estimatedHours?: number;
  images?: string[];
  tags?: string[];
}

export interface CreateServiceOrderForm {
  serviceListingId: number;
  title: string;
  description?: string;
  scheduledDate?: string;
  addressId?: number;
  addressNotes?: string;
}

export interface CreatePaymentForm {
  paymentMethod: string;
  transactionId?: string;
  metadata?: any;
}

export interface CreateReviewForm {
  rating: number;
  comment?: string;
  isProfessional?: boolean;
}

export interface SendMessageForm {
  content: string;
  serviceOrderId: number;
}

export interface UpdateProfileForm {
  name?: string;
  phone?: string;
  bio?: string;
  document?: string;
}

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
}

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

// ============================================
// WALLET TYPES
// ============================================

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'PAYMENT' | 'REFUND' | 'FEE';

export interface TransactionFilter {
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface WithdrawalRequest {
  amount: number;
}

export interface WalletSummary {
  balance: number;
  totalSpent?: number;
  totalRefunded?: number;
  totalEarned?: number;
  totalWithdrawn?: number;
  totalFees?: number;
  availableForWithdrawal?: number;
  pendingInEscrow: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

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

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface ServiceCardProps {
  service: ServiceListing;
  onClick?: () => void;
  showProfessional?: boolean;
  showActions?: boolean;
}

export interface OrderCardProps {
  order: ServiceOrder;
  view?: "client" | "professional";
  onClick?: () => void;
  showStatus?: boolean;
  showActions?: boolean;
}

export interface ReviewCardProps {
  review: Review;
  showAuthor?: boolean;
  showTarget?: boolean;
  showServiceOrder?: boolean;
}

export interface NotificationItemProps {
  notification: Notification;
  onRead?: () => void;
  onArchive?: () => void;
}

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  showTime?: boolean;
}

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

// ============================================
// EXPORT ALL TYPES
// ============================================

export type {
  // Re-export para compatibilidade
  User as UserType,
  ServiceListing as ServiceListingType,
  ServiceOrder as ServiceOrderType,
  Payment as PaymentType,
  Review as ReviewType,
  Notification as NotificationModel,
  Message as MessageType,
  Address as AddressType,
  Certification as CertificationType,
};
