/**
 * SecretRefreshManager
 * Manages background refresh of Vault secrets based on TTL
 */

import { IRefreshStatus, VaultPropertyMetadata } from './types';
import { VaultCache } from './vault-cache';
import { VaultProvider } from './vault-provider';

interface IRefreshContext {
  metadata: VaultPropertyMetadata;
  targetInstance?: object;
  fullPath: string;
}

/**
 * SecretRefreshManager - Handles TTL-based secret refresh scheduling
 */
export class SecretRefreshManager {
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshLocks: Map<string, Promise<void>> = new Map();
  private refreshCounts: Map<string, number> = new Map();
  private lastRefreshTimes: Map<string, number> = new Map();
  private refreshContexts: Map<string, IRefreshContext> = new Map();
  private vaultProvider: VaultProvider;
  private cache: VaultCache;
  private refreshBuffer: number; // Default refresh buffer in seconds

  constructor(provider: VaultProvider, cache: VaultCache, refreshBuffer?: number) {
    this.vaultProvider = provider;
    this.cache = cache;
    // Default: min(10% of TTL, 300s) - but we'll use a fixed buffer per secret
    this.refreshBuffer = refreshBuffer || 300; // 5 minutes default
  }

  /**
   * Schedule refresh for a secret based on TTL
   */
  scheduleRefresh(propertyName: string, metadata: VaultPropertyMetadata, targetInstance?: object): void {
    const entry = this.cache.getEntry(propertyName);
    if (!entry) {
      return; // No cache entry to refresh
    }

    // Store context for refresh
    this.refreshContexts.set(propertyName, {
      metadata,
      targetInstance,
      fullPath: entry.vaultPath
    });

    // Cancel existing refresh if any
    this.cancelRefresh(propertyName);

    // Calculate refresh time
    const now = Date.now();
    const timeUntilRefresh = Math.max(0, entry.refreshAt - now);

    if (timeUntilRefresh <= 0) {
      // Already past refresh time, refresh immediately
      this.executeRefresh(propertyName);
      return;
    }

    // Schedule refresh
    const timer = setTimeout(() => {
      this.executeRefresh(propertyName);
    }, timeUntilRefresh);

    this.refreshTimers.set(propertyName, timer);
  }

  /**
   * Cancel scheduled refresh for a property
   */
  cancelRefresh(propertyName: string): void {
    const timer = this.refreshTimers.get(propertyName);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(propertyName);
    }
  }

  /**
   * Execute refresh for a secret (with locking to prevent concurrent refreshes)
   */
  private async executeRefresh(propertyName: string): Promise<void> {
    // Check if refresh is already in progress
    const existingLock = this.refreshLocks.get(propertyName);
    if (existingLock) {
      await existingLock;
      return; // Refresh already completed
    }

    // Create refresh lock
    const refreshPromise = this.performRefresh(propertyName)
      .finally(() => {
        this.refreshLocks.delete(propertyName);
        this.refreshTimers.delete(propertyName);
      });

    this.refreshLocks.set(propertyName, refreshPromise);
    await refreshPromise;
  }

  /**
   * Perform the actual refresh operation
   */
  private async performRefresh(propertyName: string): Promise<void> {
    const context = this.refreshContexts.get(propertyName);
    if (!context) {
      console.error(`No refresh context for ${ propertyName }`);
      return;
    }

    const { metadata, targetInstance, fullPath } = context;
    const refreshCount = (this.refreshCounts.get(propertyName) || 0) + 1;
    this.refreshCounts.set(propertyName, refreshCount);

    try {
      // Read fresh secret from Vault (using full path)
      const secret = await this.vaultProvider.read(fullPath);

      // Update cache
      this.cache.set(propertyName, fullPath, secret, metadata);

      // Update target instance if provided
      if (targetInstance) {
        const key = metadata.key || metadata.propertyName;
        const value = secret.data[key];
        (targetInstance as any)[propertyName] = value;
      }

      // Record refresh time
      this.lastRefreshTimes.set(propertyName, Date.now());

      // Reschedule next refresh
      this.scheduleRefresh(propertyName, metadata, targetInstance);
    } catch (error: any) {
      // Log error (sanitized)
      const errorMessage = error?.message || 'Unknown error';
      console.error(`Failed to refresh secret for ${ propertyName }: ${ this.sanitizeError(errorMessage) }`);

      // Retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, refreshCount - 1), 30000); // Max 30s
      setTimeout(() => {
        this.scheduleRefresh(propertyName, metadata, targetInstance);
      }, retryDelay);
    }
  }

  /**
   * Get refresh status for all secrets
   */
  getRefreshStatus(): IRefreshStatus[] {
    const statuses: IRefreshStatus[] = [];
    const cachedProperties = this.cache.getCachedProperties();

    for (const propertyName of cachedProperties) {
      const entry = this.cache.getEntry(propertyName);
      if (!entry) {
        continue;
      }

      const timer = this.refreshTimers.get(propertyName);
      const now = Date.now();
      const refreshAt = entry.refreshAt;
      const timeUntilRefresh = Math.max(0, refreshAt - now);

      statuses.push({
        propertyName,
        vaultPath: entry.vaultPath,
        scheduled: timer !== undefined,
        refreshAt,
        timeUntilRefresh,
        lastRefresh: this.lastRefreshTimes.get(propertyName) || entry.cachedAt,
        refreshCount: this.refreshCounts.get(propertyName) || 0
      });
    }

    return statuses;
  }

  /**
   * Get refresh status for a specific property
   */
  getRefreshStatusForProperty(propertyName: string): IRefreshStatus | null {
    const entry = this.cache.getEntry(propertyName);
    if (!entry) {
      return null;
    }

    const timer = this.refreshTimers.get(propertyName);
    const now = Date.now();
    const refreshAt = entry.refreshAt;
    const timeUntilRefresh = Math.max(0, refreshAt - now);

    return {
      propertyName,
      vaultPath: entry.vaultPath,
      scheduled: timer !== undefined,
      refreshAt,
      timeUntilRefresh,
      lastRefresh: this.lastRefreshTimes.get(propertyName) || entry.cachedAt,
      refreshCount: this.refreshCounts.get(propertyName) || 0
    };
  }

  /**
   * Stop all refresh workers
   */
  shutdown(): void {
    // Cancel all timers
    for (const [ propertyName, timer ] of this.refreshTimers.entries()) {
      clearTimeout(timer);
    }

    this.refreshTimers.clear();
    this.refreshLocks.clear();
    this.refreshCounts.clear();
    this.lastRefreshTimes.clear();
  }

  /**
   * Sanitize error message (remove potential secret values)
   */
  private sanitizeError(message: string): string {
    // Remove potential secret values from error messages
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
}
