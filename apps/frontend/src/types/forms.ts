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
