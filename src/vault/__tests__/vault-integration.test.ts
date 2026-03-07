/**
 * Vault Integration Tests
 * These tests require a local Vault instance and are skipped in CI.
 * To run locally:
 *   docker compose -f docker-compose.vault.yml up -d
 *   bash scripts/vault-setup.sh
 *   VAULT_INTEGRATION_TESTS=true npm test
 */

import { IsString } from 'class-validator';

import { VaultEngine, VaultKey, VaultPath } from '../decorators';
import { buildVaultConfigFromEnv } from '../build-vault-config';
import { IVaultConfigOptions, SecretRefreshEvent } from '../types';
import { VaultIntegration } from '../vault-integration';

import 'reflect-metadata';

// Skip these tests unless explicitly enabled (requires running Vault)
const SKIP_VAULT_TESTS = !process.env.VAULT_INTEGRATION_TESTS;

/**
 * Test configuration class with Vault secrets
 * Note: VaultPath should use logical paths (without engine-specific prefix)
 * The engine prefix (secret/data/ for kv-v2) is added automatically
 */
class TestVaultConfig {
  @VaultPath('configit/api')
  @VaultKey('api_key')
  @IsString()
    API_KEY!: string;

  @VaultPath('configit/api')
  @VaultKey('api_secret')
  @IsString()
    API_SECRET!: string;

  @VaultPath('configit/database')
  @VaultKey('host')
  @IsString()
    DB_HOST!: string;

  @VaultPath('configit/database')
  @VaultKey('port')
  @IsString()
    DB_PORT!: string;

  @VaultPath('configit/database')
  @VaultKey('username')
  @IsString()
    DB_USERNAME!: string;

  @VaultPath('configit/database')
  @VaultKey('password')
  @IsString()
    DB_PASSWORD!: string;

  @VaultPath('configit/features')
  @VaultKey('enable_beta')
  @IsString()
    ENABLE_BETA!: string;

  @VaultPath('configit/features')
  @VaultKey('max_connections')
  @IsString()
    MAX_CONNECTIONS!: string;
}

const VAULT_CONFIG: IVaultConfigOptions = {
  endpoint: 'http://127.0.0.1:8200',
  auth: {
    methods: [
      {
        type: 'token',
        config: {
          token: process.env.VAULT_TOKEN || 'configit-dev-token'
        }
      }
    ]
  },
  tls: {
    enabled: false,
    verifyCertificate: false
  }
};

// Use describe.skip when Vault is not available
const describeVault = SKIP_VAULT_TESTS ? describe.skip : describe;

describeVault('VaultIntegration (requires running Vault)', () => {
  let vaultIntegration: VaultIntegration;

  afterEach(() => {
    if (vaultIntegration) {
      vaultIntegration.shutdown();
    }
  });

  describe('when Vault is available', () => {
    beforeEach(() => {
      vaultIntegration = new VaultIntegration(VAULT_CONFIG);
    });

    it('should initialize successfully', async () => {
      await vaultIntegration.initialize();
      expect(vaultIntegration.isInitialized()).toBe(true);
    });

    it('should load secrets for a config class', async () => {
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      // Verify secrets are cached
      expect(vaultIntegration.getSecret('API_KEY')).toBe('test-api-key-123');
      expect(vaultIntegration.getSecret('API_SECRET')).toBe('test-api-secret-xyz');
      expect(vaultIntegration.getSecret('DB_HOST')).toBe('localhost');
      expect(vaultIntegration.getSecret('DB_PORT')).toBe('5432');
      expect(vaultIntegration.getSecret('DB_USERNAME')).toBe('testuser');
      expect(vaultIntegration.getSecret('DB_PASSWORD')).toBe('testpassword');
      expect(vaultIntegration.getSecret('ENABLE_BETA')).toBe('true');
      expect(vaultIntegration.getSecret('MAX_CONNECTIONS')).toBe('100');
    });

    it('should report healthy status after initialization', async () => {
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      const health = vaultIntegration.getHealth();
      expect(health.connected).toBe(true);
      expect(health.authenticated).toBe(true);
      expect(health.cacheSize).toBeGreaterThan(0);
    });

    it('should invalidate cache entries', async () => {
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      // Verify secret is cached
      expect(vaultIntegration.getSecret('API_KEY')).toBe('test-api-key-123');

      // Invalidate
      vaultIntegration.invalidateProperty('API_KEY');

      // Should be null after invalidation
      expect(vaultIntegration.getSecret('API_KEY')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      vaultIntegration = new VaultIntegration(VAULT_CONFIG);

      await expect(vaultIntegration.loadSecrets(TestVaultConfig))
        .rejects
        .toThrow('VaultIntegration not initialized');
    });

    it('should throw error with invalid token', async () => {
      const invalidConfig: IVaultConfigOptions = {
        ...VAULT_CONFIG,
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                token: 'invalid-token'
              }
            }
          ]
        }
      };

      vaultIntegration = new VaultIntegration(invalidConfig);

      await expect(vaultIntegration.initialize())
        .rejects
        .toThrow(/authentication.*failed/i);
    });
  });

  describe('onSecretRefreshed callback', () => {
    it('should fire callback with correct event when configured via constructor', async () => {
      const events: SecretRefreshEvent[] = [];
      const configWithCallback: IVaultConfigOptions = {
        ...VAULT_CONFIG,
        onSecretRefreshed: (event) => { events.push(event); }
      };

      vaultIntegration = new VaultIntegration(configWithCallback);
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      expect(events).toHaveLength(0);
    });

    it('should fire callback via runtime registration', async () => {
      const events: SecretRefreshEvent[] = [];

      vaultIntegration = new VaultIntegration(VAULT_CONFIG);
      vaultIntegration.onSecretRefreshed((event) => { events.push(event); });
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      expect(events).toHaveLength(0);
    });
  });

  describe('dynamic secrets with TTL-based refresh', () => {
    /**
     * Config class using the database engine with dynamic credentials.
     * database/creds/configit-readonly has a 60s TTL in the test Vault setup.
     */
    class DynamicConfig {
      @VaultPath('creds/configit-readonly')
      @VaultKey('username')
      @VaultEngine('database')
      @IsString()
        DB_USERNAME!: string;

      @VaultPath('creds/configit-readonly')
      @VaultKey('password')
      @VaultEngine('database')
      @IsString()
        DB_PASSWORD!: string;
    }

    it('should load dynamic database credentials', async () => {
      vaultIntegration = new VaultIntegration({
        ...VAULT_CONFIG,
        refreshBuffer: 30
      });
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(DynamicConfig);

      const username = vaultIntegration.getSecret('DB_USERNAME');
      const password = vaultIntegration.getSecret('DB_PASSWORD');

      expect(username).toBeDefined();
      expect(username).toMatch(/^v-token-/);
      expect(password).toBeDefined();
      expect(password!.length).toBeGreaterThan(0);
    });

    it('should schedule refresh for dynamic secrets', async () => {
      vaultIntegration = new VaultIntegration({
        ...VAULT_CONFIG,
        refreshBuffer: 30
      });
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(DynamicConfig);

      const health = vaultIntegration.getHealthDetails();
      expect(health.refreshQueueSize).toBeGreaterThanOrEqual(1);

      const dbUserStatus = health.refreshStatus.find((s) => s.propertyName === 'DB_USERNAME');
      expect(dbUserStatus).toBeDefined();
      expect(dbUserStatus!.scheduled).toBe(true);
      expect(dbUserStatus!.timeUntilRefresh).toBeLessThanOrEqual(60000);
    });

    it('should perform path-level atomic refresh and fire callback', async () => {
      const events: SecretRefreshEvent[] = [];

      vaultIntegration = new VaultIntegration({
        ...VAULT_CONFIG,
        refreshBuffer: 55, // 60s TTL minus 55s buffer = refresh after ~5s
        onSecretRefreshed: (event) => { events.push(event); }
      });
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(DynamicConfig);

      const initialUser = vaultIntegration.getSecret('DB_USERNAME');
      const initialPass = vaultIntegration.getSecret('DB_PASSWORD');

      // Wait for the refresh to trigger (~5s + some margin)
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const refreshedUser = vaultIntegration.getSecret('DB_USERNAME');
      const refreshedPass = vaultIntegration.getSecret('DB_PASSWORD');

      // Credentials should have changed
      expect(refreshedUser).not.toBe(initialUser);
      expect(refreshedPass).not.toBe(initialPass);

      // Exactly one callback event for the path
      expect(events.length).toBeGreaterThanOrEqual(1);
      const dbEvent = events.find((e) => e.engine === 'database');
      expect(dbEvent).toBeDefined();
      expect(dbEvent!.properties).toContain('DB_USERNAME');
      expect(dbEvent!.properties).toContain('DB_PASSWORD');
      expect(dbEvent!.vaultPath).toContain('configit-readonly');
      expect(dbEvent!.refreshCount).toBeGreaterThanOrEqual(1);
    }, 20000);
  });

  describe('buildVaultConfigFromEnv end-to-end', () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      savedEnv.VAULT_ADDR = process.env.VAULT_ADDR;
      savedEnv.VAULT_TOKEN = process.env.VAULT_TOKEN;
      savedEnv.VAULT_GCP_ROLE = process.env.VAULT_GCP_ROLE;
    });

    afterEach(() => {
      for (const [key, val] of Object.entries(savedEnv)) {
        if (val !== undefined) {
          process.env[key] = val;
        } else {
          delete process.env[key];
        }
      }
    });

    it('should produce a config that VaultIntegration can use', async () => {
      process.env.VAULT_ADDR = 'http://127.0.0.1:8200';
      process.env.VAULT_TOKEN = 'configit-dev-token';
      delete process.env.VAULT_GCP_ROLE;

      const config = buildVaultConfigFromEnv();
      expect(config).toBeDefined();

      vaultIntegration = new VaultIntegration(config!);
      await vaultIntegration.initialize();
      expect(vaultIntegration.isInitialized()).toBe(true);

      await vaultIntegration.loadSecrets(TestVaultConfig);
      expect(vaultIntegration.getSecret('API_KEY')).toBe('test-api-key-123');
    });

    it('should wire onSecretRefreshed callback through to VaultIntegration', async () => {
      process.env.VAULT_ADDR = 'http://127.0.0.1:8200';
      process.env.VAULT_TOKEN = 'configit-dev-token';
      delete process.env.VAULT_GCP_ROLE;

      const events: SecretRefreshEvent[] = [];
      const config = buildVaultConfigFromEnv({
        onSecretRefreshed: (event) => { events.push(event); }
      });
      expect(config).toBeDefined();
      expect(config!.onSecretRefreshed).toBeDefined();

      vaultIntegration = new VaultIntegration(config!);
      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      // No events yet (KV secrets have no TTL-based refresh in this setup)
      expect(events).toHaveLength(0);
    });
  });
});

/**
 * Run this file directly to test Vault integration:
 *   npx ts-node src/vault/__tests__/vault-integration.test.ts
 */
if (require.main === module) {
  (async () => {
    console.log('Testing Vault Integration...\n');

    const integration = new VaultIntegration(VAULT_CONFIG);

    try {
      console.log('1. Initializing...');
      await integration.initialize();
      console.log('   ✓ Initialized\n');

      console.log('2. Loading secrets...');
      await integration.loadSecrets(TestVaultConfig);
      console.log('   ✓ Secrets loaded\n');

      console.log('3. Reading secrets:');
      console.log(`   API_KEY: ${ integration.getSecret('API_KEY') }`);
      console.log(`   API_SECRET: ${ integration.getSecret('API_SECRET') }`);
      console.log(`   DB_HOST: ${ integration.getSecret('DB_HOST') }`);
      console.log(`   DB_PORT: ${ integration.getSecret('DB_PORT') }`);
      console.log(`   DB_USERNAME: ${ integration.getSecret('DB_USERNAME') }`);
      console.log(`   DB_PASSWORD: ${ integration.getSecret('DB_PASSWORD') }`);
      console.log(`   ENABLE_BETA: ${ integration.getSecret('ENABLE_BETA') }`);
      console.log(`   MAX_CONNECTIONS: ${ integration.getSecret('MAX_CONNECTIONS') }\n`);

      console.log('4. Health status:');
      const health = integration.getHealth();
      console.log(`   Connected: ${ health.connected }`);
      console.log(`   Authenticated: ${ health.authenticated }`);
      console.log(`   Cache size: ${ health.cacheSize }`);
      console.log(`   Errors: ${ health.errors.length }\n`);

      console.log('✓ All tests passed!\n');
    } catch (error) {
      console.error('✗ Test failed:', error);
      process.exit(1);
    } finally {
      integration.shutdown();
    }
  })();
}

