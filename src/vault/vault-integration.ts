/**
 * VaultIntegration
 * High-level integration class for Vault secrets management
 */

import { getAllVaultMetadata } from './decorators';
import { SecretRefreshManager } from './secret-refresh-manager';
import {
  IVaultConfigOptions,
  IVaultHealthDetails,
  VaultHealth,
  VaultPropertyMetadata
} from './types';
import { VaultCache } from './vault-cache';
import { VaultProvider } from './vault-provider';

/**
 * VaultIntegration - High-level API for Vault secrets integration
 */
export class VaultIntegration {
  private provider: VaultProvider;
  private cache: VaultCache;
  private refreshManager: SecretRefreshManager;
  private initialized = false;
  private config: IVaultConfigOptions;
  private errors: Array<{ timestamp: number; path: string; error: string; retryable: boolean }> = [];
  private targetClass?: new () => any;
  private vaultMetadata: Record<string, VaultPropertyMetadata> = {};

  constructor(config: IVaultConfigOptions) {
    this.config = config;
    this.provider = new VaultProvider(config);
    this.cache = new VaultCache();
    const refreshBuffer = config.refreshBuffer || 300; // Default 5 minutes
    this.refreshManager = new SecretRefreshManager(this.provider, this.cache, refreshBuffer);
  }

  /**
   * Initialize Vault connection and authenticate
   * Must be called before using Vault integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      await this.provider.initialize();
      this.initialized = true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      this.recordError('', this.sanitizeError(errorMessage), false);
      throw error;
    }
  }

  /**
   * Load secrets for a config class or instance
   * Scans for @VaultPath decorators and loads secrets
   */
  async loadSecrets<T extends object>(configOrClass: T | (new () => T)): Promise<void> {
    if (!this.initialized) {
      throw new Error('VaultIntegration not initialized. Call initialize() first.');
    }

    // Determine if we got a class or instance
    const isClass = typeof configOrClass === 'function';
    const targetClass = isClass ? configOrClass : (configOrClass.constructor as new () => T);
    const targetInstance = isClass ? null : configOrClass;

    // Store metadata and class for later use (e.g., registerConfigInstance)
    this.targetClass = targetClass;
    this.vaultMetadata = getAllVaultMetadata(targetClass);

    if (Object.keys(this.vaultMetadata).length === 0) {
      return; // No Vault properties
    }

    // Group properties by full Vault path (including engine prefix)
    const pathGroups = this.groupByFullPath(this.vaultMetadata);

    // Load secrets for each path
    for (const [ fullPath, properties ] of pathGroups.entries()) {
      try {
        const secret = await this.provider.read(fullPath);

        // Cache secret for each property
        for (const property of properties) {
          // Merge global refreshBuffer config with property metadata
          const propertyWithDefaults = {
            ...property,
            // Use property-specific refreshBuffer, fall back to global config
            refreshBuffer: property.refreshBuffer ?? this.config.refreshBuffer
          };

          this.cache.set(property.propertyName, fullPath, secret, propertyWithDefaults);

          // Extract and set the specific key value to the instance
          if (targetInstance) {
            const key = property.key || property.propertyName;
            const value = secret.data[key];
            (targetInstance as any)[property.propertyName] = value;
          }

          // Schedule refresh if secret has TTL
          if (secret.leaseDuration > 0) {
            this.refreshManager.scheduleRefresh(property.propertyName, propertyWithDefaults, targetInstance);
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        const sanitizedError = this.sanitizeError(errorMessage);
        this.recordError(fullPath, sanitizedError, this.isRetryableError(error));

        // Handle fallback strategy
        const fallback = this.config.fallback;
        if (fallback?.required !== false) {
          // Required secret - throw error
          throw new Error(`Failed to load required secret from ${ this.sanitizePath(fullPath) }: ${ sanitizedError }`);
        }

        // Optional secret - log warning and continue
        console.warn(`Failed to load optional secret from ${ this.sanitizePath(fullPath) }: ${ sanitizedError }`);
      }
    }
  }

  /**
   * Get secret value synchronously from cache
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSecret(propertyName: string): any | null {
    return this.cache.get(propertyName);
  }

  /**
   * Check if Vault integration is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register a config instance for automatic refresh updates
   * Call this after creating the config instance to ensure refreshed secrets
   * are automatically applied to the instance
   */
  registerConfigInstance<T extends object>(instance: T): void {
    if (Object.keys(this.vaultMetadata).length === 0) {
      // No Vault properties to register
      return;
    }

    // Re-register all properties with the refresh manager using this instance
    for (const [ propertyName, metadata ] of Object.entries(this.vaultMetadata)) {
      const entry = this.cache.getEntry(propertyName);
      if (!entry) {
        continue;
      }

      // Merge global refreshBuffer config with property metadata
      const propertyWithDefaults = {
        ...metadata,
        refreshBuffer: metadata.refreshBuffer ?? this.config.refreshBuffer
      };

      // Re-schedule refresh with the actual instance
      if (entry.secret.leaseDuration > 0) {
        this.refreshManager.scheduleRefresh(propertyName, propertyWithDefaults, instance);
      }
    }
  }

  /**
   * Get Vault health status
   */
  getHealth(): VaultHealth {
    const refreshStatus = this.refreshManager.getRefreshStatus();
    const lastRefreshTime = refreshStatus.length > 0 ?
      Math.max(...refreshStatus.map((s) => s.lastRefresh)) :
      0;

    return {
      connected: this.initialized && this.provider.isAuthenticated(),
      authenticated: this.provider.isAuthenticated(),
      cacheSize: this.cache.size(),
      refreshQueueSize: refreshStatus.filter((s) => s.scheduled).length,
      lastRefreshTime,
      errors: this.errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Get detailed health information
   */
  getHealthDetails(): IVaultHealthDetails {
    const refreshStatus = this.refreshManager.getRefreshStatus();

    return {
      connected: this.initialized && this.provider.isAuthenticated(),
      authenticated: this.provider.isAuthenticated(),
      cacheSize: this.cache.size(),
      refreshQueueSize: refreshStatus.filter((s) => s.scheduled).length,
      lastRefreshTime: refreshStatus.length > 0 ?
        Math.max(...refreshStatus.map((s) => s.lastRefresh)) :
        0,
      errors: this.errors.slice(-10), // Last 10 errors
      refreshStatus
    };
  }

  /**
   * Invalidate cache for a Vault path
   */
  invalidateCache(vaultPath: string): void {
    this.cache.invalidate(vaultPath);
    // Cancel refresh for properties using this path
    const properties = this.cache.getPropertiesForPath(vaultPath);
    for (const propertyName of properties) {
      this.refreshManager.cancelRefresh(propertyName);
    }
  }

  /**
   * Invalidate cache for a property
   */
  invalidateProperty(propertyName: string): void {
    this.cache.invalidateProperty(propertyName);
    this.refreshManager.cancelRefresh(propertyName);
  }

  /**
   * Shutdown gracefully - stop all refresh workers
   */
  shutdown(): void {
    this.refreshManager.shutdown();
    this.cache.clear();
    this.initialized = false;
  }

  /**
   * Group properties by Vault path
   */
  private groupByPath(metadata: Record<string, VaultPropertyMetadata>): Map<string, VaultPropertyMetadata[]> {
    const groups = new Map<string, VaultPropertyMetadata[]>();

    for (const property of Object.values(metadata)) {
      const path = property.path;
      if (!groups.has(path)) {
        groups.set(path, []);
      }
      groups.get(path)!.push(property);
    }

    return groups;
  }

  /**
   * Group properties by full Vault path (including engine prefix)
   */
  private groupByFullPath(metadata: Record<string, VaultPropertyMetadata>): Map<string, VaultPropertyMetadata[]> {
    const groups = new Map<string, VaultPropertyMetadata[]>();

    for (const property of Object.values(metadata)) {
      const fullPath = this.constructFullPath(property.path, property.engine);
      if (!groups.has(fullPath)) {
        groups.set(fullPath, []);
      }
      groups.get(fullPath)!.push(property);
    }

    return groups;
  }

  /**
   * Construct full Vault path based on engine type
   */
  private constructFullPath(path: string, engine: string): string {
    switch (engine) {
      case 'kv1':
      case 'kv-v1':
        return `secret/${ path }`;
      case 'kv2':
      case 'kv-v2':
        return `secret/data/${ path }`;
      case 'database':
        return path.startsWith('database/') ? path : `database/${ path }`;
      default:
        return path;
    }
  }

  /**
   * Record error for health monitoring
   */
  private recordError(path: string, error: string, retryable: boolean): void {
    this.errors.push({
      timestamp: Date.now(),
      path: this.sanitizePath(path),
      error,
      retryable
    });

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message || '';
    const errorCode = error?.code || '';
    const statusCode = error?.statusCode || error?.response?.statusCode;

    const retryablePatterns = [ 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '5xx' ];

    for (const pattern of retryablePatterns) {
      if (pattern.includes('xx') && statusCode) {
        const codePrefix = parseInt(pattern[0]);
        const statusPrefix = Math.floor(statusCode / 100);
        if (statusPrefix === codePrefix) {
          return true;
        }
      } else if (errorMessage.includes(pattern) || errorCode.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize error message
   */
  private sanitizeError(message: string): string {
    const sensitivePatterns = [ /password/i, /secret/i, /key/i, /token/i, /credential/i ];
    let sanitized = message;

    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(
        new RegExp(`${ pattern.source }[:=]\\s*[^\\s,}]+`, 'gi'),
        `${ pattern.source }: ***`
      );
    });

    return sanitized;
  }

  /**
   * Sanitize path for logging
   */
  private sanitizePath(path: string): string {
    const segments = path.split('/');
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const sensitivePatterns = [ /password/i, /secret/i, /key/i, /token/i, /credential/i ];
      if (sensitivePatterns.some((pattern) => pattern.test(lastSegment))) {
        segments[segments.length - 1] = '***';
      }
    }
    return segments.join('/');
  }
}
