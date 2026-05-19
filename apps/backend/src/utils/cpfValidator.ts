/**
 * Brazilian CPF validation with check-digit verification.
 * Rejects formatting-only variants (e.g. 000.000.000-00, 111.111.111-11).
 */

/** Strip formatting characters from CPF string */
function stripCpf(cpf: string): string {
  return cpf.replace(/[\s.\-]/g, "");
}

/**
 * Returns true if the string is a valid CPF (11 digits, correct check digits).
 * Does NOT accept trivial sequences (all same digit).
 *
 * @example
 *   isValidCPF("529.982.247-25") // true
 *   isValidCPF("111.111.111-11") // false (trivial sequence)
 *   isValidCPF("000.000.000-00") // false
 */
export function isValidCPF(raw: string): boolean {
  const digits = stripCpf(raw);

  if (digits.length !== 11) return false;
  if (!/^\d{11}$/.test(digits)) return false;

  // Reject trivial sequences: 00000000000 … 99999999999
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9), 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/** Alias for backwards compatibility */
export const isValidCpf = isValidCPF;
