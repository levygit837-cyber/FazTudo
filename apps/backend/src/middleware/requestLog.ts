import pinoHttp from "pino-http";
import logger from "../lib/logger";

/**
 * HTTP request logging middleware using pino-http.
 * Automatically logs: method, url, statusCode, responseTime, userAgent.
 * In dev: pretty printed. In prod: JSON per line.
 */
export const requestLogger = pinoHttp({
  logger,
  // Don't log health/metrics/root requests (noisy in prod)
  autoLogging: {
    ignore: (req) => {
      const url = (req as any).url || "";
      return url === "/" || url.startsWith("/health") || url === "/metrics";
    },
  },
  // Custom log level based on response status
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Customize what gets serialized from the request
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      // Don't log headers (may contain auth tokens)
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
