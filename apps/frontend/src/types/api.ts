import { Payment } from "./entities";

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

export interface TransparentCheckoutResponse {
  payment: Payment;
  paymentData: {
    status: string;
    statusDetail: string;
    paymentType: string;
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    boletoUrl?: string;
    barcode?: string;
    expirationDate?: string;
    mpPaymentId?: number;
  };
  feeBreakdown: {
    totalAmount: number;
    platformFeePercentage: number;
    platformFee: number;
    professionalAmount: number;
  };
}

export interface CheckoutFormData {
  paymentMethod: "credit_card" | "pix" | "boleto";
  payerEmail: string;
  payerName: string;
  payerCPF: string;
  token?: string;
  paymentMethodId?: string;
  installments?: number;
}

export interface MPConfig {
  publicKey: string;
  sandbox: boolean;
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
