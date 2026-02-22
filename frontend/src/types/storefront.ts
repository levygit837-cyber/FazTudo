// ============================================
// STOREFRONT / VITRINE TYPES
// ============================================

import { ServiceCategory } from "./entities";

// --- Core Entities ---

export interface Storefront {
  id: number;
  userId: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  isActive: boolean;
  isPublished: boolean;
  mainCategoryId?: number | null;
  mainCategory?: ServiceCategory | null;
  ratingAverage: number;
  totalReviews: number;
  totalServices: number;
  categories?: StorefrontCategory[];
  user?: StorefrontOwner;
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontOwner {
  id: number;
  name: string;
  bio?: string | null;
  profileImage?: string | null;
  isVerified: boolean;
  ratingAverage: number;
  totalReviews: number;
}

export interface StorefrontCategory {
  id: number;
  storefrontId: number;
  name: string;
  order: number;
  isActive: boolean;
  services?: StorefrontService[];
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontService {
  id: number;
  categoryId: number;
  title: string;
  description?: string | null;
  price: number;
  images?: string[] | null;
  isAvailable: boolean;
  order: number;
  options?: StorefrontServiceOption[];
  category?: StorefrontCategory;
  createdAt: string;
  updatedAt: string;
}

export interface StorefrontServiceOption {
  id: number;
  serviceId: number;
  name: string;
  price?: number | null;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrderItem {
  id: number;
  serviceOrderId: number;
  serviceId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  optionsSnapshot?: OptionSnapshot[] | null;
  service?: Pick<StorefrontService, "id" | "title" | "price">;
  createdAt: string;
}

export interface OptionSnapshot {
  id: number;
  name: string;
  price: number | null;
}

// --- API List Response (public) ---

export interface StorefrontListItem {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  isPublished: boolean;
  ratingAverage: number;
  totalReviews: number;
  totalServices: number;
  mainCategory?: { id: number; name: string; icon?: string | null } | null;
  user: StorefrontOwner;
  createdAt: string;
}

export interface StorefrontListResponse {
  storefronts: StorefrontListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// --- API Detail Response (public by slug) ---

export interface StorefrontDetail extends Storefront {
  categories: (StorefrontCategory & {
    services: (StorefrontService & {
      options: StorefrontServiceOption[];
    })[];
  })[];
  user: StorefrontOwner;
}

// --- Form/Input Types ---

export interface CreateStorefrontInput {
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  mainCategoryId?: number;
  serviceLocation?: string;
  teamSize?: number;
  workingHours?: string;
  averageServiceTime?: string;
}

export interface UpdateStorefrontInput {
  name?: string;
  description?: string;
  logo?: string;
  banner?: string;
  mainCategoryId?: number;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  order?: number;
  isActive?: boolean;
}

export interface ReorderCategoriesInput {
  categoryIds: number[];
}

export interface CreateServiceInput {
  categoryId: number;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  order?: number;
}

export interface UpdateServiceInput {
  title?: string;
  description?: string;
  price?: number;
  images?: string[];
  isAvailable?: boolean;
  order?: number;
  categoryId?: number;
}

export interface CreateOptionInput {
  serviceId: number;
  name: string;
  price?: number;
  isDefault?: boolean;
  order?: number;
}

export interface UpdateOptionInput {
  name?: string;
  price?: number;
  isDefault?: boolean;
  order?: number;
}

// --- Cart Types ---

export interface CartItem {
  service: StorefrontService;
  quantity: number;
  selectedOptions: StorefrontServiceOption[];
  unitPrice: number; // base price + sum of option prices
  totalPrice: number; // unitPrice * quantity
}

export interface Cart {
  storefrontId: number;
  storefrontName: string;
  storefrontSlug: string;
  items: CartItem[];
  totalPrice: number;
}

export interface CartCheckoutInput {
  storefrontId: number;
  items: {
    serviceId: number;
    quantity: number;
    selectedOptionIds?: number[];
  }[];
}

// --- Filter/Query Types ---

export interface StorefrontFilters {
  search?: string;
  categoryId?: number;
  sort?: "relevance" | "rating" | "recent" | "services";
  page?: number;
  limit?: number;
}

// --- Legacy Compatibility ---

/** @deprecated Use Storefront types instead */
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
