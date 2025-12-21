import { NestFactory } from '@nestjs/core';

import { AppConfigService, initializeConfigit } from './config/config.service';
import { AppModule } from './app.module';

import 'reflect-metadata';

/**
 * Bootstrap NestJS application with Vault initialization
 *
 * IMPORTANT: Vault must be initialized BEFORE NestFactory.create()
 * because Sequelize needs database credentials during module initialization.
 */
async function bootstrap() {
  console.log('Starting NestJS application with Vault integration...\n');

  try {
    // Step 1: Initialize Configit + Vault BEFORE creating NestJS app
    // This loads database credentials from Vault
    console.log('Step 1: Initializing Vault and loading secrets...');
    await initializeConfigit();
    console.log('');

    // Step 2: Create NestJS application (Sequelize will now have credentials)
    console.log('Step 2: Creating NestJS application...');
    const app = await NestFactory.create(AppModule);

    // Get config service for health checks
    const configService = app.get(AppConfigService);

    // Step 3: Start server
    const port = process.env.PORT || 3000;
    await app.listen(port);

    console.log(`\n✓ Application is running on: http://localhost:${ port }`);
    console.log('\nTest endpoints:');
    console.log(`  GET http://localhost:${ port }/test/db - Query database`);
    console.log(`  GET http://localhost:${ port }/test/credentials - Show current credentials`);
    console.log(`  GET http://localhost:${ port }/test/vault-health - Show Vault health\n`);

    // Log credential rotation info
    const vaultHealth = configService.getVaultHealth();
    if (vaultHealth) {
      console.log('Vault health status:');
      console.log(`  Connected: ${ vaultHealth.connected }`);
      console.log(`  Cache size: ${ vaultHealth.cacheSize }`);
      console.log(`  Refresh queue: ${ vaultHealth.refreshQueueSize }`);
      console.log('');
    }
  } catch (error: any) {
    console.error('\n✗ Failed to start application:', error.message);
    if (error.message.includes('Vault')) {
      console.error('\nMake sure Vault is running:');
      console.error('  docker compose -f docker-compose.vault.yml up -d');
      console.error('  bash scripts/vault-setup.sh');
    }
    process.exit(1);
  }
}

bootstrap();
