/**
 * Safe Prisma select patterns that NEVER include sensitive fields.
 * Use these instead of `include: { client: true }` which returns ALL fields.
 *
 * FORBIDDEN fields (never return to client):
 * - password, refreshToken, resetPasswordToken, resetPasswordExpires
 * - emailVerifyToken, emailVerifyExpires, tokenVersion
 */

/** Minimal user info for listing/search results */
export const SAFE_USER_SELECT_MINIMAL = {
  id: true,
  name: true,
  profileImage: true,
  ratingAverage: true,
  totalReviews: true,
} as const;

/** Standard user info for order/payment contexts */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  isVerified: true,
  profileImage: true,
  bio: true,
  ratingAverage: true,
  totalReviews: true,
  createdAt: true,
} as const;

/** User info for the user themselves (includes document, balance) */
export const SAFE_USER_SELECT_SELF = {
  ...SAFE_USER_SELECT,
  document: true,
  balance: true,
  emailVerified: true,
  updatedAt: true,
} as const;
