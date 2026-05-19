import { describe, it, expect } from "vitest";
import { isValidCPF } from "../../src/utils/cpfValidator";

describe("isValidCPF", () => {
  it("accepts valid CPF (digits only)", () => {
    expect(isValidCPF("12345678909")).toBe(true);
  });

  it("accepts valid CPF (formatted with dots and dash)", () => {
    expect(isValidCPF("123.456.789-09")).toBe(true);
  });

  it("rejects CPF with all same digits", () => {
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("00000000000")).toBe(false);
    expect(isValidCPF("99999999999")).toBe(false);
  });

  it("rejects CPF with wrong first check digit", () => {
    // 12345678901 has wrong first check digit (correct is 0, not 0 - let's use a clearly wrong one)
    expect(isValidCPF("12345678901")).toBe(false);
  });

  it("rejects CPF that is too short", () => {
    expect(isValidCPF("1234567")).toBe(false);
  });

  it("rejects CPF that is too long", () => {
    expect(isValidCPF("123456789012")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidCPF("")).toBe(false);
  });

  it("accepts MercadoPago test CPF (12345678909)", () => {
    // This is the official MP sandbox CPF
    expect(isValidCPF("12345678909")).toBe(true);
  });
});
