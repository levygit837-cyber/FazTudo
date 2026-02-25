import { UserRole } from "./enums";
import { User } from "./entities";

// ============================================
// AUTHENTICATION TYPES
// ============================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole.CLIENT | UserRole.PROFESSIONAL;
  document?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
