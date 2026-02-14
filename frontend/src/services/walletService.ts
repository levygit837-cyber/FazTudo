import api, { ApiResponse, extractData } from "./api";
import type { TransactionFilter, TransactionListResponse, WalletSummary, WithdrawalRequest, Transaction } from "../types";

export const getBalance = async (): Promise<{ balance: number }> => {
  const response = await api.get<ApiResponse<{ balance: number }>>("/wallet/balance");
  return extractData(response);
};

export const getTransactions = async (
  filter?: TransactionFilter,
): Promise<TransactionListResponse> => {
  const response = await api.get<ApiResponse<TransactionListResponse>>(
    "/wallet/transactions",
    { params: filter },
  );
  return extractData(response);
};

export const getSummary = async (): Promise<WalletSummary> => {
  const response = await api.get<ApiResponse<WalletSummary>>("/wallet/summary");
  return extractData(response);
};

export const requestWithdrawal = async (
  data: WithdrawalRequest,
): Promise<{ transaction: Transaction; newBalance: number }> => {
  const response = await api.post<
    ApiResponse<{ transaction: Transaction; newBalance: number }>
  >("/wallet/withdraw", data);
  return extractData(response);
};
