/**
 * Unit tests for buildVaultConfigFromEnv helper.
 * These are pure unit tests — no running Vault instance required.
 */

import { buildVaultConfigFromEnv } from '../build-vault-config';

describe('buildVaultConfigFromEnv', () => {
  const ENV_KEYS = ['VAULT_ADDR', 'VAULT_TOKEN', 'VAULT_GCP_ROLE'] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it('should return undefined when VAULT_ADDR is not set', () => {
    expect(buildVaultConfigFromEnv()).toBeUndefined();
  });

  it('should return undefined when VAULT_ADDR is set but no auth env var is present', () => {
    process.env.VAULT_ADDR = 'http://127.0.0.1:8200';
    expect(buildVaultConfigFromEnv()).toBeUndefined();
  });

  describe('token auth (VAULT_TOKEN)', () => {
    beforeEach(() => {
      process.env.VAULT_ADDR = 'https://vault.example.com';
      process.env.VAULT_TOKEN = 'my-dev-token';
    });

    it('should build config with token auth', () => {
      const config = buildVaultConfigFromEnv();

      expect(config).toBeDefined();
      expect(config!.endpoint).toBe('https://vault.example.com');
      expect(config!.auth).toEqual({ method: 'token', token: 'my-dev-token' });
    });

    it('should default refreshBuffer to 10 for token auth', () => {
      const config = buildVaultConfigFromEnv();
      expect(config!.refreshBuffer).toBe(10);
    });

    it('should allow overriding refreshBuffer', () => {
      const config = buildVaultConfigFromEnv({ refreshBuffer: 45 });
      expect(config!.refreshBuffer).toBe(45);
    });

    it('should apply default fallback config', () => {
      const config = buildVaultConfigFromEnv();

      expect(config!.fallback).toEqual({
        required: false,
        useCacheOnFailure: true,
        maxCacheAge: 3600000,
        failFast: false
      });
    });

    it('should allow overriding fallback config', () => {
      const customFallback = { required: true, useCacheOnFailure: false, maxCacheAge: 0, failFast: true };
      const config = buildVaultConfigFromEnv({ fallback: customFallback });
      expect(config!.fallback).toEqual(customFallback);
    });

    it('should wire through onSecretRefreshed callback', () => {
      const callback = jest.fn();
      const config = buildVaultConfigFromEnv({ onSecretRefreshed: callback });
      expect(config!.onSecretRefreshed).toBe(callback);
    });

    it('should prefer VAULT_TOKEN over VAULT_GCP_ROLE when both are set', () => {
      process.env.VAULT_GCP_ROLE = 'my-gcp-role';
      const config = buildVaultConfigFromEnv();
      expect((config!.auth as any).method).toBe('token');
    });
  });

  describe('GCP auth (VAULT_GCP_ROLE)', () => {
    beforeEach(() => {
      process.env.VAULT_ADDR = 'https://vault.prod.example.com';
      process.env.VAULT_GCP_ROLE = 'my-gcp-role';
    });

    it('should build config with GCP auth', () => {
      const config = buildVaultConfigFromEnv();

      expect(config).toBeDefined();
      expect(config!.endpoint).toBe('https://vault.prod.example.com');
      expect(config!.auth).toEqual({ method: 'gcp', role: 'my-gcp-role' });
    });

    it('should default refreshBuffer to 60 for GCP auth', () => {
      const config = buildVaultConfigFromEnv();
      expect(config!.refreshBuffer).toBe(60);
    });

    it('should allow overriding refreshBuffer', () => {
      const config = buildVaultConfigFromEnv({ refreshBuffer: 120 });
      expect(config!.refreshBuffer).toBe(120);
    });
  });
});
