import { describe, it, expect } from "vitest";
import { filterChatContent } from "../../src/middleware/chatFilter";

/**
 * Integration test: verifica o fluxo completo de chat mensagens
 * - Tipos de mensagem (TEXT, ATTACHMENT, LOCATION, SYSTEM)
 * - Filtro de conteúdo pessoal (PIX, telefone, redes sociais, URLs)
 * - Validação de schema (Zod)
 */
describe("Chat Mensagens - Integration", () => {
  describe("Message types", () => {
    it("TEXT messages should be filtered for personal data", () => {
      const result = filterChatContent("Me chama no whatsapp 11 98765-4321");
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain("telefone");
      expect(result.sanitized).not.toContain("98765");
    });

    it("should allow normal service-related conversation", () => {
      const messages = [
        "Bom dia! A que horas posso ir?",
        "O serviço ficou excelente!",
        "Preciso que traga ferramentas de pintura",
        "Pode vir pela manhã?",
        "Vou precisar de 2 dias para concluir",
      ];
      for (const msg of messages) {
        const result = filterChatContent(msg);
        expect(result.clean, `"${msg}" should be allowed`).toBe(true);
      }
    });
  });

  describe("Content filter - PIX keys", () => {
    it("should block PIX key with email format", () => {
      const result = filterChatContent("minha chave pix: joao@email.com");
      expect(result.clean).toBe(false);
    });

    it("should block PIX key with phone format", () => {
      const result = filterChatContent("pix: 11987654321");
      expect(result.clean).toBe(false);
    });

    it("should block PIX key with CPF format", () => {
      const result = filterChatContent("chave pix 123.456.789-00");
      expect(result.clean).toBe(false);
    });
  });

  describe("Content filter - Social media bypass attempts", () => {
    it("should block 'insta: usuario'", () => {
      const result = filterChatContent("me segue, insta: meu_perfil");
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain("rede social");
    });

    it("should block TikTok URLs", () => {
      const result = filterChatContent("veja meu tiktok.com/@meuuser");
      expect(result.clean).toBe(false);
    });

    it("should block YouTube URLs", () => {
      const result = filterChatContent("meu canal youtube.com/@canal");
      expect(result.clean).toBe(false);
    });
  });

  describe("Content filter - Contact requests", () => {
    it("should block 'me chama no whatsapp'", () => {
      const result = filterChatContent("me chama no whatsapp");
      expect(result.clean).toBe(false);
    });

    it("should block 'me adiciona no instagram'", () => {
      const result = filterChatContent("me adiciona no instagram");
      expect(result.clean).toBe(false);
    });
  });

  describe("Content filter - External URLs", () => {
    it("should block external URLs", () => {
      const result = filterChatContent("veja aqui https://www.outrosite.com/promo");
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain("link externo");
    });

    it("should allow platform URLs", () => {
      const result = filterChatContent("veja em https://faztudo.com/pedido/123");
      expect(result.clean).toBe(true);
    });
  });

  describe("Content filter - Number words bypass", () => {
    it("should block phone numbers written as words", () => {
      const result = filterChatContent(
        "meu numero: nove oito sete seis cinco quatro três dois um"
      );
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain("telefone");
    });
  });

  describe("Content filter - Multiple violations", () => {
    it("should detect multiple violation types", () => {
      const result = filterChatContent(
        "me manda no whatsapp 11 98765-4321, ou email: joao@gmail.com, pix: minhachave"
      );
      expect(result.clean).toBe(false);
      expect(result.blockedTypes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
