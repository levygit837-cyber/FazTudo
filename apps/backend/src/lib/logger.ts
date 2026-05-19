import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : isTest ? "silent" : "debug"),
  transport: !isProduction && !isTest
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // Structured fields included in every log
  base: {
    env: process.env.NODE_ENV || "development",
  },
  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger for a specific module.
 * Usage: const log = createLogger('orderController');
 */
export const createLogger = (module: string) => logger.child({ module });

export default logger;
