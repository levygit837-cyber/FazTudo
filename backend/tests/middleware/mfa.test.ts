import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../src/middleware/auth";

// ============================================
// MOCKS
// ============================================

const mockPrismaUserMFAFindUnique = vi.fn();
const mockPrismaUserMFAUpdate = vi.fn();

vi.mock("../../src/lib/prisma", () => ({
  default: {
    userMFA: {
      findUnique: (...args: any[]) => mockPrismaUserMFAFindUnique(...args),
      update: (...args: any[]) => mockPrismaUserMFAUpdate(...args),
    },
  },
}));

const mockVerifySync = vi.fn();

vi.mock("otplib", () => ({
  verifySync: (...args: any[]) => mockVerifySync(...args),
}));

vi.mock("../../src/controllers/mfaController", () => ({
  decryptSecret: vi.fn((ciphertext: string) => `decrypted-${ciphertext}`),
}));

vi.mock("../../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import AFTER mocks
import { requireMFA } from "../../src/middleware/mfa";

// ============================================
// HELPERS
// ============================================

function createMockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    user: { id: 1, email: "test@test.com", role: "CLIENT" },
    headers: {},
    ...overrides,
  } as any;
}

function createMockRes(): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
  };
  return res as Response;
}

// ============================================
// TESTS
// ============================================

describe("requireMFA middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it("should return 401 if user is not authenticated", async () => {
    const req = createMockReq({ user: undefined });
    const res = createMockRes();

    await requireMFA(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should allow non-admin users through if MFA is not configured", async () => {
    const req = createMockReq();
    const res = createMockRes();
    mockPrismaUserMFAFindUnique.mockResolvedValue(null);

    await requireMFA(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("should block admin users without MFA configured", async () => {
    const req = createMockReq({
      user: { id: 1, email: "admin@test.com", role: "ADMIN" },
    } as any);
    const res = createMockRes();
    mockPrismaUserMFAFindUnique.mockResolvedValue(null);

    await requireMFA(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        mfaSetupRequired: true,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should require MFA code header when MFA is enabled", async () => {
    const req = createMockReq();
    const res = createMockRes();
    mockPrismaUserMFAFindUnique.mockResolvedValue({
      isEnabled: true,
      secret: "encrypted-secret",
    });

    await requireMFA(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ mfaRequired: true }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should accept valid MFA code and call next", async () => {
    const req = createMockReq({
      headers: { "x-mfa-code": "123456" },
    } as any);
    const res = createMockRes();

    mockPrismaUserMFAFindUnique.mockResolvedValue({
      isEnabled: true,
      secret: "encrypted-secret",
    });
    mockVerifySync.mockReturnValue({ valid: true, delta: 0 });
    mockPrismaUserMFAUpdate.mockResolvedValue({});

    await requireMFA(req, res, next);

    expect(mockVerifySync).toHaveBeenCalledWith({
      token: "123456",
      secret: "decrypted-encrypted-secret",
    });
    expect(next).toHaveBeenCalled();
  });

  it("should reject invalid MFA code", async () => {
    const req = createMockReq({
      headers: { "x-mfa-code": "000000" },
    } as any);
    const res = createMockRes();

    mockPrismaUserMFAFindUnique.mockResolvedValue({
      isEnabled: true,
      secret: "encrypted-secret",
    });
    mockVerifySync.mockReturnValue({ valid: false });

    await requireMFA(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should update lastUsedAt on successful verification", async () => {
    const req = createMockReq({
      headers: { "x-mfa-code": "123456" },
    } as any);
    const res = createMockRes();

    mockPrismaUserMFAFindUnique.mockResolvedValue({
      isEnabled: true,
      secret: "encrypted-secret",
    });
    mockVerifySync.mockReturnValue({ valid: true, delta: 0 });
    mockPrismaUserMFAUpdate.mockResolvedValue({});

    await requireMFA(req, res, next);

    expect(mockPrismaUserMFAUpdate).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
