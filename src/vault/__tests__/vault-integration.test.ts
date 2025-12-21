/**
 * Vault Integration Tests
 * Tests require local Vault instance running:
 *   docker compose -f docker-compose.vault.yml up -d
 *   bash scripts/vault-setup.sh
 */

import { IsString } from 'class-validator';

import { VaultKey, VaultPath } from '../decorators';
import { IVaultConfigOptions } from '../types';
import { VaultIntegration } from '../vault-integration';

import 'reflect-metadata';

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
          type: 'token',
          token: process.env.VAULT_TOKEN || 'configit-dev-token'
        }
      }
    ]
  },
  tls: {
    enabled: false, // Allow HTTP for local dev
    verifyCertificate: false
  }
};

describe('VaultIntegration', () => {
  let vaultIntegration: VaultIntegration;

  beforeAll(async () => {
    // Skip if SKIP_VAULT_TESTS is set (for CI without Vault)
    if (process.env.SKIP_VAULT_TESTS) {
      console.log('Skipping Vault tests (SKIP_VAULT_TESTS=true)');
      return;
    }
  });

  afterAll(() => {
    if (vaultIntegration) {
      vaultIntegration.shutdown();
    }
  });

  describe('when Vault is available', () => {
    beforeEach(() => {
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }
      vaultIntegration = new VaultIntegration(VAULT_CONFIG);
    });

    afterEach(() => {
      if (vaultIntegration) {
        vaultIntegration.shutdown();
      }
    });

    it('should initialize successfully', async () => {
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

      await vaultIntegration.initialize();
      expect(vaultIntegration.isInitialized()).toBe(true);
    });

    it('should load secrets for a config class', async () => {
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

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
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

      await vaultIntegration.initialize();
      await vaultIntegration.loadSecrets(TestVaultConfig);

      const health = vaultIntegration.getHealth();
      expect(health.connected).toBe(true);
      expect(health.authenticated).toBe(true);
      expect(health.cacheSize).toBeGreaterThan(0);
    });

    it('should invalidate cache entries', async () => {
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

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
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

      vaultIntegration = new VaultIntegration(VAULT_CONFIG);

      await expect(vaultIntegration.loadSecrets(TestVaultConfig))
        .rejects
        .toThrow('VaultIntegration not initialized');
    });

    it('should throw error with invalid token', async () => {
      if (process.env.SKIP_VAULT_TESTS) {
        return;
      }

      const invalidConfig: IVaultConfigOptions = {
        ...VAULT_CONFIG,
        auth: {
          methods: [
            {
              type: 'token',
              config: {
                type: 'token',
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

