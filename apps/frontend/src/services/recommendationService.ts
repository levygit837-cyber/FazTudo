import api, { ApiResponse, extractData } from "./api";

export interface RecommendedService {
  service: {
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
    completedOrders: number;
    createdAt: string;
    updatedAt: string;
    professional: {
      id: number;
      name: string;
      profileImage?: string;
      ratingAverage: number;
      totalReviews: number;
    };
    category: {
      id: number;
      name: string;
      icon?: string;
    };
  };
  score: number;
  reasons: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendedService[];
  total: number;
}

export const getRecommendations = async (
  limit: number = 10,
  offset: number = 0,
): Promise<RecommendationResponse> => {
  const response = await api.get<ApiResponse<RecommendationResponse>>(
    "/services/recommendations",
    { params: { limit, offset } },
  );
  return extractData(response);
};
