import { Transaction } from "./entities";

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
