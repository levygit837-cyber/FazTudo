export interface ProfessionalStorefront {
  user: {
    id: number;
    name: string;
    bio?: string;
    profileImage?: string;
    isVerified: boolean;
    ratingAverage: number;
    totalReviews: number;
    createdAt: string;
    categories: Array<{
      category: { id: number; name: string; icon?: string };
    }>;
    certifications: Array<{
      id: number;
      title: string;
      issuer: string;
      issueDate: string;
    }>;
  };
  services: Array<{
    id: number;
    title: string;
    description: string;
    price: number;
    estimatedHours?: number;
    images: string[];
    tags: string[];
    category: { id: number; name: string; icon?: string };
  }>;
  stats: {
    completedOrders: number;
    ratingAverage: number;
    totalReviews: number;
  };
  recentReviews: Array<{
    id: number;
    rating: number;
    comment?: string;
    createdAt: string;
    author: { id: number; name: string; profileImage?: string };
  }>;
}
