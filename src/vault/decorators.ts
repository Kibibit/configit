/**
 * Vault Decorators
 * Composable decorators for marking configuration properties as Vault secrets
 */

import { kebabCase } from 'lodash';

import { VaultEngineType, VaultPropertyMetadata } from './types';

import 'reflect-metadata';

/**
 * Symbols for storing individual decorator metadata
 */
const VAULT_PATH_SYMBOL = Symbol('configit:vault:path');
const VAULT_ENGINE_SYMBOL = Symbol('configit:vault:engine');
const VAULT_KEY_SYMBOL = Symbol('configit:vault:key');
const VAULT_REFRESH_BUFFER_SYMBOL = Symbol('configit:vault:refreshBuffer');
const VAULT_OPTIONAL_SYMBOL = Symbol('configit:vault:optional');
const VAULT_PROPERTIES_SYMBOL = Symbol('configit:vault:properties');

/**
 * Register a property as having Vault metadata (for discovery)
 */
function registerVaultProperty(target: unknown, propertyKey: string): void {
  const constructor = (target as object).constructor;
  const existingProperties: string[] = Reflect.getMetadata(VAULT_PROPERTIES_SYMBOL, constructor) || [];
  if (!existingProperties.includes(propertyKey)) {
    Reflect.defineMetadata(VAULT_PROPERTIES_SYMBOL, [ ...existingProperties, propertyKey ], constructor);
  }
}

/**
 * Get all registered Vault property names for a class
 */
export function getVaultPropertyNames(target: unknown): string[] {
  const constructor = typeof target === 'function' ? target : (target as object).constructor;
  return Reflect.getMetadata(VAULT_PROPERTIES_SYMBOL, constructor) || [];
}

/**
 * Specifies the Vault path for a property (required for Vault secrets)
 * @param path Full Vault path (e.g., 'secret/data/myapp/db_password' or 'database/creds/my-role')
 */
export function VaultPath(path: string): PropertyDecorator {
  return function(target: unknown, propertyKey: string | symbol) {
    const key = String(propertyKey);
    Reflect.defineMetadata(VAULT_PATH_SYMBOL, path, target, key);
    // Register this property for discovery
    registerVaultProperty(target, key);
  };
}

/**
 * Specifies the Vault secrets engine type (optional, auto-detected from path)
 * @param engine Engine type
 */
export function VaultEngine(engine: VaultEngineType): PropertyDecorator {
  return function(target: unknown, propertyKey: string | symbol) {
    const key = String(propertyKey);
    Reflect.defineMetadata(VAULT_ENGINE_SYMBOL, engine, target, key);
  };
}

/**
 * Specifies the key name within the secret (optional, defaults to property name in kebab-case)
 * Only used for KV v1/v2 engines
 * @param key Key name
 */
export function VaultKey(key: string): PropertyDecorator {
  return function(target: unknown, propertyKey: string | symbol) {
    const keyName = String(propertyKey);
    Reflect.defineMetadata(VAULT_KEY_SYMBOL, key, target, keyName);
  };
}

/**
 * Override default refresh buffer (optional)
 * @param seconds Refresh buffer in seconds (default: 300s or 10% of TTL, whichever is smaller)
 */
export function VaultRefreshBuffer(seconds: number): PropertyDecorator {
  return function(target: unknown, propertyKey: string | symbol) {
    const key = String(propertyKey);
    Reflect.defineMetadata(VAULT_REFRESH_BUFFER_SYMBOL, seconds, target, key);
  };
}

/**
 * Mark secret as optional - fallback to environment variable if Vault unavailable
 * Without this decorator, Vault secrets are required by default
 */
export function VaultOptional(): PropertyDecorator {
  return function(target: unknown, propertyKey: string | symbol) {
    const key = String(propertyKey);
    Reflect.defineMetadata(VAULT_OPTIONAL_SYMBOL, true, target, key);
  };
}

/**
 * Get Vault path for a property
 */
export function getVaultPath(target: any, propertyKey: string): string | undefined {
  return Reflect.getMetadata(VAULT_PATH_SYMBOL, target, propertyKey);
}

/**
 * Get Vault engine for a property
 */
export function getVaultEngine(target: any, propertyKey: string): VaultEngineType | undefined {
  return Reflect.getMetadata(VAULT_ENGINE_SYMBOL, target, propertyKey);
}

/**
 * Get Vault key for a property
 */
export function getVaultKey(target: any, propertyKey: string): string | undefined {
  return Reflect.getMetadata(VAULT_KEY_SYMBOL, target, propertyKey);
}

/**
 * Get Vault refresh buffer for a property
 */
export function getVaultRefreshBuffer(target: any, propertyKey: string): number | undefined {
  return Reflect.getMetadata(VAULT_REFRESH_BUFFER_SYMBOL, target, propertyKey);
}

/**
 * Check if Vault secret is optional for a property
 */
export function isVaultOptional(target: any, propertyKey: string): boolean {
  return Reflect.getMetadata(VAULT_OPTIONAL_SYMBOL, target, propertyKey) === true;
}

/**
 * Detect engine type from Vault path
 */
export function detectEngineFromPath(path: string): VaultEngineType {
  // Common path patterns
  if (path.startsWith('secret/data/')) {
    return 'kv-v2';
  }
  if (path.startsWith('secret/') && !path.includes('/data/')) {
    return 'kv-v1';
  }
  if (path.startsWith('database/creds/')) {
    return 'database';
  }
  if (path.startsWith('aws/creds/')) {
    return 'aws';
  }
  if (path.startsWith('azure/creds/')) {
    return 'azure';
  }
  if (path.startsWith('gcp/')) {
    return 'gcp';
  }
  if (path.startsWith('transit/')) {
    return 'transit';
  }
  if (path.startsWith('pki/')) {
    return 'pki';
  }

  // Default to kv-v2 (most common)
  return 'kv-v2';
}

/**
 * Get property type from metadata (basic implementation)
 */
function getPropertyType(target: any, propertyKey: string): string {
  // Try to get type from reflect-metadata
  const type = Reflect.getMetadata('design:type', target, propertyKey);
  if (type) {
    return type.name || 'unknown';
  }
  return 'unknown';
}

/**
 * Build complete Vault metadata for a property from individual decorators
 */
export function buildVaultMetadata(
  target: any,
  propertyKey: string
): VaultPropertyMetadata | undefined {
  const path = getVaultPath(target, propertyKey);
  if (!path) {
    return undefined; // Not a Vault property
  }

  const engine = getVaultEngine(target, propertyKey) || detectEngineFromPath(path);
  const key = getVaultKey(target, propertyKey) || kebabCase(propertyKey);
  const refreshBuffer = getVaultRefreshBuffer(target, propertyKey);
  const optional = isVaultOptional(target, propertyKey);
  const propertyType = getPropertyType(target, propertyKey);

  return {
    path,
    engine,
    key,
    refreshBuffer,
    required: !optional,
    propertyName: propertyKey,
    propertyType
  };
}

/**
 * Get all Vault metadata for a class
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllVaultMetadata(target: any): Record<string, VaultPropertyMetadata> {
  const metadata: Record<string, VaultPropertyMetadata> = {};

  // Get registered Vault properties
  const propertyKeys = getVaultPropertyNames(target);
  const prototype = target.prototype || target;

  for (const key of propertyKeys) {
    const vaultMetadata = buildVaultMetadata(prototype, key);
    if (vaultMetadata) {
      metadata[key] = vaultMetadata;
    }
  }

  return metadata;
}
