import api, { ApiResponse } from "./api";
import type {
  PublicStorefront,
  CompanyProfile,
  CompanyStorefrontSection,
  CompanyStorefrontItem,
  CompanyStorefrontBlock,
  CompanyPinnedTestimonial,
  StorefrontBlockType,
} from "../types";

// ==================== STOREFRONT SERVICE ====================

export const companyStorefrontService = {
  // ── Public (no auth required) ──────────────────────────────────────────────

  /**
   * Obtém o storefront público de uma empresa pelo ID
   */
  getPublicStorefront: async (
    companyId: number,
  ): Promise<ApiResponse<PublicStorefront>> => {
    const res = await api.get<ApiResponse<PublicStorefront>>(
      `/storefront/${companyId}`,
    );
    return res.data;
  },

  // ── Editor (auth required — token sent automatically by axios interceptors) ─

  /**
   * Obtém o perfil da empresa com dados completos do storefront para edição
   */
  getEditor: async (): Promise<ApiResponse<CompanyProfile>> => {
    const res = await api.get<ApiResponse<CompanyProfile>>(
      "/company/storefront/editor",
    );
    return res.data;
  },

  // ── Sections ───────────────────────────────────────────────────────────────

  /**
   * Cria uma nova seção no storefront
   */
  createSection: async (data: {
    title: string;
    description?: string;
    order: number;
    isActive?: boolean;
  }): Promise<ApiResponse<CompanyStorefrontSection>> => {
    const res = await api.post<ApiResponse<CompanyStorefrontSection>>(
      "/company/storefront/sections",
      data,
    );
    return res.data;
  },

  /**
   * Atualiza uma seção existente
   */
  updateSection: async (
    sectionId: number,
    data: Partial<{
      title: string;
      description?: string;
      order: number;
      isActive?: boolean;
    }>,
  ): Promise<ApiResponse<CompanyStorefrontSection>> => {
    const res = await api.patch<ApiResponse<CompanyStorefrontSection>>(
      `/company/storefront/sections/${sectionId}`,
      data,
    );
    return res.data;
  },

  /**
   * Remove uma seção do storefront
   */
  deleteSection: async (
    sectionId: number,
  ): Promise<ApiResponse<void>> => {
    const res = await api.delete<ApiResponse<void>>(
      `/company/storefront/sections/${sectionId}`,
    );
    return res.data;
  },

  // ── Section items ──────────────────────────────────────────────────────────

  /**
   * Adiciona um listing a uma seção
   */
  addItemToSection: async (
    sectionId: number,
    data: {
      listingId: number;
      order: number;
      isFeatured?: boolean;
    },
  ): Promise<ApiResponse<CompanyStorefrontItem>> => {
    const res = await api.post<ApiResponse<CompanyStorefrontItem>>(
      `/company/storefront/sections/${sectionId}/items`,
      data,
    );
    return res.data;
  },

  /**
   * Remove um item de uma seção
   */
  removeItemFromSection: async (
    sectionId: number,
    itemId: number,
  ): Promise<ApiResponse<void>> => {
    const res = await api.delete<ApiResponse<void>>(
      `/company/storefront/sections/${sectionId}/items/${itemId}`,
    );
    return res.data;
  },

  // ── Blocks ─────────────────────────────────────────────────────────────────

  /**
   * Cria ou atualiza um bloco do storefront (upsert por tipo)
   */
  upsertBlock: async (data: {
    type: StorefrontBlockType;
    order: number;
    isActive?: boolean;
    content: Record<string, unknown>;
  }): Promise<ApiResponse<CompanyStorefrontBlock>> => {
    const res = await api.put<ApiResponse<CompanyStorefrontBlock>>(
      "/company/storefront/blocks",
      data,
    );
    return res.data;
  },

  // ── Pinned testimonials ────────────────────────────────────────────────────

  /**
   * Fixa um depoimento no storefront
   */
  pinTestimonial: async (data: {
    reviewId: number;
    order: number;
  }): Promise<ApiResponse<CompanyPinnedTestimonial>> => {
    const res = await api.post<ApiResponse<CompanyPinnedTestimonial>>(
      "/company/storefront/testimonials/pin",
      data,
    );
    return res.data;
  },

  /**
   * Remove um depoimento fixado do storefront
   */
  unpinTestimonial: async (
    pinnedId: number,
  ): Promise<ApiResponse<void>> => {
    const res = await api.delete<ApiResponse<void>>(
      `/company/storefront/testimonials/${pinnedId}`,
    );
    return res.data;
  },
};

export default companyStorefrontService;
