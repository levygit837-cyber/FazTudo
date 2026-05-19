import api, { ApiResponse } from "./api";
import type { InviteValidation } from "../types";

// ==================== COMPANY INVITE SERVICE ====================

export const companyInviteService = {
  /**
   * Gera um link de convite para a empresa com o papel especificado
   */
  generateInviteLink: async (data: {
    role: string;
  }): Promise<ApiResponse<{ token: string; link: string; expiresAt: string }>> => {
    const res = await api.post<
      ApiResponse<{ token: string; link: string; expiresAt: string }>
    >("/company/invite/generate", data);
    return res.data;
  },

  /**
   * Valida um token de convite e retorna informações sobre a empresa e papel
   */
  validateInviteToken: async (
    token: string,
  ): Promise<ApiResponse<InviteValidation>> => {
    const res = await api.get<ApiResponse<InviteValidation>>(
      `/company/invite/${token}`,
    );
    return res.data;
  },

  /**
   * Aceita um convite usando o token fornecido
   */
  acceptInvite: async (
    token: string,
  ): Promise<ApiResponse<{ message: string }>> => {
    const res = await api.post<ApiResponse<{ message: string }>>(
      `/company/invite/${token}/accept`,
    );
    return res.data;
  },
};

export default companyInviteService;
