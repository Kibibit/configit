/**
 * buildVaultConfigFromEnv
 *
 * Builds IVaultConfigOptions from standard environment variables.
 * Returns undefined when Vault is not configured, causing configit
 * to fall back to env vars / config files.
 *
 * Supported auth flows (checked in order):
 *   1. VAULT_TOKEN         → Token auth (local development)
 *   2. VAULT_GCP_ROLE      → GCP IAM auth (production / GKE)
 *
 * Common env vars:
 *   VAULT_ADDR             → Vault server URL (required)
 */

import { IVaultConfigOptions, IVaultFallbackConfig, SecretRefreshCallback } from './types';

export interface IBuildVaultConfigOptions {
  /** Seconds before expiry to trigger refresh. Default: 10 (token) / 60 (GCP) */
  refreshBuffer?: number;

  /** Fallback behavior when Vault is unavailable */
  fallback?: IVaultFallbackConfig;

  /** Callback fired when secrets are refreshed */
  onSecretRefreshed?: SecretRefreshCallback;
}

const DEFAULT_FALLBACK: IVaultFallbackConfig = {
  required: false,
  useCacheOnFailure: true,
  maxCacheAge: 3600000,
  failFast: false
};

export function buildVaultConfigFromEnv(
  options?: IBuildVaultConfigOptions
): IVaultConfigOptions | undefined {
  const vaultAddr = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;
  const vaultRole = process.env.VAULT_GCP_ROLE;

  if (!vaultAddr) {
    // eslint-disable-next-line no-undefined
    return undefined;
  }

  const fallback = options?.fallback ?? DEFAULT_FALLBACK;
  const onSecretRefreshed = options?.onSecretRefreshed;

  if (vaultToken) {
    return {
      endpoint: vaultAddr,
      auth: { method: 'token' as const, token: vaultToken },
      refreshBuffer: options?.refreshBuffer ?? 10,
      fallback,
      onSecretRefreshed
    };
  }

  if (vaultRole) {
    return {
      endpoint: vaultAddr,
      auth: { method: 'gcp' as const, role: vaultRole },
      refreshBuffer: options?.refreshBuffer ?? 60,
      fallback,
      onSecretRefreshed
    };
  }

  // eslint-disable-next-line no-undefined
  return undefined;
}
