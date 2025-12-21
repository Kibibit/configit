/**
 * Standalone Vault Integration Test Script
 * 
 * Run with:
 *   npx ts-node scripts/test-vault.ts
 * 
 * Prerequisites:
 *   docker compose -f docker-compose.vault.yml up -d
 *   bash scripts/vault-setup.sh
 */

import 'reflect-metadata';
import { IsString } from 'class-validator';
import {
  VaultPath,
  VaultKey,
  VaultIntegration,
  IVaultConfigOptions
} from '../src/vault';

/**
 * Test configuration class with Vault secrets
 */
class TestVaultConfig {
  @VaultPath('secret/data/configit/api')
  @VaultKey('api_key')
  @IsString()
  API_KEY!: string;

  @VaultPath('secret/data/configit/api')
  @VaultKey('api_secret')
  @IsString()
  API_SECRET!: string;

  @VaultPath('secret/data/configit/database')
  @VaultKey('host')
  @IsString()
  DB_HOST!: string;

  @VaultPath('secret/data/configit/database')
  @VaultKey('port')
  @IsString()
  DB_PORT!: string;

  @VaultPath('secret/data/configit/database')
  @VaultKey('username')
  @IsString()
  DB_USERNAME!: string;

  @VaultPath('secret/data/configit/database')
  @VaultKey('password')
  @IsString()
  DB_PASSWORD!: string;

  @VaultPath('secret/data/configit/features')
  @VaultKey('enable_beta')
  @IsString()
  ENABLE_BETA!: string;

  @VaultPath('secret/data/configit/features')
  @VaultKey('max_connections')
  @IsString()
  MAX_CONNECTIONS!: string;
}

// Use LOCAL_VAULT_* env vars to avoid conflict with production VAULT_* vars
const VAULT_CONFIG: IVaultConfigOptions = {
  endpoint: process.env.LOCAL_VAULT_ADDR || 'http://127.0.0.1:8200',
  auth: {
    methods: [
      {
        type: 'token',
        config: {
          type: 'token',
          token: process.env.LOCAL_VAULT_TOKEN || 'configit-dev-token'
        }
      }
    ]
  },
  tls: {
    enabled: false,
    verifyCertificate: false
  }
};

async function runTests() {
  console.log('='.repeat(50));
  console.log('  Configit Vault Integration Test');
  console.log('='.repeat(50));
  console.log('');

  const integration = new VaultIntegration(VAULT_CONFIG);

  try {
    // Test 1: Initialize
    console.log('Test 1: Initializing Vault connection...');
    await integration.initialize();
    console.log('  ✓ Initialized successfully\n');

    // Test 2: Load secrets
    console.log('Test 2: Loading secrets from Vault...');
    await integration.loadSecrets(TestVaultConfig);
    console.log('  ✓ Secrets loaded\n');

    // Test 3: Verify secrets
    console.log('Test 3: Verifying secret values...');
    const expectedSecrets = {
      API_KEY: 'test-api-key-123',
      API_SECRET: 'test-api-secret-xyz',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'testuser',
      DB_PASSWORD: 'testpassword',
      ENABLE_BETA: 'true',
      MAX_CONNECTIONS: '100'
    };

    let allPassed = true;
    for (const [ key, expected ] of Object.entries(expectedSecrets)) {
      const actual = integration.getSecret(key);
      const passed = actual === expected;
      const status = passed ? '✓' : '✗';
      console.log(`  ${ status } ${ key }: ${ passed ? 'correct' : `expected "${ expected }", got "${ actual }"` }`);
      if (!passed) {
        allPassed = false;
      }
    }
    console.log('');

    // Test 4: Health check
    console.log('Test 4: Checking health status...');
    const health = integration.getHealth();
    console.log(`  Connected: ${ health.connected }`);
    console.log(`  Authenticated: ${ health.authenticated }`);
    console.log(`  Cache size: ${ health.cacheSize }`);
    console.log(`  Errors: ${ health.errors.length }`);
    console.log('');

    // Test 5: Cache invalidation
    console.log('Test 5: Testing cache invalidation...');
    const beforeInvalidate = integration.getSecret('API_KEY');
    integration.invalidateProperty('API_KEY');
    const afterInvalidate = integration.getSecret('API_KEY');
    if (beforeInvalidate === 'test-api-key-123' && afterInvalidate === null) {
      console.log('  ✓ Cache invalidation works correctly\n');
    } else {
      console.log('  ✗ Cache invalidation failed\n');
      allPassed = false;
    }

    // Summary
    console.log('='.repeat(50));
    if (allPassed) {
      console.log('  ✓ All tests passed!');
    } else {
      console.log('  ✗ Some tests failed');
    }
    console.log('='.repeat(50));

    return allPassed;
  } catch (error: any) {
    console.error('');
    console.error('✗ Test failed with error:', error.message);
    console.error('');
    console.error('Make sure Vault is running:');
    console.error('  docker compose -f docker-compose.vault.yml up -d');
    console.error('  bash scripts/vault-setup.sh');
    return false;
  } finally {
    integration.shutdown();
  }
}

runTests()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

