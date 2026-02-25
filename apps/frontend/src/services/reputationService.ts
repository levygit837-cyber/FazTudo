import api, { ApiResponse, extractData } from "./api";

export interface LowRatingReview {
  id: number;
  rating: number;
  comment: string | null;
  author: { id: number; name: string; profileImage: string | null };
  serviceOrder: { id: number; title: string; completedAt: string | null };
  createdAt: string;
}

export interface ReputationRecommendation {
  type: string;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ReputationAnalytics {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  lowRatingReviews: LowRatingReview[];
  completionRate: number;
  avgResponseTimeHours: number;
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  churnRiskScore: number;
  recommendations: ReputationRecommendation[];
  stats: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  };
}

export const getReputationAnalytics = async (): Promise<ReputationAnalytics> => {
  const response = await api.get<ApiResponse<ReputationAnalytics>>(
    "/dashboard/professional/reputation"
  );
  return extractData(response);
};
