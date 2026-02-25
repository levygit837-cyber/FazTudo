import { createLogger } from "../lib/logger";

const log = createLogger("secrets");

type SecretsProvider = "env" | "aws" | "gcp" | "azure";

const SECRETS_PROVIDER = (process.env.SECRETS_PROVIDER || "env") as SecretsProvider;

const secretsCache = new Map<string, string>();
let lastReload = 0;
const RELOAD_INTERVAL_MS = 60 * 60 * 1000; // 1h

/**
 * List of all sensitive keys managed by the secrets system.
 * When migrating to a cloud provider, these keys will be fetched
 * from the secrets manager instead of process.env.
 */
const MANAGED_SECRETS = [
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "MP_ACCESS_TOKEN",
  "MP_CLIENT_SECRET",
  "MP_WEBHOOK_SECRET",
  "SMTP_PASS",
  "MFA_ENCRYPTION_KEY",
  "DATABASE_URL",
] as const;

/**
 * Fetch a secret from the configured provider.
 * In dev: reads from process.env (current behavior).
 * In prod: reads from cloud provider secrets manager.
 *
 * Results are cached for 1 hour to reduce API calls.
 */
export async function getSecret(key: string): Promise<string> {
  // Check cache freshness
  if (secretsCache.has(key) && Date.now() - lastReload < RELOAD_INTERVAL_MS) {
    return secretsCache.get(key)!;
  }

  let value: string;

  switch (SECRETS_PROVIDER) {
    case "aws":
      value = await getAWSSecret(key);
      break;
    case "gcp":
      value = await getGCPSecret(key);
      break;
    case "azure":
      value = await getAzureSecret(key);
      break;
    case "env":
    default:
      value = process.env[key] || "";
  }

  secretsCache.set(key, value);
  lastReload = Date.now();
  return value;
}

/**
 * Pre-load all managed secrets into cache at boot time.
 * This ensures the first request to getSecret() is fast
 * and validates that all required secrets are accessible.
 */
export async function preloadSecrets(): Promise<void> {
  const missing: string[] = [];

  for (const key of MANAGED_SECRETS) {
    const value = await getSecret(key);
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    log.warn(
      { provider: SECRETS_PROVIDER, missing },
      "Some secrets are not configured",
    );
  }

  log.info(
    {
      provider: SECRETS_PROVIDER,
      total: MANAGED_SECRETS.length,
      loaded: MANAGED_SECRETS.length - missing.length,
    },
    "Secrets preloaded",
  );
}

/**
 * Force-reload all cached secrets from the provider.
 * Useful after secret rotation.
 */
export async function reloadSecrets(): Promise<void> {
  secretsCache.clear();
  lastReload = 0;
  await preloadSecrets();
  log.info("Secrets cache reloaded");
}

/**
 * Get the currently configured secrets provider.
 */
export function getSecretsProvider(): SecretsProvider {
  return SECRETS_PROVIDER;
}

// ============================================
// CLOUD PROVIDER PLACEHOLDERS
// ============================================
// These functions are stubs that fall back to process.env.
// Implement the actual SDK calls when deploying to a
// cloud provider with a secrets manager.

async function getAWSSecret(key: string): Promise<string> {
  // Implement with @aws-sdk/client-secrets-manager when deploying to AWS
  log.debug({ key, provider: "aws" }, "AWS Secrets Manager — using env fallback");
  return process.env[key] || "";
}

async function getGCPSecret(key: string): Promise<string> {
  // Implement with @google-cloud/secret-manager when deploying to GCP
  log.debug({ key, provider: "gcp" }, "GCP Secret Manager — using env fallback");
  return process.env[key] || "";
}

async function getAzureSecret(key: string): Promise<string> {
  // Implement with @azure/keyvault-secrets when deploying to Azure
  log.debug({ key, provider: "azure" }, "Azure Key Vault — using env fallback");
  return process.env[key] || "";
}
