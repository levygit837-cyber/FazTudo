import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  withdrawalSchema,
  createPaymentSchema,
} from '../../src/middleware/validation';

describe('Security: Input Validation', () => {
  describe('registerSchema', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@email.com',
        password: 'Abc123',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without uppercase', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@email.com',
        password: 'abcdefg1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without numbers', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@email.com',
        password: 'Abcdefgh',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid registration', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@email.com',
        password: 'Abcdefg1',
      });
      expect(result.success).toBe(true);
    });

    it('normalizes email to lowercase', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'TEST@Email.COM',
        password: 'Abcdefg1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@email.com');
      }
    });

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'not-an-email',
        password: 'Abcdefg1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = registerSchema.safeParse({
        name: 'Test User',
        email: 'test@email.com',
        password: 'Abcdefg1',
        role: 'ADMIN',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('rejects same current and new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'Abcdefg1',
        newPassword: 'Abcdefg1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects weak new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'Abcdefg1',
        newPassword: 'weak',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('withdrawalSchema', () => {
    it('rejects amount below minimum', () => {
      const result = withdrawalSchema.safeParse({ amount: 5 });
      expect(result.success).toBe(false);
    });

    it('rejects amount above maximum', () => {
      const result = withdrawalSchema.safeParse({ amount: 60000 });
      expect(result.success).toBe(false);
    });

    it('rejects negative amount', () => {
      const result = withdrawalSchema.safeParse({ amount: -100 });
      expect(result.success).toBe(false);
    });

    it('accepts valid amount', () => {
      const result = withdrawalSchema.safeParse({ amount: 100 });
      expect(result.success).toBe(true);
    });
  });

  describe('createPaymentSchema', () => {
    it('rejects invalid payment method', () => {
      const result = createPaymentSchema.safeParse({ paymentMethod: 'BITCOIN' });
      expect(result.success).toBe(false);
    });

    it('accepts valid payment method', () => {
      const result = createPaymentSchema.safeParse({ paymentMethod: 'PIX' });
      expect(result.success).toBe(true);
    });
  });
});
