// frontend/src/types/company.ts

export interface CompanyPermissions {
  metrics: { view: boolean; viewTeam: boolean };
  chat: { view: boolean; respond: boolean; manage: boolean };
  orders: { view: boolean; assign: boolean; manage: boolean };
  finance: { view: boolean; transfer: boolean; salary: boolean };
  team: { view: boolean; invite: boolean; manage: boolean };
  catalog: { edit: boolean };
  company: { settings: boolean; roles: boolean };
}

export interface CompanyProfile {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  website?: string;
  phone?: string;
  address?: Record<string, unknown>;
  isVerified: boolean;
  industry?: string;
  foundedAt?: string;
  createdAt: string;
}

export interface CompanyRole {
  id: number;
  companyId: number;
  name: string;
  level: number;
  permissions: CompanyPermissions;
  color?: string;
  createdAt: string;
}

export interface CompanyMember {
  id: number;
  companyId: number;
  userId: number;
  roleId: number;
  customPermissions?: Partial<CompanyPermissions>;
  joinedAt: string;
  isActive: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    profileImage?: string;
    ratingAverage: number;
    isVerified: boolean;
  };
  role: CompanyRole;
}

export interface CompanySalaryRule {
  id: number;
  companyId: number;
  roleId?: number;
  memberId?: number;
  amount: number;
  dayOfMonth: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  role?: { name: string };
  member?: { user: { name: string } };
}

export interface CompanySalaryPayment {
  id: number;
  ruleId: number;
  memberId: number;
  amount: number;
  paidAt: string;
  status: string; // "PENDING" | "PAID" | "FAILED"
  note?: string;
  rule?: { description?: string };
  member?: { user: { name: string } };
}

export interface ServiceTeam {
  id: number;
  orderId: number;
  leaderId: number;
  createdAt: string;
  leader?: CompanyMember;
  members?: Array<{
    id: number;
    memberId: number;
    member?: CompanyMember;
  }>;
}

export interface CompanyDashboardStats {
  totalOrders: number;
  activeOrders: number;
  totalRevenue: number;
  pendingSalaries: number;
  totalMembers: number;
  activeMembers: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export interface MemberPerformance {
  member: {
    id: number;
    name: string;
    profileImage?: string;
    role: { name: string; color?: string };
    ratingAverage: number;
  };
  stats: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    completionRate: number;
    ledTotal: number;
    ledCompleted: number;
  };
}

export interface TopService {
  id: number;
  title: string;
  category: string;
  price: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

export interface AnalyticsOverview {
  totalOrders: number;
  completedOrders: number;
  ordersLast30Days: number;
  completionRate: number;
  totalRevenue: number;
  revenueLast30Days: number;
  totalMembers: number;
  activeMembers: number;
  averageRating: number;
}

export interface PendingCompany {
  id: number;
  userId: number;
  companyName: string;
  cnpj: string;
  description?: string;
  industry?: string;
  createdAt: string;
  isVerified: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    status: string;
    createdAt: string;
  };
  _count: { members: number };
}

export interface CompanyChannel {
  id: number;
  companyId: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  members?: CompanyChannelMember[];
  _count?: { members: number };
}

export interface CompanyChannelMember {
  id: number;
  channelId: number;
  memberId: number;
  member: CompanyMember;
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type StorefrontBlockType = "HERO" | "ABOUT" | "TESTIMONIALS";

export type CompanyTier = "EMPRESA" | "PARCEIRO" | "ELITE";

// ─── Storefront blocks ────────────────────────────────────────────────────────

export interface CompanyStorefrontBlock {
  id: number;
  companyId: number;
  type: StorefrontBlockType;
  order: number;
  isActive: boolean;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Storefront sections & items ─────────────────────────────────────────────

export interface CompanyStorefrontItem {
  id: number;
  sectionId: number;
  listingId: number;
  order: number;
  isFeatured: boolean;
  listing?: {
    id: number;
    title: string;
    description: string;
    price: number;
    images: string[];
    category?: { name: string };
  };
}

export interface CompanyStorefrontSection {
  id: number;
  companyId: number;
  title: string;
  description?: string;
  order: number;
  isActive: boolean;
  items: CompanyStorefrontItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Pinned testimonials ─────────────────────────────────────────────────────

export interface CompanyPinnedTestimonial {
  id: number;
  companyId: number;
  reviewId: number;
  order: number;
  review?: {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;
    author?: { name: string; profileImage?: string };
  };
}

// ─── Public storefront response ───────────────────────────────────────────────

export interface PublicStorefront {
  company: {
    id: number;
    companyName: string;
    cnpj: string;
    description?: string;
    logoUrl?: string;
    tier: CompanyTier;
    storefrontSections: CompanyStorefrontSection[];
    storefrontBlocks: CompanyStorefrontBlock[];
    pinnedTestimonials: CompanyPinnedTestimonial[];
    user?: { name: string; profileImage?: string };
    members?: Array<{
      id: number;
      role?: { name: string };
      user?: { name: string; profileImage?: string };
    }>;
  };
  ordersCount: number;
}

// ─── Invite token ─────────────────────────────────────────────────────────────

export interface CompanyInviteToken {
  id: number;
  companyId: number;
  token: string;
  role: string;
  expiresAt: string;
  usedAt?: string;
  createdById: number;
  usedByUserId?: number;
}

export interface InviteValidation {
  company: { id: number; companyName: string; logoUrl?: string };
  role: string;
  expiresAt: string;
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface ConversionFunnel {
  received: number;
  accepted: number;
  inProgress: number;
  completed: number;
}

export interface TeamOccupancyEntry {
  userId: number;
  name: string;
  activeOrders: number;
}

export interface NPSData {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
}
