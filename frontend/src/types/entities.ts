import {
  UserRole,
  UserStatus,
  ServiceOrderStatus,
  PaymentStatus,
  NotificationType,
  NotificationStatus,
  ServiceCategoryType,
  VerificationType,
  VerificationSubmissionStatus,
} from "./enums";

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
  images: string[];
  tags: string[];

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

  clientConfirmedAt?: string;
  professionalConfirmedAt?: string;

  // Reschedule approval flow
  rescheduleProposedDate?: string;
  rescheduleReason?: string;
  rescheduleStatus?: string;
  rescheduleRequestedBy?: number;

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
  brief?: OrderBrief;

  createdAt: string;
  updatedAt: string;
}

export interface OrderBrief {
  id: number;
  serviceOrderId: number;
  categoryId?: number;
  urgencyLevel: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  briefData: Record<string, any>;
  mediaUrls?: string[];
  notes?: string;
  category?: ServiceCategory;
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
  type: string;
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

export type MessageType = "TEXT" | "SYSTEM" | "ATTACHMENT" | "LOCATION";

export interface Message {
  id: number;
  content: string;
  isRead: boolean;
  type: MessageType;

  senderId: number;
  recipientId: number;
  serviceOrderId: number;

  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;

  locationLat?: number;
  locationLng?: number;
  locationLabel?: string;

  sender?: User;
  recipient?: User;
  serviceOrder?: ServiceOrder;

  createdAt: string;
  readAt?: string;
}

export interface ChatConversation {
  orderId: number;
  orderTitle: string;
  orderStatus: ServiceOrderStatus;
  otherUser: {
    id: number;
    name: string;
    profileImage?: string;
  } | null;
  lastMessage: {
    id: number;
    content: string;
    type: MessageType;
    senderId: number;
    createdAt: string;
    isRead: boolean;
  } | null;
  unreadCount: number;
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
