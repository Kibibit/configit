/**
 * Unit tests for SecretRefreshManager
 * Uses mocked VaultProvider and VaultCache — no running Vault required.
 */

import { SecretRefreshManager } from '../secret-refresh-manager';
import { VaultCache } from '../vault-cache';
import { VaultProvider } from '../vault-provider';
import { IVaultSecret, SecretRefreshEvent, VaultCacheEntry, VaultPropertyMetadata } from '../types';

jest.mock('../vault-provider');
jest.mock('../vault-cache');

function makeMetadata(overrides: Partial<VaultPropertyMetadata> = {}): VaultPropertyMetadata {
  return {
    propertyName: 'PROP',
    propertyType: 'string',
    path: 'test/path',
    key: 'value',
    engine: 'kv-v2',
    required: true,
    ...overrides
  };
}

function makeSecret(data: Record<string, string>, leaseDuration = 60): IVaultSecret {
  return {
    data,
    leaseDuration,
    leaseId: leaseDuration > 0 ? 'lease-123' : '',
    renewable: leaseDuration > 0
  };
}

function makeCacheEntry(vaultPath: string, refreshAtOffset = 30000): VaultCacheEntry {
  const now = Date.now();
  const secret = makeSecret({ value: 'cached' });
  return {
    value: 'cached',
    secret,
    vaultPath,
    propertyName: 'PROP',
    cachedAt: now,
    expiresAt: now + 60000,
    refreshAt: now + refreshAtOffset
  };
}

describe('SecretRefreshManager', () => {
  let manager: SecretRefreshManager;
  let mockProvider: jest.Mocked<VaultProvider>;
  let mockCache: jest.Mocked<VaultCache>;

  beforeEach(() => {
    jest.useFakeTimers();

    mockProvider = new VaultProvider({} as any) as jest.Mocked<VaultProvider>;
    mockCache = new VaultCache() as jest.Mocked<VaultCache>;

    manager = new SecretRefreshManager(mockProvider, mockCache, 30);
  });

  afterEach(() => {
    manager.shutdown();
    jest.useRealTimers();
  });

  describe('onSecretRefreshed', () => {
    it('should register a callback', () => {
      const callback = jest.fn();
      manager.onSecretRefreshed(callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      manager.onSecretRefreshed(cb1);
      manager.onSecretRefreshed(cb2);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  describe('scheduleRefresh', () => {
    it('should not schedule when cache entry is missing', () => {
      mockCache.getEntry.mockReturnValue(null as any);
      manager.scheduleRefresh('PROP', makeMetadata());
      expect(mockCache.getEntry).toHaveBeenCalledWith('PROP');
    });

    it('should schedule a timer when cache entry has future refreshAt', () => {
      mockCache.getEntry.mockReturnValue(makeCacheEntry('secret/data/test/path', 5000));
      mockProvider.read.mockResolvedValue(makeSecret({ value: 'new' }));

      manager.scheduleRefresh('PROP', makeMetadata());

      expect(mockCache.getEntry).toHaveBeenCalledWith('PROP');
    });

    it('should execute immediately when refreshAt is in the past', () => {
      mockCache.getEntry.mockReturnValue(makeCacheEntry('secret/data/test/path', -1000));
      mockProvider.read.mockResolvedValue(makeSecret({ value: 'new' }));

      manager.scheduleRefresh('PROP', makeMetadata());
    });
  });

  describe('path-level atomic refresh', () => {
    const SHARED_PATH = 'database/creds/my-role';

    beforeEach(() => {
      mockProvider.read.mockResolvedValue(makeSecret({
        username: 'new-user',
        password: 'new-pass'
      }, 60));
    });

    it('should refresh all sibling properties from a single Vault read', async () => {
      const entry = makeCacheEntry(SHARED_PATH, 100);
      mockCache.getEntry.mockReturnValue(entry);

      const metaUser = makeMetadata({ propertyName: 'DB_USERNAME', key: 'username', engine: 'database', path: 'creds/my-role' });
      const metaPass = makeMetadata({ propertyName: 'DB_PASSWORD', key: 'password', engine: 'database', path: 'creds/my-role' });

      const target = { DB_USERNAME: 'old-user', DB_PASSWORD: 'old-pass' };

      manager.scheduleRefresh('DB_USERNAME', metaUser, target);
      manager.scheduleRefresh('DB_PASSWORD', metaPass, target);

      await jest.advanceTimersByTimeAsync(200);

      expect(mockProvider.read).toHaveBeenCalledTimes(1);
      expect(mockProvider.read).toHaveBeenCalledWith(SHARED_PATH);
    });

    it('should update target instance properties from the single read', async () => {
      const entry = makeCacheEntry(SHARED_PATH, 100);
      mockCache.getEntry.mockReturnValue(entry);

      const metaUser = makeMetadata({ propertyName: 'DB_USERNAME', key: 'username', engine: 'database', path: 'creds/my-role' });
      const metaPass = makeMetadata({ propertyName: 'DB_PASSWORD', key: 'password', engine: 'database', path: 'creds/my-role' });

      const target = { DB_USERNAME: 'old-user', DB_PASSWORD: 'old-pass' };

      manager.scheduleRefresh('DB_USERNAME', metaUser, target);
      manager.scheduleRefresh('DB_PASSWORD', metaPass, target);

      await jest.advanceTimersByTimeAsync(200);

      expect(target.DB_USERNAME).toBe('new-user');
      expect(target.DB_PASSWORD).toBe('new-pass');
    });

    it('should fire one callback per path with all affected properties', async () => {
      const events: SecretRefreshEvent[] = [];
      manager.onSecretRefreshed((e) => { events.push(e); });

      const entry = makeCacheEntry(SHARED_PATH, 100);
      mockCache.getEntry.mockReturnValue(entry);

      const metaUser = makeMetadata({ propertyName: 'DB_USERNAME', key: 'username', engine: 'database', path: 'creds/my-role' });
      const metaPass = makeMetadata({ propertyName: 'DB_PASSWORD', key: 'password', engine: 'database', path: 'creds/my-role' });

      manager.scheduleRefresh('DB_USERNAME', metaUser);
      manager.scheduleRefresh('DB_PASSWORD', metaPass);

      await jest.advanceTimersByTimeAsync(200);

      expect(events).toHaveLength(1);
      expect(events[0].vaultPath).toBe(SHARED_PATH);
      expect(events[0].properties).toContain('DB_USERNAME');
      expect(events[0].properties).toContain('DB_PASSWORD');
      expect(events[0].engine).toBe('database');
      expect(events[0].refreshCount).toBe(1);
      expect(events[0].timestamp).toBeDefined();
    });

    it('should increment refreshCount on subsequent refreshes', async () => {
      const events: SecretRefreshEvent[] = [];
      manager.onSecretRefreshed((e) => { events.push(e); });

      const entry = makeCacheEntry(SHARED_PATH, -100);
      mockCache.getEntry.mockReturnValue(entry);

      const meta = makeMetadata({ propertyName: 'DB_USERNAME', key: 'username', engine: 'database', path: 'creds/my-role' });

      manager.scheduleRefresh('DB_USERNAME', meta);
      await jest.advanceTimersByTimeAsync(0);

      manager.scheduleRefresh('DB_USERNAME', meta);
      await jest.advanceTimersByTimeAsync(0);

      expect(events).toHaveLength(2);
      expect(events[0].refreshCount).toBe(1);
      expect(events[1].refreshCount).toBe(2);
    });
  });

  describe('callback error handling', () => {
    it('should not throw when a sync callback throws', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      manager.onSecretRefreshed(() => { throw new Error('callback boom'); });

      const entry = makeCacheEntry('secret/data/test', -100);
      mockCache.getEntry.mockReturnValue(entry);
      mockProvider.read.mockResolvedValue(makeSecret({ value: 'new' }));

      manager.scheduleRefresh('PROP', makeMetadata());
      await jest.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('callback boom')
      );

      consoleSpy.mockRestore();
    });

    it('should not throw when an async callback rejects', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      manager.onSecretRefreshed(async () => { throw new Error('async boom'); });

      const entry = makeCacheEntry('secret/data/test', -100);
      mockCache.getEntry.mockReturnValue(entry);
      mockProvider.read.mockResolvedValue(makeSecret({ value: 'new' }));

      manager.scheduleRefresh('PROP', makeMetadata());
      await jest.advanceTimersByTimeAsync(0);

      // Give the rejected promise a tick to log
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('async boom')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Vault read failure', () => {
    it('should log error and schedule retry on read failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const entry = makeCacheEntry('secret/data/test', -100);
      mockCache.getEntry.mockReturnValue(entry);
      mockProvider.read.mockRejectedValue(new Error('Vault unavailable'));

      manager.scheduleRefresh('PROP', makeMetadata());
      await jest.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to refresh secrets')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('cancelRefresh', () => {
    it('should cancel a scheduled refresh', () => {
      mockCache.getEntry.mockReturnValue(makeCacheEntry('secret/data/test', 30000));
      manager.scheduleRefresh('PROP', makeMetadata());
      manager.cancelRefresh('PROP');
      // No error thrown, timer cleared
    });

    it('should be a no-op for non-existent property', () => {
      manager.cancelRefresh('NON_EXISTENT');
    });
  });

  describe('getRefreshStatus', () => {
    it('should return empty array when nothing is cached', () => {
      mockCache.getCachedProperties.mockReturnValue([]);
      expect(manager.getRefreshStatus()).toEqual([]);
    });

    it('should return status for cached properties', () => {
      const entry = makeCacheEntry('secret/data/test', 30000);
      mockCache.getCachedProperties.mockReturnValue(['PROP']);
      mockCache.getEntry.mockReturnValue(entry);

      manager.scheduleRefresh('PROP', makeMetadata());

      const statuses = manager.getRefreshStatus();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].propertyName).toBe('PROP');
      expect(statuses[0].vaultPath).toBe('secret/data/test');
      expect(statuses[0].scheduled).toBe(true);
    });
  });

  describe('getRefreshStatusForProperty', () => {
    it('should return null for uncached property', () => {
      mockCache.getEntry.mockReturnValue(null as any);
      expect(manager.getRefreshStatusForProperty('MISSING')).toBeNull();
    });

    it('should return status for a cached property', () => {
      const entry = makeCacheEntry('secret/data/test', 30000);
      mockCache.getEntry.mockReturnValue(entry);

      manager.scheduleRefresh('PROP', makeMetadata());

      const status = manager.getRefreshStatusForProperty('PROP');
      expect(status).toBeDefined();
      expect(status!.propertyName).toBe('PROP');
      expect(status!.scheduled).toBe(true);
      expect(status!.refreshCount).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should clear all timers and callbacks', () => {
      const cb = jest.fn();
      manager.onSecretRefreshed(cb);

      mockCache.getEntry.mockReturnValue(makeCacheEntry('secret/data/test', 30000));
      manager.scheduleRefresh('PROP', makeMetadata());

      manager.shutdown();
      // After shutdown, advancing time should not trigger anything
    });
  });
});
