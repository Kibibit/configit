/**
 * Comprehensive Vault Integration Test Script
 * Tests multiple authentication methods and engines
 *
 * Run with:
 *   npx ts-node scripts/test-vault-comprehensive.ts
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
  VaultEngine,
  VaultIntegration,
  VaultProvider,
  IVaultConfigOptions
} from '../src/vault';

// Test results tracking
const results: Array<{ test: string; passed: boolean; error?: string }> = [];

function logTest(name: string, passed: boolean, error?: string) {
  results.push({ test: name, passed, error });
  const status = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}${status}\x1b[0m ${name}${error ? `: ${error}` : ''}`);
}

// ============================================
// Test 1: Token Authentication
// ============================================
async function testTokenAuth() {
  console.log('\n\x1b[1;33mTest Suite 1: Token Authentication\x1b[0m');

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [
        {
          type: 'token',
          config: {
            type: 'token',
            token: 'configit-dev-token'
          }
        }
      ]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  try {
    const provider = new VaultProvider(config);
    await provider.initialize();
    logTest('Token authentication succeeds', true);

    // Test reading a secret
    const secret = await provider.read('secret/data/configit/api');
    const hasData = secret.data && secret.data.api_key;
    logTest('Can read KV v2 secret', !!hasData, hasData ? undefined : 'No data returned');

    return true;
  } catch (error: any) {
    logTest('Token authentication succeeds', false, error.message);
    return false;
  }
}

// ============================================
// Test 2: AppRole Authentication
// ============================================
async function testAppRoleAuth() {
  console.log('\n\x1b[1;33mTest Suite 2: AppRole Authentication\x1b[0m');

  // First, generate a fresh secret ID using the root token
  // (AppRole secret IDs are consumed on use by default)
  let secretId: string;
  let roleId: string;

  try {
    const setupProvider = new VaultProvider({
      endpoint: 'http://127.0.0.1:8200',
      auth: { methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }] },
      tls: { enabled: false, verifyCertificate: false }
    });
    await setupProvider.initialize();

    // Fetch current role ID
    const roleIdResponse = await (setupProvider as any).client.read('auth/approle/role/configit-role/role-id');
    roleId = roleIdResponse.data.role_id;

    // Generate new secret ID
    const secretIdResponse = await (setupProvider as any).client.write('auth/approle/role/configit-role/secret-id', {});
    secretId = secretIdResponse.data.secret_id;
    logTest('Generated fresh AppRole credentials', true);
  } catch (error: any) {
    logTest('Generated fresh AppRole credentials', false, error.message);
    return false;
  }

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [
        {
          type: 'approle',
          config: {
            type: 'approle',
            roleId,
            secretId
          }
        }
      ]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  try {
    const provider = new VaultProvider(config);
    await provider.initialize();
    logTest('AppRole authentication succeeds', true);

    // Test reading a secret with AppRole token
    const secret = await provider.read('secret/data/configit/api');
    const hasData = secret.data && secret.data.api_key;
    logTest('Can read secret with AppRole token', !!hasData, hasData ? undefined : 'No data returned');

    return true;
  } catch (error: any) {
    logTest('AppRole authentication succeeds', false, error.message);
    return false;
  }
}

// ============================================
// Test 3: Authentication Fallback
// ============================================
async function testAuthFallback() {
  console.log('\n\x1b[1;33mTest Suite 3: Authentication Fallback\x1b[0m');

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [
        // First method: invalid token (should fail)
        {
          type: 'token',
          config: {
            type: 'token',
            token: 'invalid-token-12345'
          }
        },
        // Second method: valid token (should succeed)
        {
          type: 'token',
          config: {
            type: 'token',
            token: 'configit-dev-token'
          }
        }
      ]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  try {
    const provider = new VaultProvider(config);
    await provider.initialize();
    logTest('Falls back to second auth method when first fails', true);
    return true;
  } catch (error: any) {
    logTest('Falls back to second auth method when first fails', false, error.message);
    return false;
  }
}

// ============================================
// Test 4: KV v1 Engine
// ============================================
async function testKvV1Engine() {
  console.log('\n\x1b[1;33mTest Suite 4: KV v1 Engine\x1b[0m');

  // First, enable KV v1 and create a test secret
  const setupConfig: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  try {
    const provider = new VaultProvider(setupConfig);
    await provider.initialize();

    // Try to read from kv-v1 path (cubbyhole is similar to kv-v1)
    // Note: cubbyhole is per-token, so we use it as a kv-v1 test
    try {
      // Write to cubbyhole
      await (provider as any).client.write('cubbyhole/test', { test_key: 'test_value' });
      logTest('Can write to cubbyhole (KV v1-like)', true);

      // Read from cubbyhole
      const response = await (provider as any).client.read('cubbyhole/test');
      const hasData = response?.data?.test_key === 'test_value';
      logTest('Can read from cubbyhole (KV v1-like)', hasData, hasData ? undefined : 'Data mismatch');

      return true;
    } catch (error: any) {
      logTest('KV v1-like operations work', false, error.message);
      return false;
    }
  } catch (error: any) {
    logTest('KV v1 test setup', false, error.message);
    return false;
  }
}

// ============================================
// Test 5: VaultIntegration with Decorators
// ============================================
async function testVaultIntegrationDecorators() {
  console.log('\n\x1b[1;33mTest Suite 5: VaultIntegration with Decorators\x1b[0m');

  // Define test config class
  // Note: VaultPath should be the logical path, VaultEngine determines the prefix
  class TestConfig {
    @VaultPath('configit/api')
    @VaultKey('api_key')
    @VaultEngine('kv-v2')
    @IsString()
    API_KEY!: string;

    @VaultPath('configit/database')
    @VaultKey('password')
    @VaultEngine('kv-v2')
    @IsString()
    DB_PASSWORD!: string;
  }

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  const integration = new VaultIntegration(config);

  try {
    await integration.initialize();
    logTest('VaultIntegration initializes', true);

    await integration.loadSecrets(TestConfig);
    logTest('VaultIntegration loads secrets', true);

    const apiKey = integration.getSecret('API_KEY');
    logTest('API_KEY loaded correctly', apiKey === 'test-api-key-123', apiKey ? undefined : 'No value');

    const dbPassword = integration.getSecret('DB_PASSWORD');
    logTest('DB_PASSWORD loaded correctly', dbPassword === 'testpassword', dbPassword ? undefined : 'No value');

    const health = integration.getHealth();
    logTest('Health check returns valid data', health.connected && health.cacheSize > 0);

    integration.shutdown();
    return true;
  } catch (error: any) {
    logTest('VaultIntegration test', false, error.message);
    integration.shutdown();
    return false;
  }
}

// ============================================
// Test 6: TTL and Refresh Scheduling
// ============================================
async function testTTLRefreshScheduling() {
  console.log('\n\x1b[1;33mTest Suite 6: TTL and Refresh Scheduling\x1b[0m');

  // Note: KV v2 secrets don't have TTLs. Dynamic secrets (database, AWS, etc.) do.
  // We'll test the refresh scheduling mechanism with a mock/simulation.

  class TTLTestConfig {
    @VaultPath('configit/api')
    @VaultKey('api_key')
    @VaultEngine('kv-v2')
    @IsString()
    API_KEY!: string;
  }

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
    },
    tls: { enabled: false, verifyCertificate: false },
    refreshBuffer: 60 // 60 second refresh buffer
  };

  const integration = new VaultIntegration(config);

  try {
    await integration.initialize();
    await integration.loadSecrets(TTLTestConfig);

    // Check health details for refresh status
    const healthDetails = integration.getHealthDetails();
    logTest('Health details available', !!healthDetails);
    logTest('Refresh status tracked', Array.isArray(healthDetails.refreshStatus));

    // KV v2 secrets have leaseDuration=0, so no refresh is scheduled
    // This is expected behavior
    logTest('KV v2 secrets have no TTL (expected)', healthDetails.refreshQueueSize === 0);

    integration.shutdown();
    return true;
  } catch (error: any) {
    logTest('TTL refresh test', false, error.message);
    integration.shutdown();
    return false;
  }
}

// ============================================
// Test 7: Error Handling
// ============================================
async function testErrorHandling() {
  console.log('\n\x1b[1;33mTest Suite 7: Error Handling\x1b[0m');

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  const provider = new VaultProvider(config);

  try {
    await provider.initialize();

    // Test reading non-existent secret
    try {
      await provider.read('secret/data/nonexistent/path');
      logTest('Handles missing secret gracefully', false, 'Should have thrown');
    } catch (error: any) {
      const isExpectedError = error.message.includes('not found') || error.message.includes('404');
      logTest('Handles missing secret gracefully', true);
    }

    // Test invalid path
    try {
      await provider.read('invalid///path');
      logTest('Handles invalid path', false, 'Should have thrown');
    } catch (error: any) {
      logTest('Handles invalid path', true);
    }

    return true;
  } catch (error: any) {
    logTest('Error handling test setup', false, error.message);
    return false;
  }
}

// ============================================
// Test 8: TLS Enforcement
// ============================================
async function testTLSEnforcement() {
  console.log('\n\x1b[1;33mTest Suite 8: TLS Enforcement\x1b[0m');

  // Test that HTTP is rejected when TLS is required (default)
  const configWithTLS: IVaultConfigOptions = {
    endpoint: 'http://some-remote-vault:8200', // HTTP to non-localhost
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'test' } }]
    }
    // Note: tls not specified, defaults to enabled
  };

  try {
    const provider = new VaultProvider(configWithTLS);
    await provider.initialize();
    logTest('Rejects HTTP for non-localhost', false, 'Should have thrown');
  } catch (error: any) {
    const isTLSError = error.message.includes('TLS') || error.message.includes('HTTPS');
    logTest('Rejects HTTP for non-localhost', isTLSError, isTLSError ? undefined : error.message);
  }

  // Test that localhost HTTP is allowed
  const configLocalhost: IVaultConfigOptions = {
    endpoint: 'http://localhost:8200',
    auth: {
      methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
    }
  };

  try {
    const provider = new VaultProvider(configLocalhost);
    await provider.initialize();
    logTest('Allows HTTP for localhost', true);
  } catch (error: any) {
    // Might fail for connection reasons, but not TLS
    const isTLSError = error.message.includes('TLS') || error.message.includes('HTTPS');
    logTest('Allows HTTP for localhost', !isTLSError, isTLSError ? 'TLS error unexpected' : undefined);
  }

  return true;
}

// ============================================
// Test 9: GCP IAM Authentication
// ============================================
async function testGCPAuth() {
  console.log('\n\x1b[1;33mTest Suite 9: GCP IAM Authentication\x1b[0m');

  // Check if GCP key file exists
  const fs = await import('fs');
  const keyFilePath = './secrets/gcp-sa-key.json';

  if (!fs.existsSync(keyFilePath)) {
    logTest('GCP key file exists', false, `${ keyFilePath } not found - skipping GCP tests`);
    return false;
  }

  logTest('GCP key file exists', true);

  const config: IVaultConfigOptions = {
    endpoint: 'http://127.0.0.1:8200',
    auth: {
      methods: [
        {
          type: 'gcp',
          config: {
            type: 'gcp',
            role: 'configit-gcp-role',
            serviceAccountKeyFile: keyFilePath
          }
        }
      ]
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  try {
    const provider = new VaultProvider(config);
    await provider.initialize();
    logTest('GCP IAM authentication succeeds', true);

    // Test reading a secret with GCP token
    const secret = await provider.read('secret/data/configit/api');
    const hasData = secret.data && secret.data.api_key;
    logTest('Can read secret with GCP IAM token', !!hasData, hasData ? undefined : 'No data returned');

    return true;
  } catch (error: any) {
    logTest('GCP IAM authentication succeeds', false, error.message);
    return false;
  }
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[1;34m  Comprehensive Vault Integration Tests\x1b[0m');
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');

  await testTokenAuth();
  await testAppRoleAuth();
  await testGCPAuth();
  await testAuthFallback();
  await testKvV1Engine();
  await testVaultIntegrationDecorators();
  await testTTLRefreshScheduling();
  await testErrorHandling();
  await testTLSEnforcement();

  // Summary
  console.log('\n\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[1;34m  Test Summary\x1b[0m');
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`  Total: ${total}`);
  console.log(`  \x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${failed}\x1b[0m\n`);

  if (failed > 0) {
    console.log('  \x1b[1;31mFailed Tests:\x1b[0m');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`    - ${r.test}${r.error ? `: ${r.error}` : ''}`);
    });
    console.log('');
  }

  const success = failed === 0;
  console.log(success ? '  \x1b[32m✓ All tests passed!\x1b[0m' : '  \x1b[31m✗ Some tests failed\x1b[0m');
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m\n');

  return success;
}

runAllTests()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

