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
