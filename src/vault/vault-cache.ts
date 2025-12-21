/**
 * VaultCache
 * In-memory cache for Vault secrets with TTL management
 */

import nconf from 'nconf';

import { IVaultSecret, VaultCacheEntry, VaultPropertyMetadata } from './types';

/**
 * VaultCache - Manages in-memory cache of Vault secrets
 */
export class VaultCache {
  private cache: Map<string, VaultCacheEntry> = new Map();
  private propertyToPath: Map<string, string> = new Map();
  private pathToProperties: Map<string, Set<string>> = new Map();

  /**
   * Get cached value for a property
   * @returns The cached value or null if not found/expired
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(propertyName: string): any | null {
    const entry = this.cache.get(propertyName);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(propertyName);
      return null;
    }

    return entry.value;
  }

  /**
   * Set cached value for a property
   */
  set(
    propertyName: string,
    vaultPath: string,
    secret: IVaultSecret,
    metadata: VaultPropertyMetadata
  ): void {
    // Extract value based on engine type
    const value = this.extractValue(secret, metadata);

    // Calculate expiration times
    const now = Date.now();
    const leaseDurationMs = secret.leaseDuration * 1000;
    // Default 1 hour if no TTL
    const expiresAt = secret.leaseDuration > 0 ? now + leaseDurationMs : now + 3600000;

    // Calculate refresh time (refresh buffer)
    // metadata.refreshBuffer is in SECONDS, we need milliseconds
    // Default: min(10% of TTL, 5 minutes)
    const defaultBufferMs = Math.min(leaseDurationMs * 0.1, 300000);
    const refreshBufferMs = metadata.refreshBuffer ? metadata.refreshBuffer * 1000 : defaultBufferMs;
    const refreshAt = secret.leaseDuration > 0 ? expiresAt - refreshBufferMs : expiresAt;

    const entry: VaultCacheEntry = {
      value,
      secret,
      cachedAt: now,
      expiresAt,
      refreshAt,
      propertyName,
      vaultPath
    };

    this.cache.set(propertyName, entry);

    // Update mappings
    this.propertyToPath.set(propertyName, vaultPath);

    const properties = this.pathToProperties.get(vaultPath) || new Set();
    properties.add(propertyName);
    this.pathToProperties.set(vaultPath, properties);

    // Inject into nconf overrides (highest priority)
    // Merge with existing overrides to avoid overwriting other secrets
    // Access the overrides store directly to get current values
    const overridesStore = (nconf as any).stores?.overrides;
    const existingOverrides = overridesStore?.store || {};

    // Merge and set all overrides at once
    nconf.overrides({
      ...existingOverrides,
      [propertyName]: value
    });
  }

  /**
   * Extract value from secret based on engine type and metadata
   */
  private extractValue(secret: IVaultSecret, metadata: VaultPropertyMetadata): any {
    const { engine, key } = metadata;

    switch (engine) {
      case 'kv-v1':
        // KV v1: data is flat
        return key ? secret.data[key] : secret.data;

      case 'kv-v2':
        // KV v2: data is nested under 'data' key
        const kv2Data = secret.data?.data || secret.data;
        return key ? kv2Data[key] : kv2Data;

      case 'database':
      case 'aws':
      case 'azure':
      case 'gcp':
        // Dynamic secrets: data contains credentials
        return key ? secret.data[key] : secret.data;

      default:
        // Default: try to extract by key, fallback to entire data
        return key ? secret.data[key] : secret.data;
    }
  }

  /**
   * Invalidate cache entry by path
   */
  invalidate(vaultPath: string): void {
    const properties = this.pathToProperties.get(vaultPath);
    if (!properties) {
      return;
    }

    for (const propertyName of properties) {
      this.cache.delete(propertyName);
      this.propertyToPath.delete(propertyName);
      // Remove from nconf overrides
      nconf.remove(propertyName);
    }

    this.pathToProperties.delete(vaultPath);
  }

  /**
   * Invalidate cache entry by property name
   */
  invalidateProperty(propertyName: string): void {
    const vaultPath = this.propertyToPath.get(propertyName);
    if (vaultPath) {
      this.invalidate(vaultPath);
    } else {
      // Just remove this property
      this.cache.delete(propertyName);
      nconf.remove(propertyName);
    }
  }

  /**
   * Get cache entry for a property
   */
  getEntry(propertyName: string): VaultCacheEntry | undefined {
    return this.cache.get(propertyName);
  }

  /**
   * Get all properties for a Vault path
   */
  getPropertiesForPath(vaultPath: string): string[] {
    const properties = this.pathToProperties.get(vaultPath);
    return properties ? Array.from(properties) : [];
  }

  /**
   * Get Vault path for a property
   */
  getPathForProperty(propertyName: string): string | undefined {
    return this.propertyToPath.get(propertyName);
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(propertyName: string): boolean {
    const entry = this.cache.get(propertyName);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(propertyName);
      return false;
    }

    return true;
  }

  /**
   * Get all cache entries that need refresh
   */
  getEntriesNeedingRefresh(): VaultCacheEntry[] {
    const now = Date.now();
    const entries: VaultCacheEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.refreshAt <= now && entry.expiresAt > now) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Remove all from nconf overrides
    for (const propertyName of this.cache.keys()) {
      nconf.remove(propertyName);
    }

    this.cache.clear();
    this.propertyToPath.clear();
    this.pathToProperties.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached property names
   */
  getCachedProperties(): string[] {
    return Array.from(this.cache.keys());
  }
}
