/**
 * Chat Content Filter
 *
 * Blocks personal contact information to keep communications
 * within the platform, protecting both parties.
 */

import type { Request, Response, NextFunction } from "express";

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
  /(?:tiktok\.com\/@?)[a-zA-Z0-9_.]+/gi,
  /(?:youtube\.com\/(?:@|channel\/|c\/)?)[a-zA-Z0-9_.]+/gi,
  /@[a-zA-Z0-9_.]{3,30}(?=\s|$|[.,!?])/g, // @username patterns
];

// Social media keywords with identifiers (e.g., "insta: meu_perfil")
const SOCIAL_KEYWORD_PATTERNS = [
  /(?:insta|instagram|face|facebook|twitter|tiktok|telegram|linkedin)[\s:]+[a-zA-Z0-9_.@/]+/gi,
];

// CPF: XXX.XXX.XXX-XX
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g;

// CNPJ: XX.XXX.XXX/XXXX-XX
const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g;

// WhatsApp mentions
const WHATSAPP_REGEX = /(?:whats?\s*app|wpp|zap|zapzap)[\s:]*\d*/gi;

// PIX key mentions
const PIX_REGEX = /(?:chave\s*)?pix[\s:]+\S+/gi;

// Phone numbers written in words (Portuguese)
const PHONE_WORDS_REGEX = /(?:(?:meu\s+)?(?:n[uú]mero|tel(?:efone)?|celular|contato)\s+[eé:]\s*).{5,50}/gi;

// Numbers written as words (attempts to bypass)
const NUMBER_WORDS = /(?:zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|meia|sete|oito|nove)(?:\s+(?:zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|meia|sete|oito|nove)){6,}/gi;

// URL patterns (generic)
const URL_REGEX = /https?:\/\/[^\s]+/gi;

// "Me liga", "me chama", "me adiciona" + variations
const CONTACT_REQUEST_REGEX = /(?:me\s+(?:liga|chama|adiciona|manda|envia)\s*(?:no|na|em|pelo)?)\s*(?:whatsapp|wpp|zap|telegram|insta|instagram|face|facebook|email)/gi;

const PLACEHOLDER = "***";

/**
 * Helper to test and replace with a regex, resetting lastIndex for global regexes.
 */
function testAndReplace(
  text: string,
  regex: RegExp,
  blockedTypes: string[],
  typeName: string,
): string {
  regex.lastIndex = 0;
  if (regex.test(text)) {
    if (!blockedTypes.includes(typeName)) {
      blockedTypes.push(typeName);
    }
    regex.lastIndex = 0;
    text = text.replace(regex, PLACEHOLDER);
  }
  return text;
}

/**
 * Filters personal contact information from chat messages.
 * Returns the sanitized message and a list of blocked content types.
 */
export function filterChatContent(content: string): FilterResult {
  let sanitized = content;
  const blockedTypes: string[] = [];

  // Check phone numbers
  sanitized = testAndReplace(sanitized, PHONE_REGEX, blockedTypes, "telefone");

  // Check emails
  sanitized = testAndReplace(sanitized, EMAIL_REGEX, blockedTypes, "email");

  // Check social media URLs
  for (const pattern of SOCIAL_PATTERNS) {
    sanitized = testAndReplace(sanitized, pattern, blockedTypes, "rede social");
  }

  // Check social media keywords
  for (const pattern of SOCIAL_KEYWORD_PATTERNS) {
    sanitized = testAndReplace(sanitized, pattern, blockedTypes, "rede social");
  }

  // Check CPF
  sanitized = testAndReplace(sanitized, CPF_REGEX, blockedTypes, "CPF");

  // Check CNPJ
  sanitized = testAndReplace(sanitized, CNPJ_REGEX, blockedTypes, "CNPJ");

  // Check WhatsApp mentions
  sanitized = testAndReplace(sanitized, WHATSAPP_REGEX, blockedTypes, "telefone");

  // Check PIX keys
  sanitized = testAndReplace(sanitized, PIX_REGEX, blockedTypes, "chave PIX");

  // Check phone numbers as words
  sanitized = testAndReplace(sanitized, NUMBER_WORDS, blockedTypes, "telefone");

  // Check contact request patterns
  sanitized = testAndReplace(sanitized, CONTACT_REQUEST_REGEX, blockedTypes, "solicitação de contato");

  // Check generic URLs (except platform URLs)
  URL_REGEX.lastIndex = 0;
  const urlMatches = sanitized.match(URL_REGEX);
  if (urlMatches) {
    const externalUrls = urlMatches.filter(
      (url) => !url.includes("faztudo") && !url.includes("localhost"),
    );
    if (externalUrls.length > 0) {
      if (!blockedTypes.includes("link externo")) {
        blockedTypes.push("link externo");
      }
      for (const url of externalUrls) {
        sanitized = sanitized.replace(url, PLACEHOLDER);
      }
    }
  }

  // Check "phone number is" pattern
  sanitized = testAndReplace(sanitized, PHONE_WORDS_REGEX, blockedTypes, "telefone");

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

// ─── EXPRESS MIDDLEWARE ────────────────────────────────────────────────────

/**
 * Express middleware: blocks messages containing personal contact information.
 * Returns HTTP 400 if req.body.content contains disallowed content types.
 * Apply to all routes that accept chat text messages.
 */
export const chatFilterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body?.content && typeof req.body.content === "string") {
    const result = filterChatContent(req.body.content);
    if (!result.clean) {
      res.status(400).json({
        success: false,
        message: `Mensagem contém informações de contato não permitidas: ${result.blockedTypes.join(", ")}`,
        data: { blockedTypes: result.blockedTypes },
      });
      return;
    }
    req.body.content = result.sanitized;
  }
  next();
};
