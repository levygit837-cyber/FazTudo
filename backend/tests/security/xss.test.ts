import { describe, it, expect } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { xssSanitizer } from '../../src/middleware/sanitize';

function createMockReq(body: any = {}, query: any = {}, params: any = {}): Partial<Request> {
  return { body, query, params };
}

describe('Security: XSS Sanitization', () => {
  it('sanitizes script tags from body', () => {
    const req = createMockReq({ name: '<script>alert("xss")</script>Hello' });
    const res = {} as Response;
    const next = (() => {}) as NextFunction;

    xssSanitizer(req as Request, res, next);

    expect(req.body.name).not.toContain('<script>');
    expect(req.body.name).toContain('Hello');
  });

  it('sanitizes nested objects', () => {
    const req = createMockReq({ user: { bio: '<img onerror="alert(1)" src="x">' } });
    const res = {} as Response;
    const next = (() => {}) as NextFunction;

    xssSanitizer(req as Request, res, next);

    expect(req.body.user.bio).not.toContain('onerror');
  });

  it('sanitizes arrays', () => {
    const req = createMockReq({ tags: ['<script>xss</script>', 'valid'] });
    const res = {} as Response;
    const next = (() => {}) as NextFunction;

    xssSanitizer(req as Request, res, next);

    expect(req.body.tags[0]).not.toContain('<script>');
    expect(req.body.tags[1]).toBe('valid');
  });

  it('preserves non-string values', () => {
    const req = createMockReq({ count: 42, active: true, price: 19.99 });
    const res = {} as Response;
    const next = (() => {}) as NextFunction;

    xssSanitizer(req as Request, res, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.price).toBe(19.99);
  });

  it('calls next()', () => {
    const req = createMockReq({});
    const res = {} as Response;
    let called = false;
    const next = (() => { called = true; }) as NextFunction;

    xssSanitizer(req as Request, res, next);

    expect(called).toBe(true);
  });
});
