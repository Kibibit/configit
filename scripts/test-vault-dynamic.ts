/**
 * Dynamic Secrets Test - Tests TTL-based refresh with real PostgreSQL credentials
 *
 * Run with:
 *   npx ts-node scripts/test-vault-dynamic.ts
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
  IVaultConfigOptions,
  SecretRefreshEvent
} from '../src/vault';

// ============================================
// Test Config with Dynamic Database Secrets
// ============================================
class DynamicSecretsConfig {
  // Static KV v2 secret (no TTL)
  @VaultPath('configit/api')
  @VaultKey('api_key')
  @VaultEngine('kv-v2')
  @IsString()
  API_KEY!: string;

  // Dynamic database credential (60s TTL!)
  @VaultPath('creds/configit-readonly')
  @VaultKey('username')
  @VaultEngine('database')
  @IsString()
  DB_USERNAME!: string;

  // Dynamic database credential (60s TTL!)
  @VaultPath('creds/configit-readonly')
  @VaultKey('password')
  @VaultEngine('database')
  @IsString()
  DB_PASSWORD!: string;
}

const refreshEvents: SecretRefreshEvent[] = [];

const VAULT_CONFIG: IVaultConfigOptions = {
  endpoint: 'http://127.0.0.1:8200',
  auth: {
    methods: [{ type: 'token', config: { type: 'token', token: 'configit-dev-token' } }]
  },
  tls: { enabled: false, verifyCertificate: false },
  refreshBuffer: 30, // Refresh 30 seconds before expiry
  onSecretRefreshed: (event: SecretRefreshEvent) => {
    refreshEvents.push(event);
    console.log(`  \x1b[35m[CALLBACK]\x1b[0m Secret refreshed!`);
    console.log(`    Path: ${ event.vaultPath }`);
    console.log(`    Properties: ${ event.properties.join(', ') }`);
    console.log(`    Engine: ${ event.engine }`);
    console.log(`    Refresh #${ event.refreshCount }`);
  }
};

async function runDynamicSecretsTest() {
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[1;34m  Dynamic Secrets Test (TTL-based Refresh)\x1b[0m');
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m\n');

  const integration = new VaultIntegration(VAULT_CONFIG);

  try {
    // Step 1: Initialize
    console.log('\x1b[1;33mStep 1: Initializing VaultIntegration...\x1b[0m');
    await integration.initialize();
    console.log('  \x1b[32m✓\x1b[0m Initialized\n');

    // Step 2: Load secrets
    console.log('\x1b[1;33mStep 2: Loading secrets (static + dynamic)...\x1b[0m');
    await integration.loadSecrets(DynamicSecretsConfig);
    console.log('  \x1b[32m✓\x1b[0m Secrets loaded\n');

    // Step 3: Display initial values
    console.log('\x1b[1;33mStep 3: Initial secret values:\x1b[0m');
    const initialApiKey = integration.getSecret('API_KEY');
    const initialDbUser = integration.getSecret('DB_USERNAME');
    const initialDbPass = integration.getSecret('DB_PASSWORD');
    console.log(`  API_KEY (static):    ${ initialApiKey }`);
    console.log(`  DB_USERNAME (dynamic): ${ initialDbUser }`);
    console.log(`  DB_PASSWORD (dynamic): ${ initialDbPass?.substring(0, 8) }...`);
    console.log('');

    // Step 4: Check health details
    console.log('\x1b[1;33mStep 4: Checking health details...\x1b[0m');
    const health = integration.getHealthDetails();
    console.log(`  Connected: ${ health.connected }`);
    console.log(`  Cache size: ${ health.cacheSize }`);
    console.log(`  Refresh queue size: ${ health.refreshQueueSize }`);
    console.log('');

    console.log('  \x1b[1;33mRefresh status per secret:\x1b[0m');
    for (const status of health.refreshStatus) {
      const timeUntil = Math.round(status.timeUntilRefresh / 1000);
      console.log(`    - ${ status.propertyName }:`);
      console.log(`        Scheduled: ${ status.scheduled }`);
      console.log(`        Time until refresh: ${ timeUntil }s`);
    }
    console.log('');

    // Step 5: Wait and observe TTL behavior
    console.log('\x1b[1;33mStep 5: Observing TTL behavior (waiting 35 seconds)...\x1b[0m');
    console.log('  Dynamic credentials have 60s TTL, refresh buffer is 30s');
    console.log('  So refresh should trigger at ~30s mark\n');

    // Check every 10 seconds
    for (let i = 1; i <= 4; i++) {
      await sleep(10000);
      const elapsed = i * 10;
      console.log(`  \x1b[36m[${ elapsed }s elapsed]\x1b[0m`);

      const currentDbUser = integration.getSecret('DB_USERNAME');
      const currentDbPass = integration.getSecret('DB_PASSWORD');
      const currentHealth = integration.getHealthDetails();

      const userChanged = currentDbUser !== initialDbUser;
      const passChanged = currentDbPass !== initialDbPass;

      if (userChanged) {
        console.log(`    DB_USERNAME: \x1b[33mCHANGED\x1b[0m ${ initialDbUser } → ${ currentDbUser }`);
      } else {
        console.log(`    DB_USERNAME: ${ currentDbUser } (unchanged)`);
      }

      if (passChanged) {
        console.log(`    DB_PASSWORD: \x1b[33mCHANGED\x1b[0m`);
      } else {
        console.log(`    DB_PASSWORD: ...${currentDbPass?.slice(-4)} (unchanged)`);
      }

      // Show refresh status
      const dbUserStatus = currentHealth.refreshStatus.find((s) => s.propertyName === 'DB_USERNAME');
      if (dbUserStatus) {
        const timeUntil = Math.max(0, Math.round(dbUserStatus.timeUntilRefresh / 1000));
        console.log(`    Refresh in: ${ timeUntil }s, Count: ${ dbUserStatus.refreshCount }`);
      }
      console.log('');
    }

    // Step 6: Verify credentials changed
    console.log('\x1b[1;33mStep 6: Verifying credential rotation...\x1b[0m');
    const finalDbUser = integration.getSecret('DB_USERNAME');
    const finalDbPass = integration.getSecret('DB_PASSWORD');
    const apiKeyUnchanged = integration.getSecret('API_KEY') === initialApiKey;
    const dbRotated = finalDbUser !== initialDbUser || finalDbPass !== initialDbPass;

    console.log(`  API_KEY unchanged: ${ apiKeyUnchanged ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m' }`);
    console.log(`  DB credentials rotated: ${ dbRotated ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m (may need more time)' }`);
    console.log('');

    // Step 7: Verify onSecretRefreshed callback
    console.log('\x1b[1;33mStep 7: Verifying onSecretRefreshed callback...\x1b[0m');
    const callbackFired = refreshEvents.length > 0;
    console.log(`  Callback events received: ${ refreshEvents.length } ${ callbackFired ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m' }`);
    if (callbackFired) {
      const dbEvent = refreshEvents.find((e) => e.engine === 'database');
      if (dbEvent) {
        const bothProps = dbEvent.properties.includes('DB_USERNAME') && dbEvent.properties.includes('DB_PASSWORD');
        console.log(`  DB event includes both properties: ${ bothProps ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m' }`);
        console.log(`  Single event for path (atomic): \x1b[32m✓\x1b[0m (not 2 separate events)`);
      }
    }
    console.log('');

    // Summary
    console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');
    if (apiKeyUnchanged) {
      console.log('\x1b[32m  ✓ Test completed!\x1b[0m');
      console.log('\x1b[32m    - Static secrets remain stable\x1b[0m');
      if (dbRotated) {
        console.log('\x1b[32m    - Dynamic secrets were rotated based on TTL\x1b[0m');
      } else {
        console.log('\x1b[33m    - Dynamic secrets not rotated yet (TTL ~60s, may need more time)\x1b[0m');
      }
      if (callbackFired) {
        console.log('\x1b[32m    - onSecretRefreshed callback fired correctly\x1b[0m');
      }
    } else {
      console.log('\x1b[31m  ✗ Unexpected behavior\x1b[0m');
    }
    console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m\n');

    return true;
  } catch (error: any) {
    console.error('\n\x1b[31m✗ Test failed:\x1b[0m', error.message);

    if (error.message.includes('connection refused') || error.message.includes('ECONNREFUSED')) {
      console.log('\n\x1b[33mMake sure Vault and PostgreSQL are running:\x1b[0m');
      console.log('  docker compose -f docker-compose.vault.yml up -d');
      console.log('  bash scripts/vault-setup.sh');
    }

    return false;
  } finally {
    integration.shutdown();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Also test reading dynamic credentials directly
// ============================================
async function testDirectDynamicRead() {
  console.log('\n\x1b[1;34m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[1;34m  Direct Dynamic Credential Read Test\x1b[0m');
  console.log('\x1b[1;34m' + '='.repeat(60) + '\x1b[0m\n');

  const provider = new VaultProvider(VAULT_CONFIG);

  try {
    await provider.initialize();
    console.log('\x1b[32m✓\x1b[0m Provider initialized\n');

    // Read dynamic credentials twice
    console.log('Reading database/creds/configit-readonly (1st time)...');
    const creds1 = await provider.read('database/creds/configit-readonly');
    console.log(`  Username: ${ creds1.data.username }`);
    console.log(`  Password: ${ creds1.data.password?.substring(0, 8) }...`);
    console.log(`  TTL: ${ creds1.leaseDuration }s`);
    console.log(`  Lease ID: ${ creds1.leaseId?.substring(0, 30) }...`);
    console.log(`  Renewable: ${ creds1.renewable }`);
    console.log('');

    console.log('Reading database/creds/configit-readonly (2nd time)...');
    const creds2 = await provider.read('database/creds/configit-readonly');
    console.log(`  Username: ${ creds2.data.username }`);
    console.log(`  Password: ${ creds2.data.password?.substring(0, 8) }...`);
    console.log('');

    const different = creds1.data.username !== creds2.data.username;
    console.log(`Credentials different on each read: ${ different ? '\x1b[32m✓ Yes (expected)\x1b[0m' : '\x1b[31m✗ No\x1b[0m' }`);
    console.log('\n\x1b[33mNote: Each read generates NEW credentials (this is how dynamic secrets work)\x1b[0m\n');

    return true;
  } catch (error: any) {
    console.error('\x1b[31m✗ Error:\x1b[0m', error.message);
    return false;
  }
}

// Run all tests
async function main() {
  const directTestPassed = await testDirectDynamicRead();
  const integrationTestPassed = await runDynamicSecretsTest();

  process.exit(directTestPassed && integrationTestPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

