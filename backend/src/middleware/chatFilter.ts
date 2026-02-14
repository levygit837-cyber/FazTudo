/**
 * Chat Content Filter
 *
 * Blocks personal contact information to keep communications
 * within the platform, protecting both parties.
 */

interface FilterResult {
  clean: boolean;
  sanitized: string;
  blockedTypes: string[];
}

// Phone numbers: (XX) XXXXX-XXXX, XX XXXXX-XXXX, XXXXXXXXXXX, etc.
const PHONE_REGEX = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

// Email addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Social media handles and URLs
const SOCIAL_PATTERNS = [
  /(?:instagram|insta)\.com\/[a-zA-Z0-9_.]+/gi,
  /(?:facebook|fb)\.com\/[a-zA-Z0-9_.]+/gi,
  /(?:twitter|x)\.com\/[a-zA-Z0-9_.]+/gi,
  /(?:linkedin)\.com\/in\/[a-zA-Z0-9_.]+/gi,
  /(?:wa\.me|api\.whatsapp\.com)\/\d+/gi,
  /(?:t\.me)\/[a-zA-Z0-9_.]+/gi,
  /@[a-zA-Z0-9_.]{3,30}(?=\s|$|[.,!?])/g, // @username patterns
];

// CPF: XXX.XXX.XXX-XX
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g;

// CNPJ: XX.XXX.XXX/XXXX-XX
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g;

// WhatsApp mentions
const WHATSAPP_REGEX = /(?:whats?\s*app|wpp|zap|zapzap)[\s:]*\d*/gi;

const PLACEHOLDER = "***";

/**
 * Filters personal contact information from chat messages.
 * Returns the sanitized message and a list of blocked content types.
 */
export function filterChatContent(content: string): FilterResult {
  let sanitized = content;
  const blockedTypes: string[] = [];

  // Check phone numbers
  if (PHONE_REGEX.test(sanitized)) {
    blockedTypes.push("telefone");
    sanitized = sanitized.replace(PHONE_REGEX, PLACEHOLDER);
  }

  // Check emails
  if (EMAIL_REGEX.test(sanitized)) {
    blockedTypes.push("email");
    sanitized = sanitized.replace(EMAIL_REGEX, PLACEHOLDER);
  }

  // Check social media
  for (const pattern of SOCIAL_PATTERNS) {
    if (pattern.test(sanitized)) {
      if (!blockedTypes.includes("rede social")) {
        blockedTypes.push("rede social");
      }
      sanitized = sanitized.replace(pattern, PLACEHOLDER);
    }
  }

  // Check CPF
  if (CPF_REGEX.test(sanitized)) {
    blockedTypes.push("CPF");
    sanitized = sanitized.replace(CPF_REGEX, PLACEHOLDER);
  }

  // Check CNPJ
  if (CNPJ_REGEX.test(sanitized)) {
    blockedTypes.push("CNPJ");
    sanitized = sanitized.replace(CNPJ_REGEX, PLACEHOLDER);
  }

  // Check WhatsApp mentions
  if (WHATSAPP_REGEX.test(sanitized)) {
    if (!blockedTypes.includes("telefone")) {
      blockedTypes.push("telefone");
    }
    sanitized = sanitized.replace(WHATSAPP_REGEX, PLACEHOLDER);
  }

  return {
    clean: blockedTypes.length === 0,
    sanitized,
    blockedTypes,
  };
}

/**
 * Returns a user-friendly message explaining what was blocked.
 */
export function getBlockedContentMessage(blockedTypes: string[]): string {
  if (blockedTypes.length === 0) return "";

  const types = blockedTypes.join(", ");
  return `Sua mensagem contém informações de contato pessoal (${types}) que foram removidas. Para sua segurança, mantenha a comunicação pela plataforma.`;
}
