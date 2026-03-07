/**
 * SecretRefreshManager
 * Manages background refresh of Vault secrets based on TTL.
 *
 * Refreshes are path-aware: when a secret at a given Vault path is refreshed,
 * ALL properties sharing that path are updated from the same Vault read.
 * This prevents credential mismatch (e.g. username from one read, password
 * from another) for engines like `database` where each read generates new creds.
 */

import {
  IRefreshStatus,
  SecretRefreshCallback,
  SecretRefreshEvent,
  VaultPropertyMetadata
} from './types';
import { VaultCache } from './vault-cache';
import { VaultProvider } from './vault-provider';

interface IRefreshContext {
  metadata: VaultPropertyMetadata;
  targetInstance?: object;
  fullPath: string;
}

export class SecretRefreshManager {
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshLocks: Map<string, Promise<void>> = new Map();
  private refreshCounts: Map<string, number> = new Map();
  private lastRefreshTimes: Map<string, number> = new Map();
  private refreshContexts: Map<string, IRefreshContext> = new Map();
  private vaultProvider: VaultProvider;
  private cache: VaultCache;
  private refreshBuffer: number;
  private onRefreshCallbacks: SecretRefreshCallback[] = [];

  constructor(provider: VaultProvider, cache: VaultCache, refreshBuffer?: number) {
    this.vaultProvider = provider;
    this.cache = cache;
    this.refreshBuffer = refreshBuffer || 300;
  }

  /**
   * Register a callback to be invoked after secrets are refreshed.
   * Multiple callbacks can be registered.
   */
  onSecretRefreshed(callback: SecretRefreshCallback): void {
    this.onRefreshCallbacks.push(callback);
  }

  scheduleRefresh(propertyName: string, metadata: VaultPropertyMetadata, targetInstance?: object): void {
    const entry = this.cache.getEntry(propertyName);
    if (!entry) {
      return;
    }

    this.refreshContexts.set(propertyName, {
      metadata,
      targetInstance,
      fullPath: entry.vaultPath
    });

    this.cancelRefresh(propertyName);

    const now = Date.now();
    const timeUntilRefresh = Math.max(0, entry.refreshAt - now);

    if (timeUntilRefresh <= 0) {
      this.executeRefresh(propertyName);
      return;
    }

    const timer = setTimeout(() => {
      this.executeRefresh(propertyName);
    }, timeUntilRefresh);

    this.refreshTimers.set(propertyName, timer);
  }

  cancelRefresh(propertyName: string): void {
    const timer = this.refreshTimers.get(propertyName);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(propertyName);
    }
  }

  private async executeRefresh(propertyName: string): Promise<void> {
    const context = this.refreshContexts.get(propertyName);
    if (!context) {
      return;
    }

    // Lock by path so sibling properties don't trigger duplicate reads
    const lockKey = `path:${ context.fullPath }`;
    const existingLock = this.refreshLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
      return;
    }

    const refreshPromise = this.performPathRefresh(context.fullPath)
      .finally(() => {
        this.refreshLocks.delete(lockKey);
      });

    this.refreshLocks.set(lockKey, refreshPromise);
    await refreshPromise;
  }

  /**
   * Refresh ALL properties that share the given Vault path in a single read.
   */
  private async performPathRefresh(fullPath: string): Promise<void> {
    const siblingProperties = this.getSiblingsForPath(fullPath);
    if (siblingProperties.length === 0) {
      return;
    }

    const pathRefreshCount = (this.refreshCounts.get(fullPath) || 0) + 1;
    this.refreshCounts.set(fullPath, pathRefreshCount);

    try {
      const secret = await this.vaultProvider.read(fullPath);
      const updatedProperties: string[] = [];
      let engine = siblingProperties[0].metadata.engine;

      for (const { propertyName, metadata, targetInstance } of siblingProperties) {
        this.cache.set(propertyName, fullPath, secret, metadata);

        if (targetInstance) {
          const key = metadata.key || metadata.propertyName;
          const value = secret.data[key];
          (targetInstance as any)[propertyName] = value;
        }

        updatedProperties.push(propertyName);
        engine = metadata.engine;

        this.cancelRefresh(propertyName);
        this.refreshTimers.delete(propertyName);
      }

      const now = Date.now();
      this.lastRefreshTimes.set(fullPath, now);

      // Reschedule all sibling properties
      for (const { propertyName, metadata, targetInstance } of siblingProperties) {
        this.scheduleRefresh(propertyName, metadata, targetInstance);
      }

      // Fire callbacks once per path
      const event: SecretRefreshEvent = {
        vaultPath: fullPath,
        properties: updatedProperties,
        engine,
        timestamp: new Date(now).toISOString(),
        refreshCount: pathRefreshCount
      };

      for (const callback of this.onRefreshCallbacks) {
        try {
          const result = callback(event);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch((err) => {
              console.error(`Secret refresh callback error for ${ fullPath }: ${ this.sanitizeError(err?.message || 'Unknown') }`);
            });
          }
        } catch (err: any) {
          console.error(`Secret refresh callback error for ${ fullPath }: ${ this.sanitizeError(err?.message || 'Unknown') }`);
        }
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error(`Failed to refresh secrets for path ${ this.sanitizePath(fullPath) }: ${ this.sanitizeError(errorMessage) }`);

      const retryDelay = Math.min(1000 * Math.pow(2, pathRefreshCount - 1), 30000);
      setTimeout(() => {
        for (const { propertyName, metadata, targetInstance } of siblingProperties) {
          this.scheduleRefresh(propertyName, metadata, targetInstance);
        }
      }, retryDelay);
    }
  }

  /**
   * Find all properties that share the given Vault path.
   */
  private getSiblingsForPath(fullPath: string): Array<{ propertyName: string; metadata: VaultPropertyMetadata; targetInstance?: object }> {
    const siblings: Array<{ propertyName: string; metadata: VaultPropertyMetadata; targetInstance?: object }> = [];

    for (const [ propertyName, context ] of this.refreshContexts.entries()) {
      if (context.fullPath === fullPath) {
        siblings.push({
          propertyName,
          metadata: context.metadata,
          targetInstance: context.targetInstance
        });
      }
    }

    return siblings;
  }

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
        lastRefresh: this.lastRefreshTimes.get(entry.vaultPath) || entry.cachedAt,
        refreshCount: this.refreshCounts.get(entry.vaultPath) || 0
      });
    }

    return statuses;
  }

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
      lastRefresh: this.lastRefreshTimes.get(entry.vaultPath) || entry.cachedAt,
      refreshCount: this.refreshCounts.get(entry.vaultPath) || 0
    };
  }

  shutdown(): void {
    for (const [ , timer ] of this.refreshTimers.entries()) {
      clearTimeout(timer);
    }

    this.refreshTimers.clear();
    this.refreshLocks.clear();
    this.refreshCounts.clear();
    this.lastRefreshTimes.clear();
    this.onRefreshCallbacks = [];
  }

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
