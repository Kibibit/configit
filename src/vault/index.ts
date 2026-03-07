/**
 * Vault Integration Module
 * Exports for HashiCorp Vault integration
 */

// Types
export * from './types';

// Decorators
export {
  VaultPath,
  VaultEngine,
  VaultKey,
  VaultRefreshBuffer,
  VaultOptional,
  getVaultPath,
  getVaultEngine,
  getVaultKey,
  getVaultRefreshBuffer,
  isVaultOptional,
  detectEngineFromPath,
  buildVaultMetadata,
  getAllVaultMetadata,
  getVaultPropertyNames
} from './decorators';

// Components
export { VaultProvider } from './vault-provider';
export { VaultCache } from './vault-cache';
export { SecretRefreshManager } from './secret-refresh-manager';
export { VaultIntegration } from './vault-integration';

// Helpers
export { buildVaultConfigFromEnv } from './build-vault-config';
export type { IBuildVaultConfigOptions } from './build-vault-config';
