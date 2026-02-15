import { describe, it, expect } from "vitest";
import { filterChatContent } from "../../src/middleware/chatFilter";

describe("filterChatContent", () => {
  it("should block phone numbers in various formats", () => {
    const cases = [
      "(11) 98765-4321",
      "11987654321",
      "+55 11 98765-4321",
      "55 11 98765 4321",
      "meu tel: 11 98765-4321",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be blocked`).toBe(false);
      expect(result.blockedTypes).toContain("telefone");
    }
  });

  it("should block email addresses", () => {
    const result = filterChatContent("me manda em joao@gmail.com");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("email");
  });

  it("should block social media URLs and handles", () => {
    const cases = [
      "instagram.com/meuuser",
      "me segue @meuuser",
      "facebook.com/meuuser",
      "linkedin.com/in/meuuser",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be blocked`).toBe(false);
      expect(result.blockedTypes).toContain("rede social");
    }
  });

  it("should block CPF numbers", () => {
    const result = filterChatContent("meu cpf 123.456.789-00");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("CPF");
  });

  it("should block CNPJ numbers", () => {
    const result = filterChatContent("cnpj 12.345.678/0001-90");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("CNPJ");
  });

  it("should block WhatsApp mentions", () => {
    const cases = [
      "me chama no whatsapp",
      "manda no wpp",
      "fala no zap",
      "meu zapzap",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be blocked`).toBe(false);
    }
  });

  it("should block PIX keys (email, phone, CPF, random key)", () => {
    const cases = [
      "minha chave pix: joao@gmail.com",
      "pix: 11987654321",
      "chave pix 123.456.789-00",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be blocked`).toBe(false);
    }
  });

  it("should block attempts to share personal info with creative formatting", () => {
    const cases = [
      "meu número é nove oito sete seis cinco quatro três dois um",
      "insta: meu_perfil",
      "me liga: (11) 9.8765-4321",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be blocked`).toBe(false);
    }
  });

  it("should allow normal conversation", () => {
    const cases = [
      "Bom dia, a que horas você pode vir?",
      "O serviço ficou ótimo, obrigado!",
      "Preciso que traga as ferramentas necessárias.",
      "Pode confirmar o endereço cadastrado?",
    ];
    for (const c of cases) {
      const result = filterChatContent(c);
      expect(result.clean, `Expected "${c}" to be allowed`).toBe(true);
    }
  });
});
