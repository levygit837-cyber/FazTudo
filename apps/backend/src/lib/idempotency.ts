import prisma from "./prisma";
import { createLogger } from "./logger";

const log = createLogger("idempotency");

// Usando SystemConfig para armazenar chaves (sem nova tabela)
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Verifica se uma chave de idempotência já foi processada.
 * Retorna `true` se for duplicata (deve ser rejeitada), `false` se for nova.
 */
export const checkIdempotencyKey = async (
  key: string,
  userId: number,
): Promise<{ isDuplicate: boolean }> => {
  const storageKey = `idempotency:${userId}:${key}`;
  const existing = await prisma.systemConfig.findUnique({
    where: { key: storageKey },
  });

  if (existing) {
    const createdAt = new Date(existing.value as string).getTime();
    if (Date.now() - createdAt < IDEMPOTENCY_TTL_MS) {
      log.warn({ key, userId }, "Duplicate idempotency key detected");
      return { isDuplicate: true };
    }
    // Expirado — deletar e permitir
    await prisma.systemConfig.delete({ where: { key: storageKey } }).catch(() => {});
  }

  // Registrar nova chave
  await prisma.systemConfig.upsert({
    where: { key: storageKey },
    create: { key: storageKey, value: new Date().toISOString(), description: "Idempotency key" },
    update: { value: new Date().toISOString() },
  });

  return { isDuplicate: false };
};
