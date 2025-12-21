#!/usr/bin/env npx ts-node
/**
 * GCP IAM Auth TTL Test
 *
 * Tests the scenario where GCP IAM auth token has a shorter TTL (10s)
 * than the secrets (60s), verifying that token refresh works correctly.
 *
 * Prerequisites:
 *   - Run: ./scripts/vault-setup.sh
 *   - GCP project must be created (not --skip-gcp)
 */

import * as fs from 'fs';
import * as path from 'path';
import { VaultIntegration } from '../src/vault/vault-integration';
import { VaultProvider } from '../src/vault/vault-provider';
import { IVaultConfigOptions } from '../src/vault/types';
import { VaultPath, VaultEngine, VaultKey } from '../src/vault/decorators';

// Force local Vault address
process.env.VAULT_ADDR = 'http://127.0.0.1:8200';

const VAULT_ADDR = 'http://127.0.0.1:8200';
const KEY_FILE = path.join(process.cwd(), 'secrets/gcp-sa-key.json');
const GCP_PROJECT_FILE = path.join(process.cwd(), '.gcp-test-project');

// Test config class with dynamic secret
class TestConfigWithDynamicSecret {
  @VaultEngine('database')
  @VaultPath('creds/configit-readonly')
  @VaultKey('username')
  dbUser?: string;

  @VaultEngine('database')
  @VaultPath('creds/configit-readonly')
  @VaultKey('password')
  dbPassword?: string;
}

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const NC = '\x1b[0m';

function log(msg: string, color: string = NC) {
  console.log(`${color}${msg}${NC}`);
}

function elapsed(start: number): string {
  return ((Date.now() - start) / 1000).toFixed(1);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest(): Promise<void> {
  log('\n============================================', BLUE);
  log('  GCP IAM Auth TTL Test', BLUE);
  log('============================================\n', BLUE);

  // Check prerequisites
  if (!fs.existsSync(KEY_FILE)) {
    log('ERROR: GCP key file not found', RED);
    log('Run: ./scripts/vault-setup.sh (without --skip-gcp)', YELLOW);
    process.exit(1);
  }

  if (!fs.existsSync(GCP_PROJECT_FILE)) {
    log('ERROR: GCP project file not found', RED);
    log('Run: ./scripts/vault-setup.sh (without --skip-gcp)', YELLOW);
    process.exit(1);
  }

  // Load service account info
  const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'));
  const serviceAccountEmail = keyData.client_email;
  log(`Service Account: ${serviceAccountEmail}`, CYAN);

  // Test 1: Verify GCP IAM auth works with short TTL role
  log('\n--- Test 1: GCP IAM Auth with 10s TTL ---', YELLOW);

  const vaultOptions: IVaultConfigOptions = {
    endpoint: VAULT_ADDR,
    auth: {
      method: 'gcp' as const,
      role: 'configit-gcp-role', // 10s TTL role
      serviceAccountKeyFile: KEY_FILE,
      serviceAccountEmail
    },
    tls: { enabled: false, verifyCertificate: false }
  };

  const provider = new VaultProvider(vaultOptions);
  const start1 = Date.now();

  try {
    await provider.connect();
    log(`✓ Initial GCP auth successful (${elapsed(start1)}s)`, GREEN);
  } catch (err: any) {
    log(`✗ GCP auth failed: ${err.message}`, RED);
    process.exit(1);
  }

  // Read a secret immediately
  const secret1 = await provider.readSecret('configit/api', 'kv2');
  log(`✓ Read KV secret: api_key=${secret1.data['api_key']?.slice(0, 10)}...`, GREEN);

  // Test 2: Wait for auth token to expire, then try to read again
  log('\n--- Test 2: Wait for Auth TTL (10s) to Expire ---', YELLOW);
  log('  Waiting 12 seconds for token to expire...', CYAN);

  await sleep(12000);

  log('  Token should be expired now, attempting to read...', CYAN);

  try {
    // This should fail or trigger re-auth
    const secret2 = await provider.readSecret('configit/api', 'kv2');
    log(`✗ Unexpectedly succeeded - secret: ${JSON.stringify(secret2.data)}`, RED);
    log('  This might mean token hasn\'t expired or was auto-renewed', YELLOW);
  } catch (err: any) {
    log(`✓ Expected: Token expired - ${err.message.slice(0, 50)}...`, GREEN);
  }

  // Test 3: Re-authenticate and verify
  log('\n--- Test 3: Re-authenticate After Expiry ---', YELLOW);
  const start3 = Date.now();

  await provider.connect(); // Should re-authenticate
  log(`✓ Re-authentication successful (${elapsed(start3)}s)`, GREEN);

  const secret3 = await provider.readSecret('configit/api', 'kv2');
  log(`✓ Read secret after re-auth: api_key=${secret3.data['api_key']?.slice(0, 10)}...`, GREEN);

  await provider.disconnect();

  // Test 4: VaultIntegration with dynamic secrets and short auth TTL
  log('\n--- Test 4: VaultIntegration with Short Auth TTL ---', YELLOW);
  log('  Testing: Auth TTL (10s) < Secret TTL (60s)', CYAN);
  log('  This verifies secrets stay valid even when auth expires', CYAN);

  const integration = new VaultIntegration({
    endpoint: VAULT_ADDR,
    auth: {
      method: 'gcp' as const,
      role: 'configit-gcp-role', // 10s TTL
      serviceAccountKeyFile: KEY_FILE,
      serviceAccountEmail
    },
    tls: { enabled: false, verifyCertificate: false },
    refreshBuffer: 5 // Refresh 5s before TTL expires
  });

  const testConfig = new TestConfigWithDynamicSecret();
  const start4 = Date.now();

  try {
    await integration.initialize();
    await integration.loadSecrets(testConfig);
    log(`✓ Initial load successful (${elapsed(start4)}s)`, GREEN);
    log(`  DB User: ${testConfig.dbUser}`, CYAN);
    log(`  DB Pass: ${testConfig.dbPassword?.slice(0, 10)}...`, CYAN);
  } catch (err: any) {
    log(`✗ Failed: ${err.message}`, RED);
    await integration.shutdown();
    process.exit(1);
  }

  // Get health to see refresh scheduling
  const health = integration.getHealth();
  log('\n  Health Status:', CYAN);
  log(`    Connected: ${health.connected}`, health.connected ? GREEN : RED);
  log(`    Cache Size: ${health.cacheSize}`, CYAN);
  log(`    Refresh Queue: ${health.refreshQueueSize}`, CYAN);

  // Test 5: Wait through multiple auth TTL cycles
  log('\n--- Test 5: Multiple Auth TTL Cycles ---', YELLOW);
  log('  Monitoring for 35 seconds (3+ auth TTL cycles)...', CYAN);

  const initialUser = testConfig.dbUser;
  let refreshCount = 0;
  const checkInterval = 5000; // Check every 5s
  const totalWait = 35000; // 35s total

  for (let waited = 0; waited < totalWait; waited += checkInterval) {
    await sleep(checkInterval);
    const currentHealth = integration.getHealth();
    const timeStr = `[${((waited + checkInterval) / 1000).toFixed(0)}s]`;

    log(`  ${timeStr} Cache: ${currentHealth.cacheSize}, Queue: ${currentHealth.refreshQueueSize}`, CYAN);

    // Check if secret was refreshed
    const newUser = testConfig.dbUser;
    if (newUser !== initialUser) {
      refreshCount++;
      log(`  ${timeStr} ✓ Secret REFRESHED: ${initialUser} -> ${newUser}`, GREEN);
    }

    // Log any errors
    if (currentHealth.errors.length > 0) {
      log(`  ${timeStr} Errors: ${currentHealth.errors.length}`, YELLOW);
      currentHealth.errors.slice(-2).forEach((e) => {
        log(`    - ${e.path}: ${e.error.slice(0, 40)}...`, YELLOW);
      });
    }
  }

  // Final check
  log('\n--- Final Verification ---', YELLOW);
  const finalUser = testConfig.dbUser;
  const finalPass = testConfig.dbPassword;

  if (finalUser && finalPass) {
    log(`✓ Secrets still available after 35s:`, GREEN);
    log(`  DB User: ${finalUser}`, CYAN);
    log(`  DB Pass: ${finalPass?.slice(0, 10)}...`, CYAN);
  } else {
    log(`✗ Secrets lost after auth cycles`, RED);
  }

  await integration.shutdown();

  // Summary
  log('\n============================================', BLUE);
  log('  Test Summary', BLUE);
  log('============================================', BLUE);
  log('  Auth Method: GCP IAM', CYAN);
  log('  Auth TTL: 10 seconds', CYAN);
  log('  Secret TTL: 60 seconds (database creds)', CYAN);
  log('  Test Duration: 35 seconds', CYAN);
  log(`  Secret Refreshes: ${refreshCount}`, refreshCount > 0 ? GREEN : YELLOW);
  log('\n  ✓ Test Complete', GREEN);
  log('============================================\n', BLUE);
}

runTest().catch((err) => {
  log(`\nFATAL ERROR: ${err.message}`, RED);
  console.error(err);
  process.exit(1);
});

